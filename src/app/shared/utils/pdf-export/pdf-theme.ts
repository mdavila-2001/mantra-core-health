import type { ColorRgb } from './alovida-mark';

/* ============================================================================
    El sistema de diseño del papel.

    Un solo archivo decide color, tamaño y aire de **todos** los PDF del
    sistema: receta, historia clínica, orden de estudio, comprobante y
    presupuesto. Si cada documento eligiera lo suyo, seis papeles de la misma
    clínica saldrían con seis identidades distintas, que es exactamente lo que
    un membrete existe para evitar.

    ## Por qué es sobrio

    Estos papeles se imprimen. En blanco y negro, en impresoras de consultorio,
    y muchas veces se fotocopian. Un diseño cargado de rellenos y colores se
    convierte en manchas grises que tapan el dato; uno construido con aire,
    filetes finos y jerarquía tipográfica sobrevive la fotocopia y sigue
    leyéndose como un documento serio. El lujo acá es el margen, no la tinta.
    ========================================================================== */

/** El azul de AloVida, el mismo del logo (`#0b557e`). */
export const COLOR_MARCA: ColorRgb = [11, 85, 126];

/** Un azul más profundo para los títulos: contrasta sin gritar. */
export const COLOR_MARCA_PROFUNDO: ColorRgb = [8, 62, 92];

/** La tinta del cuerpo. Negro puro no, que en papel se lee duro. */
export const COLOR_TINTA: ColorRgb = [26, 42, 51];

/** Para etiquetas y datos secundarios: presente, nunca protagonista. */
export const COLOR_TINTA_SUAVE: ColorRgb = [110, 130, 142];

/** El filete de un cabello, que separa sin dibujar una caja. */
export const COLOR_FILETE: ColorRgb = [219, 229, 234];

/** Un filete algo más presente, para cerrar una tabla. */
export const COLOR_FILETE_FUERTE: ColorRgb = [176, 199, 211];

/** El relleno apenas teñido de los paneles y las cabeceras de tabla. */
export const COLOR_PANEL: ColorRgb = [243, 248, 250];

/** Hoja A4 en puntos, con márgenes anchos: el aire es parte del diseño. */
export const MARGEN_LATERAL_PT = 54;
export const MARGEN_SUPERIOR_PT = 44;
export const MARGEN_INFERIOR_PT = 58;

/** Dónde arranca el contenido en la primera página, bajo el membrete. */
export const INICIO_DE_CONTENIDO_PT = 156;

/** Dónde arranca el contenido en las páginas siguientes, bajo el membrete corto. */
export const INICIO_DE_CONTENIDO_CONTINUACION_PT = 116;

/** Tamaños de fuente, en puntos. */
export const TIPOGRAFIA = {
  /** El título del documento, arriba de todo. */
  titulo: 21,
  /** La bajada del título. */
  bajada: 10.5,
  /** El nombre de la marca, junto al isotipo. */
  logotipo: 13,
  /** La clase de documento, arriba a la derecha, en versalitas espaciadas. */
  clase: 7.5,
  /** Título de sección grande. */
  seccion: 13,
  /** Título de sección, en versalitas espaciadas sobre un filete. */
  subseccion: 8.5,
  /** Subtítulo dentro de una sección. */
  rotulo: 10.5,
  /** El cuerpo. */
  cuerpo: 10,
  /** La etiqueta de un dato, a la izquierda de su valor. */
  etiqueta: 8,
  /** Las filas de una tabla. */
  fila: 9.5,
  /** Notas al pie de un bloque y letra chica. */
  nota: 8.5,
  /** El pie de página. */
  pie: 7.5,
  /** El total de un comprobante. */
  total: 13,
} as const;

/** Espaciado entre letras, en puntos. Es lo que le da el aire a las versalitas. */
export const ESPACIADO = {
  logotipo: 2.4,
  clase: 1.5,
  subseccion: 1.2,
  etiqueta: 0.6,
} as const;

/** Interlineado y separación entre bloques, en puntos. */
export const RITMO = {
  /** Alto de una línea de cuerpo. */
  linea: 14,
  /** Alto de una línea de tabla. */
  lineaDeFila: 13,
  /** Aire entre dos bloques seguidos. */
  entreBloques: 9,
  /** Aire antes de una sección nueva: la separación que hace la jerarquía. */
  antesDeSeccion: 22,
  /** Aire después del filete de una sección. */
  despuesDeSeccion: 12,
  /** Ancho de la columna de etiquetas en un dato. */
  columnaDeEtiqueta: 132,
  /** Relleno interno de un panel. */
  panel: 10,
} as const;

/** El ancho del isotipo en el membrete de la primera página. */
export const ANCHO_DE_ISOTIPO_PT = 30;

/** El ancho del isotipo en el membrete de las páginas siguientes. */
export const ANCHO_DE_ISOTIPO_CONTINUACION_PT = 18;

/**
 * La filigrana: el isotipo enorme y casi transparente detrás del texto.
 *
 * `0.05` está medido para que se vea en pantalla y en una impresión decente, y
 * para que **no** se coma la legibilidad del texto que le pasa por encima ni
 * salga como una mancha en una fotocopia.
 */
export const FILIGRANA = {
  /** Fracción del ancho de página que ocupa el isotipo. */
  anchoRelativo: 0.62,
  opacidad: 0.05,
} as const;
