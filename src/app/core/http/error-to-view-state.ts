import { HttpErrorResponse } from '@angular/common/http';

import {
  forbidden,
  notFound,
  offline,
  unexpectedError,
  validation,
} from '../view-state/view-state';
import type { ViewState, ViewStateIssue } from '../view-state/view-state.types';
import { isTenantDenialReason, tenantDenialHint, tenantDenialText } from '../data-access/iam/tenant-denial';
import { accessErrorText } from '../data-access/access-governance/access-errors';
import { safeReturnUrl } from '../auth/return-url';
import { TENANT_SELECTION_ROUTE } from '../auth/tenant-selection-route';
import { readApiError, type ApiErrorBody } from './api-error';
import { explainFailure, explanationOf, isTimeout, type ErrorExplanation } from './error-explanation';
import { issuesOf } from './validation-issues';

/**
 * A dónde lleva la puerta cuando falta verificar la identidad.
 *
 * Es una ruta **del router**, y esa precisión es la corrección de un defecto
 * real: antes valía `'/identity/me'`, que es la ruta de la **API**. Ninguna
 * ruta de Angular coincidía, así que la acción de S5 mandaba al comodín — un
 * muro con cartel de puerta, que es peor que un muro.
 *
 * La pantalla que la atiende es `features/identity-verification/`, que encadena
 * `FilesClient.upload` con `IdentityClient.requestPatientIdentityVerification`.
 *
 * **Desde el 2026-09-10 vive dentro del centro de verificación** —una pantalla
 * con dos pestañas, `identity-hub/`— y esta constante apunta ahí. La dirección
 * anterior, `/my-account/identity/verify`, sigue redirigiendo: está en
 * historiales y en los correos ya enviados. Lo que **no** puede pasar es que la
 * constante y el registro de navegación digan cosas distintas, y hay una prueba
 * en `navigation.map.spec.ts` que lo impide.
 */
export const IDENTITY_VERIFICATION_ROUTE = '/my-account/identity';

/** `/auth/organization` con `returnUrl` a la pantalla actual (sólo en el navegador y sólo si es una ruta interna). */
function tenantSelectionRoute(): string {
  const place = (globalThis as { location?: { pathname: string; search: string } }).location;
  const current = place === undefined ? null : safeReturnUrl(`${place.pathname}${place.search}`);
  return current === null || current === '/' || current.startsWith('/auth/')
    ? TENANT_SELECTION_ROUTE
    : `${TENANT_SELECTION_ROUTE}?returnUrl=${encodeURIComponent(current)}`;
}

/**
 * Traduce un fallo de la API a uno de los 9 estados de UX del M34.
 *
 * El mapeo se apoya en `error.code`, no en el estado HTTP ni en el mensaje: el
 * backend declara los códigos como parte del contrato y los mensajes como texto
 * humano que puede cambiar de redacción. Dos códigos distintos comparten el 403
 * y hay que separarlos, así que el estado HTTP no alcanza.
 *
 * Referencia: `docs/api/error-model.md` del backend.
 */
export function errorToViewState<T>(error: unknown): ViewState<T> {
  if (!(error instanceof HttpErrorResponse)) {
    return explained('sin-id', explanationOf('client'));
  }

  // Estado 0 es «la petición no llegó»: sin conexión, DNS caído o CORS. Nunca
  // trae cuerpo de la API, así que se resuelve antes de intentar leerlo.
  if (error.status === 0) {
    return isTimeout(error) ? offline(undefined, { timedOut: true }) : offline();
  }

  const body = readApiError(error);
  if (body === null) {
    // Respuesta sin la forma del contrato: un proxy, un balanceador, un 502.
    // Lo que diga ese cuerpo no se muestra: la explicación sale del estado HTTP.
    return explained(correlationOf(error, null), explainFailure(error, null));
  }

  // Sólo el id que mandó la API: en S4 y S5 es opcional, así que no se inventa
  // un «sin-id» que nadie podría buscar.
  const requestId = body.correlationId;

  // Falta fijar organización (403/412/422 con `details.reason`): no es un muro, es una puerta. Quien tiene alcance de
  // plataforma no es redirigido por el interceptor; la pantalla lo dice (S5) y ofrece elegir, volviendo luego a ella.
  const reason = body.details?.['reason'];
  if (reason === 'TENANT_REQUIRED' || reason === 'TENANT_AMBIGUOUS') {
    return forbidden({
      message: 'Esta información pertenece a una organización. Elija cuál desea ver.',
      nextAction: { label: 'Elegir organización', route: tenantSelectionRoute() },
      ...(requestId === undefined ? {} : { requestId }),
    });
  }

  switch (body.code) {
    // --- S4 · validación o conflicto ---------------------------------------
    case 'VALIDATION_FAILED':
      return validation(issuesOf(body), undefined, requestId);

    case 'CONFLICT':
      return validation([{ message: body.message, code: body.code }], undefined, requestId);

    /**
     * Escritura concurrente: para la persona es «alguien cambió esto mientras
     * lo editabas», que se resuelve releyendo. Es el mismo S4, pero conviene que
     * el mensaje lo diga.
     */
    case 'CONCURRENCY_CONFLICT':
      return validation([
        {
          message: body.message || 'Otra persona modificó este dato mientras lo editaba.',
          code: body.code,
        },
      ], undefined, requestId);

    case 'PRECONDITION_FAILED':
      return validation([{ message: body.message, code: body.code }], undefined, requestId);

    case 'PAYLOAD_TOO_LARGE':
      return validation(
        [{ message: body.message || sentenceOf(explanationOf('too-large')), code: body.code }],
        undefined,
        requestId,
      );

    case 'RATE_LIMITED':
      return validation(
        [{ message: body.message || sentenceOf(explanationOf('rate-limited')), code: body.code }],
        retryAfterOf(error),
        requestId,
      );

    // --- S5 · prohibido ----------------------------------------------------
    /**
     * El muro: no hay nada que la persona pueda hacer desde la interfaz, así que
     * **no se le ofrece una acción**. Inventar una sería mandarla a un lugar
     * donde tampoco va a poder.
     */
    case 'FORBIDDEN': {
      // 403 de una organización que **niega ahora** a la persona (política de sesión): trae el motivo estable en
      // `details.reason` y `details.tenantId`. No es un permiso que falta ni cierra la sesión: se dice qué pasa y qué hacer.
      const denial = tenantDenialOf(body);
      if (denial !== null) {
        return forbidden({
          message: `${denial.message} ${tenantDenialHint(denial.reason)}`,
          ...(denial.reason === 'MFA_ENROLLMENT_REQUIRED' ? { nextAction: { label: 'Activar verificación en dos pasos', route: '/my-account/security/mfa' } } : {}),
          ...(requestId === undefined ? {} : { requestId }),
        });
      }
      // 403 del gobierno de accesos (paso extra, aprobación, regla de la organización…): el texto en lenguaje simple por `reason`.
      // Quien puede resolverlo (`withAccessChallenge`) ya lo intentó; lo que llega acá es un muro o un desafío no resuelto.
      return forbidden({ message: accessErrorText(body.reason) ?? body.message, ...(requestId === undefined ? {} : { requestId }) });
    }

    /**
     * La puerta. Mismo 403, estado opuesto: hay algo que la persona puede hacer,
     * y por eso este estado **sí** lleva acción.
     */
    case 'IDENTITY_VERIFICATION_REQUIRED':
      return forbidden({
        message: body.message || 'Necesita verificar su identidad para continuar.',
        nextAction: { label: 'Verificar identidad', route: IDENTITY_VERIFICATION_ROUTE },
        ...(requestId === undefined ? {} : { requestId }),
      });

    // --- S6 · no encontrado, sin filtrar existencia -------------------------
    /**
     * Se descarta `message` y `details` a propósito. El backend puede incluir el
     * identificador buscado, y repetirlo en pantalla confirmaría que la persona
     * consultó por algo concreto. El estado S6 del M34 existe justamente para no
     * revelar si el recurso existe.
     */
    case 'NOT_FOUND':
      return notFound();

    // --- S9 · error inesperado ---------------------------------------------
    case 'DEPENDENCY_UNAVAILABLE':
      return explained(correlationOf(error, body), explanationOf('unavailable'));

    /**
     * `UNAUTHENTICATED` llega acá sólo si el interceptor de autenticación ya
     * agotó su intento de refresco: cuando eso pasa, la sesión ya se cerró y se
     * navegó al login, así que no hay nada que mostrar en la pantalla anterior.
     *
     * `body.message` **no** se muestra: en un 5xx la API ya lo censura a «Error
     * interno del servidor», que no le dice nada a la persona, y si algún día
     * un fallo se escapara sin censurar, el front no lo repetiría.
     */
    case 'UNAUTHENTICATED':
    case 'INTERNAL':
    default:
      return explained(correlationOf(error, body), explainFailure(error, body));
  }
}

/** S9 con la explicación fija del catálogo: causa como mensaje, acción como pista. */
function explained<T>(requestId: string, explanation: ErrorExplanation): ViewState<T> {
  return unexpectedError(requestId, explanation.cause, {
    title: explanation.title,
    hint: explanation.action,
  });
}

/** Causa y acción en un solo texto, para donde no hay título aparte. */
function sentenceOf(explanation: ErrorExplanation): string {
  return `${explanation.cause} ${explanation.action}`;
}



/** El identificador que conecta el reporte de la persona con los registros. */
function correlationOf(error: HttpErrorResponse, body: ApiErrorBody | null): string {
  return body?.correlationId ?? error.headers.get('x-request-id') ?? 'sin-id';
}

/** Segundos hasta poder reintentar, si el servidor los declara. */
function retryAfterOf(error: HttpErrorResponse): number | undefined {
  const header = error.headers.get('retry-after');
  if (header === null) {
    return undefined;
  }

  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

/**
 * El 403 de una organización que niega ahora a la persona: `reason` y `details: { tenantId, reason }` con uno de los
 * cinco motivos (`OUTSIDE_ALLOWED_HOURS`, `OUTSIDE_ALLOWED_NETWORK`, `IDLE_TIMEOUT`, `MFA_REQUIRED`,
 * `MFA_ENROLLMENT_REQUIRED`), o `null` si es otro 403. El token de alcance limitado trae `MFA_ENROLLMENT_REQUIRED` sin
 * `tenantId` (la API lo exige en todo salvo el alta del factor): también se dice con ese motivo.
 */
function tenantDenialOf(body: ApiErrorBody): { readonly reason: string; readonly message: string } | null {
  const reason = body.details?.['reason'];
  if (!isTenantDenialReason(reason)) return null;
  const donde = typeof body.details?.['tenantId'] === 'string' ? 'La organización que eligió' : 'Su cuenta';
  return { reason, message: `${donde} no le permite actuar ahora: ${tenantDenialText(reason)}.` };
}
