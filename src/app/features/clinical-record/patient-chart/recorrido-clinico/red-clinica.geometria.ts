/* ============================================================================
    Dónde va cada cosa en la red clínica por episodios.

    Funciones puras: reciben los registros, sus vínculos, la agrupación en
    episodios y qué está desplegado, y devuelven coordenadas. Separado del
    componente para que se pruebe sin navegador: una línea que pasa por detrás
    de otra tarjeta afirma un vínculo que no existe.

    ## El plano

    - De izquierda a derecha, el tiempo: una **columna** por atención o por día
      con actividad, compartida por todos los hilos para que lo simultáneo
      quede alineado. No es una escala proporcional: el intervalo real se
      escribe sobre el eje.
    - De arriba abajo, un **hilo** por episodio. Plegado es una franja-resumen
      con sus hitos; desplegado muestra sus registros en las columnas.
    - Una columna es **ancha** si algún hilo desplegado tiene registros en
      ella; si no, es **angosta**: con todo plegado, dieciocho meses entran en
      una pantalla.

    ## Las líneas

    - El **tronco** de una atención baja por el pasillo izquierdo de su columna
      y entrega una rama a cada registro asentado en ella, en su hilo o en
      otro: así una atención compartida se dibuja una vez y conecta con todos.
    - Los demás vínculos son **enlaces** ortogonales con flecha: salen por la
      derecha del origen, bajan o suben por el pasillo de la derecha, cruzan
      por el **canal** del hilo de destino (una banda sin tarjetas debajo de su
      cabecera) y entran por la izquierda del destino. Entre columnas
      contiguas no hace falta canal; en la misma columna, un corchete por la
      derecha.
    - Cada tramo vertical tiene su carril en su pasillo y cada tramo
      horizontal su carril en su canal: dos líneas no comparten recta.
    ========================================================================== */

import {
  CLASES_DE_DETALLE,
  CLASES_DE_LA_RED,
  claveDelDia,
  esInferido,
  type EpisodioClinico,
  type HitoDelEpisodio,
  type MotivoDelVinculo,
  type RedPorEpisodios,
  type RegistroDeLaRed,
  type VinculoDeLaRed,
} from './red-clinica.model';
import { describirIntervalo } from './recorrido-clinico.model';

/** Medidas en píxeles CSS. Fijas: el trazado depende de ellas. */
export const MEDIDAS_DE_LA_RED = {
  anchoAncha: 248,
  anchoAngosta: 76,
  altoEje: 76,
  altoCabeceraHilo: 56,
  altoPista: 40,
  altoNodo: 86,
  altoCompacto: 40,
  altoGrupo: 56,
  separacionNodos: 16,
  rellenoHilo: 14,
  separacionHilos: 10,
  huecoAncho: 64,
  huecoAngosto: 14,
} as const;

/** Dónde empieza el carril más cercano a una tarjeta en su pasillo: más que una punta de flecha. */
export const INICIO_DEL_PASILLO = 18;
/** La distancia entre dos carriles paralelos. */
export const PASO_DE_CARRIL = 7;
/** Aire entre el carril más externo y el tronco de la columna siguiente. */
const AIRE_CON_EL_TRONCO = 12;
/** A cuánto del borde izquierdo de su columna va el tronco de la atención. */
export const DISTANCIA_DEL_TRONCO = 24;
/** Aire entre el canal y lo que tiene arriba y abajo. */
const MARGEN_DEL_CANAL = 8;

/** Qué está abierto. Todo lo que no figura, plegado. */
export interface EstadoDeLaRed {
  /** Los episodios desplegados (nivel 2). */
  readonly desplegados: ReadonlySet<string>;
  /**
   * Lo abierto dentro de un episodio: los diagnósticos descartados (por su id)
   * y los grupos de detalle (por la clave de su «+N»).
   */
  readonly abiertos: ReadonlySet<string>;
  /** Si viene, sólo estos registros se dibujan. Vacío o ausente: todos. */
  readonly visibles?: ReadonlySet<string> | null;
}

export type FormaDelNodo = 'tarjeta' | 'descartado' | 'plegar' | 'grupo';

export interface NodoDeLaRed {
  /** El id del registro real; para los controles, `grupo:…` o `plegar:…`. */
  readonly id: string;
  readonly forma: FormaDelNodo;
  /** El registro que representa; ausente en un grupo. */
  readonly registro?: RegistroDeLaRed;
  readonly episodio: string;
  readonly columna: number;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** Sólo grupos: qué abre o cierra. */
  readonly grupo?: {
    readonly accion: 'expandir' | 'contraer';
    readonly clave: string;
    readonly ocultos: readonly RegistroDeLaRed[];
  };
}

export interface ColumnaDeLaRed {
  readonly clave: string;
  readonly x: number;
  readonly ancho: number;
  readonly ancha: boolean;
  readonly fecha: Date | null;
  readonly encuentroId: string | null;
  /** Igual que en el recorrido anterior: atención a la vista, día con atención oculta, o sin atención. */
  readonly contexto: 'atencion' | 'dia' | 'sin-atencion';
  readonly intervalo: string;
  readonly hueco: number;
}

export interface HitoUbicado {
  readonly x: number;
  readonly y: number;
  readonly columna: number;
  readonly tipo: HitoDelEpisodio['tipo'];
  readonly titulos: readonly string[];
}

export interface HiloDeLaRed {
  readonly episodio: EpisodioClinico;
  readonly y: number;
  readonly alto: number;
  readonly desplegado: boolean;
  /** Plegado: la franja-resumen. */
  readonly hitos: readonly HitoUbicado[];
  readonly yPista: number;
  /** Desplegado: dónde corre el canal. */
  readonly yCanal: number;
  readonly altoCanal: number;
}

export type Punto = readonly [number, number];

export interface AristaDeLaRed {
  readonly clave: string;
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDelVinculo;
  readonly inferido: boolean;
  /** `tronco`: de una atención a lo asentado en su columna. `enlace`: con flecha. */
  readonly familia: 'tronco' | 'enlace';
  readonly trazo: string;
  readonly puntos: readonly Punto[];
  /** Dónde va la palabra «inferido», si lo es. */
  readonly etiqueta?: { readonly x: number; readonly y: number; readonly vertical: boolean };
}

export interface PlanoDeLaRed {
  readonly ancho: number;
  readonly alto: number;
  readonly columnas: readonly ColumnaDeLaRed[];
  readonly hilos: readonly HiloDeLaRed[];
  readonly nodos: readonly NodoDeLaRed[];
  readonly aristas: readonly AristaDeLaRed[];
}

const SIN_FECHA = 'sin-fecha';

/** La clave del grupo de detalle de un hilo en una columna. */
export function claveDeGrupo(episodio: string, columna: string): string {
  return `${episodio}|${columna}`;
}

/** El orden de las fracciones de alto por las que entran los enlaces: nunca por el medio, que es la rama del tronco. */
const ENTRADAS = [0.3, 0.7, 0.2, 0.8, 0.38, 0.62, 0.12, 0.88];

export function ubicarRed(
  registros: readonly RegistroDeLaRed[],
  vinculos: readonly VinculoDeLaRed[],
  red: RedPorEpisodios,
  estado: EstadoDeLaRed,
): PlanoDeLaRed {
  const m = MEDIDAS_DE_LA_RED;
  const filtro = estado.visibles !== undefined && estado.visibles !== null && estado.visibles.size > 0 ? estado.visibles : null;
  const visibles = registros.filter((r) => filtro === null || filtro.has(r.id));
  const porId = new Map(visibles.map((r) => [r.id, r]));

  /* 1 · Columnas: por atención (a la vista) o por día. */
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

  /* 2 · Los hilos visibles y lo que va en cada celda. */
  const hilosVisibles = red.episodios.filter((e) =>
    [...e.miembros, ...e.compartidos].some((id) => porId.has(id)),
  );
  const desplegado = (e: EpisodioClinico): boolean => estado.desplegados.has(e.id);

  type NodoSinUbicar = Omit<NodoDeLaRed, 'x' | 'y' | 'ancho'>;
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
          }
          // El mismo id que el «+N»: Angular conserva el botón y el foco.
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
  for (const nodos of celdas.values()) for (const n of nodos) ubicable.set(n.id, n);

  /* 3 · Las aristas, antes de ubicar: decide cuánto aire hace falta. */
  interface Pendiente {
    readonly clave: string;
    readonly desde: string;
    readonly hasta: string;
    readonly motivo: MotivoDelVinculo;
    readonly familia: 'tronco' | 'enlace';
  }
  const pendientes: Pendiente[] = [];
  const vistas = new Set<string>();
  for (const v of vinculos) {
    const desde = representante.get(v.desde) ?? v.desde;
    const hasta = representante.get(v.hasta) ?? v.hasta;
    const a = ubicable.get(desde);
    const b = ubicable.get(hasta);
    if (a === undefined || b === undefined || desde === hasta) continue;
    const clave = `${v.motivo}:${desde}>${hasta}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    const atencionA = a.registro?.clase === 'atencion';
    const atencionB = b.registro?.clase === 'atencion';
    // Un vínculo inferido nunca va por el tronco: ahí quedaría tapado por los
    // reales de la misma atención y su trazo punteado no se vería.
    const tronco =
      a.columna === b.columna && (atencionA || atencionB) && !(atencionA && atencionB) && !esInferido(v.motivo);
    if (tronco) {
      // El tronco sale siempre de la atención.
      pendientes.push(atencionA ? { clave, desde, hasta, motivo: v.motivo, familia: 'tronco' } : { clave, desde: hasta, hasta: desde, motivo: v.motivo, familia: 'tronco' });
    } else {
      pendientes.push({ clave, desde, hasta, motivo: v.motivo, familia: 'enlace' });
    }
  }
  const enlaces = pendientes.filter((p) => p.familia === 'enlace');
  const usaCanal = (p: Pendiente): boolean => {
    const ca = ubicable.get(p.desde)!.columna;
    const cb = ubicable.get(p.hasta)!.columna;
    return ca !== cb && cb !== ca + 1;
  };

  // Carriles del canal de cada hilo, por intervalo de pasillos (no de x:
  // la x todavía no se sabe, y el orden de los pasillos es el mismo).
  const carrilDeCanal = new Map<string, number>();
  const carrilesDeCanal = new Map<string, number>();
  for (const e of hilosVisibles) {
    const delCanal = enlaces
      .filter((p) => usaCanal(p) && ubicable.get(p.hasta)!.episodio === e.id)
      .map((p) => {
        const ks = ubicable.get(p.desde)!.columna;
        const kt = ubicable.get(p.hasta)!.columna - 1;
        return { p, a: Math.min(ks, kt), b: Math.max(ks, kt) };
      })
      .sort((x, y) => x.a - y.a || x.b - y.b || x.p.clave.localeCompare(y.p.clave));
    const ocupados: { a: number; b: number }[][] = [];
    for (const tramo of delCanal) {
      let carril = ocupados.findIndex((enUso) => enUso.every((o) => tramo.b < o.a || tramo.a > o.b));
      if (carril === -1) {
        carril = ocupados.length;
        ocupados.push([]);
      }
      ocupados[carril].push(tramo);
      carrilDeCanal.set(tramo.p.clave, carril);
    }
    carrilesDeCanal.set(e.id, ocupados.length);
  }

  /* 4 · Los hilos, de arriba abajo. */
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

  /* 5 · Entradas de cada destino y tramos verticales por pasillo. */
  const yCentro = (id: string): number => yDeNodo.get(id)! + ubicable.get(id)!.alto / 2;
  const entradasIzq = new Map<string, number>();
  const entradasDer = new Map<string, number>();
  const yEntrada = new Map<string, number>();
  // Las alturas ya tomadas por un tramo horizontal en cada pasillo: la salida
  // de un origen y la entrada a un destino de la columna vecina podían caer a
  // la misma altura y leerse como una sola línea.
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

  /* 6 · Las x: anchos de columna y de pasillo. */
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

  /* 7 · Columnas, hilos y nodos ubicados. */
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

  /* 8 · Los trazos. */
  const aristas: AristaDeLaRed[] = [];
  for (const p of pendientes) {
    const a = nodoPorId.get(p.desde)!;
    const b = nodoPorId.get(p.hasta)!;
    const inferido = esInferido(p.motivo);
    if (p.familia === 'tronco') {
      const puntos = puntosDelTronco(a, b);
      aristas.push({
        ...p,
        inferido,
        trazo: trazoDelTronco(a, b),
        puntos,
        ...(inferido ? { etiqueta: { x: a.x - DISTANCIA_DEL_TRONCO, y: (puntos[1][1] + puntos[2][1]) / 2, vertical: true } } : {}),
      });
      continue;
    }
    const y0 = a.y + a.alto / 2;
    const y1 = yEntrada.get(p.clave)!;
    const lx = xDelCarril(a.columna, carrilDelTramo.get(`${p.clave}|sale`) ?? 0);
    let puntos: Punto[];
    let etiqueta: AristaDeLaRed['etiqueta'];
    if (a.columna === b.columna) {
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, y1], [b.x + b.ancho, y1]];
      etiqueta = { x: lx, y: (y0 + y1) / 2, vertical: true };
    } else if (b.columna === a.columna + 1) {
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, y1], [b.x, y1]];
      etiqueta = { x: lx, y: (y0 + y1) / 2, vertical: true };
    } else {
      const yc = yDelCanal(p);
      const lt = xDelCarril(b.columna - 1, carrilDelTramo.get(`${p.clave}|entra`) ?? 0);
      puntos = [[a.x + a.ancho, y0], [lx, y0], [lx, yc], [lt, yc], [lt, y1], [b.x, y1]];
      etiqueta = { x: (lx + lt) / 2, y: yc, vertical: false };
    }
    aristas.push({ ...p, inferido, trazo: poligonal(puntos), puntos, ...(inferido ? { etiqueta } : {}) });
  }

  const ultima = ordenadas.length - 1;
  const ancho =
    ultima < 0
      ? 320
      : bordeDerecho(ultima) + Math.max(24, INICIO_DEL_PASILLO + (carrilesPorPasillo.get(ultima) ?? 0) * PASO_DE_CARRIL + 8);
  return { ancho, alto: altoTotal, columnas, hilos, nodos, aristas };
}

/** Los vértices del tronco: de la atención por el pasillo izquierdo hasta el registro. */
function puntosDelTronco(desde: NodoDeLaRed, hasta: NodoDeLaRed): Punto[] {
  const tronco = desde.x - DISTANCIA_DEL_TRONCO;
  const y0 = desde.y + desde.alto / 2;
  const y1 = hasta.y + hasta.alto / 2;
  return [[desde.x, y0], [tronco, y0], [tronco, y1], [hasta.x, y1]];
}

function trazoDelTronco(desde: NodoDeLaRed, hasta: NodoDeLaRed): string {
  const [[x0, y0], [tronco], , [x1, y1]] = puntosDelTronco(desde, hasta);
  const r = Math.min(10, Math.abs(y1 - y0) / 2);
  const sentido = y1 >= y0 ? 1 : -1;
  return [
    `M ${x0} ${y0}`,
    `H ${tronco + r}`,
    `Q ${tronco} ${y0} ${tronco} ${y0 + r * sentido}`,
    `V ${y1 - r * sentido}`,
    `Q ${tronco} ${y1} ${tronco + r} ${y1}`,
    `H ${x1}`,
  ].join(' ');
}

/** Una poligonal con las esquinas redondeadas, para que el ojo siga una línea. */
export function poligonal(puntos: readonly Punto[], radio = 6): string {
  const partes = [`M ${puntos[0][0]} ${puntos[0][1]}`];
  for (let i = 1; i < puntos.length - 1; i++) {
    const [ax, ay] = puntos[i - 1];
    const [bx, by] = puntos[i];
    const [cx, cy] = puntos[i + 1];
    const r = Math.min(radio, Math.hypot(bx - ax, by - ay) / 2, Math.hypot(cx - bx, cy - by) / 2);
    const haciaA = Math.hypot(bx - ax, by - ay) || 1;
    const haciaC = Math.hypot(cx - bx, cy - by) || 1;
    const antes = [bx - ((bx - ax) / haciaA) * r, by - ((by - ay) / haciaA) * r];
    const despues = [bx + ((cx - bx) / haciaC) * r, by + ((cy - by) / haciaC) * r];
    partes.push(`L ${antes[0]} ${antes[1]}`, `Q ${bx} ${by} ${despues[0]} ${despues[1]}`);
  }
  const [ux, uy] = puntos[puntos.length - 1];
  partes.push(`L ${ux} ${uy}`);
  return partes.join(' ');
}
