/* ============================================================================
    Where everything goes in the clinical network by episodes.

    Pure functions: they take the records, their links, the grouping into
    episodes and what is expanded, and return coordinates. Kept apart from the
    component so it is tested without a browser: a line running behind another
    card asserts a link that does not exist.

    ## The plane

    - Left to right, time: one **column** per encounter or per day with
      activity, shared by every thread so that what is simultaneous lines up.
      It is not a proportional scale: the real interval is written on the axis.
    - Top to bottom, one **thread** per episode. Collapsed it is a summary strip
      with its milestones; expanded it shows its records in the columns.
    - A column is **wide** if some expanded thread has records in it; otherwise
      it is **narrow** (76 px instead of 248): collapsed, the history takes a
      fraction of the width.

    ## The lines

    - An encounter's **trunk** runs down its column's left aisle and hands a
      branch to every record entered in it, in its thread or in another: so a
      shared encounter is drawn once and connects with all of them.
    - The other links are orthogonal **links** with an arrow: they leave from
      the source's right, go down or up the right aisle, cross along the target
      thread's **channel** (a band without cards under its header) and enter the
      target from the left. Between adjacent columns no channel is needed; in
      the same column, a bracket on the right.
    - Each vertical stretch has its lane in its aisle and each horizontal
      stretch its lane in its channel: two lines never share a straight run.

    Steps 1–3 and 8 live in `red-clinica.celdas.ts`, `red-clinica.aristas.ts`
    and `red-clinica.trazos.ts`; the measures and shapes, in
    `red-clinica.geometria.types.ts`.
    ========================================================================== */

import type { RegistroDeLaRed, VinculoDeLaRed } from './red-clinica.model';
import type { EpisodioClinico, HitoDelEpisodio, RedPorEpisodios } from './red-clinica.episodio';
import { describirIntervalo } from './recorrido-clinico.model';
import { armarCeldas } from './red-clinica.celdas';
import { aristasPendientes, type Pendiente } from './red-clinica.aristas';
import { trazarAristas } from './red-clinica.trazos';
import {
  AIRE_CON_EL_TRONCO,
  DISTANCIA_DEL_TRONCO,
  INICIO_DEL_PASILLO,
  MARGEN_DEL_CANAL,
  MEDIDAS_DE_LA_RED,
  PASO_DE_CARRIL,
  type ColumnaDeLaRed,
  type EstadoDeLaRed,
  type HiloDeLaRed,
  type HitoUbicado,
  type NodoDeLaRed,
  type PlanoDeLaRed,
} from './red-clinica.geometria.types';

/** The order of the height fractions links enter by: never the middle, which is the trunk's branch. */
const ENTRADAS = [0.3, 0.7, 0.2, 0.8, 0.38, 0.62, 0.12, 0.88];

export function ubicarRed(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
  red: RedPorEpisodios,
  estado: EstadoDeLaRed,
): PlanoDeLaRed {
  const m = MEDIDAS_DE_LA_RED;
  const celdasDeLaRed = armarCeldas(registros, red, estado);
  const { porId, ordenadas, indiceDeColumna, claveDeColumna, hilosVisibles, celdas, ubicable } = celdasDeLaRed;
  const desplegado = (e: EpisodioClinico): boolean => estado.desplegados.has(e.id);
  const { pendientes, enlaces, carrilDeCanal, carrilesDeCanal } = aristasPendientes(vinculos, celdasDeLaRed);

  /* 4 · The threads, top to bottom. */
  const hilosSinX: { episodio: EpisodioClinico; y: number; alto: number; desplegado: boolean; yCanal: number; altoCanal: number; yPista: number }[] = [];
  const yDeNodo = new Map<string, number>();
  let y = m.altoEje;
  for (const e of hilosVisibles) {
    const abierto = desplegado(e);
    const yCabeza = y;
    if (!abierto) {
      const alto = m.altoCabeceraHilo + m.altoPista;
      hilosSinX.push({ episodio: e, y: yCabeza, alto, desplegado: false, yCanal: 0, altoCanal: 0, yPista: yCabeza + m.altoCabeceraHilo + m.altoPista / 2 - 6 });
      y += alto + m.separacionHilos;
      continue;
    }
    const carriles = carrilesDeCanal.get(e.id) ?? 0;
    const altoCanal = carriles === 0 ? 4 : 2 * MARGEN_DEL_CANAL + (carriles - 1) * PASO_DE_CARRIL;
    const yCanal = yCabeza + m.altoCabeceraHilo;
    const yCeldas = yCanal + altoCanal + m.rellenoHilo;
    let maximo = 0;
    for (let c = 0; c < ordenadas.length; c++) {
      let yy = yCeldas;
      for (const n of celdas.get(`${e.id}#${c}`) ?? []) {
        yDeNodo.set(n.id, yy);
        yy += n.alto + m.separacionNodos;
      }
      maximo = Math.max(maximo, yy - yCeldas - m.separacionNodos);
    }
    const alto = m.altoCabeceraHilo + altoCanal + m.rellenoHilo + Math.max(maximo, 0) + m.rellenoHilo;
    hilosSinX.push({ episodio: e, y: yCabeza, alto, desplegado: true, yCanal, altoCanal, yPista: 0 });
    y += alto + m.separacionHilos;
  }
  const altoTotal = y;
  const hiloPorEpisodio = new Map(hilosSinX.map((h) => [h.episodio.id, h]));

  /* 5 · Each target's entries and the vertical stretches per aisle. */
  const yCentro = (id: string): number => yDeNodo.get(id)! + ubicable.get(id)!.alto / 2;
  const entradasIzq = new Map<string, number>();
  const entradasDer = new Map<string, number>();
  const yEntrada = new Map<string, number>();
  // Heights already taken by a horizontal stretch in each aisle: a source's
  // exit and the entry into a target of the neighbouring column could land at
  // the same height and read as a single line.
  const ocupadas = new Map<number, number[]>();
  const ocupar = (pasillo: number, yy: number): void => {
    ocupadas.set(pasillo, [...(ocupadas.get(pasillo) ?? []), yy]);
  };
  for (const p of enlaces) {
    ocupar(ubicable.get(p.desde)!.columna, yCentro(p.desde));
  }
  for (const p of enlaces) {
    const b = ubicable.get(p.hasta)!;
    const mismaColumna = ubicable.get(p.desde)!.columna === b.columna;
    const pasillo = mismaColumna ? b.columna : b.columna - 1;
    const cuenta = mismaColumna ? entradasDer : entradasIzq;
    let i = cuenta.get(p.hasta) ?? 0;
    const libre = (yy: number): boolean => (ocupadas.get(pasillo) ?? []).every((o) => Math.abs(o - yy) >= 6);
    let elegida = yDeNodo.get(p.hasta)! + b.alto * ENTRADAS[i % ENTRADAS.length];
    for (let intento = 0; intento < ENTRADAS.length && !libre(elegida); intento++) {
      i++;
      elegida = yDeNodo.get(p.hasta)! + b.alto * ENTRADAS[i % ENTRADAS.length];
    }
    cuenta.set(p.hasta, i + 1);
    ocupar(pasillo, elegida);
    yEntrada.set(p.clave, elegida);
  }
  const yDelCanal = (p: Pendiente): number =>
    hiloPorEpisodio.get(ubicable.get(p.hasta)!.episodio)!.yCanal + MARGEN_DEL_CANAL + (carrilDeCanal.get(p.clave) ?? 0) * PASO_DE_CARRIL;

  interface Tramo { readonly pasillo: number; readonly desde: number; readonly hasta: number; readonly clave: string; readonly rol: 'sale' | 'entra' }
  const tramos: Tramo[] = [];
  for (const p of enlaces) {
    const ca = ubicable.get(p.desde)!.columna;
    const cb = ubicable.get(p.hasta)!.columna;
    const y0 = yCentro(p.desde);
    const y1 = yEntrada.get(p.clave)!;
    if (ca === cb || cb === ca + 1) {
      tramos.push({ pasillo: ca, desde: Math.min(y0, y1), hasta: Math.max(y0, y1), clave: p.clave, rol: 'sale' });
      continue;
    }
    const yc = yDelCanal(p);
    tramos.push({ pasillo: ca, desde: Math.min(y0, yc), hasta: Math.max(y0, yc), clave: p.clave, rol: 'sale' });
    tramos.push({ pasillo: cb - 1, desde: Math.min(yc, y1), hasta: Math.max(yc, y1), clave: p.clave, rol: 'entra' });
  }
  const carrilDelTramo = new Map<string, number>();
  const carrilesPorPasillo = new Map<number, number>();
  for (let k = -1; k < ordenadas.length; k++) {
    const delPasillo = tramos
      .filter((t) => t.pasillo === k)
      .sort((a, b) => b.hasta - b.desde - (a.hasta - a.desde) || a.clave.localeCompare(b.clave));
    const ocupados: { desde: number; hasta: number }[][] = [];
    for (const t of delPasillo) {
      let carril = ocupados.findIndex((enUso) =>
        enUso.every((o) => t.hasta + PASO_DE_CARRIL < o.desde || t.desde - PASO_DE_CARRIL > o.hasta),
      );
      if (carril === -1) {
        carril = ocupados.length;
        ocupados.push([]);
      }
      ocupados[carril].push(t);
      carrilDelTramo.set(`${t.clave}|${t.rol}`, carril);
    }
    carrilesPorPasillo.set(k, ocupados.length);
  }
  /* 6 · The x: column and aisle widths. */
  const anchaPorColumna = ordenadas.map((_, c) =>
    hilosSinX.some((h) => h.desplegado && (celdas.get(`${h.episodio.id}#${c}`)?.length ?? 0) > 0),
  );
  const anchoDe = (c: number): number => (anchaPorColumna[c] ? m.anchoAncha : m.anchoAngosta);
  const huecoTras = (k: number): number => {
    const carriles = carrilesPorPasillo.get(k) ?? 0;
    const necesario =
      carriles === 0 ? 0 : INICIO_DEL_PASILLO + (carriles - 1) * PASO_DE_CARRIL + AIRE_CON_EL_TRONCO + DISTANCIA_DEL_TRONCO;
    const minimo = (k >= 0 && anchaPorColumna[k]) || anchaPorColumna[k + 1] ? m.huecoAncho : m.huecoAngosto;
    return Math.max(minimo, necesario);
  };
  const xDeColumna: number[] = [];
  const carrilesIzquierda = carrilesPorPasillo.get(-1) ?? 0;
  const margenIzquierdo =
    carrilesIzquierda === 0
      ? 32
      : INICIO_DEL_PASILLO + (carrilesIzquierda - 1) * PASO_DE_CARRIL + AIRE_CON_EL_TRONCO + DISTANCIA_DEL_TRONCO;
  ordenadas.forEach((_, c) => {
    xDeColumna.push(c === 0 ? margenIzquierdo : xDeColumna[c - 1] + anchoDe(c - 1) + huecoTras(c - 1));
  });
  const bordeDerecho = (c: number): number => xDeColumna[c] + anchoDe(c);
  const xDelCarril = (k: number, carril: number): number =>
    (k === -1 ? 0 : bordeDerecho(k)) + INICIO_DEL_PASILLO + carril * PASO_DE_CARRIL;
  /* 7 · Columns, threads and nodes, placed. */
  const columnas: ColumnaDeLaRed[] = ordenadas.map(([clave, g], c) => {
    const anterior = c === 0 ? null : ordenadas[c - 1][1].fecha;
    return {
      clave,
      x: xDeColumna[c],
      ancho: anchoDe(c),
      ancha: anchaPorColumna[c],
      fecha: g.fecha,
      encuentroId: g.encuentro,
      contexto: g.encuentro !== null ? 'atencion' : g.registros.some((r) => r.encuentroId !== undefined) ? 'dia' : 'sin-atencion',
      intervalo: anterior === null || g.fecha === null ? '' : describirIntervalo(anterior, g.fecha),
      hueco: c === 0 ? 0 : xDeColumna[c] - bordeDerecho(c - 1),
    };
  });
  const nodos: NodoDeLaRed[] = [];
  for (const n of ubicable.values()) {
    nodos.push({ ...n, x: xDeColumna[n.columna], y: yDeNodo.get(n.id)!, ancho: anchoDe(n.columna) });
  }
  const nodoPorId = new Map(nodos.map((n) => [n.id, n]));

  const PRIORIDAD: readonly HitoDelEpisodio['tipo'][] = ['confirmado', 'presuntivo', 'descartado', 'historico', 'internacion', 'derivacion', 'procedimiento', 'momento'];
  const hilos: HiloDeLaRed[] = hilosSinX.map((h) => {
    if (h.desplegado) return { ...h, hitos: [] };
    const porColumna = new Map<number, HitoDelEpisodio[]>();
    for (const hito of h.episodio.hitos) {
      const clave = claveDeColumna.get(hito.id);
      if (clave === undefined || !porId.has(hito.id)) continue;
      const c = indiceDeColumna.get(clave)!;
      porColumna.set(c, [...(porColumna.get(c) ?? []), hito]);
    }
    const hitos: HitoUbicado[] = [...porColumna.entries()]
      .sort(([a], [b]) => a - b)
      .map(([c, lista]) => {
        const tipo = [...lista].sort((a, b) => PRIORIDAD.indexOf(a.tipo) - PRIORIDAD.indexOf(b.tipo))[0].tipo;
        return { x: xDeColumna[c] + anchoDe(c) / 2, y: h.yPista, columna: c, tipo, titulos: lista.map((x) => x.titulo) };
      });
    return { ...h, hitos };
  });
  /* 8 · The strokes. */
  const aristas = trazarAristas(pendientes, nodoPorId, { yEntrada, carrilDelTramo, xDelCarril, yDelCanal });

  const ultima = ordenadas.length - 1;
  const ancho =
    ultima < 0
      ? 320
      : bordeDerecho(ultima) + Math.max(24, INICIO_DEL_PASILLO + (carrilesPorPasillo.get(ultima) ?? 0) * PASO_DE_CARRIL + 8);
  return { ancho, alto: altoTotal, columnas, hilos, nodos, aristas };
}
