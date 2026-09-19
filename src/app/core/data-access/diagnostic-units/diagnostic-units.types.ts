/** Concepto ya resuelto por el servidor, sin UUID técnico. */
export interface DiagnosticConcept {
  readonly code: string;
  readonly display: string;
}

/** Resumen que alimenta una tarjeta del directorio. */
export interface DiagnosticUnitDirectoryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: DiagnosticConcept;
  readonly siteCount: number;
  readonly equipmentCount: number;
  readonly studyCount: number;
  readonly acceptsExternalOrders: boolean | null;
  readonly walkInAvailable: boolean | null;
  readonly homeCollectionAvailable: boolean | null;
}

export interface DiagnosticUnitDirectory {
  readonly items: readonly DiagnosticUnitDirectoryItem[];
  readonly count: number;
}

export interface DiagnosticUnitSite {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly role: DiagnosticConcept;
  readonly sampleCollectionAvailable: boolean | null;
  readonly imagingAvailable: boolean | null;
}

export interface DiagnosticEquipment {
  readonly id: string;
  readonly siteId: string;
  readonly type: DiagnosticConcept;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly modality: DiagnosticConcept | null;
  readonly operationalStatus: DiagnosticConcept;
  readonly lastCalibrationAt: Date | null;
  readonly nextCalibrationDueAt: Date | null;
}

export interface DiagnosticPublicPrice {
  readonly amount: string;
  readonly currency: DiagnosticConcept;
  readonly scheduleCode: string;
  readonly siteId: string | null;
}

export interface DiagnosticStudy {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly siteId: string | null;
  readonly modality: DiagnosticConcept | null;
  readonly preparationInstructions: string | null;
  readonly expectedDurationMinutes: number | null;
  readonly expectedTurnaroundMinutes: number | null;
  readonly requiresMedicalOrder: boolean | null;
  readonly prices: readonly DiagnosticPublicPrice[];
}

export interface DiagnosticAccreditation {
  readonly id: string;
  readonly type: DiagnosticConcept;
  readonly number: string | null;
  readonly siteId: string | null;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
}

export interface DiagnosticUnitDetail extends DiagnosticUnitDirectoryItem {
  readonly sites: readonly DiagnosticUnitSite[];
  readonly equipment: readonly DiagnosticEquipment[];
  readonly studies: readonly DiagnosticStudy[];
  readonly accreditations: readonly DiagnosticAccreditation[];
}

/* ============================================================================
    El buscador del paciente.

    El directorio de arriba contesta «qué laboratorios tiene mi organización».
    Esto contesta la otra pregunta, la que la especificación le pide al portal:
    «dónde me hago este estudio» — entre todos los centros publicados, filtrando
    por tipo, estudio, prestaciones, convenio, precio y calificación.

    Son dos lecturas del mismo catálogo y por eso la tarjeta es la misma, con
    dos datos más que sólo el buscador necesita.
    ========================================================================== */

/** Tipo de centro que el buscador entiende. */
export type DiagnosticUnitKind = 'LABORATORY' | 'IMAGING';

/** Los filtros del buscador. Todos opcionales: sin ninguno, lista todo. */
export interface DiagnosticUnitSearchQuery {
  /** Texto libre sobre nombre y código. */
  readonly q?: string;
  /** Organización propietaria, si se acota a una. */
  readonly tenantId?: string;
  /** Laboratorio o imagenología. */
  readonly kind?: DiagnosticUnitKind;
  /** Sólo centros que ofrezcan este estudio. */
  readonly studyCode?: string;
  /** Sólo centros con convenio vigente con esta aseguradora. */
  readonly insurerTenantId?: string;
  /** Sólo centros que toman muestras a domicilio. */
  readonly homeCollection?: boolean;
  /** Sólo centros que atienden sin turno. */
  readonly walkIn?: boolean;
  /** Sólo centros que aceptan órdenes de otras instituciones. */
  readonly acceptsExternalOrders?: boolean;
  /** Precio publicado máximo. */
  readonly maxAmount?: number;
  /** Calificación mínima. */
  readonly minRating?: number;
  /** Tope de filas. */
  readonly limit?: number;
  /** Filas a saltar. */
  readonly offset?: number;
}

/**
 * Una tarjeta del buscador.
 *
 * `rating` es `null` cuando el centro todavía no tiene reseñas publicadas, y
 * eso **no es lo mismo que cero**: quien lo muestre dice «sin calificaciones»,
 * nunca una nota mínima que el centro no se ganó. Lo mismo con `minAmount` y
 * «sin tarifa publicada».
 */
export interface DiagnosticUnitSearchItem extends DiagnosticUnitDirectoryItem {
  readonly tenantId: string;
  readonly rating: number | null;
  readonly ratingCount: number;
  readonly minAmount: number | null;
  /**
   * Las ciudades donde el centro tiene sede, sin repetir. Es lo que deja
   * filtrar el directorio por el mapa de departamentos.
   *
   * **Opcional porque hoy sólo lo sirve la maqueta de `mockup`.** La búsqueda
   * de la API no lo devuelve todavía (TODO: exponerlo en
   * `diagnostic_units/dto/catalog.dto.ts`, a partir de las sedes). Sin el
   * dato el directorio no dibuja el mapa: un filtro que no filtra nada es
   * peor que no tenerlo.
   */
  readonly cities?: readonly string[];
}

/** Página del buscador. */
export interface DiagnosticUnitSearchPage {
  readonly items: readonly DiagnosticUnitSearchItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}
