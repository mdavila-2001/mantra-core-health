import type {
  NewSupportGrant,
  SupportActionCode,
  SupportGrantChange,
} from './support-access.types';
import type { SupportAtom } from './support-atoms';

/* Permisos escritos con átomos. Vive aparte de `support-access.types.ts` para no crear un ciclo de tipos con él. */

/**
 * Lo que un permiso acepta como acción al escribirse: uno de los 15 códigos antiguos
 * (alias, siguen vigentes) o uno de los 73 átomos `módulo.recurso.acción[.campo]`.
 */
export type SupportActionInput = SupportActionCode | SupportAtom;

/**
 * Alta de un permiso escrito con átomos (o con una mezcla de alias y átomos): lo mismo que `NewSupportGrant` pero con
 * `actions` ancho. El editor de permisos con condiciones usa este; `NewSupportGrant` sigue siendo el de los 15 códigos.
 */
export type NewAtomGrant = Omit<NewSupportGrant, 'actions'> & {
  readonly actions: readonly SupportActionInput[];
};

/** Cambio de un permiso con átomos; `SupportGrantChange` sigue siendo el de los 15 códigos. */
export type AtomGrantChange = Omit<SupportGrantChange, 'actions'> & {
  readonly actions?: readonly SupportActionInput[];
};

/**
 * Lo que contesta la API (202) cuando un permiso suma un átomo de sensibilidad CRÍTICA: **no se escribió nada** y queda esperando la
 * aprobación de otra persona (`GRANT_CHANGE`, cuatro ojos). `reasons` es el porqué en códigos y `criticalAtoms` los átomos nuevos.
 */
export interface GrantChangePending {
  readonly status: 'PENDING_APPROVAL';
  readonly approvalId: string;
  readonly expiresAt: string;
  readonly reasons: readonly string[];
  readonly criticalAtoms: readonly string[];
}

/** ¿La respuesta de guardar un permiso es «queda pendiente de aprobación»? */
export function isGrantChangePending(result: unknown): result is GrantChangePending {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { status?: unknown }).status === 'PENDING_APPROVAL'
  );
}
