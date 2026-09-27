/* ============================================================================
    Contrato de la facturación SIMULADA (FACT-SIAT-MOCK) — rutas
    `/billing/simulated/*`, que sólo responde el backend simulado del front.

    TODO(FACT-SIAT-MOCK): **no hay contrato de API real**. Cuando la API publique
    facturación, este cliente se reemplaza por el real; no se «conecta». Las
    rutas llevan `simulated` en el nombre y cada objeto declara
    `simulated: true` para que nadie las confunda con el producto.

    Dos vocabularios a propósito:
    - lo de MANTRA (cobros, pagos, emisores) va en inglés, como el resto de los
      contratos del front;
    - lo que es del SIAT (`cabecera`, `detalle`, `codigoEstado`, `mensajesList`)
      conserva los nombres oficiales, para que al cambiar el simulador por el
      SIAT real no haya nada que traducir.
    ========================================================================== */

/** Valor de un campo del XML: texto, número o `xsi:nil`. */
export type SiatValue = string | number | null;
export type SiatRow = Readonly<Record<string, SiatValue>>;

export type ChargeSource = 'CONSULTATION' | 'PHARMACY';

/** Estado del documento para la pantalla, derivado de la última respuesta del SIAT simulado. */
export type SimulatedInvoiceStatus = 'VALIDATED' | 'OBSERVED' | 'REJECTED' | 'ANNULLED';

export interface SimulatedIssuer {
  readonly id: string;
  readonly kind: 'PRACTICE' | 'PHARMACY';
  /** NIT **sintético** (CA-4). */
  readonly nit: string;
  readonly legalName: string;
  readonly municipality: string;
  readonly address: string;
  readonly phone: string | null;
  readonly branchCode: number;
  readonly pointOfSaleCode: number;
  /** Documento sector con el que emite (CA-1: 1, Compra y Venta). */
  readonly documentSector: number;
  readonly simulated: true;
}

export interface ChargeLine {
  readonly productCode: string;
  readonly description: string;
  /** Decimal en texto, como en el XML. */
  readonly quantity: string;
  readonly unitOfMeasure: number;
  readonly unitPrice: string;
  readonly discount: string | null;
  readonly subtotal: string;
}

export interface SimulatedPayment {
  readonly id: string;
  /** Código del catálogo **simulado** de métodos de pago. */
  readonly methodCode: number;
  readonly methodLabel: string;
  readonly amount: string;
  readonly currency: 'BOB';
  readonly paidAt: string;
  readonly simulated: true;
}

export interface SuggestedBuyer {
  readonly name: string;
  readonly documentTypeCode: number;
  readonly documentNumber: string;
  readonly email: string | null;
}

export interface SimulatedInvoiceSummary {
  readonly id: string;
  readonly invoiceNumber: number;
  readonly cuf: string;
  readonly status: SimulatedInvoiceStatus;
  readonly siatStatusCode: number;
  readonly issuedAt: string;
  readonly total: string;
  readonly simulated: true;
}

export interface SimulatedCharge {
  readonly id: string;
  readonly source: ChargeSource;
  /** `appointmentId` o id del pedido de farmacia. */
  readonly sourceRef: string;
  readonly issuerId: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly description: string;
  readonly lines: readonly ChargeLine[];
  readonly total: string;
  readonly currency: 'BOB';
  readonly createdAt: string;
  readonly payment: SimulatedPayment | null;
  readonly suggestedBuyer: SuggestedBuyer;
  readonly latestInvoice: SimulatedInvoiceSummary | null;
  readonly simulated: true;
}

export interface SimulatedChargesPage {
  readonly items: readonly SimulatedCharge[];
  readonly count: number;
  readonly simulated: true;
}

/** Mensaje del SIAT (nombres oficiales). */
export interface SiatMessage {
  readonly codigo: number;
  readonly descripcion: string;
  readonly advertencia: boolean;
  readonly forzadoPorSimulacion?: true;
}

/** `respuestaRecepcion` del SIAT (nombres oficiales). */
export interface SiatResponse {
  readonly transaccion: boolean;
  readonly codigoEstado: number;
  readonly codigoDescripcion: string;
  readonly codigoRecepcion: string | null;
  readonly mensajesList: readonly SiatMessage[];
  readonly simulated: true;
}

export type InvoiceEventKind =
  | 'PAYMENT_REGISTERED'
  | 'INVOICE_BUILT'
  | 'SENT_TO_SIAT'
  | 'SIAT_RESPONSE'
  | 'ANNULMENT'
  | 'ANNULMENT_REVERSAL'
  | 'EMAIL_QUEUED';

export interface InvoiceEvent {
  readonly kind: InvoiceEventKind;
  readonly at: string;
  readonly siatStatusCode: number | null;
  readonly detail: string;
}

export interface SimulatedInvoice {
  readonly id: string;
  readonly chargeId: string;
  readonly issuer: SimulatedIssuer;
  readonly documentSector: number;
  /** Computarizada en Línea (CA-2). */
  readonly modality: 2;
  readonly invoiceNumber: number;
  readonly cuf: string;
  readonly cufd: string;
  readonly issuedAt: string;
  /** La cabecera del XML, con los nombres del XSD oficial. */
  readonly cabecera: SiatRow;
  readonly detalle: readonly SiatRow[];
  readonly xml: string;
  readonly hashArchivo: string;
  readonly compressedBytes: number;
  readonly status: SimulatedInvoiceStatus;
  readonly siatResponse: SiatResponse;
  readonly events: readonly InvoiceEvent[];
  readonly simulated: true;
}

export interface SimulatedOutboxEntry {
  readonly id: string;
  readonly invoiceId: string;
  readonly to: string;
  readonly attachments: readonly string[];
  /** Nunca se envía nada: la bandeja es de mentira y lo dice. */
  readonly status: 'NOT_SENT_SIMULATED';
  readonly queuedAt: string;
  readonly simulated: true;
}

export interface SimulatedOutboxPage {
  readonly items: readonly SimulatedOutboxEntry[];
  readonly count: number;
  readonly simulated: true;
}

export interface SimulatedCatalogEntry {
  readonly codigo: number;
  readonly descripcion: string;
  readonly origen: 'EJEMPLO_OFICIAL' | 'SIMULADO';
}

export interface SimulatedCatalogs {
  readonly paymentMethods: readonly SimulatedCatalogEntry[];
  readonly identityDocumentTypes: readonly SimulatedCatalogEntry[];
  readonly annulmentReasons: readonly SimulatedCatalogEntry[];
  /** Códigos del catálogo oficial que la directiva de simulación puede forzar. */
  readonly forceableMessages: readonly { readonly codigo: number; readonly descripcion: string; readonly advertencia: boolean }[];
  readonly simulated: true;
}

export interface SimulatedFiscalCredentials {
  readonly issuerId: string;
  readonly cuis: string | null;
  readonly cuisValidUntil: string | null;
  readonly cufd: string | null;
  readonly cufdValidUntil: string | null;
}

export interface SimulatedFiscalStatus {
  readonly environment: 'SIMULADO';
  readonly modality: 2;
  /** Hora del «SIN simulado» (Bolivia). */
  readonly serverTime: string;
  readonly issuers: readonly SimulatedIssuer[];
  readonly credentials: readonly SimulatedFiscalCredentials[];
  readonly simulated: true;
}

// ---- cuerpos -------------------------------------------------------------------

export interface RegisterPaymentInput {
  readonly methodCode: number;
}

export interface BuyerInput {
  readonly name: string;
  readonly documentTypeCode: number;
  readonly documentNumber: string;
  readonly complement?: string | null;
  readonly email?: string | null;
}

export interface IssueInvoiceInput {
  readonly buyer: BuyerInput;
  readonly additionalDiscount?: string | null;
  /** Sólo simulador: forzar un mensaje del catálogo oficial para mostrar una rama. */
  readonly simulation?: { readonly forceMessageCode?: number } | null;
}

export interface AnnulInvoiceInput {
  readonly reasonCode: number;
}

export interface EmailInvoiceInput {
  readonly to: string;
}
