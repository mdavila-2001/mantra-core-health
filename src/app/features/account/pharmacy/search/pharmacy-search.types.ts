/**
 * Contratos del buscador de la tienda de farmacia (carril 43, plan
 * `04-farmacia-ecommerce-2026-09-25` §4).
 *
 * Dos modos —productos y farmacias— y dos órdenes —precio y distancia— sobre
 * las mismas dos lecturas que ya existen: `GET /pharmacy/products` publica el
 * catálogo **sin precio**, y `GET /pharmacy-inventory/availability` es la
 * única que lo trae, evaluado contra una sede. Por eso el precio de una fila
 * es `string | null` y no un número: viaja como texto exacto y `null` no es
 * «gratis», es «esta sede no lo publica».
 */

/** Qué se busca: productos sueltos, o las farmacias que los venden. */
export type SearchMode = 'products' | 'stores';

/** Cómo se acomoda lo que volvió. Sin origen, `distance` no reordena nada. */
export type SearchSort = 'price' | 'distance';

/**
 * Un producto en una sede concreta: la unidad de la decisión de compra.
 *
 * Es el cruce de las dos lecturas, y por eso existe una fila por
 * `(productId, siteId)` y no una por producto: el mismo paracetamol en dos
 * farmacias son dos precios y dos distancias, que es justamente lo que se
 * está comparando.
 */
export interface ProductHit {
  /** `<siteId>:<productId>`. Identifica la fila en la lista, no al producto. */
  readonly id: string;
  readonly productId: string;
  readonly name: string;
  /** «500 mg · caja x 20», o `null` si el directorio no lo publica. */
  readonly presentation: string | null;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly addressText: string | null;
  /**
   * Lo que paga el paciente, como texto exacto; `null` si la sede no publica
   * precio. **Sólo puede venir de `availability()`**: el catálogo no lo trae.
   */
  readonly unitAmount: string | null;
  readonly currency: string | null;
  /** Distancia Haversine en km que calculó la API; `null` sin origen. */
  readonly distanceKm: number | null;
  readonly requiresPrescription: boolean;
  /**
   * El medicamento del vademécum, cuando se lo conoce.
   *
   * Hoy es siempre `null`: ni `PharmacyProduct` ni `AvailabilityProduct`
   * publican el uuid del concepto — publican `medication` ya resuelto a
   * `{ code, display }`. El campo existe porque `CartLine` lo declara y la
   * bandeja lo va a necesitar; inventarlo desde el `code` sería adivinar.
   */
  readonly medicationConceptId: string | null;
}

/** Una sede del directorio, opcionalmente con el «desde» del término buscado. */
export interface StoreHit {
  /** El `siteId`. Identifica la tarjeta en la lista. */
  readonly id: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly addressText: string | null;
  readonly distanceKm: number | null;
  /**
   * El más barato de los productos que coinciden con el término, en esta
   * sede. `null` sin término, o si la sede no publica ninguno de ellos.
   */
  readonly fromAmount: string | null;
  readonly currency: string | null;
  readonly productCount: number;
}

/**
 * Lo que devuelve una búsqueda.
 *
 * `sinOrigen` no es un error: es que se pidió ordenar por distancia sin un
 * punto desde donde medir, así que el orden que llegó **no se tocó** y la
 * pantalla tiene que decirlo y ofrecer elegir origen.
 */
export interface SearchResult<T> {
  readonly items: readonly T[];
  readonly sinOrigen: boolean;
}
