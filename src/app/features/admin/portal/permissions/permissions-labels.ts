import { rejectionReason } from '../../../../core/data-access/authz-admin/authz-admin.client';
import type { LifecycleAction } from '../../../../core/data-access/authz-governance/authz-governance.types';
import { describeApiFailure } from '../../../../core/http/api-failure';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos y explicaciones del gobierno de permisos. No deciden nada: un código
    que no está acá se muestra tal cual con tono neutro, y el color nunca va
    solo. Un rechazo se explica por su `reason` estable, nunca por el mensaje.
    ========================================================================== */

const table =
  (entries: Readonly<Record<string, Rotulo>>) =>
  (code: string | null | undefined): Rotulo =>
    code ? (entries[code] ?? { label: code, tone: 'secondary' }) : { label: 'Sin dato', tone: 'secondary' };

export const effectLabel = table({
  ALLOW: { label: 'Permite', tone: 'success' },
  DENY: { label: 'Niega', tone: 'error' },
});

export const scopeLabel = table({
  SELF: { label: 'Sobre sí mismo', tone: 'secondary' },
  BRANCH: { label: 'Por sede', tone: 'info' },
  TENANT: { label: 'Por organización', tone: 'info' },
  GLOBAL: { label: 'Ámbito global', tone: 'primary' },
});

export const actionLabel = table({
  READ: { label: 'Leer', tone: 'info' },
  WRITE: { label: 'Escribir', tone: 'warning' },
  CREATE: { label: 'Crear', tone: 'success' },
  DELETE: { label: 'Borrar', tone: 'error' },
  EXECUTE: { label: 'Ejecutar', tone: 'warning' },
  APPROVE: { label: 'Aprobar', tone: 'primary' },
});

export const maskLabel = table({
  REDACT: { label: 'Oculto', tone: 'warning' },
  HASH: { label: 'Huella (hash)', tone: 'info' },
  PARTIAL: { label: 'Parcial', tone: 'info' },
  NULLIFY: { label: 'Vacío', tone: 'warning' },
});

export const subjectLabel = table({
  USER: { label: 'Persona', tone: 'secondary' },
  ROLE: { label: 'Rol', tone: 'secondary' },
  SERVICE: { label: 'Servicio', tone: 'secondary' },
});

export const resourceKindLabel = table({
  PATIENT: { label: 'Paciente', tone: 'secondary' },
  ENCOUNTER: { label: 'Encuentro', tone: 'secondary' },
  DOCUMENT: { label: 'Documento', tone: 'secondary' },
  RECORD: { label: 'Registro', tone: 'secondary' },
});

export const purposeLabel = table({
  TREATMENT: { label: 'Tratamiento', tone: 'secondary' },
  PAYMENT: { label: 'Pago', tone: 'secondary' },
  OPERATIONS: { label: 'Operación', tone: 'secondary' },
  EMERGENCY: { label: 'Emergencia', tone: 'warning' },
});

export const lifecycleState = table({
  ACTIVE: { label: 'Activa', tone: 'success' },
  SUSPENDED: { label: 'Suspendida', tone: 'warning' },
  OFFBOARDED: { label: 'Dada de baja', tone: 'error' },
  LOCKED_OTHER: { label: 'Bloqueada por otra causa', tone: 'warning' },
  ANONYMIZED: { label: 'Anonimizada', tone: 'secondary' },
  OTHER: { label: 'Otro estado', tone: 'secondary' },
});

export const lifecycleEvent = table({
  SUSPENDED: { label: 'Suspensión', tone: 'warning' },
  REACTIVATED: { label: 'Reactivación', tone: 'success' },
  OFFBOARDED: { label: 'Baja', tone: 'error' },
});

export const reviewDecision = table({
  CERTIFIED: { label: 'Certificó los accesos', tone: 'success' },
  CHANGES_REQUIRED: { label: 'Pidió cambios', tone: 'warning' },
});

export const LIFECYCLE_ACTIONS: Readonly<
  Record<LifecycleAction, { readonly title: string; readonly verb: string; readonly effect: string; readonly destructive: boolean }>
> = {
  suspend: {
    title: 'Suspender la cuenta',
    verb: 'Suspender',
    effect: 'Se cortan sus sesiones abiertas y no podrá ingresar hasta que se reactive. Sus roles se conservan.',
    destructive: false,
  },
  reactivate: {
    title: 'Reactivar la cuenta',
    verb: 'Reactivar',
    effect: 'Podrá volver a ingresar. Sus roles no cambian.',
    destructive: false,
  },
  offboard: {
    title: 'Dar de baja la cuenta',
    verb: 'Dar de baja',
    effect:
      'Se bloquea la cuenta, se cortan sus sesiones y se revocan todos sus roles. Reactivar después no devuelve los roles ni deshace la baja.',
    destructive: true,
  },
};

/** Las acciones que cada estado de la cuenta admite. Es ayuda de pantalla: decide la API. */
export function actionsFor(state: string): readonly LifecycleAction[] {
  switch (state) {
    case 'ACTIVE':
      return ['suspend', 'offboard'];
    case 'SUSPENDED':
      return ['reactivate', 'offboard'];
    case 'LOCKED_OTHER':
      return ['offboard'];
    default:
      return [];
  }
}

const REASON_MESSAGES: Readonly<Record<string, string>> = {
  USER_LIFECYCLE_USER_NOT_FOUND: 'Esa persona ya no existe.',
  USER_LIFECYCLE_NOT_ACTIVE: 'La cuenta ya no estaba activa. El estado se actualizó.',
  USER_LIFECYCLE_NOT_SUSPENDED: 'La cuenta no está suspendida, así que no se reactiva desde aquí. El estado se actualizó.',
  USER_LIFECYCLE_ANONYMIZED: 'La cuenta está anonimizada y ya no admite ninguna transición.',
  USER_LIFECYCLE_ALREADY_OFFBOARDED: 'La cuenta ya se dio de baja. No se reactiva: hay que darla de alta y asignar los roles de nuevo.',
  USER_LIFECYCLE_SELF_ACTION: 'Nadie puede suspenderse ni darse de baja a sí mismo. Lo hace otra persona administradora.',
  ACCESS_REVIEW_USER_NOT_FOUND: 'Esa persona ya no existe.',
  ACCESS_REVIEW_SELF_REVIEW: 'Nadie revisa sus propios accesos. Lo revisa otra persona administradora.',
  ACCESS_REVIEW_ASSIGNMENT_MISMATCH: 'Alguna asignación ya no es de esa persona o dejó de estar activa. Se actualizó la lista: revise de nuevo.',
  RESOURCE_SCOPE_GRANT_NOT_FOUND: 'Ese permiso por alcance ya no existe. La lista se actualizó.',
  RESOURCE_SCOPE_GRANT_ALREADY_ENDED: 'Ese permiso por alcance ya había terminado su vigencia. La lista se actualizó.',
  ROLE_NOT_FOUND: 'El rol ya no existe. Elija otro.',
  ROLE_PERMISSION_NOT_FOUND: 'Alguno de los permisos ya no existe en el catálogo. Recargue la pantalla.',
  ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ: 'Un campo que se puede escribir tiene que poder leerse.',
};

/** El texto de un rechazo, leído por su motivo estable. */
export function governanceFailure(error: unknown, fallback: string): string {
  const reason = rejectionReason(error);
  return reason !== null && reason in REASON_MESSAGES ? REASON_MESSAGES[reason]! : describeApiFailure(error, fallback);
}

/** ¿El rechazo deja la pantalla con datos viejos? Entonces hay que volver a leerlos. */
export function staleAfter(error: unknown): boolean {
  const reason = rejectionReason(error);
  return (
    reason !== null &&
    [
      'USER_LIFECYCLE_NOT_ACTIVE',
      'USER_LIFECYCLE_NOT_SUSPENDED',
      'USER_LIFECYCLE_ALREADY_OFFBOARDED',
      'ACCESS_REVIEW_ASSIGNMENT_MISMATCH',
      'RESOURCE_SCOPE_GRANT_NOT_FOUND',
      'RESOURCE_SCOPE_GRANT_ALREADY_ENDED',
    ].includes(reason)
  );
}

export function optionsOf(codes: readonly string[], label: (code: string) => Rotulo): readonly SelectOption<string>[] {
  return codes.map((code) => ({ value: code, label: label(code).label }));
}

/** Para ordenar roles por nombre en español. */
export const byName = (a: { readonly name: string }, b: { readonly name: string }): number =>
  a.name.localeCompare(b.name, 'es');
