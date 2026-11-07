import type { LabServiceDraft } from './lab-portal.types';

/* ---- bulk CSV import ---------------------------------------------------- */

/** Create what is new and update what exists, or only update. */
export type LabImportMode = 'CREATE_OR_UPDATE' | 'UPDATE_ONLY';

/** A CSV row already parsed, with its line number to point at it. */
export interface LabImportRow {
  readonly line: number;
  readonly service: LabServiceDraft;
}

export type LabImportOutcome = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'REJECTED';

export interface LabImportRowResult {
  readonly line: number;
  readonly code: string;
  readonly outcome: LabImportOutcome;
  /** Why it was rejected, in plain words. */
  readonly reason: string | null;
}

export interface LabImportResult {
  readonly created: number;
  readonly updated: number;
  readonly unchanged: number;
  readonly rejected: number;
  readonly rows: readonly LabImportRowResult[];
}

/* ---- study catalog (proceso 4.2) ----------------------------------------- */

/** Suggested list price, copied verbatim from its tariff. */
export interface LabSuggestedPrice {
  readonly source: 'INLASA' | 'FONASA';
  readonly sourceCode: string;
  readonly sourceName: string;
  /** Exact decimal string in BOB ('60.00'). */
  readonly priceBs: string;
}

/** One component of a panel (Hemoglobina of the Hemograma). */
export interface LabCatalogComponent {
  readonly conceptId: string;
  readonly code: string;
  readonly name: string;
  readonly loinc: string | null;
  readonly unit: string | null;
  readonly suggestedPrice: LabSuggestedPrice | null;
}

/** One LOINC-coded análisis of the catalog the doctor orders from. */
export interface LabCatalogItem {
  readonly conceptId: string;
  readonly code: string;
  readonly name: string;
  readonly loinc: string | null;
  readonly specimen: string | null;
  /** What is drawn from the patient (BLOOD, URINE…), a code of `LabCatalog.sampleTypes`. */
  readonly sampleType: string;
  readonly suggestedPrice: LabSuggestedPrice | null;
  /** The lab service already made from this item, if any. */
  readonly offeredServiceId: string | null;
  readonly components: readonly LabCatalogComponent[];
}

export interface LabCatalogSection {
  readonly code: string;
  readonly name: string;
  readonly items: readonly LabCatalogItem[];
}

/** `GET /diagnostics/lab/catalog`. */
export interface LabCatalog {
  readonly sections: readonly LabCatalogSection[];
  /** Sample types in display order (blood first): how the lab browses. */
  readonly sampleTypes: readonly { readonly code: string; readonly name: string }[];
  readonly count: number;
  /** How suggested prices were chosen, to cite on screen. */
  readonly priceRule: string;
  /** Version of the LOINC catalog loaded; null: only the basic análisis are there. */
  readonly catalogVersion: string | null;
}

/** LINKED: a free-form service with the same code now points to the catalog item. */
export type LabCatalogImportOutcome = 'CREATED' | 'LINKED' | 'REPUBLISHED' | 'SKIPPED' | 'REJECTED';

/** `POST /diagnostics/lab/catalog/import`. */
export interface LabCatalogImportResult {
  readonly created: number;
  readonly republished: number;
  readonly linked: number;
  readonly skipped: number;
  readonly rejected: number;
  readonly rows: readonly {
    readonly conceptId: string;
    readonly outcome: LabCatalogImportOutcome;
    readonly serviceId: string | null;
    readonly reason: string | null;
  }[];
}
