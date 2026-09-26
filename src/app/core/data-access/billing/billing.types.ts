/**
 * Lecturas de facturación (CV-12). **Sólo lectura**: emitir, cobrar, aplicar
 * pagos y notas de crédito quedan fuera de este carril.
 *
 * Los importes son cadenas decimales y se muestran tal cual: la suma la hace el
 * servidor con aritmética exacta.
 */
export interface InvoiceSummary {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly patientProfileId: string;
  /** Concepto del estado de la factura. */
  readonly statusConceptId: string;
  readonly issueDate: Date;
  readonly dueDate?: Date;
  readonly total?: string;
  readonly balance?: string;
  readonly createdAt: Date;
}

export interface InvoiceLine {
  readonly id: string;
  readonly description?: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly discount?: string;
  readonly taxAmount?: string;
  readonly lineTotal?: string;
}

export interface InvoiceDetail {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly subtotal?: string;
  readonly taxTotal?: string;
  readonly discountTotal?: string;
  readonly total?: string;
  readonly paidTotal?: string;
  readonly balance?: string;
  readonly lineCount: number;
  readonly lines: readonly InvoiceLine[];
}

export interface PatientStatement {
  readonly id: string;
  readonly patientProfileId: string;
  /** Inicio y fin del período, fechas civiles. */
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly openingBalance: string;
  readonly charges: string;
  readonly payments: string;
  readonly closingBalance: string;
}

/** Una página por cursor opaco: `nextCursor === null` es la última. */
export interface BillingPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface BillingPageQuery {
  readonly practiceId: string;
  readonly cursor?: string;
  readonly limit?: number;
}
