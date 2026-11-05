/* ============================================================================
    La vitrina pública de medicamentos.

    Espeja `GET /public/medications` y `GET /public/medications/:id/availability`
    del módulo de farmacia de la API. Superficie **anónima**: no lleva sesión y
    no expone identificadores con los que se pueda pedir, reservar ni pagar.

    Los importes son SIEMPRE texto: el backend los declara `numeric` y un
    `number` de JavaScript no representa 0.10 sin error. Acá no se hace
    aritmética con ellos — se muestran tal como la farmacia los publicó.
    ========================================================================== */

/** Un punto desde donde medir distancias. */
export interface PuntoDeOrigen {
  readonly lat: number;
  readonly lng: number;
}

/** Un medicamento del vademécum, tal como la vitrina lo exhibe. */
export interface TarjetaDeMedicamento {
  /**
   * Concepto del vademécum. Es la llave para pedir la disponibilidad; no
   * identifica a ninguna farmacia ni a ningún producto concreto.
   */
  readonly conceptId: string;
  /** Código ATC de clasificación (p. ej. `C09CA01`). */
  readonly atcCode: string;
  /** Nombre del principio activo. */
  readonly genericName: string;
  /** Grupo terapéutico legible, derivado del primer nivel del ATC. */
  readonly therapeuticGroup: string;
  /** Marcas con que las farmacias lo publican. */
  readonly brands: readonly string[];
  /** Presentaciones publicadas. */
  readonly presentations: readonly string[];
  /** `true` si alguna publicación lo marca como venta bajo receta. */
  readonly requiresPrescription: boolean;
  /** Precio más bajo publicado hoy, texto exacto. */
  readonly priceFrom: string | null;
  /** Precio más alto publicado hoy, texto exacto. */
  readonly priceTo: string | null;
  /** Código de moneda; `null` si ninguna farmacia lo publica. */
  readonly currency: string | null;
  /** En cuántas farmacias está dentro del alcance consultado. */
  readonly pharmacyCount: number;
  /** Distancia a la más cercana que lo tiene; `null` sin origen. */
  readonly nearestKm: number | null;
  /** Para qué se usa según su grupo ATC (OMS); clasificación, no indicación. */
  readonly uses?: readonly string[];
  /** Por qué salió en la búsqueda; ausente sin texto. */
  readonly matchedBy?: 'name' | 'brand' | 'code' | 'use' | null;
  /** El uso que lo encontró, cuando `matchedBy` es `use`. */
  readonly matchedUse?: string | null;
}

/** Un medicamento del registro sanitario oficial que coincide con la búsqueda. */
export interface MedicamentoDelRegistro {
  readonly id: string;
  readonly name: string;
  readonly holder: string | null;
  readonly strengthText: string | null;
  readonly dosageForm: string | null;
  readonly sourceName: string;
  readonly atc: readonly string[];
  readonly uses: readonly string[];
  readonly requiresPrescription: boolean | null;
}

/** La página de la vitrina. */
export interface PaginaDeVitrina {
  readonly items: readonly TarjetaDeMedicamento[];
  readonly total: number;
  /** Los grupos terapéuticos del catálogo completo, para los filtros. */
  readonly groups: readonly string[];
  /** Lo que de verdad se buscó cuando lo escrito no daba nada («ibopofeno» → «ibuprofeno»). */
  readonly correctedQuery?: string | null;
  /** Lo que coincide en el registro sanitario oficial (AGEMED, CIMA…). */
  readonly officialProducts?: readonly MedicamentoDelRegistro[];
  readonly generatedAt: string;
}

/** Una farmacia que publica el medicamento consultado. */
export interface OfertaDeFarmacia {
  /** Slug del perfil público: el enlace a su ficha. */
  readonly pharmacySlug: string;
  readonly pharmacyName: string;
  readonly addressText: string | null;
  readonly city: string | null;
  readonly latitude: number;
  readonly longitude: number;
  /** Distancia en línea recta al origen; `null` sin origen. */
  readonly distanceKm: number | null;
  readonly brandName: string | null;
  readonly presentation: string | null;
  /** Lo que paga el paciente, texto exacto. */
  readonly price: string;
  readonly currency: string;
  /** `true` si la farmacia reporta unidades disponibles hoy. */
  readonly inStock: boolean;
  readonly homeDelivery: boolean;
  readonly pickup: boolean;
  readonly requiresPrescription: boolean;
}

/** La disponibilidad de un medicamento, farmacia por farmacia. */
export interface DisponibilidadDeMedicamento {
  readonly medication: TarjetaDeMedicamento;
  /** Ordenadas por stock, después distancia y después precio. */
  readonly offers: readonly OfertaDeFarmacia[];
  readonly generatedAt: string;
}

/** Los filtros de la vitrina. Sin ninguno, lista el catálogo publicado. */
export interface ConsultaDeVitrina {
  /** Principio activo, marca, código ATC o para qué se usa («dolor abdominal»). */
  readonly q?: string;
  /** `true` busca lo escrito tal cual, sin corregir el tipeo. */
  readonly exact?: boolean;
  /** Grupo terapéutico, tal como lo lista `groups`. */
  readonly group?: string;
  /** Desde dónde medir; `lat` y `lng` viajan juntos o no viajan. */
  readonly origin?: PuntoDeOrigen;
  /** Radio en km; sólo se aplica si viajó el origen. */
  readonly radiusKm?: number;
  readonly limit?: number;
}
