import type { LocationNode } from '../../../core/data-access/support-access/support-access.types';
import { isVisible } from './agenda-grouping';
import type { AgendaDoctor, AgendaEvent } from './agenda-model';

/**
 * Qué se ve de la agenda: lo que prenden y apagan «Mis doctores», el árbol de
 * ubicaciones, el servicio y los dos interruptores de horarios. Lógica pura.
 */
export interface AgendaFilters {
  /** Doctores apagados en «Mis doctores». */
  readonly hiddenDoctors: ReadonlySet<string>;
  /** Un nodo del árbol (sede, edificio, piso o sala): se ve todo lo que queda dentro. */
  readonly locationId: string | null;
  readonly serviceId: string | null;
  /** Mostrar los horarios donde no hay permiso (atenuados, con el motivo). */
  readonly showDenied: boolean;
  /** Mostrar los horarios libres, además de las citas. */
  readonly showFree: boolean;
}

export const NO_FILTERS: AgendaFilters = {
  hiddenDoctors: new Set(),
  locationId: null,
  serviceId: null,
  showDenied: true,
  showFree: true,
};

export function applyFilters(
  events: readonly AgendaEvent[],
  filters: AgendaFilters,
  locations: ReadonlyMap<string, LocationNode>,
): readonly AgendaEvent[] {
  const raiz = filters.locationId === null ? undefined : locations.get(filters.locationId);
  return events.filter((e) => {
    if (filters.hiddenDoctors.has(e.practitionerRoleAssignmentId)) return false;
    if (filters.serviceId !== null && e.healthcareServiceId !== filters.serviceId) return false;
    if (!filters.showDenied && !isVisible(e)) return false;
    if (!filters.showFree && e.status === 'FREE' && isVisible(e)) return false;
    if (filters.locationId !== null) {
      const lugar = locations.get(e.careSpaceId);
      if (raiz === undefined || lugar === undefined) return false;
      if (lugar.id !== raiz.id && !lugar.path.startsWith(raiz.path)) return false;
    }
    return true;
  });
}

/** Cuántos filtros cambian lo que se ve (para el rótulo «Limpiar todo»). */
export function activeFilterCount(filters: AgendaFilters, totalDoctors: number): number {
  let n = 0;
  if (filters.hiddenDoctors.size > 0 && totalDoctors > 0) n += 1;
  if (filters.locationId !== null) n += 1;
  if (filters.serviceId !== null) n += 1;
  if (!filters.showDenied) n += 1;
  if (!filters.showFree) n += 1;
  return n;
}

/* ---- el árbol de ubicaciones ----------------------------------------------------- */

export interface LocationTreeRow {
  readonly node: LocationNode;
  readonly depth: number;
  readonly hasChildren: boolean;
}

/**
 * El árbol sede → edificio → piso → sala, aplanado en el orden en que se dibuja.
 * Un nodo cuyo padre no está en la lista (la API solo manda lo que se ve) pasa a ser raíz.
 */
export function flattenLocationTree(locations: readonly LocationNode[], collapsed: ReadonlySet<string> = new Set()): readonly LocationTreeRow[] {
  const ids = new Set(locations.map((n) => n.id));
  const hijos = new Map<string | null, LocationNode[]>();
  for (const n of locations) {
    const padre = n.parentId !== null && ids.has(n.parentId) ? n.parentId : null;
    hijos.set(padre, [...(hijos.get(padre) ?? []), n]);
  }
  const filas: LocationTreeRow[] = [];
  const recorrer = (padre: string | null, depth: number): void => {
    for (const nodo of (hijos.get(padre) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))) {
      const lista = hijos.get(nodo.id) ?? [];
      filas.push({ node: nodo, depth, hasChildren: lista.length > 0 });
      if (!collapsed.has(nodo.id)) recorrer(nodo.id, depth + 1);
    }
  };
  recorrer(null, 0);
  return filas;
}

/** El nombre de un nodo con su camino: «Edificio A › Piso 1». Para el chip del filtro. */
export function locationBreadcrumb(locations: readonly LocationNode[], id: string): string {
  const porId = new Map(locations.map((n) => [n.id, n]));
  const partes: string[] = [];
  let actual = porId.get(id);
  while (actual !== undefined) {
    partes.unshift(actual.name);
    actual = actual.parentId === null ? undefined : porId.get(actual.parentId);
  }
  return partes.slice(-2).join(' › ');
}

/* ---- «Mis doctores» -------------------------------------------------------------- */

export function allDoctorsOn(hidden: ReadonlySet<string>): boolean {
  return hidden.size === 0;
}

export function toggleDoctor(hidden: ReadonlySet<string>, doctorId: string): ReadonlySet<string> {
  const nuevo = new Set(hidden);
  if (!nuevo.delete(doctorId)) nuevo.add(doctorId);
  return nuevo;
}

/** «Todos» prende a todos; apagarlos todos deja la agenda vacía a propósito. */
export function setAllDoctors(doctors: readonly AgendaDoctor[], on: boolean): ReadonlySet<string> {
  return on ? new Set() : new Set(doctors.map((d) => d.id));
}

/* ---- los chips de filtros activos -------------------------------------------------- */

/** Un filtro activo, para el chip que lo nombra y lo quita. */
export interface FilterChip {
  readonly id: 'doctors' | 'location' | 'service' | 'denied' | 'free';
  readonly label: string;
}

export function filterChips(
  filters: AgendaFilters,
  names: {
    readonly doctors: readonly AgendaDoctor[];
    readonly services: readonly { readonly id: string; readonly name: string }[];
    readonly locations: ReadonlyMap<string, LocationNode>;
  },
): readonly FilterChip[] {
  const chips: FilterChip[] = [];
  const total = names.doctors.length;
  if (filters.hiddenDoctors.size > 0 && total > 0) {
    const prendidos = names.doctors.filter((d) => !filters.hiddenDoctors.has(d.id)).length;
    chips.push({ id: 'doctors', label: `Doctores: ${prendidos} de ${total}` });
  }
  if (filters.locationId !== null) {
    chips.push({ id: 'location', label: `Ubicación: ${names.locations.get(filters.locationId)?.name ?? 'elegida'}` });
  }
  if (filters.serviceId !== null) {
    chips.push({ id: 'service', label: `Servicio: ${names.services.find((s) => s.id === filters.serviceId)?.name ?? 'elegido'}` });
  }
  if (!filters.showFree) chips.push({ id: 'free', label: 'Sin horarios libres' });
  if (!filters.showDenied) chips.push({ id: 'denied', label: 'Sin horarios sin permiso' });
  return chips;
}
