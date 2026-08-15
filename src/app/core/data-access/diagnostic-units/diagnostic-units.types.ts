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
