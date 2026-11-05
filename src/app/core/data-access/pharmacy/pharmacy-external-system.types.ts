/** Formatos de sistema que la plataforma sabe leer. */
export const EXTERNAL_SYSTEM_FORMATS = ['ALOVIDA_STANDARD', 'SIMULATED_CHAIN'] as const;

export type ExternalSystemFormat = (typeof EXTERNAL_SYSTEM_FORMATS)[number];

/** Lo que la API muestra del sistema de la farmacia. Nunca trae la clave. */
export interface ExternalSystemSummary {
  readonly format: ExternalSystemFormat;
  readonly baseUrl: string;
  readonly externalPharmacyCode: string;
  /** Si hay una clave guardada. */
  readonly apiKeyConfigured: boolean;
  readonly configuredAt: string;
  /** Última comprobación persistida; histórico ausente significa desconocido. */
  readonly lastCheck?: {
    readonly status: 'ACTIVE' | 'ERROR';
    readonly errorReason: 'AUTH_REJECTED' | 'UNREACHABLE' | null;
    readonly checkedAt: string;
  };
}

/** `PUT …/:connectionId/external-system`. La clave viaja solo acá. */
export interface ExternalSystemDraft {
  readonly format: ExternalSystemFormat;
  readonly baseUrl: string;
  readonly externalPharmacyCode: string;
  readonly apiKey: string;
}

/** Respuesta del `PUT`: el sistema guardado y que respondió al probarlo. */
export interface ExternalSystemSaved {
  readonly system: ExternalSystemSummary;
  readonly probe: 'OK';
}

/** `POST …/:connectionId/external-system/test`. */
export interface ExternalSystemProbe {
  readonly status: 'OK';
  readonly source: 'PHARMACY' | 'SERVER';
}
