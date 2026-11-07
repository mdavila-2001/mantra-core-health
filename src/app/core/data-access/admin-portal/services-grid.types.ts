/** The four catalog kinds the read-only services grid can show. */
export type ServicesGridKind = 'doctor' | 'laboratory' | 'hospital' | 'pharmacy';

/** Visual tone of a status, mapped by the screen to a badge variant. */
export type ServicesGridTone = 'success' | 'warning' | 'secondary';

/** One normalized row, whatever endpoint it came from. */
export interface ServicesGridRow {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Kind-specific grouping text (organization type, sample type, dosage form). */
  readonly group: string;
  /** Exact decimal string, or null when the source has no price for the row. */
  readonly price: string | null;
  readonly statusLabel: string;
  readonly statusTone: ServicesGridTone;
}

/** A normalized page. `truncated` is true when the API says there are more rows than it returned. */
export interface ServicesGridPage {
  readonly rows: readonly ServicesGridRow[];
  readonly truncated: boolean;
}
