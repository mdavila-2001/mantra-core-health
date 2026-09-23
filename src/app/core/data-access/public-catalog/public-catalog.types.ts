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

/* ============================================================================
    Las sucursales de una farmacia y la búsqueda de una receta entre ellas.

    Pedido del propietario (19/09/2026): «debe mostrar todas sus sucursales y
    pedirle ubicación para la más cercana recomendar dada una receta médica».

    Como las dos lecturas de arriba, **la API real todavía no las publica**:
    son P37 de `PENDIENTES-BACKEND.md` y sobre `mockup` las responde el
    simulador. Contra la API real la sección se queda en su estado de error;
    no inventa sucursales ni existencias.
    ========================================================================== */

/**
 * Una sucursal de la cadena a la que pertenece la farmacia que se está
 * mirando —ella incluida—.
 *
 * Es la unidad que le sirve a una persona: quien va a comprar una receta va a
 * **un mostrador con una dirección**, no a una marca. Por eso cada sucursal
 * tiene su propia ficha (`slug`) y este tipo trae lo que hace falta para
 * elegir entre ellas sin abrir ninguna.
 */
export interface PublicPharmacyBranch {
  /** El slug de su propia ficha pública. */
  readonly slug: string;
  /** «Farmacorp · San Miguel»: la cadena y la sucursal, que es como se nombra. */
  readonly name: string;
  /** Sólo la sucursal («San Miguel»), para no repetir la cadena en cada renglón. */
  readonly siteName: string;
  readonly city: string | null;
  readonly addressText: string | null;
  readonly phone: string | null;
  /** «Lun a Sáb 08:00–22:00», tal como lo publica la cadena. `null` si no lo declara. */
  readonly openingHours: string | null;
  /** Sin punto no hay pin ni distancia: la sucursal se lista igual, con su dirección. */
  readonly location: PublicGeoPoint | null;
  /**
   * Con cuánta precisión se conoce ese punto, ya en palabras («Ubicación
   * aproximada · centro de la ciudad»). `null` cuando no se declara.
   *
   * Viaja resuelto y no como código porque es **una advertencia para quien
   * mira**, no una faceta: una distancia medida contra el centroide de la
   * ciudad no es la distancia a la puerta, y decirla sin esto sería precisión
   * fingida.
   */
  readonly locationAccuracy: string | null;
  /** Si es la sucursal cuya ficha se está mirando. */
  readonly isCurrent: boolean;
}

/** Un punto en grados decimales, como lo sirve la superficie pública. */
export interface PublicGeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/** Un renglón de la receta que la sucursal **sí** tiene. */
export interface PublicBranchMatch {
  /** Lo que la persona escribió, para poder decir cuál de sus renglones es. */
  readonly term: string;
  readonly genericName: string;
  readonly brandName: string | null;
  readonly presentation: string | null;
  /** Texto exacto, como el resto de los importes. `null` si no hay precio publicado. */
  readonly price: string | null;
  readonly currency: string | null;
}

/**
 * Qué tiene una sucursal de una receta concreta.
 *
 * `complete` no se deduce de `missing.length` en la pantalla: lo dice el
 * servidor, que es el que sabe qué se buscó. Una sucursal sin nada igual
 * aparece, rotulada — esconderla dejaría a la persona sin saber que existe.
 */
export interface PublicBranchAvailability {
  readonly branch: PublicPharmacyBranch;
  readonly matches: readonly PublicBranchMatch[];
  /** Los renglones de la receta que esta sucursal no tiene o tiene agotados. */
  readonly missing: readonly string[];
  readonly complete: boolean;
  /** Suma de lo que sí tiene, en texto exacto. `null` cuando no tiene nada. */
  readonly totalAmount: string | null;
  readonly currency: string | null;
  /**
   * Distancia **en línea recta**, con una decimal, o `null` si no se entregó
   * ubicación. No es distancia de recorrido y el rótulo lo dice igual que el
   * campo (PAC-MED-005).
   */
  readonly distanceKm: number | null;
}
