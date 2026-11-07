/* ============================================================================
    The network's filter: a typed object and a pure function that applies it.

    The bar (`filtros/red-clinica-filtros.ts`) only edits a `FiltroDeRed`;
    whoever draws the network calls `aplicarFiltro` and paints what comes back.
    So the criterion is tested without a browser, and the bar and the network
    cannot disagree on what «del 1 al 15 de octubre» means.
    ========================================================================== */

import type { NodoDeRed, Referencia, TipoDeNodo } from './red-clinica.types';
import type { AristaDeRed } from './red-clinica-vinculos.types';

export interface FiltroDeRed {
  /** Id de especialidad; `null` = todas. */
  readonly especialidadId: string | null;
  /** Id de profesional; `null` = todos. */
  readonly profesionalId: string | null;
  /** Start of the range, inclusive from the day's 00:00. */
  readonly desde: Date | null;
  /** End of the range, inclusive up to the day's 23:59:59.999. */
  readonly hasta: Date | null;
  /** Id of the diagnosis node whose thread is to be seen alone; `null` = all. */
  readonly hiloDeDiagnosticoId: string | null;
  /** Free search; ignoring case and accents. */
  readonly texto: string;
  /** Node types in view; empty = all. */
  readonly tipos: readonly TipoDeNodo[];
}

export const FILTRO_VACIO: FiltroDeRed = Object.freeze({
  especialidadId: null,
  profesionalId: null,
  desde: null,
  hasta: null,
  hiloDeDiagnosticoId: null,
  texto: '',
  tipos: Object.freeze([]) as readonly TipoDeNodo[],
});

/** Lowercase and without accents: «Cefalea» finds «cefaléa» and vice versa. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
}

/** How many criteria are set: what the «Limpiar (3)» button says. */
export function criteriosActivos(filtro: FiltroDeRed): number {
  return (
    (filtro.especialidadId === null ? 0 : 1) +
    (filtro.profesionalId === null ? 0 : 1) +
    (filtro.desde === null && filtro.hasta === null ? 0 : 1) +
    (filtro.hiloDeDiagnosticoId === null ? 0 : 1) +
    (normalizarTexto(filtro.texto) === '' ? 0 : 1) +
    (filtro.tipos.length === 0 ? 0 : 1)
  );
}

function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

function finDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999).getTime();
}

/** The types that concentrate links: they enter the thread, but do not spread it. */
const TIPOS_DE_CONTEXTO: ReadonlySet<TipoDeNodo> = new Set<TipoDeNodo>([
  'atencion',
  'cita',
  'reconsulta',
  'internacion',
]);

/**
 * The ids of a diagnosis' thread.
 *
 * The thread is what **explains** that diagnosis: the studies ordered for it,
 * their results, the decision's evidence, the medication indicated, the
 * diagnosis that replaced it (and that one's thread), the referrals hanging
 * from those records and the encounter where each one was entered.
 *
 * The network is walked both ways with two brakes, without which an encounter
 * with five diagnoses would put all five into one's thread:
 *
 * 1. an encounter, appointment, follow-up or admission **enters** but does not expand;
 * 2. another diagnosis only expands if reached through `reemplazado-por` (the
 *    resolved differential is the same thread); through another link it enters
 *    as a reference and stops there.
 *
 * An id that is not a network node returns an empty set.
 */
export function hiloDeDiagnostico(
  diagnosticoId: string,
  nodos: readonly NodoDeRed[],
  aristas: readonly AristaDeRed[],
): ReadonlySet<string> {
  const porId = new Map(nodos.map((n) => [n.id, n]));
  if (!porId.has(diagnosticoId)) return new Set();

  const vecinos = new Map<string, { id: string; arista: AristaDeRed }[]>();
  const agregar = (de: string, a: string, arista: AristaDeRed) => {
    const lista = vecinos.get(de) ?? [];
    lista.push({ id: a, arista });
    vecinos.set(de, lista);
  };
  for (const arista of aristas) {
    agregar(arista.desde, arista.hasta, arista);
    agregar(arista.hasta, arista.desde, arista);
  }

  const hilo = new Set<string>([diagnosticoId]);
  const pendientes: string[] = [diagnosticoId];
  while (pendientes.length > 0) {
    const actual = pendientes.shift() as string;
    for (const { id, arista } of vecinos.get(actual) ?? []) {
      const nodo = porId.get(id);
      if (nodo === undefined || hilo.has(id)) continue;
      hilo.add(id);
      if (TIPOS_DE_CONTEXTO.has(nodo.tipo)) continue;
      if (nodo.tipo === 'diagnostico' && arista.tipo !== 'reemplazado-por') continue;
      pendientes.push(id);
    }
  }
  return hilo;
}

/**
 * Applies the filter. All criteria combine with «and».
 *
 * - With a date range set, a node **without a date** is left out: it cannot be
 *   asserted that it happened in that range.
 * - A node without practitioner or specialty is left out when filtering by
 *   practitioner or specialty, for the same reason.
 * - The text searches title, subtitle, status, practitioner, specialty,
 *   `buscable`, the type's name and the analysis' texts (reason, note,
 *   clinical summary, destination, report conclusion).
 *
 * Returns the nodes in the order they arrived.
 */
export function aplicarFiltro(
  nodos: readonly NodoDeRed[],
  filtro: FiltroDeRed,
  aristas: readonly AristaDeRed[] = [],
): readonly NodoDeRed[] {
  const hilo =
    filtro.hiloDeDiagnosticoId === null
      ? null
      : hiloDeDiagnostico(filtro.hiloDeDiagnosticoId, nodos, aristas);
  const tipos = filtro.tipos.length === 0 ? null : new Set(filtro.tipos);
  const desde = filtro.desde === null ? null : inicioDelDia(filtro.desde);
  const hasta = filtro.hasta === null ? null : finDelDia(filtro.hasta);
  const termino = normalizarTexto(filtro.texto);

  return nodos.filter((nodo) => {
    if (tipos !== null && !tipos.has(nodo.tipo)) return false;
    if (filtro.especialidadId !== null && nodo.especialidad?.id !== filtro.especialidadId) {
      return false;
    }
    if (filtro.profesionalId !== null && nodo.profesional?.id !== filtro.profesionalId) {
      return false;
    }
    if (desde !== null || hasta !== null) {
      if (nodo.cuando === null) return false;
      const t = nodo.cuando.getTime();
      if (desde !== null && t < desde) return false;
      if (hasta !== null && t > hasta) return false;
    }
    if (hilo !== null && !hilo.has(nodo.id)) return false;
    if (termino !== '' && !normalizarTexto(textoBuscable(nodo)).includes(termino)) return false;
    return true;
  });
}

/** The analysis' texts that are also searched: reason, note, summary, destination, conclusion. */
function textosDelDetalle(nodo: NodoDeRed): readonly (string | undefined)[] {
  const d = nodo.detalle;
  switch (d?.tipo) {
    case 'estudio':
      return [d.motivo, d.categoria, d.resultado?.conclusion];
    case 'diagnostico':
      return [d.nota];
    case 'derivacion':
      return [d.motivo, d.resumenClinico, d.destino, d.tipoDeDerivacion];
    case 'cita':
    case 'reconsulta':
      return [d.motivo, d.lugar];
    case 'general':
      return [d.resumen];
    default:
      return [];
  }
}

function textoBuscable(nodo: NodoDeRed): string {
  return [
    ...textosDelDetalle(nodo),
    nodo.titulo,
    nodo.subtitulo,
    nodo.estado?.etiqueta,
    nodo.profesional?.nombre,
    nodo.especialidad?.nombre,
    nodo.buscable,
    nodo.tipo,
  ]
    .filter((parte): parte is string => typeof parte === 'string' && parte !== '')
    .join(' ');
}

/** Las aristas cuyas dos puntas sobrevivieron al filtro. */
export function aristasVisibles(
  aristas: readonly AristaDeRed[],
  visibles: readonly NodoDeRed[],
): readonly AristaDeRed[] {
  const ids = new Set(visibles.map((n) => n.id));
  return aristas.filter((a) => ids.has(a.desde) && ids.has(a.hasta));
}

/* -- The bar's options, taken from the nodes themselves -------------------- */

function referenciasUnicas(lista: readonly (Referencia | null | undefined)[]): readonly Referencia[] {
  const porId = new Map<string, Referencia>();
  for (const ref of lista) {
    if (ref && !porId.has(ref.id)) porId.set(ref.id, ref);
  }
  return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function especialidadesDe(nodos: readonly NodoDeRed[]): readonly Referencia[] {
  return referenciasUnicas(nodos.map((n) => n.especialidad));
}

export function profesionalesDe(nodos: readonly NodoDeRed[]): readonly Referencia[] {
  return referenciasUnicas(nodos.map((n) => n.profesional));
}

/** The diagnoses that can be the thread, most recent first. */
export function diagnosticosDe(nodos: readonly NodoDeRed[]): readonly NodoDeRed[] {
  return nodos
    .filter((n) => n.tipo === 'diagnostico')
    .sort((a, b) => (b.cuando?.getTime() ?? 0) - (a.cuando?.getTime() ?? 0));
}

/** The types present, in the canonical order of `TIPOS_DE_NODO`. */
export function tiposPresentes(
  nodos: readonly NodoDeRed[],
  orden: readonly TipoDeNodo[],
): readonly TipoDeNodo[] {
  const presentes = new Set(nodos.map((n) => n.tipo));
  return orden.filter((t) => presentes.has(t));
}
