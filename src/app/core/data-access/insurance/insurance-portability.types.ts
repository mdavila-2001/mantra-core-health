/** Formatos de entrega del certificado de portabilidad. */
export type PortabilityExportFormat = 'PDF' | 'JSON' | 'BUNDLE';

/** Cuerpo de `POST /insurance/portability/export`. */
export interface PortabilityExportInput {
  readonly patientProfileId: string;
  readonly format?: PortabilityExportFormat;
  /** Aseguradora a la que el titular declara que quiere llevar su historial. */
  readonly targetInsurerTenantId?: string;
}

/** Totales agregados de un período del resumen actuarial. */
export interface PortabilityPeriodStats {
  readonly claimsCount: number;
  readonly approvedCount: number;
  readonly deniedCount: number;
  readonly pendingCount: number;
  readonly billedAmount: string;
  readonly coveredAmount: string;
  readonly patientCopayAmount: string;
  readonly deniedAmount: string;
  readonly firstClaimAt?: Date;
  readonly lastClaimAt?: Date;
  readonly coveredMonths: string;
}

/** Reclamos y montos de un año calendario. */
export interface PortabilityYearStats {
  readonly year: number;
  readonly claimsCount: number;
  readonly billedAmount: string;
  readonly coveredAmount: string;
}

/** El resumen actuarial del certificado. */
export interface PortabilitySummary {
  readonly currencyCode: string | null;
  readonly allTime: PortabilityPeriodStats;
  readonly last36Months: PortabilityPeriodStats;
  readonly byYear: readonly PortabilityYearStats[];
  readonly claimsOver2000Count: number;
  readonly estimatedLossRatioPercent: string | null;
}

/** Respuesta de `POST /insurance/portability/export`. */
export interface PortabilityExportResult {
  readonly certificateId: string;
  readonly manifestHash: string;
  readonly generatedAt: Date;
  readonly format: PortabilityExportFormat;
  readonly recordCount: number;
  readonly policiesCount: number;
  readonly pdfDownloadUrl: string;
  readonly jsonDownloadUrl: string;
  readonly verificationUrl: string;
  readonly summary: PortabilitySummary;
}

/**
 * Respuesta de `GET /public/portability/verify/:manifestHash`. Sin PHI: sólo
 * confirma que el certificado existe y con qué se emitió.
 */
export interface PortabilityVerification {
  readonly status: 'VALID';
  readonly certificateId: string;
  readonly manifestHash: string;
  readonly generatedAt: Date;
  readonly recordCount: number;
  readonly algorithm: 'SHA-256';
  readonly issuer: string;
}

/** Bytes descargados, con el nombre sugerido por el servidor si vino. */
export interface BinaryDownload {
  readonly blob: Blob;
  readonly fileName?: string;
}
