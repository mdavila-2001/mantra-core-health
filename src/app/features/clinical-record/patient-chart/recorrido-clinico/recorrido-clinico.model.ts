/* ============================================================================
    El recorrido clínico: la historia como un mapa de decisiones.

    Funciones puras y sin Angular: reciben los registros ya traducidos y sus
    vínculos **reales** —los que el contrato devuelve— y calculan dónde va cada
    nodo y por dónde pasa cada conexión. Separado del componente para que la
    geometría se pruebe sin navegador: una conexión que apunta al nodo
    equivocado es un error clínico, no estético.
    ========================================================================== */

import type { Tone } from '../../../../shared/components/tone/tone.types';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';

/**
 * Los tipos de registro, en el orden en que se **razona** una atención: se
 * atiende, se observa, se diagnostica, se trata, se deja constancia. Es el
 * orden de los carriles de arriba abajo, así las conexiones bajan.
 */
export const TIPOS_DEL_RECORRIDO = [
  'encuentros',
  'internaciones',
  'observaciones',
  'diagnosticos',
  'medicacion',
  'planes',
  'notas',
  'documentos',
] as const;

export type TipoDelRecorrido = (typeof TIPOS_DEL_RECORRIDO)[number];

/** Cómo se presenta cada tipo. El tono nunca va solo: lleva ícono y nombre. */
export interface AspectoDelTipo {
  readonly singular: string;
  readonly plural: string;
  readonly tono: Tone | 'neutral';
  readonly icono: NavIconName;
}

export const ASPECTO_DEL_TIPO: Readonly<Record<TipoDelRecorrido, AspectoDelTipo>> = {
  encuentros: { singular: 'Atención', plural: 'Atenciones', tono: 'primary', icono: 'stethoscope' },
  internaciones: {
    singular: 'Internación',
    plural: 'Internaciones',
    tono: 'warning',
    icono: 'hospital',
  },
  observaciones: {
    singular: 'Observación',
    plural: 'Observaciones',
    tono: 'info',
    icono: 'flask',
  },
  diagnosticos: { singular: 'Diagnóstico', plural: 'Diagnósticos', tono: 'error', icono: 'heart' },
  medicacion: { singular: 'Medicación', plural: 'Medicación', tono: 'success', icono: 'pill' },
  planes: {
    singular: 'Plan de cuidados',
    plural: 'Planes de cuidados',
    tono: 'secondary',
    icono: 'clipboard',
  },
  notas: { singular: 'Nota clínica', plural: 'Notas', tono: 'neutral', icono: 'note' },
  documentos: { singular: 'Documento', plural: 'Documentos', tono: 'neutral', icono: 'folder' },
};

/** Un registro del expediente, listo para ubicarse en el recorrido. */
export interface NodoDelRecorrido {
  readonly id: string;
  readonly tipo: TipoDelRecorrido;
  readonly principal: string;
  readonly secundario: string;
  readonly estado: string;
  /**
   * El tono del estado, con la MISMA regla que la tabla (`estadoTono ?? 'info'`):
   * «Enfermedad activa» no puede ser verde en una vista y roja en otra.
   */
  readonly tonoDelEstado?: Tone;
  readonly cuando: Date | null;
  /**
   * La atención en la que se registró, si el contrato la guarda y está a la
   * vista. Es lo que lo pone en la columna de esa atención: se decidió ahí,
   * aunque la enfermedad haya empezado antes.
   */
  readonly encuentroId?: string;
}

/**
 * Por qué dos registros están conectados.
 *
 * - `atencion`: el registro se decidió en esa atención (`encounterId`).
 * - `indicacion`: la receta se indicó para ese diagnóstico
 *   (`indicationConditionId`).
 *
 * No hay más: cualquier otra flecha sería una asociación inventada.
 */
export type MotivoDeConexion = 'atencion' | 'indicacion';

export interface AristaDelRecorrido {
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDeConexion;
}

/* -- La geometría --------------------------------------------------------- */

/** Medidas en píxeles CSS. Fijas: el trazado de las conexiones depende de ellas. */
export const MEDIDAS = {
  // Ancho y alto pensados para nombres clínicos largos («Hipertensión arterial
  // esencial», «Enalapril 10 mg comprimidos») en dos renglones: con 232 × 68 se
  // cortaban en el primero aun a 1440 px.
  anchoColumna: 248,
  separacionColumnas: 64,
  margenLateral: 24,
  altoCabecera: 76,
  altoRotuloCarril: 32,
  altoNodo: 86,
  // Holgada a propósito: por este hueco cruzan las indicaciones entre
  // columnas, cada una a su altura y a 6 px o más de las tarjetas.
  separacionNodos: 20,
  rellenoCarril: 16,
} as const;

export interface ColumnaUbicada {
  readonly clave: string;
  readonly x: number;
  readonly fecha: Date | null;
  /** La atención que da nombre a la columna, si la hay. */
  readonly encuentroId: string | null;
  /**
   * Qué es la columna, para su rótulo:
   *
   * - `atencion`: la de una atención a la vista;
   * - `dia`: un día cuyos registros **sí** cuelgan de una atención, pero esa
   *   atención no está dibujada —el filtro la oculta o quedó fuera del tope de
   *   la lectura—. Decir «Sin atención» acá sería una afirmación clínica falsa;
   * - `sin-atencion`: ningún registro del día trae atención.
   */
  readonly contexto: 'atencion' | 'dia' | 'sin-atencion';
  /** Cuánto pasó desde la columna anterior, en palabras; vacío en la primera. */
  readonly intervalo: string;
  /**
   * El ancho del pasillo entre esta columna y la anterior (0 en la primera).
   * No es fijo: se ensancha cuando por él bajan más indicaciones de las que
   * entran en el ancho de siempre.
   */
  readonly hueco: number;
  readonly nodos: readonly NodoUbicado[];
}

export interface CarrilUbicado {
  readonly tipo: TipoDelRecorrido;
  readonly y: number;
  readonly alto: number;
  readonly cantidad: number;
}

export interface NodoUbicado extends NodoDelRecorrido {
  readonly x: number;
  readonly y: number;
  readonly columna: number;
  /**
   * Si el nodo no es un registro sino el control de una celda agrupada:
   * `expandir` resume los registros ocultos, `contraer` vuelve a agruparlos.
   * Lleva la clave de la celda, que es lo que el componente alterna.
   */
  readonly grupo?: { readonly accion: 'expandir' | 'contraer'; readonly celda: string; readonly ocultos: number };
}

export interface AristaUbicada extends AristaDelRecorrido {
  readonly clave: string;
  /** El atributo `d` del `<path>`. */
  readonly trazo: string;
  /**
   * Los vértices del recorrido ortogonal de una indicación, antes de
   * redondear las esquinas. Las pruebas los usan para comprobar que dos
   * indicaciones no compartan un tramo y que ninguna pase por una tarjeta.
   */
  readonly puntos?: readonly Punto[];
}

export type Punto = readonly [number, number];

export interface RecorridoUbicado {
  readonly ancho: number;
  readonly alto: number;
  readonly columnas: readonly ColumnaUbicada[];
  readonly carriles: readonly CarrilUbicado[];
  readonly nodos: readonly NodoUbicado[];
  readonly aristas: readonly AristaUbicada[];
}

const SIN_FECHA = 'sin-fecha';

/**
 * Cuántos registros de un mismo tipo muestra una celda antes de agruparse.
 *
 * Una consulta de control deja ocho signos vitales: dibujados todos, el carril
 * de observaciones ocupa media pantalla y empuja el diagnóstico —que es lo que
 * se vino a mirar— fuera de la vista. Pasado el tope, la celda muestra los
 * primeros y un nodo «+6 observaciones» que la abre.
 */
export const TOPE_POR_CELDA = 3;

/** La clave de una celda: columna y tipo. */
export function claveDeCelda(columna: string, tipo: TipoDelRecorrido): string {
  return `${columna}|${tipo}`;
}

/** La clave del día local, `aaaa-mm-dd`. Dos registros del mismo día comparten columna. */
function claveDelDia(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `dia:${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Cuánto pasó entre dos fechas, como lo diría quien atiende.
 *
 * Redondea hacia lo legible —«3 meses», no «94 días»—: el intervalo orienta la
 * lectura del recorrido, no reemplaza a la fecha, que va en la cabecera.
 */
export function describirIntervalo(antes: Date, despues: Date): string {
  // Días de calendario, no tramos de 24 h: dos columnas con la misma fecha en
  // la cabecera no pueden quedar a «1 día», ni dos fechas distintas al «mismo día».
  const medianoche = (fecha: Date): number =>
    Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  const dias = Math.round((medianoche(despues) - medianoche(antes)) / 86_400_000);
  if (dias <= 0) {
    return 'el mismo día';
  }
  if (dias === 1) {
    return '1 día';
  }
  if (dias < 14) {
    return `${dias} días`;
  }
  if (dias < 60) {
    return `${Math.round(dias / 7)} semanas`;
  }
  if (dias < 365) {
    return `${Math.round(dias / 30)} meses`;
  }
  const anios = Math.round((dias / 365) * 10) / 10;
  return anios === 1 ? '1 año' : `${String(anios).replace('.', ',')} años`;
}

/**
 * Ubica los nodos y traza las conexiones.
 *
 * ## Columnas: momentos, no una escala de tiempo
 *
 * Cada columna es una atención o un día con actividad, en orden cronológico
 * de izquierda a derecha. Una escala proporcional dejaría cuatro años de vacío
 * entre dos consultas y apiñaría tres registros de una misma semana; el
 * intervalo real se escribe sobre el eje, entre columna y columna.
 *
 * Lo registrado **en** una atención va en la columna de esa atención aunque su
 * fecha propia sea otra: un diagnóstico con inicio hace un año se decidió hoy.
 *
 * ## Carriles: uno por tipo
 *
 * El alto de un carril es el de su celda más poblada. Un carril sin registros
 * no se dibuja.
 *
 * ## Conexiones
 *
 * La atención baja por un **tronco** en el pasillo izquierdo de su columna y
 * entrega a cada registro una rama corta: se lee como «de esta consulta salió
 * esto». La indicación de una receta va del borde derecho del diagnóstico al
 * de la receta: en la misma columna, como un corchete; entre columnas, como
 * una curva que avanza en el tiempo.
 */
export function ubicarRecorrido(
  nodos: readonly NodoDelRecorrido[],
  aristas: readonly AristaDelRecorrido[],
  celdasAbiertas: ReadonlySet<string> = new Set(),
): RecorridoUbicado {
  const m = MEDIDAS;
  const porId = new Map(nodos.map((nodo) => [nodo.id, nodo]));

  /* 1 · A qué columna va cada nodo. */
  const columnaDe = (nodo: NodoDelRecorrido): { clave: string; fecha: Date | null; encuentro: string | null } => {
    if (nodo.tipo === 'encuentros') {
      return { clave: `enc:${nodo.id}`, fecha: nodo.cuando, encuentro: nodo.id };
    }
    const encuentro = nodo.encuentroId === undefined ? undefined : porId.get(nodo.encuentroId);
    if (encuentro !== undefined && encuentro.tipo === 'encuentros') {
      return { clave: `enc:${encuentro.id}`, fecha: encuentro.cuando, encuentro: encuentro.id };
    }
    return nodo.cuando === null
      ? { clave: SIN_FECHA, fecha: null, encuentro: null }
      : { clave: claveDelDia(nodo.cuando), fecha: nodo.cuando, encuentro: null };
  };

  const grupos = new Map<string, { fecha: Date | null; encuentro: string | null; nodos: NodoDelRecorrido[] }>();
  for (const nodo of nodos) {
    const { clave, fecha, encuentro } = columnaDe(nodo);
    const grupo = grupos.get(clave);
    if (grupo === undefined) {
      grupos.set(clave, { fecha, encuentro, nodos: [nodo] });
    } else {
      grupo.nodos.push(nodo);
      // El día sin atención se fecha con su registro más temprano.
      if (grupo.encuentro === null && fecha !== null && (grupo.fecha === null || fecha < grupo.fecha)) {
        grupo.fecha = fecha;
      }
    }
  }

  // Cronológico; lo que no tiene fecha, al final y a la vista.
  const ordenadas = [...grupos.entries()].sort(([, a], [, b]) => {
    if (a.fecha === null) return b.fecha === null ? 0 : 1;
    if (b.fecha === null) return -1;
    return a.fecha.getTime() - b.fecha.getTime();
  });

  /* 2 · Las celdas: lo que se dibuja de cada tipo en cada columna. Una celda
     llena se agrupa, y los registros que quedan ocultos se representan por su
     nodo de grupo —también en las conexiones—. */
  const tiposPresentes = TIPOS_DEL_RECORRIDO.filter((tipo) => nodos.some((n) => n.tipo === tipo));
  const representante = new Map<string, string>();
  const celdas = new Map<string, readonly (NodoDelRecorrido & Pick<NodoUbicado, 'grupo'>)[]>();
  for (const [clave, grupo] of ordenadas) {
    for (const tipo of tiposPresentes) {
      const delTipo = grupo.nodos
        .filter((n) => n.tipo === tipo)
        .sort((a, b) => (a.cuando?.getTime() ?? 0) - (b.cuando?.getTime() ?? 0));
      const celda = claveDeCelda(clave, tipo);
      if (delTipo.length <= TOPE_POR_CELDA) {
        celdas.set(celda, delTipo);
        continue;
      }
      const plural = ASPECTO_DEL_TIPO[tipo].plural.toLowerCase();
      if (celdasAbiertas.has(celda)) {
        celdas.set(celda, [
          ...delTipo,
          {
            // El mismo id que el «+N» que reemplaza: Angular conserva el
            // botón —y con él el foco y su `aria-expanded`— en vez de
            // destruirlo y dejar a quien navega con teclado en el `<body>`.
            id: `grupo:${celda}`,
            tipo,
            principal: 'Mostrar menos',
            secundario: `Agrupar ${delTipo.length - (TOPE_POR_CELDA - 1)} ${plural}`,
            estado: '',
            cuando: null,
            grupo: { accion: 'contraer', celda, ocultos: 0 },
          },
        ]);
        continue;
      }
      const visibles = delTipo.slice(0, TOPE_POR_CELDA - 1);
      const ocultos = delTipo.slice(TOPE_POR_CELDA - 1);
      const id = `grupo:${celda}`;
      ocultos.forEach((oculto) => representante.set(oculto.id, id));
      celdas.set(celda, [
        ...visibles,
        {
          id,
          tipo,
          principal: `+${ocultos.length} ${plural}`,
          secundario: ocultos.map((o) => o.principal).join(', '),
          estado: '',
          cuando: null,
          grupo: { accion: 'expandir', celda, ocultos: ocultos.length },
        },
      ]);
    }
  }

  /* 3 · Las indicaciones, antes de ubicar nada: cuántas cruzan sobre cada
     fila decide cuánto aire hace falta encima de esa fila. */
  const posicion = new Map<string, { columna: number; tipo: TipoDelRecorrido; fila: number }>();
  ordenadas.forEach(([clave], columna) => {
    for (const tipo of tiposPresentes) {
      (celdas.get(claveDeCelda(clave, tipo)) ?? []).forEach((nodo, fila) =>
        posicion.set(nodo.id, { columna, tipo, fila }),
      );
    }
  });
  const indicaciones: {
    readonly arista: AristaDelRecorrido;
    readonly clave: string;
    readonly desde: { columna: number; tipo: TipoDelRecorrido; fila: number };
    readonly hasta: { columna: number; tipo: TipoDelRecorrido; fila: number };
  }[] = [];
  const atenciones: { readonly arista: AristaDelRecorrido; readonly clave: string }[] = [];
  const yaVistas = new Set<string>();
  for (const original of aristas) {
    const arista: AristaDelRecorrido = {
      ...original,
      desde: representante.get(original.desde) ?? original.desde,
      hasta: representante.get(original.hasta) ?? original.hasta,
    };
    const desde = posicion.get(arista.desde);
    const hasta = posicion.get(arista.hasta);
    const clave = `${arista.motivo}:${arista.desde}>${arista.hasta}`;
    if (desde === undefined || hasta === undefined || arista.desde === arista.hasta || yaVistas.has(clave)) {
      continue;
    }
    yaVistas.add(clave);
    if (arista.motivo === 'indicacion') {
      indicaciones.push({ arista, clave, desde, hasta });
    } else {
      atenciones.push({ arista, clave });
    }
  }

  // El cruce de cada indicación entre columnas: una altura propia sobre la
  // fila de su receta. Las que van más lejos, más arriba: así pasan por
  // encima de la bajada de las que entran antes, en vez de cortarla.
  const cruces = new Map<string, number>();
  const porFila = new Map<string, typeof indicaciones>();
  for (const ind of indicaciones) {
    if (ind.desde.columna === ind.hasta.columna) {
      continue;
    }
    const fila = `${ind.hasta.tipo}|${ind.hasta.fila}`;
    porFila.set(fila, [...(porFila.get(fila) ?? []), ind]);
  }
  const extraSobreFila = new Map<string, number>();
  for (const [fila, grupo] of porFila) {
    [...grupo]
      .sort(
        (a, b) =>
          Math.abs(a.hasta.columna - a.desde.columna) - Math.abs(b.hasta.columna - b.desde.columna) ||
          a.clave.localeCompare(b.clave),
      )
      .forEach((ind, carril) => cruces.set(ind.clave, carril));
    const necesario = 2 * MARGEN_DE_CRUCE + (grupo.length - 1) * PASO_DE_CARRIL;
    const base = fila.endsWith('|0') ? m.rellenoCarril : m.separacionNodos;
    extraSobreFila.set(fila, Math.max(0, necesario - base));
  }
  const extraHasta = (tipo: TipoDelRecorrido, fila: number): number => {
    let suma = 0;
    for (let f = 0; f <= fila; f++) {
      suma += extraSobreFila.get(`${tipo}|${f}`) ?? 0;
    }
    return suma;
  };

  /* 4 · Los carriles: cada uno tan alto como su celda más llena, más el aire
     que pidan sus cruces. */
  const maximoPorTipo = new Map<TipoDelRecorrido, number>();
  for (const [clave] of ordenadas) {
    for (const tipo of tiposPresentes) {
      const cuantos = celdas.get(claveDeCelda(clave, tipo))?.length ?? 0;
      maximoPorTipo.set(tipo, Math.max(maximoPorTipo.get(tipo) ?? 0, cuantos));
    }
  }

  const carriles: CarrilUbicado[] = [];
  let y = m.altoCabecera;
  for (const tipo of tiposPresentes) {
    const maximo = maximoPorTipo.get(tipo) ?? 1;
    const alto =
      m.altoRotuloCarril +
      m.rellenoCarril * 2 +
      maximo * m.altoNodo +
      (maximo - 1) * m.separacionNodos +
      extraHasta(tipo, maximo - 1);
    carriles.push({ tipo, y, alto, cantidad: nodos.filter((n) => n.tipo === tipo).length });
    y += alto;
  }
  const yDelCarril = new Map(carriles.map((c) => [c.tipo, c.y]));
  const yDeFila = (tipo: TipoDelRecorrido, fila: number): number =>
    (yDelCarril.get(tipo) ?? 0) +
    m.altoRotuloCarril +
    m.rellenoCarril +
    fila * (m.altoNodo + m.separacionNodos) +
    extraHasta(tipo, fila);

  /* 5 · Los tramos verticales de las indicaciones, por pasillo. Cada columna
     tiene a su derecha un pasillo; ahí bajan las indicaciones que salen de
     ella (y los corchetes de la misma columna), y ahí entran por la derecha
     las que van hacia atrás. Dos tramos comparten carril sólo si no se
     solapan en altura. */
  const yDe = (p: { tipo: TipoDelRecorrido; fila: number }): number => yDeFila(p.tipo, p.fila);
  const cruceDe = (ind: (typeof indicaciones)[number]): number =>
    yDe(ind.hasta) - MARGEN_DE_CRUCE - (cruces.get(ind.clave) ?? 0) * PASO_DE_CARRIL;
  const tramos: { columna: number; desde: number; hasta: number; clave: string; rol: 'sale' | 'entra' }[] = [];
  for (const ind of indicaciones) {
    const y0 = yDe(ind.desde) + m.altoNodo / 2;
    const y1 = yDe(ind.hasta) + m.altoNodo / 2;
    if (ind.desde.columna === ind.hasta.columna) {
      tramos.push({ columna: ind.desde.columna, desde: Math.min(y0, y1), hasta: Math.max(y0, y1), clave: ind.clave, rol: 'sale' });
      continue;
    }
    const cruce = cruceDe(ind);
    tramos.push({ columna: ind.desde.columna, desde: Math.min(y0, cruce), hasta: Math.max(y0, cruce), clave: ind.clave, rol: 'sale' });
    if (ind.hasta.columna < ind.desde.columna) {
      const entrada = yDe(ind.hasta) + m.altoNodo * 0.3;
      tramos.push({ columna: ind.hasta.columna, desde: cruce, hasta: entrada, clave: ind.clave, rol: 'entra' });
    }
  }
  const carrilDelTramo = new Map<string, number>();
  const carrilesPorPasillo = new Map<number, number>();
  for (let columna = 0; columna < ordenadas.length; columna++) {
    // Los más profundos, adentro: así la salida horizontal de uno no corta la
    // bajada de otro que sigue más abajo.
    const delPasillo = tramos
      .filter((t) => t.columna === columna)
      .sort((a, b) => b.hasta - a.hasta || a.clave.localeCompare(b.clave));
    const ocupados: { desde: number; hasta: number }[][] = [];
    for (const tramo of delPasillo) {
      let carril = ocupados.findIndex((enUso) =>
        enUso.every((o) => tramo.hasta + PASO_DE_CARRIL < o.desde || tramo.desde - PASO_DE_CARRIL > o.hasta),
      );
      if (carril === -1) {
        carril = ocupados.length;
        ocupados.push([]);
      }
      ocupados[carril].push(tramo);
      carrilDelTramo.set(`${tramo.clave}|${tramo.rol}`, carril);
    }
    carrilesPorPasillo.set(columna, ocupados.length);
  }

  /* 6 · Las columnas con sus nodos. El pasillo entre dos columnas se
     ensancha si los carriles de la izquierda no entran antes del tronco de
     las atenciones de la derecha. */
  const huecoTras = (columna: number): number =>
    Math.max(
      m.separacionColumnas,
      INICIO_DEL_PASILLO +
        Math.max(0, (carrilesPorPasillo.get(columna) ?? 0) - 1) * PASO_DE_CARRIL +
        AIRE_CON_EL_TRONCO +
        DISTANCIA_DEL_TRONCO,
    );
  const xDeColumna: number[] = [];
  ordenadas.forEach((_, indice) => {
    xDeColumna.push(
      indice === 0 ? m.margenLateral : xDeColumna[indice - 1] + m.anchoColumna + huecoTras(indice - 1),
    );
  });

  const ubicados: NodoUbicado[] = [];
  const columnas: ColumnaUbicada[] = ordenadas.map(([clave, grupo], indice) => {
    const x = xDeColumna[indice];
    const nodosDeLaColumna: NodoUbicado[] = [];
    for (const tipo of tiposPresentes) {
      const delTipo = celdas.get(claveDeCelda(clave, tipo)) ?? [];
      delTipo.forEach((nodo, fila) => {
        const ubicado: NodoUbicado = { ...nodo, columna: indice, x, y: yDeFila(tipo, fila) };
        nodosDeLaColumna.push(ubicado);
        ubicados.push(ubicado);
      });
    }
    const anterior = indice === 0 ? null : ordenadas[indice - 1][1].fecha;
    return {
      clave,
      x,
      fecha: grupo.fecha,
      encuentroId: grupo.encuentro,
      contexto:
        grupo.encuentro !== null
          ? 'atencion'
          : grupo.nodos.some((n) => n.encuentroId !== undefined)
            ? 'dia'
            : 'sin-atencion',
      intervalo:
        anterior === null || grupo.fecha === null ? '' : describirIntervalo(anterior, grupo.fecha),
      hueco: indice === 0 ? 0 : x - xDeColumna[indice - 1] - m.anchoColumna,
      nodos: nodosDeLaColumna,
    };
  });

  /* 7 · Las conexiones. */
  const ubicadoPorId = new Map(ubicados.map((n) => [n.id, n]));
  const xDelCarril = (columna: number, carril: number): number =>
    xDeColumna[columna] + m.anchoColumna + INICIO_DEL_PASILLO + carril * PASO_DE_CARRIL;
  const trazadas: AristaUbicada[] = [];
  for (const { arista, clave } of atenciones) {
    trazadas.push({
      ...arista,
      clave,
      trazo: trazoDeAtencion(ubicadoPorId.get(arista.desde)!, ubicadoPorId.get(arista.hasta)!),
    });
  }
  for (const ind of indicaciones) {
    const desde = ubicadoPorId.get(ind.arista.desde)!;
    const hasta = ubicadoPorId.get(ind.arista.hasta)!;
    const sale = desde.x + m.anchoColumna;
    const y0 = desde.y + m.altoNodo / 2;
    const bajada = xDelCarril(ind.desde.columna, carrilDelTramo.get(`${ind.clave}|sale`) ?? 0);
    let puntos: Punto[];
    if (ind.desde.columna === ind.hasta.columna) {
      // Un corchete por el pasillo de la derecha.
      const y1 = hasta.y + m.altoNodo / 2;
      puntos = [[sale, y0], [bajada, y0], [bajada, y1], [hasta.x + m.anchoColumna, y1]];
    } else {
      const cruce = cruceDe(ind);
      // Entra un poco arriba del centro, para no pisar la rama de su atención.
      const y1 = hasta.y + m.altoNodo * 0.3;
      const entra =
        ind.hasta.columna > ind.desde.columna
          ? hasta.x - ENTRADA_POR_IZQUIERDA
          : xDelCarril(ind.hasta.columna, carrilDelTramo.get(`${ind.clave}|entra`) ?? 0);
      const borde = ind.hasta.columna > ind.desde.columna ? hasta.x : hasta.x + m.anchoColumna;
      puntos = [[sale, y0], [bajada, y0], [bajada, cruce], [entra, cruce], [entra, y1], [borde, y1]];
    }
    trazadas.push({ ...ind.arista, clave: ind.clave, trazo: poligonal(puntos), puntos });
  }

  const ultima = xDeColumna.length === 0 ? m.margenLateral : xDeColumna[xDeColumna.length - 1];
  const pasilloFinal =
    ordenadas.length === 0 ? 0 : (carrilesPorPasillo.get(ordenadas.length - 1) ?? 0) * PASO_DE_CARRIL;
  const ancho = ultima + m.anchoColumna + Math.max(m.margenLateral, INICIO_DEL_PASILLO + pasilloFinal + 8);

  return { ancho, alto: y + m.rellenoCarril, columnas, carriles, nodos: ubicados, aristas: trazadas };
}

/** El aire mínimo entre un cruce y una tarjeta, arriba o abajo. */
const MARGEN_DE_CRUCE = 8;
/** La distancia entre dos carriles paralelos de indicación. */
const PASO_DE_CARRIL = 7;
/** Dónde empieza el pasillo de la derecha de una columna. */
/**
 * Dónde empieza el pasillo de la derecha de una columna. Más que el largo de
 * una punta de flecha (unos 14 px) más un margen: las indicaciones que entran
 * a una receta por su derecha dejan la punta entre la tarjeta y el primer
 * carril, y ahí no puede pasar la línea de otro diagnóstico.
 */
const INICIO_DEL_PASILLO = 18;
/** Aire mínimo entre el carril más externo de un pasillo y el tronco de las atenciones. */
const AIRE_CON_EL_TRONCO = 12;
/** A cuánto del borde izquierdo de su columna va el tronco de las atenciones. */
const DISTANCIA_DEL_TRONCO = 24;
/** Por dónde entra una indicación a su receta desde la izquierda. */
const ENTRADA_POR_IZQUIERDA = 10;

/**
 * De la atención a un registro de su misma columna: tronco por el pasillo
 * izquierdo y rama horizontal hasta el borde del nodo, con las esquinas
 * redondeadas para que el ojo siga una sola línea.
 */
function trazoDeAtencion(desde: NodoUbicado, hasta: NodoUbicado): string {
  const m = MEDIDAS;
  const tronco = desde.x - DISTANCIA_DEL_TRONCO;
  const y0 = desde.y + m.altoNodo / 2;
  const y1 = hasta.y + m.altoNodo / 2;
  const r = Math.min(10, Math.abs(y1 - y0) / 2);
  const sentido = y1 >= y0 ? 1 : -1;
  return [
    `M ${desde.x} ${y0}`,
    `H ${tronco + r}`,
    `Q ${tronco} ${y0} ${tronco} ${y0 + r * sentido}`,
    `V ${y1 - r * sentido}`,
    `Q ${tronco} ${y1} ${tronco + r} ${y1}`,
    `H ${hasta.x}`,
  ].join(' ');
}

/**
 * Una poligonal con las esquinas redondeadas, para que el ojo siga una línea.
 *
 * Las indicaciones van así —ortogonales, por los huecos— y no en curva
 * directa: una curva pasaba por detrás de las tarjetas de en medio, y con
 * «Atenciones» filtrado la flecha Hipertensión → Enalapril parecía salir de
 * Atorvastatina, una conexión clínica falsa dibujada por la geometría.
 */
function poligonal(puntos: readonly Punto[], radio = 6): string {
  const partes = [`M ${puntos[0][0]} ${puntos[0][1]}`];
  for (let i = 1; i < puntos.length - 1; i++) {
    const [ax, ay] = puntos[i - 1];
    const [bx, by] = puntos[i];
    const [cx, cy] = puntos[i + 1];
    const r = Math.min(
      radio,
      Math.hypot(bx - ax, by - ay) / 2,
      Math.hypot(cx - bx, cy - by) / 2,
    );
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

/**
 * Lo conectado a un nodo: lo que lo originó y lo que se decidió a partir de él.
 *
 * Recorre hacia atrás (de dónde viene) y hacia adelante (qué derivó) por
 * separado. Juntarlos en un grafo sin sentido iluminaría a los hermanos —las
 * otras recetas de la misma consulta— que no tienen nada que ver con el nodo.
 */
export function conectadosA(
  id: string,
  aristas: readonly AristaDelRecorrido[],
): { readonly nodos: ReadonlySet<string>; readonly aristas: ReadonlySet<string> } {
  const nodos = new Set<string>([id]);
  const claves = new Set<string>();
  const clave = (a: AristaDelRecorrido): string => `${a.motivo}:${a.desde}>${a.hasta}`;

  const recorrer = (inicio: string, haciaAdelante: boolean): void => {
    const pendientes = [inicio];
    const vistos = new Set<string>([inicio]);
    while (pendientes.length > 0) {
      const actual = pendientes.pop() as string;
      for (const arista of aristas) {
        const origen = haciaAdelante ? arista.desde : arista.hasta;
        const destino = haciaAdelante ? arista.hasta : arista.desde;
        if (origen === actual) {
          claves.add(clave(arista));
          nodos.add(destino);
          if (!vistos.has(destino)) {
            vistos.add(destino);
            pendientes.push(destino);
          }
        }
      }
    }
  };
  recorrer(id, true);
  recorrer(id, false);
  return { nodos, aristas: claves };
}
