import type { jsPDF } from 'jspdf';

/* ============================================================================
    El isotipo de AloVida, en vectores, para que los PDF lleven la marca.

    ## Por qué vectores y no una imagen

    El logo vive en `public/redsat/imagenes/alovida-logo.svg`, y meterlo en un
    PDF por la vía de `addImage` obliga a rasterizarlo antes: cargar el SVG,
    pintarlo en un `<canvas>` y sacar un PNG. Eso ata la generación del
    documento al DOM —no corre bajo SSR ni en pruebas— y le mete al papel un
    logo con bordes pixelados que se rompen al ampliar o al imprimir.

    Acá está el mismo trazo, convertido una sola vez a curvas de Bézier
    relativas —el formato que come `doc.lines()`— y normalizado a una caja de
    ancho 1. Se dibuja nítido a cualquier tamaño, no depende de red ni de
    canvas, y el archivo pesa un par de kilobytes.

    ## De dónde salen estos números

    De `alovida-logo.svg`, con el `translate` del original ya aplicado y las
    coordenadas divididas por el ancho del `viewBox`. Si el logo cambia, estos
    datos se regeneran del SVG; no se editan a mano.
    ========================================================================== */

/** Alto del isotipo cuando su ancho vale 1. Del `viewBox` del SVG original. */
export const PROPORCION_DE_MARCA = 0.73113;

/** Un contorno cerrado del isotipo, en el formato relativo de `doc.lines()`. */
interface SubtrazoDeMarca {
  /** Punto de arranque, en la caja normalizada. */
  readonly inicio: readonly [number, number];
  /** `[dx,dy]` para recta, `[dx1,dy1,dx2,dy2,dx3,dy3]` para curva cúbica. */
  readonly segmentos: readonly (readonly number[])[];
}

const SUBTRAZOS: readonly SubtrazoDeMarca[] = [
  {
    inicio: [0.57343, 0.00165],
    segmentos: [
      [-0.00848, 0.00319, -0.0152, 0.00985, -0.01847, 0.0183],
      [-0.00133, 0.00383, -0.00965, 0.04941, -0.01847, 0.10165],
      [-0.00882, 0.05224, -0.0208, 0.12328, -0.02662, 0.15805],
      [-0.01348, 0.07836, -0.04825, 0.28981, -0.05573, 0.33856],
      [-0.002, 0.01231, -0.00399, 0.02396, -0.00466, 0.02562],
      [-0.00083, 0.00216, -0.00366, -0.00765, -0.00815, -0.02828],
      [-0.00616, -0.02812, -0.01714, -0.07719, -0.04326, -0.19282],
      [-0.01198, -0.0529, -0.0178, -0.06871, -0.03261, -0.08851],
      [-0.00962, -0.01204, -0.02225, -0.02134, -0.0366, -0.02695],
      [-0.00482, -0.00183, -0.01714, -0.00449, -0.02695, -0.00599],
      [-0.03377, -0.00482, -0.05307, -0.01198, -0.07869, -0.02845],
      [-0.03078, -0.02013, -0.05573, -0.04459, -0.08817, -0.08634],
      [-0.02013, -0.02612, -0.04292, -0.05107, -0.05257, -0.05773],
      [-0.00482, -0.00316, -0.00582, -0.00482, -0.00582, -0.00982],
      [-0.00015, -0.01039, -0.00446, -0.02028, -0.01198, -0.02745],
      [-0.00865, -0.00765, -0.0158, -0.01065, -0.02629, -0.01065],
      [-0.02179, 0, -0.03826, 0.01664, -0.03826, 0.0386],
      [-0.00015, 0.01248, 0.00574, 0.02426, 0.01581, 0.03162],
      [0.01007, 0.00736, 0.02308, 0.00941, 0.03493, 0.00548],
      [0.00499, -0.00166, 0.00998, -0.0025, 0.01131, -0.002],
      [0.00399, 0.0015, 0.02346, 0.02446, 0.04525, 0.05357],
      [0.02529, 0.03361, 0.02695, 0.0356, 0.0381, 0.04741],
      [0.01141, 0.01206, 0.02407, 0.02288, 0.03777, 0.03228],
      [0.00898, 0.00599],
      [-0.05241, 0],
      [-0.02878, -0.00017, -0.0544, -0.00067, -0.0569, -0.00116],
      [-0.00349, -0.00067, -0.00466, -0.002, -0.00549, -0.00682],
      [-0.00416, -0.02246, -0.02662, -0.03743, -0.04758, -0.03194],
      [-0.01057, 0.00272, -0.01958, 0.00963, -0.02496, 0.01913],
      [-0.01048, 0.0183, -0.00383, 0.04276, 0.01497, 0.05374],
      [0.00982, 0.00566, 0.02545, 0.00616, 0.03727, 0.00083],
      [0.00682, -0.00316, 0.00915, -0.00349, 0.01747, -0.00216],
      [0.00516, 0.001, 0.04375, 0.00166, 0.08568, 0.00166],
      [0.07603, 0],
      [-0.00965, 0.00965],
      [-0.00809, 0.00861, -0.0157, 0.01767, -0.02279, 0.02712],
      [-0.01514, 0.02013, -0.03228, 0.0376, -0.04758, 0.04858],
      [-0.02213, 0.0158, -0.05424, 0.02778, -0.07437, 0.02778],
      [-0.00782, 0, -0.00982, -0.00067, -0.01564, -0.00566],
      [-0.01081, -0.00932, -0.0168, -0.01148, -0.03045, -0.01065],
      [-0.01048, 0.0005, -0.01331, 0.00133, -0.01946, 0.00582],
      [-0.01, 0.0074, -0.01601, 0.01901, -0.0163, 0.03144],
      [0, 0.01098, 0.00266, 0.01797, 0.01015, 0.02645],
      [0.00749, 0.00848, 0.01647, 0.01248, 0.02945, 0.01248],
      [0.01298, 0, 0.02063, -0.00366, 0.03045, -0.01464],
      [0.00732, -0.00815],
      [0.0173, -0.00183],
      [0.05174, -0.00582, 0.09965, -0.0366, 0.14125, -0.0905],
      [0.02196, -0.02845, 0.03344, -0.0371, 0.05473, -0.04126],
      [0.01913, -0.00383, 0.03577, 0.00366, 0.04542, 0.0203],
      [0.00965, 0.01697, 0.01531, 0.03893, 0.04326, 0.17019],
      [0.02862, 0.13442, 0.0376, 0.17302, 0.04192, 0.18067],
      [0.00532, 0.00965, 0.01464, 0.01531, 0.02629, 0.01614],
      [0.0163, 0.00116, 0.02828, -0.00499, 0.03377, -0.01747],
      [0.0015, -0.00349, 0.01298, -0.06804, 0.02529, -0.14357],
      [0.01231, -0.07553, 0.02662, -0.16121, 0.03161, -0.19049],
      [0.00499, -0.02928, 0.01697, -0.10049, 0.02662, -0.15805],
      [0.00965, -0.05756, 0.0178, -0.10564, 0.01813, -0.10648],
      [0.001, -0.00266, 0.0015, -0.00017, 0.01414, 0.06322],
      [0.00665, 0.03294, 0.0178, 0.08867, 0.02512, 0.12394],
      [0.03094, 0.15073, 0.03094, 0.15123, 0.04059, 0.16254],
      [0.01281, 0.01514, 0.04093, 0.0163, 0.0554, 0.00233],
      [0.00815, -0.00782, 0.01248, -0.01597, 0.02545, -0.04891],
      [0.00832, -0.02063, 0.01464, -0.03444, 0.01597, -0.03444],
      [0.00283, 0, 0.00749, 0.00915, 0.01963, 0.03793],
      [0.01314, 0.03144, 0.0208, 0.04159, 0.03677, 0.04891],
      [0.00832, 0.00383, 0.00882, 0.00383, 0.08884, 0.00433],
      [0.05756, 0.00033, 0.08202, 0, 0.08518, -0.00133],
      [0.00466, -0.002, 0.00982, -0.01048, 0.00982, -0.01614],
      [0, -0.00482, -0.00616, -0.01364, -0.01031, -0.01464],
      [-0.00216, -0.00033, -0.03677, -0.001, -0.07703, -0.00116],
      [-0.06971, -0.0005, -0.07337, -0.00067, -0.07803, -0.00383],
      [-0.00499, -0.00333, -0.01264, -0.01813, -0.02296, -0.04409],
      [-0.01331, -0.03394, -0.03061, -0.04991, -0.05374, -0.04991],
      [-0.01085, -0.00032, -0.02134, 0.0039, -0.02895, 0.01165],
      [-0.00998, 0.00998, -0.01214, 0.01447, -0.03011, 0.06122],
      [-0.00299, 0.00765, -0.00599, 0.01331, -0.00665, 0.01248],
      [-0.00216, -0.00216, -0.03045, -0.1494, -0.06904, -0.35935],
      [-0.00915, -0.04941, -0.01015, -0.05324, -0.01647, -0.06006],
      [-0.00765, -0.00848, -0.02213, -0.01198, -0.03327, -0.00799],
    ],
  },
  {
    inicio: [0.04555, 0.10912],
    segmentos: [
      [0.01181, 0.00932, 0.00133, 0.02778, -0.01198, 0.0208],
      [-0.00383, -0.00179, -0.00646, -0.00543, -0.00697, -0.00962],
      [-0.00051, -0.0042, 0.00118, -0.00836, 0.00448, -0.01101],
      [0.00549, -0.00433, 0.00898, -0.00433, 0.01447, -0.00017],
    ],
  },
  {
    inicio: [0.04688, 0.28364],
    segmentos: [
      [0.00566, 0.00582, 0.00599, 0.00982, 0.00133, 0.0158],
      [-0.00196, 0.00281, -0.00522, 0.00444, -0.00865, 0.00433],
      [-0.01165, 0, -0.01747, -0.01447, -0.00848, -0.02146],
      [0.00599, -0.00466, 0.00998, -0.00433, 0.0158, 0.00133],
    ],
  },
  {
    inicio: [0.04738, 0.45283],
    segmentos: [
      [0.00233, 0.0025, 0.00433, 0.00632, 0.00433, 0.00848],
      [0, 0.00532, -0.00699, 0.01214, -0.01264, 0.01214],
      [-0.01131, 0, -0.01664, -0.01464, -0.00799, -0.02146],
      [0.00599, -0.00466, 0.01098, -0.00433, 0.0163, 0.00083],
    ],
  },
];

/** Un color de marca en componentes RGB de 0 a 255. */
export type ColorRgb = readonly [number, number, number];

/** Dónde y cómo se estampa el isotipo. */
export interface OpcionesDeMarca {
  /** Borde izquierdo del isotipo, en puntos. */
  readonly x: number;
  /** Borde superior del isotipo, en puntos. */
  readonly y: number;
  /** Ancho en puntos; el alto sale de {@link PROPORCION_DE_MARCA}. */
  readonly ancho: number;
  readonly color: ColorRgb;
  /** 0 a 1. Por debajo de 1 se estampa como filigrana. */
  readonly opacidad?: number;
}

/** El alto que ocupa el isotipo para un ancho dado. */
export function altoDeMarca(ancho: number): number {
  return ancho * PROPORCION_DE_MARCA;
}

/**
 * Estampa el isotipo relleno.
 *
 * El estado gráfico se guarda y se restaura alrededor del dibujo: la opacidad
 * y el color de relleno son globales en un PDF, y dejarlos tocados le cambiaría
 * el tono al primer texto que se escriba después.
 */
export function dibujarMarcaAlovida(doc: jsPDF, opciones: OpcionesDeMarca): void {
  const { x, y, ancho, color, opacidad = 1 } = opciones;

  doc.saveGraphicsState();
  if (opacidad < 1) {
    doc.setGState(doc.GState({ opacity: opacidad }));
  }
  doc.setFillColor(color[0], color[1], color[2]);

  for (const trazo of SUBTRAZOS) {
    doc.lines(
      // La copia es para el tipo: `lines` pide arreglos mutables y los datos
      // del módulo son `readonly` a propósito —son la fuente del trazo—.
      trazo.segmentos.map((segmento) => [...segmento]),
      x + trazo.inicio[0] * ancho,
      y + trazo.inicio[1] * ancho,
      [ancho, ancho],
      'F',
      true,
    );
  }

  doc.restoreGraphicsState();
}
