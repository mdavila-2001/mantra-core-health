/* ============================================================================
    Facturación por espacio — franja F5e (`CONTRATO-F2-F5.md` §F5e): tarifas de
    día-cama y de quirófano por tiempo, y cargos devengados antes de facturar.
    Los importes viajan como texto decimal (`numeric(20,6)`): nunca `number`.
    ========================================================================== */

export type TariffKind = 'BED_DAY' | 'OR_TIME';

/** Una tarifa de espacio con su vigencia `[validFrom, validTo)` (`tariffView` de la API). */
export interface SpaceTariff {
  readonly id: string;
  readonly practiceId: string;
  readonly tariffKind: TariffKind;
  /** Concepto `BED_CAT_*` (se traduce con `bedCategoryCode`). */
  readonly bedCategoryConceptId: string | null;
  readonly careSpaceId: string | null;
  readonly serviceCatalogId: string;
  readonly unitMinutes: number | null;
  readonly minimumUnits: number | null;
  readonly unitPrice: string | null;
  /** Moneda (pedido a A-F5e en la vista ampliada); la vista actual no la trae. */
  readonly currencyConceptId?: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly rowVersion: number;
}

/** `POST /billing/space-tariffs` (`CreateSpaceTariffDto`). */
export interface CreateSpaceTariffRequest {
  readonly practiceId: string;
  readonly tariffKind: TariffKind;
  readonly bedCategoryCode?: string;
  readonly careSpaceId?: string;
  readonly serviceCatalogId: string;
  readonly unitMinutes?: number;
  readonly minimumUnits?: number;
  readonly unitPrice: string;
  readonly currencyConceptId?: string;
  readonly validFrom: string;
  readonly validTo?: string;
}

export type ChargeSource = 'BED_DAY' | 'OR_TIME';
export type ChargeStatusCode = 'CHG_PENDING' | 'CHG_INVOICED' | 'CHG_VOIDED';

/** Un cargo devengado (`chargeView` de la API). */
export interface ChargeCapture {
  readonly id: string;
  readonly encounterId: string | null;
  readonly source: ChargeSource;
  /** Para el quirófano por tiempo, el caso; para el día-cama, la ubicación. */
  readonly sourceRefId: string;
  /** Día de servicio `yyyy-mm-dd`: para el día-cama, el que termina en la medianoche. */
  readonly serviceDate: string;
  readonly careSpaceId: string | null;
  readonly bedCategoryConceptId: string | null;
  readonly spaceTariffId: string | null;
  readonly quantity: string;
  /** `null` = tarifa faltante: no se inventa precio. */
  readonly unitPrice: string | null;
  readonly costCenterId: string | null;
  readonly status: ChargeStatusCode;
  readonly idempotencyKey: string;
  /** Minutos en sala (quirófano), sólo si la API los manda. */
  readonly minutes?: number | null;
}

/** Resultado de devengar día-cama (idempotente): los creados y cuántos ya estaban. */
export interface BedDayRunResult {
  readonly created: readonly ChargeCapture[];
  readonly skipped: number;
}

/**
 * Una persona internada en la sede (`GET /sites/:siteId/inpatients`, F3): de
 * ahí elige Facturación el encuentro, porque la API no tiene lectura de
 * estancias de facturación.
 */
export interface Inpatient {
  readonly encounterId: string;
  readonly patientProfileId: string | null;
  readonly bed: { readonly careSpaceId: string | null; readonly clinicalUnitId: string | null };
  readonly since: string | null;
  readonly levelOfCare: string | null;
  readonly expectedDischargeAt: string | null;
  readonly losDays: number | null;
}
