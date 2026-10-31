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
  DEACTIVATED: { label: 'Dada de baja', tone: 'error' },
  ANONYMIZED: { label: 'Anonimizada', tone: 'secondary' },
});

/** El evento de la historia (`action` de `GET /iam/users/:id/lifecycle`). */
export const lifecycleEvent = table({
  SUSPEND: { label: 'Suspensión', tone: 'warning' },
  REACTIVATE: { label: 'Reactivación', tone: 'success' },
  DEACTIVATE: { label: 'Baja', tone: 'error' },
});

/** Estado de la cuenta en las vistas de gobierno (`accountStatus`). */
export const accountStatusLabel = table({
  ACTIVE: { label: 'Activa', tone: 'success' },
  LOCKED: { label: 'Bloqueada', tone: 'warning' },
  ANONYMIZED: { label: 'Anonimizada', tone: 'secondary' },
  OTHER: { label: 'Otro estado', tone: 'secondary' },
});

/** El camino por el que alguien tiene un permiso (`sources[].source`). */
export const holderSourceLabel = table({
  ROLE: { label: 'Por un rol', tone: 'info' },
  USER: { label: 'Excepción a la persona', tone: 'warning' },
  RESOURCE: { label: 'Sobre un recurso', tone: 'primary' },
});

export const LIFECYCLE_ACTIONS: Readonly<
  Record<LifecycleAction, { readonly title: string; readonly verb: string; readonly effect: string; readonly destructive: boolean }>
> = {
  suspend: {
    title: 'Suspender la cuenta',
    verb: 'Suspender',
    effect: 'Se bloquea la cuenta y se cortan sus sesiones abiertas. Sus roles se conservan. Se puede deshacer.',
    destructive: false,
  },
  reactivate: {
    title: 'Reactivar la cuenta',
    verb: 'Reactivar',
    effect: 'Se desbloquea la cuenta: podrá volver a ingresar. Sus roles no cambian.',
    destructive: false,
  },
  deactivate: {
    title: 'Dar de baja la cuenta',
    verb: 'Dar de baja',
    effect:
      'Se bloquea la cuenta, se cortan sus sesiones y se revocan sus credenciales y sus roles globales. La baja no se reactiva: volver atrás es un alta nueva.',
    destructive: true,
  },
};

/** Las acciones que cada estado de la cuenta admite. Es ayuda de pantalla: decide la API. */
export function actionsFor(state: string): readonly LifecycleAction[] {
  switch (state) {
    case 'ACTIVE':
      return ['suspend', 'deactivate'];
    case 'SUSPENDED':
      return ['reactivate', 'deactivate'];
    default:
      return [];
  }
}

const REASON_MESSAGES: Readonly<Record<string, string>> = {
  USER_NOT_FOUND: 'Esa persona ya no existe.',
  USER_LIFECYCLE_TRANSITION_INVALID:
    'La cuenta no puede pasar a ese estado desde el que tiene (otra persona se adelantó o la cuenta ya se dio de baja). El estado se actualizó.',
  USER_SELF_LIFECYCLE_FORBIDDEN: 'Nadie puede suspenderse ni darse de baja a sí mismo. Lo hace otra persona administradora.',
  USER_LAST_SECURITY_ADMIN: 'Es la última cuenta que administra accesos. Conceda ese rol a otra persona antes.',
  GOVERNANCE_USER_NOT_FOUND: 'Esa persona ya no existe.',
  GOVERNANCE_PERMISSION_NOT_FOUND: 'Ese permiso ya no existe en el catálogo. Recargue la pantalla.',
  ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN: 'Nadie revisa sus propios accesos. Lo revisa otra persona administradora.',
  RESOURCE_SCOPE_GRANT_NOT_FOUND: 'Ese permiso por alcance ya no existe. La lista se actualizó.',
  RESOURCE_SCOPE_GRANT_ALREADY_ENDED: 'Ese permiso por alcance ya había terminado su vigencia. La lista se actualizó.',
  RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED: 'Terminar un permiso que niega exige un motivo: levantar una negación abre un acceso.',
  ROLE_NOT_FOUND: 'El rol ya no existe. Elija otro.',
  ROLE_PERMISSION_NOT_FOUND: 'Alguno de los permisos ya no existe en el catálogo. Recargue la pantalla.',
  ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ: 'Un campo que se puede escribir tiene que poder leerse.',
  ROLE_INSUFFICIENT:
    'Esta operación la hace una persona administradora de plataforma. Una administración acotada a una organización no puede mirar ni cambiar cuentas de toda la plataforma.',
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
      'USER_LIFECYCLE_TRANSITION_INVALID',
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
