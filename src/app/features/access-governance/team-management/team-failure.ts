import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';

/* ============================================================================
    Los errores de la administración delegada, explicados en lenguaje simple (CONTRATO-GOBIERNO §6.4, Anexo C):
    qué pasó, y qué puede hacer la persona ahora. Se ramifica por `reason`, nunca por el texto del mensaje.
   ========================================================================== */

export interface TeamFailure {
  readonly title: string;
  readonly message: string;
  /** Qué puede hacer la persona ahora; vacío si no hay nada que sugerir. */
  readonly help: string;
  readonly reason?: string;
}

const GENERIC: TeamFailure = {
  title: 'No se pudo completar',
  message: 'No pudimos completar la operación. Vuelva a intentarlo.',
  help: '',
};

const asCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

export function explainTeamFailure(error: unknown): TeamFailure {
  const failure = accessFailureOf(error);
  if (failure === null) return GENERIC;
  const base = {
    message: failure.message,
    ...(failure.reason === undefined ? {} : { reason: failure.reason }),
  };
  switch (failure.reason) {
    case 'ADMIN_CEILING_EXCEEDED':
      return {
        ...base,
        title: 'Eso pasa de lo que usted puede dar',
        help: 'Marque solo los permisos habilitados y use una fecha dentro de su límite. Si necesita dar algo más, pídaselo al administrador de seguridad: no hay una aprobación que lo salte.',
      };
    case 'ADMIN_SCOPE_EXCEEDED': {
      const count =
        asCount(failure.details?.['outsideCount']) ??
        asCount(failure.details?.['outOfScope']) ??
        asCount(failure.details?.['count']);
      return {
        ...base,
        title: 'Fuera de lo que usted administra',
        help: `${count === null ? 'Esa persona también trabaja en lugares que usted no administra.' : `Esa persona tiene ${count} ${count === 1 ? 'permiso' : 'permisos'} fuera de lo que usted administra.`} Puede quitarle lo que da en su servicio con «Quitar»; suspenderla o darla de baja le toca al administrador de seguridad.`,
      };
    }
    case 'GUARDRAIL_CRITICAL_REQUIRES_EXPIRY':
      return {
        ...base,
        title: 'Falta la fecha de vencimiento',
        help: 'Elija hasta qué día vale el permiso.',
      };
    case 'GUARDRAIL_SELF_ADMIN':
    case 'GUARDRAIL_PEER_ADMIN':
    case 'GUARDRAIL_DELEGATED_FORBIDDEN_ATOM':
      return {
        ...base,
        title: 'Eso no se puede delegar',
        help: 'Estos permisos solo los maneja el administrador de seguridad.',
      };
    case 'STEP_UP_REQUIRED':
      return {
        ...base,
        title: 'Falta confirmar su identidad',
        help: 'Escriba el código de su aplicación de verificación y vuelva a intentar.',
      };
    default:
      return { ...base, title: 'No se pudo completar', help: '' };
  }
}
