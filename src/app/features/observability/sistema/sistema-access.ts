import type { PestanaSistema } from '../state/observability-context.store';

/**
 * Quién puede leer el panel «Sistema»: los mismos roles de `OPS_READ_ROLES` de la API
 * (`ops-console.controller.ts`). `SUPERADMIN` pasa siempre (`rolesAlcanzan`).
 *
 * Ocultar una pestaña NO es seguridad: es cortesía para no ofrecer lo que sólo devolvería 403. La autoridad
 * es la API, y cada widget muestra «sin permiso» (S5) si ella lo niega.
 */
export const ROLES_LECTURA_SISTEMA: readonly string[] = ['PLATFORM_ADMIN', 'SRE', 'SECURITY_ADMIN', 'RELEASE_MANAGER', 'GOVERNANCE_ADMIN'];

/** Quién puede cambiar el estado de un grupo de errores (`PATCH /errors/groups/:id` de la API). */
export const ROLES_CAMBIO_ESTADO: readonly string[] = ['PLATFORM_ADMIN', 'SRE'];

/** Roles que alcanzan cada pestaña. Hoy todas son lecturas del mismo conjunto; el mapa deja a una pestaña pedir más sin tocar la página. */
export const ROLES_POR_PESTANA: Readonly<Record<PestanaSistema, readonly string[]>> = {
  resumen: ROLES_LECTURA_SISTEMA,
  errores: ROLES_LECTURA_SISTEMA,
  latencia: ROLES_LECTURA_SISTEMA,
  sql: ROLES_LECTURA_SISTEMA,
  endpoints: ROLES_LECTURA_SISTEMA,
  'no-medido': ROLES_LECTURA_SISTEMA,
};

export const ETIQUETA_PESTANA: Readonly<Record<PestanaSistema, string>> = {
  resumen: 'Resumen',
  errores: 'Errores',
  latencia: 'Latencia',
  sql: 'Consultas SQL',
  endpoints: 'Endpoints',
  'no-medido': 'No medido',
};
