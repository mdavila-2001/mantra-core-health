/* ============================================================================
    Campañas de farmacia (carril FAR-I7).

    Los importes son SIEMPRE texto: el backend los declara `numeric` y un
    `number` de JavaScript no puede representar 0.10 sin error. La aritmética
    del carril vive en `pharmacy-campaigns.money.ts` y trabaja en centavos
    enteros.
    ========================================================================== */

import type {
  CampaignConditions,
  CampaignScope,
  DraftFailure,
  Mechanic,
} from '../../promotions-engine/promotion-mechanics.types';

/**
 * Cómo la farmacia expresó el descuento en las dos mecánicas **originales** del
 * carril. Es el camino heredado: un borrador sin `mecanica` se interpreta con
 * este campo. Lo nuevo declara su `Mechanic` y no pasa por acá.
 */
export type TipoDeDescuento = 'PORCENTAJE' | 'PRECIO';

/**
 * Dónde está una campaña respecto de su vigencia.
 *
 * `TERMINADA` es terminal y **oculta el contenido**: una promoción vencida no
 * muestra precios ni por URL directa (regla del carril).
 */
export type EstadoDeCampana = 'PROGRAMADA' | 'VIGENTE' | 'TERMINADA';

/**
 * Un producto incluido en una campaña, con sus dos precios.
 *
 * Guardamos el par completo y no el porcentaje porque el porcentaje se
 * **deriva** de los dos precios: así lo que se pinta es lo que la farmacia
 * puso, y no hay forma de inventar un descuento por redondeo.
 */
export interface ProductoEnCampana {
  /** El producto del directorio. Jamás se pinta: es una llave. */
  readonly productId: string;
  /** Marca o genérico — lo que se lee en pantalla. */
  readonly nombre: string;
  /** «500 mg · caja x 20», o `null` si el directorio no lo publica. */
  readonly presentacion: string | null;
  /** Precio de lista, texto exacto. */
  readonly precioNormal: string;
  /**
   * Precio de campaña por unidad, texto exacto, siempre menor que el normal; o
   * `null` si la mecánica no es de precio por unidad (2x1, combo, compra
   * mínima…): ahí lo que vale se calcula sobre el pedido, no sobre el producto.
   */
  readonly precioPromocional: string | null;
  readonly moneda: string;
}

/** Un producto cuya campaña le deja un precio por unidad: el que se tacha y se cobra. */
export type ProductoConPrecioPromocional = ProductoEnCampana & {
  readonly precioPromocional: string;
};

/** Una campaña de una farmacia, tal como la ve cualquier pantalla. */
export interface CampanaDeFarmacia {
  readonly id: string;
  /** La farmacia dueña. Llave para cruzar con las sedes; no se pinta. */
  readonly pharmacyId: string;
  /** El nombre de la farmacia, para las pantallas que no lo tienen a mano. */
  readonly farmacia: string;
  readonly titulo: string;
  readonly descripcion: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly productos: readonly ProductoEnCampana[];
  /**
   * La mecánica del descuento. **Ausente = precio de campaña por producto**: así
   * se guardaban las campañas antes del motor, y los precios ya están en
   * `productos`. Usá `mecanicaDe()` en vez de leer este campo.
   */
  readonly mecanica?: Mechanic;
  /** Tope, cupón, calendario, combinabilidad… Ausente = sin condiciones. */
  readonly condiciones?: CampaignConditions;
  /** Sobre qué actúa. Ausente = exactamente los `productos`. */
  readonly alcance?: CampaignScope;
  /**
   * `true` si vino del paquete sembrado; `false` si la creó la farmacia en
   * esta sesión.
   *
   * No es cosmético: las sembradas tienen id estable y su URL abre siempre,
   * las creadas viven lo que vive la sesión. La pantalla de detalle lo dice.
   */
  readonly sembrada: boolean;
}

/**
 * Lo que la pantalla de detalle recibe, ya resuelto.
 *
 * Es una unión discriminada y no `campaña + estado` a propósito: con la
 * campaña completa al alcance, un `@if` mal escrito en la plantilla filtra los
 * precios de una promoción vencida. Acá esos precios directamente no existen
 * fuera de la rama vigente.
 */
export type CampanaPublica =
  | { readonly tipo: 'vigente'; readonly campana: CampanaDeFarmacia }
  | { readonly tipo: 'programada'; readonly titulo: string; readonly desde: Date }
  | { readonly tipo: 'terminada'; readonly titulo: string; readonly hasta: Date };

/** Un renglón del formulario de creación, antes de resolverse a precios. */
export interface RenglonDeBorrador {
  readonly productId: string;
  readonly nombre: string;
  readonly presentacion: string | null;
  readonly precioNormal: string;
  readonly moneda: string;
  /**
   * El precio de campaña que la farmacia escribió para este renglón, o `null`
   * si todavía lo está resolviendo el porcentaje de la campaña.
   */
  readonly precioPromocional: string | null;
}

/** Lo que la pantalla de creación manda al cliente. */
export interface BorradorDeCampana {
  readonly titulo: string;
  readonly descripcion: string;
  /**
   * `null` mientras la farmacia no eligió el día. El borrador modela lo que el
   * formulario permite: si el tipo mintiera con un `Date` obligatorio, la
   * pantalla tendría que inventarse una fecha o cortar la validación antes de
   * tiempo, y en los dos casos el resto de los fallos queda sin decir.
   */
  readonly desde: Date | null;
  readonly hasta: Date | null;
  /** Camino heredado (ver `TipoDeDescuento`). Se ignora si viene `mecanica`. */
  readonly tipoDeDescuento?: TipoDeDescuento;
  /** Camino heredado: sólo con `PORCENTAJE`, el entero que la farmacia escribió. */
  readonly porcentaje?: number | null;
  /** La mecánica elegida. Manda sobre `tipoDeDescuento` y `porcentaje`. */
  readonly mecanica?: Mechanic;
  readonly condiciones?: CampaignConditions;
  readonly alcance?: CampaignScope;
  readonly renglones: readonly RenglonDeBorrador[];
}

/** Por qué un borrador no se puede publicar. Se dicen todas juntas. */
export type FalloDeBorrador =
  | DraftFailure
  | 'SIN_TITULO'
  | 'SIN_PRODUCTOS'
  | 'FALTA_FECHA'
  | 'VIGENCIA_INVERTIDA'
  | 'PORCENTAJE_FUERA_DE_RANGO'
  | 'PRECIO_NO_ES_DESCUENTO'
  | 'MONEDAS_MEZCLADAS';
