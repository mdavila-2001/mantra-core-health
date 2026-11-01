import {
  QUALITY_ISSUE_STATUSES,
  QUALITY_SEVERITIES,
  type QualityIssueStatus,
  type QualityIssuesQuery,
} from '../../../../../core/data-access/admin-portal/data-quality.types';

/* ============================================================================
    La consulta de incidencias, leída de la URL.

    Lo que la API rechazaría con 400 se descarta aquí en vez de mandarse. Los
    nombres de los parámetros son los mismos que acepta la API; la pestaña es
    `status` (`ALL`: sin filtrar por estado; sin parámetro: las abiertas, que
    son las que esperan a alguien).
    ========================================================================== */

export const ISSUE_TABS = ['OPEN', 'RESOLVED', 'DISMISSED', 'ALL'] as const;
export type IssueTab = (typeof ISSUE_TABS)[number];

export const ISSUE_URL_KEYS = ['status', 'severity', 'ruleId', 'q'] as const;
export type IssueUrlValues = Readonly<Record<(typeof ISSUE_URL_KEYS)[number], string>>;

/** Los filtros que «Quitar filtros» limpia; la pestaña no es un filtro. */
export const ISSUE_FILTER_KEYS = ['severity', 'ruleId', 'q'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SEARCH = 120;

export function tabOf(values: Pick<IssueUrlValues, 'status'>): IssueTab {
  return (ISSUE_TABS as readonly string[]).includes(values.status) ? (values.status as IssueTab) : 'OPEN';
}

export function issueQuery(values: IssueUrlValues): QualityIssuesQuery {
  const tab = tabOf(values);
  const status = tab === 'ALL' ? undefined : (tab as QualityIssueStatus);
  const severity = (QUALITY_SEVERITIES as readonly string[]).includes(values.severity)
    ? (values.severity as (typeof QUALITY_SEVERITIES)[number])
    : undefined;
  const q = values.q.trim();
  return {
    ...(status ? { status } : {}),
    ...(severity ? { severity } : {}),
    ...(UUID.test(values.ruleId) ? { ruleId: values.ruleId } : {}),
    ...(q !== '' && q.length <= MAX_SEARCH ? { q } : {}),
  };
}

export function hasIssueFilters(values: IssueUrlValues): boolean {
  return ISSUE_FILTER_KEYS.some((key) => values[key] !== '');
}

/** El texto que se le dice a la persona cuando cerrar una incidencia falla. */
export function resolutionFailure(status: number | null): { message: string; reload: boolean } {
  if (status === 409) {
    return {
      message: 'Otra persona cerró esta incidencia con otro desenlace. La lista se actualizó; no se cambió nada.',
      reload: true,
    };
  }
  if (status === 403) {
    return { message: 'Su cuenta no tiene permiso para cerrar incidencias. No se cambió nada.', reload: false };
  }
  if (status === 404) {
    return { message: 'La incidencia ya no existe. La lista se actualizó.', reload: true };
  }
  return { message: 'No se pudo guardar el cierre. No se cambió nada; puede reintentar.', reload: false };
}

export const KNOWN_STATUSES: readonly string[] = QUALITY_ISSUE_STATUSES;
