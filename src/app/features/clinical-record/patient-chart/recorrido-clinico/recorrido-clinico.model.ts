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
  separacionNodos: 8,
  rellenoCarril: 12,
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
}

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

  /* 3 · Los carriles: cada uno tan alto como su celda más llena. */
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
      (maximo - 1) * m.separacionNodos;
    carriles.push({ tipo, y, alto, cantidad: nodos.filter((n) => n.tipo === tipo).length });
    y += alto;
  }
  const yDelCarril = new Map(carriles.map((c) => [c.tipo, c.y]));

  /* 4 · Las columnas con sus nodos. */
  const ubicados: NodoUbicado[] = [];
  const columnas: ColumnaUbicada[] = ordenadas.map(([clave, grupo], indice) => {
    const x = m.margenLateral + indice * (m.anchoColumna + m.separacionColumnas);
    const nodosDeLaColumna: NodoUbicado[] = [];
    for (const tipo of tiposPresentes) {
      const delTipo = celdas.get(claveDeCelda(clave, tipo)) ?? [];
      delTipo.forEach((nodo, i) => {
        const ubicado: NodoUbicado = {
          ...nodo,
          columna: indice,
          x,
          y:
            (yDelCarril.get(tipo) ?? 0) +
            m.altoRotuloCarril +
            m.rellenoCarril +
            i * (m.altoNodo + m.separacionNodos),
        };
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
      nodos: nodosDeLaColumna,
    };
  });

  /* 5 · Las conexiones. Sólo entre nodos dibujados: un extremo filtrado se
     calla, y uno agrupado se conecta a su grupo (una sola vez). */
  const ubicadoPorId = new Map(ubicados.map((n) => [n.id, n]));
  const trazadas: AristaUbicada[] = [];
  const yaTrazadas = new Set<string>();
  for (const original of aristas) {
    const arista: AristaDelRecorrido = {
      ...original,
      desde: representante.get(original.desde) ?? original.desde,
      hasta: representante.get(original.hasta) ?? original.hasta,
    };
    const desde = ubicadoPorId.get(arista.desde);
    const hasta = ubicadoPorId.get(arista.hasta);
    const clave = `${arista.motivo}:${arista.desde}>${arista.hasta}`;
    if (desde === undefined || hasta === undefined || desde === hasta || yaTrazadas.has(clave)) {
      continue;
    }
    yaTrazadas.add(clave);
    trazadas.push({
      ...arista,
      clave,
      trazo: arista.motivo === 'atencion' ? trazoDeAtencion(desde, hasta) : trazoDeIndicacion(desde, hasta),
    });
  }

  const ancho =
    m.margenLateral * 2 +
    Math.max(1, columnas.length) * m.anchoColumna +
    Math.max(0, columnas.length - 1) * m.separacionColumnas;

  return { ancho, alto: y + m.rellenoCarril, columnas, carriles, nodos: ubicados, aristas: trazadas };
}

/**
 * De la atención a un registro de su misma columna: tronco por el pasillo
 * izquierdo y rama horizontal hasta el borde del nodo, con las esquinas
 * redondeadas para que el ojo siga una sola línea.
 */
function trazoDeAtencion(desde: NodoUbicado, hasta: NodoUbicado): string {
  const m = MEDIDAS;
  const tronco = desde.x - m.separacionColumnas / 2 + 8;
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
 * Del diagnóstico a la receta que se indicó para él.
 *
 * En la misma columna, un corchete por la derecha. Entre columnas, un
 * recorrido **ortogonal** por los huecos: sale del borde del diagnóstico,
 * baja por el pasillo, cruza por la franja libre que hay justo encima de la
 * fila de la receta y entra por su borde. Una curva directa pasaba por detrás
 * de las tarjetas de en medio, y con «Atenciones» filtrado la flecha
 * Hipertensión → Enalapril parecía salir de Atorvastatina: una conexión
 * clínica falsa dibujada por la geometría.
 */
function trazoDeIndicacion(desde: NodoUbicado, hasta: NodoUbicado): string {
  const m = MEDIDAS;
  if (desde.columna === hasta.columna) {
    const x0 = desde.x + m.anchoColumna;
    const y0 = desde.y + m.altoNodo / 2;
    const x1 = hasta.x + m.anchoColumna;
    const y1 = hasta.y + m.altoNodo / 2;
    const comba = x0 + m.separacionColumnas / 2 - 4;
    return `M ${x0} ${y0} C ${comba} ${y0}, ${comba} ${y1}, ${x1} ${y1}`;
  }
  return poligonal(puntosDeIndicacion(desde, hasta));
}

/**
 * Los vértices del recorrido ortogonal entre columnas. Exportado para las
 * pruebas: son las que comprueban que no pase por detrás de ninguna tarjeta.
 */
export function puntosDeIndicacion(
  desde: NodoUbicado,
  hasta: NodoUbicado,
): readonly (readonly [number, number])[] {
  const m = MEDIDAS;
  const holgura = 12;
  const y0 = desde.y + m.altoNodo / 2;
  // Entra un poco arriba del centro, para no pisar la rama de su atención.
  const y1 = hasta.y + m.altoNodo * 0.3;
  // La mitad del hueco entre dos filas del carril, o del relleno si es la
  // primera: ahí no hay tarjeta en ninguna columna.
  const cruce = hasta.y - m.separacionNodos / 2;
  if (hasta.columna > desde.columna) {
    const sale = desde.x + m.anchoColumna;
    const entra = hasta.x;
    return [
      [sale, y0],
      [sale + holgura, y0],
      [sale + holgura, cruce],
      [entra - holgura, cruce],
      [entra - holgura, y1],
      [entra, y1],
    ];
  }
  // Hacia atrás: una receta fechada antes que su diagnóstico.
  const sale = desde.x;
  const entra = hasta.x + m.anchoColumna;
  return [
    [sale, y0],
    [sale - holgura, y0],
    [sale - holgura, cruce],
    [entra + holgura, cruce],
    [entra + holgura, y1],
    [entra, y1],
  ];
}

/** Una poligonal con las esquinas redondeadas, para que el ojo siga una línea. */
function poligonal(puntos: readonly (readonly [number, number])[], radio = 8): string {
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
