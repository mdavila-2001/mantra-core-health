import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';

/* ============================================================================
    Motivos de error estables del gobierno de accesos (CONTRATO-GOBIERNO §8.4).

    La API manda `reason` (arriba y en `details.reason`) y el front **ramifica por
    `reason`, nunca por `message`**. Acá están los textos en lenguaje simple y de usted para
    cada uno: son el piso; si la API manda un `message` más específico, la pantalla lo prefiere.
    Nada de acá revela datos de otras personas: el motivo detallado de una negación solo lo ve
    quien llama a `explain`.
   ========================================================================== */

export const ACCESS_ERROR_TEXTS: Readonly<Record<string, string>> = {
  /* condiciones */
  CONDITION_SCHEMA_VERSION_UNSUPPORTED:
    'La versión de las condiciones no es compatible. Recargue la pantalla.',
  CONDITION_UNKNOWN_KEY: 'Una de las condiciones no existe. Revise lo que escribió.',
  CONDITION_TOO_LARGE: 'Las condiciones son demasiado largas. Simplifíquelas.',
  CONDITION_TIME_EMPTY_WINDOW:
    'Una franja horaria empieza y termina a la misma hora: no cubre ningún momento.',
  CONDITION_TIME_ZONE_INVALID: 'La zona horaria no es válida.',
  CONDITION_LIMIT_INVALID: 'Un límite no es válido: revise el tope y el período.',
  CONDITION_NOT_APPLICABLE_TO_ATOM: 'Esa condición no se puede aplicar a este permiso.',
  CONDITION_NOT_ALLOWED_ON_DENY: 'Una prohibición no admite esa condición.',
  CONDITION_FIELD_NOT_GRANTED: 'Esa condición habla de un dato que el permiso no da.',
  CONDITION_NETWORK_NO_RULES:
    'Su organización aún no definió las redes permitidas: configúrelas primero.',
  CONDITION_OBLIGATION_LOOSENS_CATALOG:
    'Esa condición pide menos de lo que el permiso ya exige. Solo se puede pedir más.',
  /* barandillas */
  GUARDRAIL_NOT_DELEGABLE: 'Este permiso no se puede dar al personal de apoyo.',
  GUARDRAIL_CEILING_EXCEEDED: 'Este permiso excede lo que el rol puede tener en su organización.',
  GUARDRAIL_DELEGATED_FORBIDDEN_ATOM:
    'Este permiso solo lo puede dar el administrador de seguridad.',
  GUARDRAIL_CRITICAL_REQUIRES_EXPIRY: 'Un permiso crítico necesita fecha de vencimiento.',
  GUARDRAIL_SELF_SUPERVISION: 'Una persona no puede ser su propia responsable de cuenta.',
  GUARDRAIL_RULE_LOOSENS_PLATFORM:
    'Esa regla afloja una barandilla de la plataforma. Solo se pueden agregar restricciones.',
  GUARDRAIL_SELF_ADMIN: 'No puede darse permisos a usted mismo.',
  GUARDRAIL_PEER_ADMIN: 'No puede darle permisos de administración a otra persona que administra.',
  /* administración delegada */
  ADMIN_CEILING_EXCEEDED:
    'Eso excede lo que usted puede dar. Pídaselo al administrador de seguridad.',
  ADMIN_SCOPE_EXCEEDED: 'Esa persona o ese permiso está fuera de lo que usted administra.',
  /* SoD */
  SOD_CONFLICT_BLOCKED: 'Esta combinación de funciones no se permite en una misma persona.',
  SOD_RULE_HARD: 'Esa regla no admite excepciones.',
  SOD_RULE_LOOSENS_BASE: 'Una regla de la organización no puede aflojar la de la plataforma.',
  SOD_RULE_PLATFORM_READ_ONLY: 'Las reglas de la plataforma no se pueden editar.',
  SOD_EXCEPTION_REQUIRED: 'Esta combinación necesita una excepción aprobada por otra persona.',
  SOD_EXCEPTION_NOT_FOUND: 'No encontramos esa excepción.',
  /* cuatro ojos */
  FOUR_EYES_SELF_APPROVAL: 'No puede aprobar lo que usted mismo pidió.',
  FOUR_EYES_NOT_ELIGIBLE: 'Usted no es quien debe decidir esta solicitud.',
  FOUR_EYES_NOT_PENDING: 'Esa solicitud ya fue resuelta.',
  FOUR_EYES_EXPIRED: 'La solicitud caducó. Pida una nueva.',
  FOUR_EYES_PAYLOAD_CHANGED: 'La aprobación es de otra acción. Pida una nueva.',
  FOUR_EYES_PAYLOAD_INVALID: 'La solicitud no se puede ejecutar tal como está. Pida una nueva.',
  FOUR_EYES_ALREADY_CONSUMED: 'Esa aprobación ya se usó. Pida una nueva.',
  FOUR_EYES_DUPLICATE_PENDING: 'Ya hay una solicitud igual esperando decisión.',
  FOUR_EYES_TOO_MANY_PENDING:
    'Ya tiene muchas solicitudes esperando decisión. Espere a que se resuelvan algunas.',
  FOUR_EYES_NO_APPROVER:
    'No hay otra persona que pueda aprobar esto: con un solo administrador de seguridad no se pueden dar accesos críticos.',
  RESTRICTION_FLAG_REMOVAL_FORBIDDEN:
    'Solo el doctor titular o la administración de seguridad pueden quitar una restricción del paciente.',
  /* campañas */
  REVIEW_SCOPE_EMPTY: 'Con ese alcance y esos filtros no hay nada que revisar.',
  REVIEW_COMMENT_REQUIRED: 'Escriba un comentario para esta decisión.',
  REVIEW_ADJUST_CANNOT_BROADEN: 'Un ajuste solo puede reducir permisos, no ampliarlos.',
  REVIEW_BULK_NOT_ALLOWED:
    'Solo se pueden mantener en bloque los accesos de bajo riesgo con uso reciente.',
  REVIEW_NOT_REVIEWER: 'Usted no es quien debe revisar este acceso.',
  REVIEW_ALREADY_DECIDED: 'Ese acceso ya fue revisado.',
  REVIEW_CAMPAIGN_NOT_OPEN: 'La campaña no está abierta.',
  REVIEW_CAMPAIGN_NOT_DRAFT: 'La campaña ya no es un borrador.',
  REVIEW_CAMPAIGN_NOT_DUE:
    'Todavía no se puede cerrar: su fecha límite y sus días de gracia no terminaron.',
  REVIEW_SCHEDULE_TOO_SHORT:
    'El plazo es muy corto: ponga al menos 7 días para decidir y 3 de gracia.',
  REVIEW_CAMPAIGN_DUPLICATE: 'Ya existe una campaña igual en curso.',
  REVIEW_ITEM_NOT_FOUND: 'No encontramos ese acceso por revisar.',
  REVIEW_CAMPAIGN_NOT_FOUND: 'No encontramos esa campaña.',
  /* ciclo de vida */
  HANDOVER_TARGET_INELIGIBLE: 'Esa persona no puede recibir ese trabajo. Elija a otra.',
  HANDOVER_SUPERVISOR_REQUIRED:
    'Elija quién será responsable de las cuentas que esta persona supervisaba.',
  OWNER_NOT_ELIGIBLE: 'Esa persona no puede ser responsable de la cuenta.',
  ENGAGEMENT_ALREADY_SUSPENDED: 'Esa persona ya está suspendida.',
  ENGAGEMENT_NOT_SUSPENDED: 'Esa persona no está suspendida.',
  LIFECYCLE_ITEM_AUTOMATIC: 'Ese paso se completa solo.',
  LIFECYCLE_CASE_NOT_FOUND: 'No encontramos ese caso.',
  /* simulación, ajustes e informes */
  SIMULATION_TOO_LARGE: 'La simulación es demasiado grande. Reduzca los casos de prueba.',
  SIMULATION_NO_TARGET: 'Elija a quién simular.',
  SIMULATION_STALE: 'Algo cambió mientras editaba. Revise la vista previa y vuelva a guardar.',
  GOVERNANCE_SETTINGS_INVALID: 'Algún ajuste no es válido. Revise los valores.',
  GOVERNANCE_RULE_DUPLICATE: 'Ya existe una regla igual.',
  ROW_VERSION_CONFLICT:
    'Otra persona cambió esto mientras lo editaba. Recargue y vuelva a intentar.',
  EXPORT_REASON_REQUIRED: 'Escriba el motivo de la exportación (al menos 10 caracteres).',
  EXPORT_KIND_INVALID: 'Ese informe no se puede exportar.',
  MATRIX_DIMENSION_INVALID:
    'Elija ver personas, o quién puede actuar sobre un doctor, servicio o espacio.',
  NORMALIZE_TIGHTENING_NOT_ACKNOWLEDGED:
    'Este cambio exige más a algunas personas. Confirme que lo revisó.',
  /* paso extra */
  MFA_NOT_ENROLLED: 'Aún no activó la verificación en dos pasos.',
  MFA_CODE_INVALID: 'El código no es correcto. Revise su aplicación e intente de nuevo.',
  STEP_UP_UNAVAILABLE:
    'No pudimos comprobar su verificación en dos pasos. Intente de nuevo en unos minutos.',
  STEP_UP_ATTEMPTS_EXCEEDED: 'Demasiados intentos con el código. Espere unos minutos.',
  /* desafíos de agenda, bandeja y caja */
  REASON_REQUIRED: 'Escriba el motivo: este permiso lo exige.',
  REASON_PLACEHOLDER: 'El motivo no puede ser un texto de relleno: escriba la razón real.',
  STEP_UP_REQUIRED: 'Confirme su identidad con el segundo paso para continuar.',
  APPROVAL_REQUIRED: 'Esta acción necesita la aprobación de otra persona.',
  BREAK_GLASS_NOT_FOR_SUPPORT: 'El acceso de emergencia no existe para el personal de apoyo.',
  DECISION_LOG_UNAVAILABLE:
    'No pudimos registrar esta decisión, así que no se realizó. Intente de nuevo.',
};

/** Lo que una pantalla necesita saber de un fallo de gobierno de accesos. */
export interface AccessFailure {
  readonly status: number;
  /** El sub-código estable (`FOUR_EYES_EXPIRED`, …) o `undefined` si la API no mandó. */
  readonly reason?: string;
  /** Texto para mostrar: el de la tabla si el `reason` es conocido; si no, el de la API. */
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  /** El ID de petición, para S9. */
  readonly requestId?: string;
}

/** Texto en lenguaje simple de un `reason`; `undefined` si no está en la tabla. */
export function accessErrorText(reason: string | undefined): string | undefined {
  return reason === undefined ? undefined : ACCESS_ERROR_TEXTS[reason];
}

/** Lee un fallo de la API con su `reason`. Devuelve `null` si no es un error HTTP con la forma del contrato. */
export function accessFailureOf(error: unknown): AccessFailure | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null) return null;
  const reason = body.reason;
  return {
    status: error.status,
    ...(reason === undefined ? {} : { reason }),
    message: accessErrorText(reason) ?? body.message,
    ...(body.details === undefined ? {} : { details: body.details }),
    ...(body.correlationId === undefined ? {} : { requestId: body.correlationId }),
  };
}

/** ¿Es el error un fallo con ese `reason`? */
export function hasAccessReason(error: unknown, reason: string): boolean {
  return accessFailureOf(error)?.reason === reason;
}
