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
  readonly priceFrom: string;
  /** Precio más alto publicado hoy, texto exacto. */
  readonly priceTo: string;
  /** Código de moneda. */
  readonly currency: string;
  /** En cuántas farmacias está dentro del alcance consultado. */
  readonly pharmacyCount: number;
  /** Distancia a la más cercana que lo tiene; `null` sin origen. */
  readonly nearestKm: number | null;
}

/** La página de la vitrina. */
export interface PaginaDeVitrina {
  readonly items: readonly TarjetaDeMedicamento[];
  readonly total: number;
  /** Los grupos terapéuticos del catálogo completo, para los filtros. */
  readonly groups: readonly string[];
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
  /** Texto a buscar en principio activo, marca o código ATC. */
  readonly q?: string;
  /** Grupo terapéutico, tal como lo lista `groups`. */
  readonly group?: string;
  /** Desde dónde medir; `lat` y `lng` viajan juntos o no viajan. */
  readonly origin?: PuntoDeOrigen;
  /** Radio en km; sólo se aplica si viajó el origen. */
  readonly radiusKm?: number;
  readonly limit?: number;
}
