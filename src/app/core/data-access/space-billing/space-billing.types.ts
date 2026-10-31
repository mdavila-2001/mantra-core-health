/* ============================================================================
    Facturación por espacio — franja F5e (`CONTRATO-F2-F5.md` §F5e): tarifas de
    día-cama y de quirófano por tiempo, y cargos devengados antes de facturar.
    Los importes viajan como texto decimal (`numeric(20,6)`): nunca `number`.
    ========================================================================== */

export interface BillingConcept {
  readonly code: string;
  readonly display: string;
}

export type TariffKindCode = 'TARIFF_BED_DAY' | 'TARIFF_OR_TIME';

/** Una tarifa de espacio con su vigencia `[validFrom, validTo)`. */
export interface SpaceTariff {
  readonly id: string;
  readonly practiceId: string;
  readonly tariffKind: BillingConcept;
  readonly bedCategory: BillingConcept | null;
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly serviceCatalogId: string;
  readonly serviceName: string;
  readonly unitMinutes: number | null;
  readonly minimumUnits: number | null;
  readonly unitPrice: string;
  readonly currencyCode: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly status: BillingConcept;
}

/** `POST /billing/space-tariffs`. */
export interface CreateSpaceTariffRequest {
  readonly practiceId: string;
  readonly tariffKindCode: TariffKindCode;
  readonly bedCategoryCode?: string;
  readonly careSpaceId?: string;
  readonly serviceCatalogId: string;
  readonly unitMinutes?: number;
  readonly minimumUnits?: number;
  readonly unitPrice: string;
  readonly currencyCode: string;
  readonly validFrom: string;
  readonly validTo?: string;
}

export type ChargeSourceCode = 'CHG_SRC_BED_DAY' | 'CHG_SRC_OR_TIME';
export type ChargeStatusCode = 'CHG_PENDING' | 'CHG_INVOICED' | 'CHG_VOIDED';

/** Un cargo devengado (`billing.charge_captures`). */
export interface ChargeCapture {
  readonly id: string;
  readonly encounterId: string;
  readonly sourceKind: BillingConcept;
  readonly sourceRefId: string;
  /** Día de servicio `yyyy-mm-dd`: para el día-cama, el que termina en la medianoche. */
  readonly serviceDate: string;
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string };
  readonly bedCategory: BillingConcept | null;
  readonly spaceTariffId: string | null;
  readonly quantity: string;
  /** `null` = tarifa faltante: no se inventa precio. */
  readonly unitPrice: string | null;
  readonly currencyCode: string;
  readonly costCenter: { readonly id: string; readonly name: string } | null;
  readonly status: BillingConcept;
  readonly idempotencyKey: string;
  readonly voidReason: string | null;
  /** Quirófano por tiempo: los minutos facturados (salida − entrada a sala). */
  readonly minutes?: number | null;
}

/** `GET /billing/encounters/:encounterId/pending-charges`. */
export interface EncounterCharges {
  readonly encounterId: string;
  readonly patientName: string;
  readonly asOf: string;
  readonly charges: readonly ChargeCapture[];
}

/** Una estancia de internación con su resumen de cargos (desvío anotado: lectura de la lista). */
export interface BedDayStay {
  readonly encounterId: string;
  readonly patientName: string;
  readonly admittedAt: string;
  readonly dischargedAt: string | null;
  readonly currentBed: string;
  readonly pendingCharges: number;
}

/** Resultado de devengar día-cama (idempotente). */
export interface BedDayRunResult {
  readonly created: number;
  readonly skipped: number;
  readonly charges: readonly ChargeCapture[];
}
