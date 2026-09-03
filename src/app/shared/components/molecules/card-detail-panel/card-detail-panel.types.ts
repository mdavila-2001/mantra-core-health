/* ============================================================================
    Contratos del panel desplegable de una tarjeta.

    El panel muestra **el resto de los datos** de una entidad —los que no entran
    en la cara de la tarjeta— sin empujar a las tarjetas vecinas: mientras está
    abierto se muda al `<body>` y se posiciona con `position: fixed`, el mismo
    patrón que ya usa `molecules/menu` para no quedar recortado por el
    `overflow` de una grilla.
    ========================================================================== */

/**
 * Un dato del panel: su rótulo y su valor, los dos ya formateados.
 *
 * **No hay campos opcionales a propósito.** Quien arma las filas decide qué
 * dato existe: si la API no sirvió el campo, la fila no se construye. Un
 * `value` vacío dibujaría un renglón que dice que falta algo, y en un
 * directorio público de salud eso es ruido repetido veinte veces.
 */
export interface CardDetailRow {
  /** Qué dato es. Prosa en castellano. */
  readonly label: string;
  /** El valor, tal como se lee. Nunca vacío. */
  readonly value: string;
}

/** Aire entre el botón y el panel, en píxeles. */
export const CARD_DETAIL_PANEL_GAP_PX = 8;

/** Margen mínimo contra el borde del viewport, en píxeles. */
export const CARD_DETAIL_PANEL_MARGIN_PX = 12;

/**
 * Alto mínimo utilizable del panel, en píxeles.
 *
 * Por debajo de esto el panel se corre hacia arriba en vez de abrirse dentro de
 * una franja de 30 px: crece hacia abajo desde su borde superior, pero ese
 * borde se acomoda para que el contenido entre en pantalla.
 */
export const CARD_DETAIL_PANEL_MIN_HEIGHT_PX = 180;

/**
 * El atributo con el que una tarjeta se declara «la caja que el panel no debe
 * exceder en ancho».
 *
 * Sin él, el panel se mide contra el botón, que es un ícono de 32 px.
 */
export const CARD_ROOT_ATTRIBUTE = 'data-card-root';
