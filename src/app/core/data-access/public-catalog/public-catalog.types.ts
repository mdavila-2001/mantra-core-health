/* ============================================================================
    Lo que una clínica y una farmacia **ofrecen**, tal como lo muestra su ficha
    dentro del panel.

    ## Por qué vive aparte de `public-directory.types.ts`

    Porque aquel archivo es la transcripción literal de `CONTRATO-PUBLICO.md`
    del backend —lo dice su cabecera— y estas dos lecturas **todavía no están
    en ese contrato**: son P30 y P31 de `PENDIENTES-BACKEND.md`. Mezclarlas ahí
    diría que la API ya las sirve, y el próximo que compare el archivo contra el
    contrato no sabría cuál de los dos está mal.

    Sobre la rama `mockup` las responde el simulador, que es para lo que existe.
    Contra la API real, las dos pantallas que las consumen se quedan en su
    estado de error hasta que el backend las publique; ninguna inventa datos.

    ## Los importes son texto

    Igual que en `pharmacy.types.ts` y en el detalle de laboratorio: el
    `numeric` de la base no cabe sin pérdida en un `number`, y un redondeo en
    un precio de salud no es un detalle de formato.
    ========================================================================== */

/**
 * Un servicio que una organización ofrece, como se lee desde afuera.
 *
 * Es el mismo servicio que su dueño edita en «Mis servicios», con **menos**
 * campos: acá no viajan la práctica, la cuenta de ingresos ni el código
 * impositivo, que son cosas de quien factura y no de quien se atiende.
 */
export interface PublicOfferedService {
  readonly id: string;
  /** El código del catálogo, que es como lo nombra una orden o un presupuesto. */
  readonly code: string;
  readonly name: string;
  /** Qué incluye, cuando la organización lo escribió. */
  readonly description: string | null;
  /**
   * Precio de referencia como texto exacto, o `null` si no hay ninguno
   * publicado.
   *
   * `null` y **no** `'0.00'`: un cero se lee como que el servicio no se cobra,
   * que es justo lo que «Mis servicios» ya evita con su «Definí el precio».
   */
  readonly price: string | null;
  /** El código de la moneda (`BOB`), o `null` cuando no hay precio. */
  readonly currency: string | null;
  /** Un servicio dado de baja se sigue listando, rotulado. */
  readonly isActive: boolean;
}

/** Un medicamento que una farmacia ofrece, como se lee desde afuera. */
export interface PublicPharmacyProduct {
  readonly id: string;
  /** El genérico: es por lo que busca quien lleva una receta. */
  readonly genericName: string;
  /** La marca concreta que esta farmacia tiene, o `null` si vende el genérico. */
  readonly brandName: string | null;
  /** «500 mg comprimidos», «jarabe 120 ml». `null` si no se publicó. */
  readonly presentation: string | null;
  /** El grupo terapéutico, que es como se agrupan en la ficha. */
  readonly therapeuticGroup: string | null;
  /** Precio de esta farmacia, texto exacto. `null` = sin precio publicado. */
  readonly price: string | null;
  readonly currency: string | null;
  /** Si lo tiene ahora. Un agotado se muestra rotulado, no se esconde. */
  readonly inStock: boolean;
  readonly requiresPrescription: boolean;
}
