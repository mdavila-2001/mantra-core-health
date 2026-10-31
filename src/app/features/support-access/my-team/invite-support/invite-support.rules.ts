import { HttpErrorResponse } from '@angular/common/http';

import { roleAssignmentState } from '../../../../core/data-access/role-assignments/role-assignment-status';
import type { MyRoleAssignment } from '../../../../core/data-access/practice-sites/practice-sites.types';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import type { TeamMemberInitiator } from '../../../../core/data-access/support-access/support-invite.types';
import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/* ============================================================================
    Reglas de «Invitar a una secretaria», sin Angular: se prueban sin montar nada.
    El texto de la interfaz va en «usted», como el resto de «Mi equipo».
   ========================================================================== */

/** Largo que admite la API para el documento (`PractitionerInviteSupportDto.nationalId`). */
export const DOCUMENTO_MINIMO = 4;
export const DOCUMENTO_MAXIMO = 40;

/** Lo que la API acepta de un documento: letras, dígitos, punto y guion (`NATIONAL_ID_PATTERN`). */
const PATRON_DOCUMENTO = /^[A-Za-z0-9.-]+$/;

/**
 * El documento tal como viaja: sin espacios a los lados y nada más. No se le quitan puntos, guiones ni ceros:
 * la API busca a la secretaria por el texto que recibe, tal cual, así que «7.005.002» no es «7005002».
 */
export function documentoParaEnviar(crudo: string): string {
  return crudo.trim();
}

/**
 * Por qué el documento no se puede enviar todavía, o `null` si está bien.
 *
 * Es la validación del DTO de la API (`PractitionerInviteSupportDto.nationalId`: de 4 a 40 caracteres y solo letras,
 * dígitos, punto y guion), dicha antes de pedir. No mira el contenido: un documento como «00012» o «....» pasa
 * este control y la API contestará que no hay una secretaria con él. Ella sigue siendo quien decide si existe.
 */
export function errorDelDocumento(crudo: string): string | null {
  const documento = documentoParaEnviar(crudo);
  if (documento === '') return 'Escriba el documento de identidad de la secretaria.';
  if (!PATRON_DOCUMENTO.test(documento)) {
    return 'El documento solo admite letras, dígitos, punto y guion, sin espacios.';
  }
  if (documento.length < DOCUMENTO_MINIMO) return `El documento tiene al menos ${DOCUMENTO_MINIMO} caracteres.`;
  if (documento.length > DOCUMENTO_MAXIMO) return `El documento tiene como máximo ${DOCUMENTO_MAXIMO} caracteres.`;
  return null;
}

/** Sus vinculaciones activas con un hospital: es donde una secretaria lo puede asistir. La API vuelve a comprobarlo. */
export function vinculacionesInvitables(todas: readonly MyRoleAssignment[]): readonly MyRoleAssignment[] {
  return todas.filter((v) => v.statusCode !== undefined && roleAssignmentState(v.statusCode) === 'ACTIVE');
}

/** Cómo se nombra una vinculación al elegirla: el hospital y, si es por procedimiento, cuál. */
export function opcionesDeVinculacion(vinculaciones: readonly MyRoleAssignment[]): readonly SelectOption<string>[] {
  return vinculaciones.map((v) => ({
    value: v.id,
    label: v.serviceDisplay === undefined ? v.practiceName : `${v.practiceName} · ${v.serviceDisplay}`,
    ...(v.practiceType === undefined ? {} : { description: v.practiceType }),
  }));
}

/** Si el integrante de «Mi equipo» es una invitación del doctor que la secretaria todavía no respondió. */
export function esInvitacionSinResponder(miembro: DoctorTeamMember): boolean {
  const { awaiting, initiatedBy } = miembro as DoctorTeamMember & TeamMemberInitiator;
  // `PENDING` es el estado del vínculo en la API (`SupportLinkViewDto`); `PENDING_ACCEPTANCE`, el del simulador.
  const pendiente = (miembro.status as string) === 'PENDING' || miembro.status === 'PENDING_ACCEPTANCE';
  return pendiente && awaiting === 'SUPPORT_STAFF' && initiatedBy === 'PRACTITIONER';
}

/**
 * Clave estable de un integrante o invitación: `delegateId` si lo trae y, si no, el `id` del vínculo. La API real
 * manda `SupportLinkViewDto` (con `id`, sin `delegateId`); sin esto, la clave de la lista y el `data-testid` serían
 * `undefined` y se repetirían.
 */
export function claveDeInvitacion(miembro: DoctorTeamMember): string {
  const { id } = miembro as DoctorTeamMember & TeamMemberInitiator;
  return (miembro.delegateId as string | undefined) ?? id ?? '';
}

/** Cuándo se envió la invitación (ISO 8601), si el integrante la trae. */
export function enviadaEl(miembro: DoctorTeamMember): string | undefined {
  return (miembro as DoctorTeamMember & TeamMemberInitiator).createdAt;
}

/** Espera sugerida tras un límite de peticiones que no dice cuánto esperar. */
export const ESPERA_POR_DEFECTO_SEGUNDOS = 30;

/** Un rechazo de la invitación, dicho en palabras y, si es de un campo, anclado a él. */
export interface RechazoDeLaInvitacion {
  readonly campo: 'documento' | 'vinculacion' | null;
  readonly mensaje: string;
  /** El `correlationId` de la API, para que soporte lo encuentre. */
  readonly requestId?: string;
  /** Si repetir el mismo envío puede salir bien (la red o el servidor), en vez de pedir corregir algo. */
  readonly reintentable: boolean;
  /** Segundos que conviene esperar antes de reintentar (límite de peticiones). */
  readonly esperarSegundos?: number;
}

/**
 * Traduce el fallo de `POST /me/practitioner/support-invitations`.
 *
 * Se ramifica por el `reason` de la API, nunca por el texto. `errorToViewState` solo no alcanza: un 404 pasa a «no
 * encontrado» sin mensaje (a propósito, para no filtrar existencia) y acá el 404 es una respuesta legítima que la
 * persona tiene que poder leer.
 */
export function rechazoDeLaInvitacion(fallo: unknown): RechazoDeLaInvitacion {
  if (fallo instanceof HttpErrorResponse) {
    const cuerpo = readApiError(fallo);
    const requestId = cuerpo?.correlationId;
    const conId = requestId === undefined ? {} : { requestId };
    if (cuerpo?.code === 'RATE_LIMITED') {
      // Sin `Retry-After` se espera un rato razonable en vez de dejar el botón apagado para siempre.
      const estado = errorToViewState<unknown>(fallo);
      const indicada = estado.status === 'validation' ? estado.retryAfterSeconds : undefined;
      return {
        campo: null,
        mensaje: 'Se hicieron demasiados intentos seguidos. Espere unos segundos y vuelva a intentar.',
        reintentable: true,
        esperarSegundos: indicada ?? ESPERA_POR_DEFECTO_SEGUNDOS,
        ...conId,
      };
    }
    switch (cuerpo?.reason) {
      case 'SUPPORT_STAFF_NOT_FOUND':
        return {
          campo: 'documento',
          mensaje:
            'No hay una secretaria registrada con ese documento. Revíselo; si está bien, ella tiene que registrarse antes de que usted la invite.',
          reintentable: false,
          ...conId,
        };
      case 'SUPPORT_TARGET_NOT_FOUND':
        return {
          campo: 'vinculacion',
          mensaje: 'Esa vinculación ya no está disponible. Elija otra o vuelva a abrir el formulario.',
          reintentable: false,
          ...conId,
        };
      case 'SUPPORT_LINK_DUPLICATE':
        return {
          campo: 'documento',
          mensaje:
            'Ya hay un vínculo con esta secretaria en esa vinculación: está activo o espera su respuesta. No hace falta invitarla otra vez.',
          reintentable: false,
          ...conId,
        };
    }
  }
  const estado = errorToViewState<unknown>(fallo);
  switch (estado.status) {
    case 'validation':
      return {
        campo: null,
        mensaje: estado.issues.map((i) => i.message).join(' ') || 'La invitación no se pudo enviar. Revise lo ingresado.',
        reintentable: estado.retryAfterSeconds !== undefined,
        ...(estado.requestId === undefined ? {} : { requestId: estado.requestId }),
      };
    case 'not-found':
      // Un 404 sin `reason` no es algo que repetir: la secretaria o la vinculación no se encontraron.
      return {
        campo: null,
        mensaje: 'No encontramos a la secretaria o la vinculación elegida. Revise el documento y la vinculación.',
        reintentable: false,
      };
    case 'forbidden':
      return {
        campo: null,
        mensaje: estado.message ?? 'Su cuenta no puede invitar a una secretaria.',
        reintentable: false,
        ...(estado.requestId === undefined ? {} : { requestId: estado.requestId }),
      };
    case 'offline':
      return {
        campo: null,
        mensaje:
          'No pudimos comunicarnos con el servidor. Puede que la invitación no se haya enviado: revise «Invitaciones enviadas» antes de reintentar.',
        reintentable: true,
      };
    case 'error':
      return {
        campo: null,
        mensaje: estado.message ?? 'No pudimos enviar la invitación.',
        reintentable: true,
        // `sin-id` es el marcador de «la API no mandó uno»: no se le muestra a nadie como si fuera un código.
        ...(estado.requestId === 'sin-id' ? {} : { requestId: estado.requestId }),
      };
    default:
      return { campo: null, mensaje: 'No pudimos enviar la invitación.', reintentable: true };
  }
}
