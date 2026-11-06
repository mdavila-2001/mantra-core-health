/* ============================================================================
    El filtro de la red: un objeto tipado y una función pura que lo aplica.

    La barra (`filtros/red-clinica-filtros.ts`) sólo edita un `FiltroDeRed`;
    quien dibuja la red llama a `aplicarFiltro` y pinta lo que vuelve. Así el
    criterio se prueba sin navegador, y la barra y la red no pueden discrepar
    sobre qué significa «del 1 al 15 de octubre».
    ========================================================================== */

import type { AristaDeRed, NodoDeRed, Referencia, TipoDeNodo } from './red-clinica.types';

export interface FiltroDeRed {
  /** Id de especialidad; `null` = todas. */
  readonly especialidadId: string | null;
  /** Id de profesional; `null` = todos. */
  readonly profesionalId: string | null;
  /** Inicio del rango, inclusive desde las 00:00 del día. */
  readonly desde: Date | null;
  /** Fin del rango, inclusive hasta las 23:59:59.999 del día. */
  readonly hasta: Date | null;
  /** Id del nodo diagnóstico cuyo hilo se quiere ver solo; `null` = todo. */
  readonly hiloDeDiagnosticoId: string | null;
  /** Búsqueda libre; sin distinguir mayúsculas ni tildes. */
  readonly texto: string;
  /** Tipos de nodo a la vista; vacío = todos. */
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

/** Minúsculas y sin tildes: «Cefalea» encuentra «cefaléa» y al revés. */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es').trim();
}

/** Cuántos criterios están puestos: lo que dice el botón «Limpiar (3)». */
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

/** Los tipos que concentran vínculos: entran al hilo, pero no lo propagan. */
const TIPOS_DE_CONTEXTO: ReadonlySet<TipoDeNodo> = new Set<TipoDeNodo>([
  'atencion',
  'cita',
  'reconsulta',
  'internacion',
]);

/**
 * Los ids del hilo de un diagnóstico.
 *
 * El hilo es lo que **explica** ese diagnóstico: los estudios pedidos para él,
 * sus resultados, la evidencia de la decisión, la medicación indicada, el
 * diagnóstico que lo reemplazó (y el hilo de éste), las derivaciones que
 * cuelgan de esos registros y la atención donde se registró cada uno.
 *
 * Se recorre la red en los dos sentidos con dos frenos, sin los cuales una
 * atención con cinco diagnósticos metería los cinco en el hilo de uno:
 *
 * 1. una atención, cita, reconsulta o internación **entra** pero no se expande;
 * 2. otro diagnóstico sólo se expande si se llegó a él por `reemplazado-por`
 *    (el diferencial resuelto es el mismo hilo); por otro vínculo entra como
 *    referencia y ahí se detiene.
 *
 * Un id que no es de un nodo de la red devuelve un conjunto vacío.
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
 * Aplica el filtro. Todos los criterios se combinan con «y».
 *
 * - Con rango de fechas puesto, un nodo **sin fecha** queda fuera: no se puede
 *   afirmar que ocurrió en ese rango.
 * - Un nodo sin profesional o sin especialidad queda fuera cuando se filtra
 *   por profesional o especialidad, por la misma razón.
 * - El texto busca en título, subtítulo, estado, profesional, especialidad,
 *   `buscable`, el nombre del tipo y los textos del análisis (motivo, nota,
 *   resumen clínico, destino, conclusión del informe).
 *
 * Devuelve los nodos en el orden en que llegaron.
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

/** Los textos del análisis que también se buscan: motivo, nota, resumen, destino, conclusión. */
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

/* -- Las opciones de la barra, sacadas de los propios nodos -------------- */

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

/** Los diagnósticos que pueden ser el hilo, del más reciente al más antiguo. */
export function diagnosticosDe(nodos: readonly NodoDeRed[]): readonly NodoDeRed[] {
  return nodos
    .filter((n) => n.tipo === 'diagnostico')
    .sort((a, b) => (b.cuando?.getTime() ?? 0) - (a.cuando?.getTime() ?? 0));
}

/** Los tipos presentes, en el orden canónico de `TIPOS_DE_NODO`. */
export function tiposPresentes(
  nodos: readonly NodoDeRed[],
  orden: readonly TipoDeNodo[],
): readonly TipoDeNodo[] {
  const presentes = new Set(nodos.map((n) => n.tipo));
  return orden.filter((t) => presentes.has(t));
}
