import {
  AUDIT_METHODS,
  AUDIT_RESULT_FILTERS,
  DATA_OPERATIONS,
  type AuditLogQuery,
  type DataAccessQuery,
} from '../../../../../core/data-access/audit/audit.types';

/* ============================================================================
    La consulta de la bitácora, leída de la URL.

    La URL puede traer cualquier cosa (un enlace editado a mano, uno viejo): lo
    que la API rechazaría con 400 se descarta acá en vez de mandarse. Los
    nombres de los parámetros son los mismos que acepta la API.
    ========================================================================== */

/** Las dos vistas: acciones que mutaron y accesos a datos sensibles. */
export const AUDIT_VIEWS = ['log', 'data-access'] as const;
export type AuditView = (typeof AUDIT_VIEWS)[number];

export const AUDIT_URL_KEYS = [
  'view',
  'userId',
  'from',
  'to',
  'result',
  'method',
  'action',
  'route',
  'entity',
  'operation',
  'resourceType',
] as const;
export type AuditUrlKey = (typeof AUDIT_URL_KEYS)[number];
export type AuditUrlValues = Readonly<Record<AuditUrlKey, string>>;

/** Los filtros de cada vista, sin la pestaña. */
export const LOG_FILTER_KEYS = ['userId', 'from', 'to', 'result', 'method', 'action', 'route', 'entity'] as const;
export const DATA_ACCESS_FILTER_KEYS = ['userId', 'from', 'to', 'operation', 'resourceType'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** Topes de longitud de los filtros de texto, los mismos que valida la API. */
const MAX_LENGTH = { action: 200, route: 300, entity: 100, resourceType: 100 } as const;

export function viewOf(values: Pick<AuditUrlValues, 'view'>): AuditView {
  return values.view === 'data-access' ? 'data-access' : 'log';
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | undefined {
  return (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function text(value: string, max: number): string | undefined {
  const trimmed = value.trim();
  return trimmed !== '' && trimmed.length <= max ? trimmed : undefined;
}

function isDay(value: string): boolean {
  return DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * El rango, en días. `to` en la URL es el último día **incluido** (lo que una
 * persona entiende por «hasta el 24»); la API lo toma como excluido, así que
 * se manda el día siguiente.
 */
function range(values: Pick<AuditUrlValues, 'from' | 'to'>): Pick<AuditLogQuery, 'from' | 'to'> {
  const from = isDay(values.from) ? values.from : undefined;
  const to = isDay(values.to)
    ? new Date(Date.parse(`${values.to}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10)
    : undefined;
  return { ...(from ? { from } : {}), ...(to ? { to } : {}) };
}

function compact<T extends object>(query: T): T {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as T;
}

export function logQuery(values: AuditUrlValues): AuditLogQuery {
  return compact<AuditLogQuery>({
    ...range(values),
    userId: UUID.test(values.userId) ? values.userId : undefined,
    result: oneOf(values.result, AUDIT_RESULT_FILTERS),
    method: oneOf(values.method, AUDIT_METHODS),
    action: text(values.action, MAX_LENGTH.action),
    route: text(values.route, MAX_LENGTH.route),
    entity: text(values.entity, MAX_LENGTH.entity),
  });
}

export function dataAccessQuery(values: AuditUrlValues): DataAccessQuery {
  return compact<DataAccessQuery>({
    ...range(values),
    userId: UUID.test(values.userId) ? values.userId : undefined,
    operation: oneOf(values.operation, DATA_OPERATIONS),
    resourceType: text(values.resourceType, MAX_LENGTH.resourceType),
  });
}

/** ¿La vista tiene algún filtro aplicable? Decide qué vacío se muestra. */
export function hasFilters(values: AuditUrlValues): boolean {
  const query = viewOf(values) === 'log' ? logQuery(values) : dataAccessQuery(values);
  return Object.keys(query).length > 0;
}

/** Lo que una persona lee en la columna «Acción»: la ruta si se conoce, si no el código. */
export function actionHeadline(entry: { readonly route: string | null; readonly action: string }): string {
  return entry.route ?? entry.action;
}

/** El código de negocio sólo aporta si no es la forma `HTTP <VERBO> <ruta>` que ya se ve arriba. */
export function businessAction(entry: { readonly route: string | null; readonly action: string }): string | null {
  if (entry.route === null || entry.action.startsWith('HTTP ')) return null;
  return entry.action;
}
