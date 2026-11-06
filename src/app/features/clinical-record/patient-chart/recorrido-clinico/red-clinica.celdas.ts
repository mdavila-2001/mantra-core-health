/* ============================================================================
    Steps 1 and 2 of `ubicarRed`: the columns (per encounter in view or per
    day) and what goes in each thread × column cell.
    ========================================================================== */

import { CLASES_DE_DETALLE, CLASES_DE_LA_RED, type RegistroDeLaRed } from './red-clinica.model';
import type { EpisodioClinico, RedPorEpisodios } from './red-clinica.episodio';
import { claveDelDia } from './red-clinica.vinculos';
import { claveDeGrupo, MEDIDAS_DE_LA_RED, type EstadoDeLaRed, type NodoDeLaRed } from './red-clinica.geometria.types';

const SIN_FECHA = 'sin-fecha';

export type NodoSinUbicar = Omit<NodoDeLaRed, 'x' | 'y' | 'ancho'>;

export interface GrupoDeColumna {
  fecha: Date | null;
  encuentro: string | null;
  registros: RegistroDeLaRed[];
}

export interface CeldasDeLaRed {
  readonly porId: ReadonlyMap<string, RegistroDeLaRed>;
  readonly ordenadas: readonly (readonly [string, GrupoDeColumna])[];
  readonly indiceDeColumna: ReadonlyMap<string, number>;
  readonly claveDeColumna: ReadonlyMap<string, string>;
  readonly hilosVisibles: readonly EpisodioClinico[];
  /** Keyed `${episode}#${column}`. */
  readonly celdas: ReadonlyMap<string, readonly NodoSinUbicar[]>;
  /** Hidden detail record → the «+N» node standing for it. */
  readonly representante: ReadonlyMap<string, string>;
  readonly ubicable: ReadonlyMap<string, NodoSinUbicar>;
}

export function armarCeldas(
  registros: readonly RegistroDeLaRed[],
  red: RedPorEpisodios,
  estado: EstadoDeLaRed,
): CeldasDeLaRed {
  const m = MEDIDAS_DE_LA_RED;
  const filtro = estado.visibles !== undefined && estado.visibles !== null && estado.visibles.size > 0 ? estado.visibles : null;
  const visibles = registros.filter((r) => filtro === null || filtro.has(r.id));
  const porId = new Map(visibles.map((r) => [r.id, r]));
  /* 1 · Columns: per encounter (in view) or per day. */
  const columnaDe = (r: RegistroDeLaRed): { clave: string; fecha: Date | null; encuentro: string | null } => {
    if (r.clase === 'atencion') {
      return { clave: `enc:${r.id}`, fecha: r.cuando, encuentro: r.id };
    }
    const atencion = r.encuentroId === undefined ? undefined : porId.get(r.encuentroId);
    if (atencion !== undefined && atencion.clase === 'atencion') {
      return { clave: `enc:${atencion.id}`, fecha: atencion.cuando, encuentro: atencion.id };
    }
    return r.cuando === null
      ? { clave: SIN_FECHA, fecha: null, encuentro: null }
      : { clave: `dia:${claveDelDia(r.cuando)}`, fecha: r.cuando, encuentro: null };
  };
  const grupos = new Map<string, { fecha: Date | null; encuentro: string | null; registros: RegistroDeLaRed[] }>();
  const claveDeColumna = new Map<string, string>();
  for (const r of visibles) {
    const { clave, fecha, encuentro } = columnaDe(r);
    claveDeColumna.set(r.id, clave);
    const g = grupos.get(clave);
    if (g === undefined) {
      grupos.set(clave, { fecha, encuentro, registros: [r] });
    } else {
      g.registros.push(r);
      if (g.encuentro === null && fecha !== null && (g.fecha === null || fecha < g.fecha)) g.fecha = fecha;
    }
  }
  const ordenadas = [...grupos.entries()].sort(([, a], [, b]) => {
    if (a.fecha === null) return b.fecha === null ? 0 : 1;
    if (b.fecha === null) return -1;
    return a.fecha.getTime() - b.fecha.getTime();
  });
  const indiceDeColumna = new Map(ordenadas.map(([clave], i) => [clave, i]));
  /* 2 · The visible threads and what goes in each cell. */
  const hilosVisibles = red.episodios.filter((e) =>
    [...e.miembros, ...e.compartidos].some((id) => porId.has(id)),
  );
  const desplegado = (e: EpisodioClinico): boolean => estado.desplegados.has(e.id);

  const celdas = new Map<string, NodoSinUbicar[]>();
  const representante = new Map<string, string>();
  const ordenDeClase = (r: RegistroDeLaRed): number => CLASES_DE_LA_RED.indexOf(r.clase);
  for (const e of hilosVisibles) {
    if (!desplegado(e)) continue;
    const delHilo = e.miembros.map((id) => porId.get(id)).filter((r): r is RegistroDeLaRed => r !== undefined);
    for (const [claveCol, columna] of indiceDeColumna) {
      const enLaCelda = delHilo
        .filter((r) => claveDeColumna.get(r.id) === claveCol)
        .sort((a, b) => ordenDeClase(a) - ordenDeClase(b) || (a.cuando?.getTime() ?? 0) - (b.cuando?.getTime() ?? 0) || a.id.localeCompare(b.id));
      if (enLaCelda.length === 0) continue;
      const nodos: NodoSinUbicar[] = [];
      for (const r of enLaCelda.filter((x) => !CLASES_DE_DETALLE.has(x.clase))) {
        if (r.clase === 'diagnostico' && r.certeza === 'descartado') {
          if (estado.abiertos.has(r.id)) {
            nodos.push({ id: `plegar:${r.id}`, forma: 'plegar', registro: r, episodio: e.id, columna, alto: m.altoCompacto });
            nodos.push({ id: r.id, forma: 'tarjeta', registro: r, episodio: e.id, columna, alto: m.altoNodo });
          } else {
            nodos.push({ id: r.id, forma: 'descartado', registro: r, episodio: e.id, columna, alto: m.altoCompacto });
          }
          continue;
        }
        nodos.push({ id: r.id, forma: 'tarjeta', registro: r, episodio: e.id, columna, alto: m.altoNodo });
      }
      const detalle = enLaCelda.filter((x) => CLASES_DE_DETALLE.has(x.clase));
      const clave = claveDeGrupo(e.id, claveCol);
      if (detalle.length === 1) {
        nodos.push({ id: detalle[0].id, forma: 'tarjeta', registro: detalle[0], episodio: e.id, columna, alto: m.altoNodo });
      } else if (detalle.length > 1) {
        if (estado.abiertos.has(clave)) {
          for (const r of detalle) {
            nodos.push({ id: r.id, forma: 'tarjeta', registro: r, episodio: e.id, columna, alto: m.altoNodo });
          }          // Same id as the «+N»: Angular keeps the button and the focus.
          nodos.push({ id: `grupo:${clave}`, forma: 'grupo', episodio: e.id, columna, alto: m.altoGrupo, grupo: { accion: 'contraer', clave, ocultos: [] } });
        } else {
          detalle.forEach((r) => representante.set(r.id, `grupo:${clave}`));
          nodos.push({ id: `grupo:${clave}`, forma: 'grupo', episodio: e.id, columna, alto: m.altoGrupo, grupo: { accion: 'expandir', clave, ocultos: detalle } });
        }
      }
      celdas.set(`${e.id}#${columna}`, nodos);
    }
  }
  const ubicable = new Map<string, NodoSinUbicar>();
  for (const nodos of celdas.values()) for (const n of nodos) ubicable.set(n.id, n);  return { porId, ordenadas, indiceDeColumna, claveDeColumna, hilosVisibles, celdas, representante, ubicable };
}
