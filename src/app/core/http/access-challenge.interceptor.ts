import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import {
  ACCESS_CHALLENGE,
  ACCESS_CHALLENGE_RESOLVER,
  APPROVAL_HEADER,
  classifyAccessChallenge,
  type ChallengeAnswer,
} from '../access-challenge/access-challenge';
import { conLimiteDeEspera } from './timeout.interceptor';

/** Cuántos desafíos seguidos se resuelven en una misma petición: motivo, segundo paso y aprobación. */
export const MAX_CHALLENGE_ROUNDS = 3;

/**
 * Resuelve los **desafíos de acceso** de las peticiones que lo piden (`withAccessChallenge()`): 422 `REASON_REQUIRED`,
 * 403 `STEP_UP_REQUIRED` y 403 `APPROVAL_REQUIRED`. Abre el diálogo por el resolvedor de la aplicación y reintenta la
 * **misma petición** con lo que la persona aportó: el motivo en el cuerpo y la aprobación en `X-Approval-Id`. El segundo
 * paso no cambia la petición (la API lo recuerda por sesión).
 *
 * No toca nada más: sin la marca, un desafío llega a quien llama como cualquier 403 o 422. Un desafío que no se puede
 * resolver (`BLOCKED`) tampoco se reintenta. La autoridad es la API: si el reintento vuelve a fallar, el error sigue su camino.
 *
 * ## Qué no hace (F1, F5)
 *
 * - **No pone la espera del diálogo bajo el límite de 30 s.** `timeoutInterceptor` salta las peticiones marcadas y el
 *   límite se aplica aquí, solo alrededor de cada `next(req)`: la persona puede tardar minutos en escribir el motivo,
 *   teclear el código o esperar la aprobación sin que el diálogo se destruya.
 * - **No reenvía una petición distinta de la original.** Solo reintenta 403/409/422 con un `reason` de desafío conocido
 *   (`classifyAccessChallenge` comprueba también el estado); el motivo solo se escribe en un cuerpo objeto o ausente (nunca
 *   reemplaza un array ni un FormData, ni le da cuerpo a un GET/HEAD); si el cuerpo no puede llevarlo, el error sigue su
 *   camino sin abrir el diálogo.
 */
export const accessChallengeInterceptor: HttpInterceptorFn = (request, next) => {
  const options = request.context.get(ACCESS_CHALLENGE);
  if (options === null) return next(request);
  const resolver = inject(ACCESS_CHALLENGE_RESOLVER);
  if (resolver === null) return conLimiteDeEspera(request, next(request));

  const attempt = (req: HttpRequest<unknown>, round: number): ReturnType<typeof next> =>
    conLimiteDeEspera(req, next(req)).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof HttpErrorResponse) || round >= MAX_CHALLENGE_ROUNDS)
          return throwError(() => error);
        const challenge = classifyAccessChallenge(error);
        if (challenge === null || challenge.kind === 'BLOCKED') return throwError(() => error);
        // Un motivo no cabe en un array, un FormData ni un GET: no se pregunta lo que no se puede aplicar.
        if (challenge.kind === 'REASON' && !canCarryReason(req)) return throwError(() => error);
        return resolver.resolve(challenge, options).pipe(
          switchMap((answer) => {
            const retried = withAnswer(req, answer, options.reasonField);
            return retried === null ? throwError(() => error) : attempt(retried, round + 1);
          }),
        );
      }),
    );

  return attempt(request, 0);
};

/** ¿Es un objeto «plano» (`{}` literal o sin prototipo)? Un array, un FormData, un Blob o un texto no lo son. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** El motivo va en el cuerpo: solo si hay un cuerpo objeto (o ninguno, en un método que admite cuerpo). */
function canCarryReason(request: HttpRequest<unknown>): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return false;
  return request.body === null || request.body === undefined || isPlainObject(request.body);
}

/**
 * La petición de nuevo, con el motivo en el cuerpo y la aprobación en el encabezado; `null` si el motivo no cabe
 * (no se manda una petición distinta de la original).
 */
function withAnswer(
  request: HttpRequest<unknown>,
  answer: ChallengeAnswer,
  reasonField: string,
): HttpRequest<unknown> | null {
  let next = request;
  if (answer.approvalId !== undefined)
    next = next.clone({ setHeaders: { [APPROVAL_HEADER]: answer.approvalId } });
  if (answer.reasonText !== undefined) {
    if (!canCarryReason(request)) return null;
    const body = isPlainObject(next.body) ? next.body : {};
    next = next.clone({ body: { ...body, [reasonField]: answer.reasonText } });
  }
  return next;
}
