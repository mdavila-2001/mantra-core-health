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

/**
 * Las dos familias del papel, con el nombre con que se registran en `jsPDF`.
 *
 * Son las mismas de la pantalla (`--font-display` y `--font-body` de
 * `styles.css`): Poppins para lo que se destaca —títulos, rótulos, cabeceras,
 * versalitas— e Inter para lo que se lee —cuerpo, datos, tablas, pie—. El
 * reparto es por **estilo**: todo lo que el motor escribe en negrita es un
 * título o un rótulo y va en Poppins; todo lo normal es lectura y va en Inter.
 * Cuando las fuentes no se pudieron cargar (ver `pdf-fuentes.ts`), las dos caen
 * a Helvetica.
 */
export const FAMILIAS = {
  titulos: 'Poppins',
  cuerpo: 'Inter',
  respaldo: 'helvetica',
} as const;

/* Los colores son los de `styles.css`, copiados en RGB porque `jsPDF` no lee
   CSS. `pdf-theme.spec.ts` compara cada uno contra su variable: si la rampa de
   la pantalla cambia, el papel se entera por una prueba en rojo. */

/** El azul de AloVida, el mismo del logo: `--c-petrol-500`. */
export const COLOR_MARCA: ColorRgb = [11, 85, 126];

/** Un azul más profundo para los títulos, `--c-petrol-700`: contrasta sin gritar. */
export const COLOR_MARCA_PROFUNDO: ColorRgb = [11, 57, 83];

/** La tinta del cuerpo, `--c-neutral-500` (el `--text-primary` de la pantalla). Negro puro no, que en papel se lee duro. */
export const COLOR_TINTA: ColorRgb = [36, 40, 40];

/** Para etiquetas y datos secundarios, `--c-neutral-400`: presente, nunca protagonista. */
export const COLOR_TINTA_SUAVE: ColorRgb = [78, 81, 81];

/** El filete de un cabello, `--c-petrol-50`, que separa sin dibujar una caja. */
export const COLOR_FILETE: ColorRgb = [217, 229, 235];

/** Un filete algo más presente, `--c-petrol-200`, para cerrar una tabla. */
export const COLOR_FILETE_FUERTE: ColorRgb = [149, 181, 199];

/**
 * Mezcla un color con blanco: `fraccion` de color, el resto de papel.
 *
 * Es cómo el papel obtiene los tintes que la rampa no trae: la pantalla pone
 * un color sobre un fondo con transparencia; el PDF no tiene transparencia de
 * relleno barata, así que el tinte se calcula de antemano.
 */
export function mezclarConBlanco(color: ColorRgb, fraccion: number): ColorRgb {
  const canal = (valor: number): number => Math.round(255 - (255 - valor) * fraccion);
  return [canal(color[0]), canal(color[1]), canal(color[2])];
}

/** El relleno apenas teñido de los paneles y las cabeceras de tabla: `--c-petrol-50` al 40 %. */
export const COLOR_PANEL: ColorRgb = mezclarConBlanco(COLOR_FILETE, 0.4);

/** El sombreado de las filas impares de una tabla: `--c-petrol-50` al 20 %, apenas visible. */
export const COLOR_CEBRA: ColorRgb = mezclarConBlanco(COLOR_FILETE, 0.2);

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
  titulo: 20,
  /** La bajada del título. */
  bajada: 10.5,
  /** El nombre de la marca, junto al isotipo. */
  logotipo: 12.5,
  /** La clase de documento, arriba a la derecha, en versalitas espaciadas. */
  clase: 7,
  /** Título de sección grande. */
  seccion: 13,
  /** Título de sección, en versalitas espaciadas sobre un filete. */
  subseccion: 8.5,
  /** Subtítulo dentro de una sección. */
  rotulo: 10.5,
  /** El cuerpo. Inter tiene la x alta: a 9,5 se lee como Helvetica a 10. */
  cuerpo: 9.5,
  /** La etiqueta de un dato, a la izquierda de su valor. */
  etiqueta: 7.5,
  /** Las filas de una tabla. */
  fila: 9,
  /** La fila de encabezado de una tabla. */
  cabeceraDeTabla: 8.5,
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
  lineaDeFila: 12.5,
  /** Aire arriba y abajo del texto de una fila de tabla. */
  rellenoDeFila: 5,
  /** Aire entre dos bloques seguidos. */
  entreBloques: 9,
  /** Aire antes de una sección nueva: la separación que hace la jerarquía. */
  antesDeSeccion: 22,
  /** Aire después del filete de una sección. */
  despuesDeSeccion: 12,
  /** Ancho de la columna de etiquetas en un dato. */
  columnaDeEtiqueta: 132,
  /** Aire entre el final de la etiqueta y el arranque del valor: una etiqueta que llega al borde se lee pegada. */
  aireDeEtiqueta: 10,
  /** Relleno interno de un panel. */
  panel: 10,
} as const;

/** El ancho del isotipo en el membrete de la primera página. */
export const ANCHO_DE_ISOTIPO_PT = 30;

/** El ancho del isotipo en el membrete de las páginas siguientes. */
export const ANCHO_DE_ISOTIPO_CONTINUACION_PT = 18;

/**
 * La filigrana: el isotipo chico y casi transparente, abajo a la derecha,
 * apoyado sobre el filete del pie.
 *
 * Al 62 % del ancho y centrada se cruzaba con las tablas y en pantalla se leía
 * como una mancha gris. Al 25 % y en el rincón firma la hoja sin tocar el
 * contenido; `0.04` se ve en pantalla y en una impresión decente y desaparece
 * en una fotocopia, que es exactamente lo que se quiere de una filigrana.
 */
export const FILIGRANA = {
  /** Fracción del ancho de página que ocupa el isotipo. */
  anchoRelativo: 0.25,
  opacidad: 0.04,
  /** Aire entre el isotipo y el filete del pie. */
  aireSobreElPie: 12,
} as const;

/**
 * La ranura del logo del consultorio: arriba a la derecha de la primera página,
 * a la altura del isotipo.
 *
 * Es una caja de tamaño **fijo** y el logo se contiene dentro de ella, con o sin
 * imagen. Por eso el membrete —el filete, el título y el arranque del contenido—
 * mide lo mismo con un logo cuadrado, con uno apaisado, con uno altísimo o sin
 * ninguno. `alto` deja 4 pt de aire sobre el filete.
 */
export const LOGO_DEL_CONSULTORIO = {
  ancho: 120,
  alto: 34,
  /** Aire entre la caja del logo y la clase de documento, que se corre a su izquierda. */
  separacion: 14,
} as const;

/**
 * El bloque de firma del pie de la última página: la imagen de la firma, el
 * sello al lado, una línea y debajo el nombre y la matrícula.
 *
 * Las cajas son de tamaño **fijo**, como la del logo: con firma, sin firma, con
 * una firma altísima o con un sello roto, el bloque mide lo mismo y nada de lo
 * escrito antes se corre. `alto` es lo que reserva al pie: si el contenido llega
 * hasta ahí, el bloque pasa a una página nueva en vez de pisarlo.
 */
export const FIRMA_Y_SELLO = {
  cajaFirma: { ancho: 150, alto: 56 },
  cajaSello: { ancho: 56, alto: 56 },
  /** Aire entre la caja de la firma y la del sello. */
  separacion: 16,
  /** Desde el borde superior del bloque hasta su último renglón. */
  alto: 96,
  /** Aire mínimo entre el final del contenido y el bloque. */
  aireSobreElBloque: 18,
} as const;
