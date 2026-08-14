/* ============================================================================
    La forma de un resultado del buscador público.

    Sale de la maqueta `SALUD/Vistas/HTML/V65-buscador/publico/` y de
    `_assets/redsat.css` §25: cada campo de acá corresponde a una parte que la
    maqueta dibuja, y no hay ninguno que ella no muestre.

    ## Por qué el resultado no conoce al dominio

    Las seis pantallas de listado —profesionales, medicamentos, hospitales,
    laboratorios, aseguradoras y la portada— pintan **la misma tarjeta** con
    datos de módulos distintos. Si este tipo hablara de `PublicProfileDetail` o
    de un medicamento, haría falta una tarjeta por módulo, o una tarjeta con
    seis ramas.

    Así que recibe lo que la maqueta muestra —una figura, un título, líneas de
    contexto, sellos y un lado— y **quien la usa traduce su dominio a eso**. Es
    la misma frontera que ya tienen `app-badge` o `app-card`.
    ========================================================================== */

/**
 * Los cinco tonos de la insignia **de la superficie pública**.
 *
 * No son los del `app-badge` del banco (`primary`, `success`, `warning`…): son
 * los que `redsat.css` declara para `.app-badge[data-tono]`, y las 14 maquetas
 * de V65 usan sólo estos cinco. Mezclar las dos escalas pondría dos insignias
 * de distinto tamaño y color en la misma tarjeta.
 */
export const SEARCH_RESULT_TONES = ['ok', 'neutro', 'info', 'aviso', 'error'] as const;

/** Un tono de la insignia pública. */
export type SearchResultTone = (typeof SEARCH_RESULT_TONES)[number];

/**
 * Una línea de contexto bajo el título: especialidad, dirección, distancia,
 * puntuación…
 *
 * El icono es **opcional** y va como SVG proyectado por quien usa el
 * componente, no elegido acá: la maqueta usa un icono distinto por tipo de dato
 * y el componente no puede saber cuál corresponde sin conocer el dominio.
 */
export interface SearchResultMeta {
  /** El texto de la línea. Es lo único obligatorio. */
  readonly text: string;
  /**
   * Clave del icono que le corresponde, si lleva.
   *
   * No es el SVG: es el nombre con el que quien usa el componente lo proyecta
   * en el `ng-content` de los iconos. Sin clave, la línea va sin icono.
   */
  readonly iconKey?: string;
}

/**
 * Un sello del resultado: «Matrícula verificada», «Espacio pagado»…
 *
 * `tone` no es un color suelto: es uno de los cinco que `redsat.css` declara.
 */
export interface SearchResultSeal {
  readonly label: string;
  readonly tone: SearchResultTone;
}

/**
 * Un resultado del buscador público.
 *
 * ## `figureText` y `figureImageUrl` no son lo mismo que «avatar»
 *
 * La maqueta pinta un cuadrado de 56 px con iniciales cuando no hay foto. Es
 * deliberadamente **no** el `app-avatar` del banco: aquel es redondo, tiene
 * punto de presencia y deriva su color de un hash del nombre. Éste es un
 * cuadrado de la superficie pública, sin presencia, y su color sale del CSS.
 * Reusar el avatar acá haría que un resultado de farmacia se vea como una
 * persona conectada.
 */
export interface SearchResultItem {
  /** Identificador estable, para `@for` y para las pruebas. */
  readonly id: string;
  /** El nombre que se lee: profesional, medicamento, organización. */
  readonly title: string;
  /**
   * A dónde lleva el título.
   *
   * Va como `routerLink`, así que es una ruta de la aplicación y no una URL
   * externa. La superficie pública vive fuera de `/app` — ver `redsat.routes`.
   */
  readonly link: string;
  /** Iniciales o símbolo del cuadrado, cuando no hay imagen. */
  readonly figureText?: string;
  /** Imagen del cuadrado. Gana sobre `figureText` si viene. */
  readonly figureImageUrl?: string;
  /** El tipo, como insignia al lado del título: «Profesional», «Farmacia»… */
  readonly kind?: SearchResultSeal;
  /** Las líneas de contexto, en el orden en que se muestran. */
  readonly meta?: readonly SearchResultMeta[];
  /** Los sellos, bajo las líneas de contexto. */
  readonly seals?: readonly SearchResultSeal[];
}
