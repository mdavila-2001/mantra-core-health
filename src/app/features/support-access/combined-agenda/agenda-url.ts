import { fromDayKey, toDayKey, type AgendaViewKind } from './agenda-model';
import type { FilterChip } from './agenda-filters';
import type { AgendaView } from './agenda-grouping';

/**
 * El estado de la agenda combinada **vive en la URL**: vista, agrupación, fecha,
 * organización y filtros. Recargar, volver atrás o mandar el enlace deja a
 * quien lo abre exactamente donde estaba.
 *
 * Los nombres de los parámetros están en castellano porque se ven en la barra
 * de direcciones: `?vista=semana&agrupar=consultorio&fecha=2026-11-02`.
 * Lo que está en su valor por omisión **no se escribe**, para que la URL de la
 * agenda sin tocar sea limpia.
 */
export interface AgendaUrlState {
  readonly view: AgendaViewKind;
  readonly group: AgendaView;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  /** Un `tenantId`, o `ALL` para todas las organizaciones juntas, o `null` si aún no se eligió. */
  readonly org: string | null;
  readonly hidden: readonly string[];
  readonly location: string | null;
  readonly service: string | null;
  readonly showDenied: boolean;
  readonly showFree: boolean;
  /** Cuántos días cubre la línea de tiempo. */
  readonly span: 1 | 7;
}

export const ALL_ORGS = 'ALL';

const VISTAS: Readonly<Record<string, AgendaViewKind>> = { dia: 'DAY', semana: 'WEEK', linea: 'TIMELINE' };
const VISTAS_INV: Readonly<Record<AgendaViewKind, string>> = { DAY: 'dia', WEEK: 'semana', TIMELINE: 'linea' };
const AGRUPAR: Readonly<Record<string, AgendaView>> = { doctor: 'DOCTOR', consultorio: 'SPACE', servicio: 'SERVICE' };
const AGRUPAR_INV: Readonly<Record<AgendaView, string>> = { DOCTOR: 'doctor', SPACE: 'consultorio', SERVICE: 'servicio' };

/** Lo mínimo que se necesita de `ParamMap`: así se prueba sin Angular. */
export interface ParamReader {
  get(name: string): string | null;
}

export function defaultUrlState(today: Date): AgendaUrlState {
  return {
    view: 'DAY',
    group: 'DOCTOR',
    date: toDayKey(today),
    org: null,
    hidden: [],
    location: null,
    service: null,
    showDenied: true,
    showFree: true,
    span: 1,
  };
}

export function parseUrlState(params: ParamReader, today: Date): AgendaUrlState {
  const base = defaultUrlState(today);
  const fecha = fromDayKey(params.get('fecha'));
  const ocultos = params.get('ocultos');
  return {
    view: VISTAS[params.get('vista') ?? ''] ?? base.view,
    group: AGRUPAR[params.get('agrupar') ?? ''] ?? base.group,
    date: fecha === null ? base.date : toDayKey(fecha),
    org: params.get('org') === null || params.get('org') === '' ? null : params.get('org'),
    hidden: ocultos === null || ocultos === '' ? [] : ocultos.split(',').filter((id) => id !== ''),
    location: params.get('ubicacion') === '' ? null : params.get('ubicacion'),
    service: params.get('servicio') === '' ? null : params.get('servicio'),
    showDenied: params.get('sinpermiso') !== '0',
    showFree: params.get('libres') !== '0',
    span: params.get('rango') === '7' ? 7 : 1,
  };
}

/**
 * Los parámetros a escribir en la URL. Un valor `null` quita el parámetro:
 * lo que está en su valor por omisión no ensucia la dirección.
 */
export function toQueryParams(state: AgendaUrlState, today: Date): Readonly<Record<string, string | null>> {
  const base = defaultUrlState(today);
  return {
    vista: state.view === base.view ? null : VISTAS_INV[state.view],
    agrupar: state.group === base.group ? null : AGRUPAR_INV[state.group],
    fecha: state.date === base.date ? null : state.date,
    org: state.org,
    ocultos: state.hidden.length === 0 ? null : state.hidden.join(','),
    ubicacion: state.location,
    servicio: state.service,
    sinpermiso: state.showDenied ? null : '0',
    libres: state.showFree ? null : '0',
    rango: state.span === 7 ? '7' : null,
  };
}

/** Quita **un** filtro del estado. */
export function withoutFilter(state: AgendaUrlState, id: FilterChip['id']): AgendaUrlState {
  switch (id) {
    case 'doctors':
      return { ...state, hidden: [] };
    case 'location':
      return { ...state, location: null };
    case 'service':
      return { ...state, service: null };
    case 'denied':
      return { ...state, showDenied: true };
    case 'free':
      return { ...state, showFree: true };
  }
}

/** «Limpiar todo»: quita los filtros y deja la vista, la fecha y la organización donde están. */
export function clearAllFilters(state: AgendaUrlState): AgendaUrlState {
  return { ...state, hidden: [], location: null, service: null, showDenied: true, showFree: true };
}
