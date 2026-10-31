/* ============================================================================
    Equipos en sala — franja F5a (`CONTRATO-F2-F5.md` §F5a): dónde está cada
    equipo (espacio de F1), su AE Title DICOM y su recurso agendable.
    ========================================================================== */

export interface EquipmentConcept {
  readonly code: string;
  readonly display: string;
}

/** Un equipo diagnóstico visto desde el hospital. */
export interface LocatedEquipment {
  readonly id: string;
  readonly siteId: string;
  readonly diagnosticUnitSiteName: string;
  readonly type: EquipmentConcept;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly modality: EquipmentConcept | null;
  readonly operationalStatus: EquipmentConcept;
  /** La sala, con la ruta del árbol; `null` si todavía no se ubicó. */
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string; readonly path: string } | null;
  /** DICOM AE Title: ≤ 16 caracteres ASCII imprimibles, sin barra invertida. */
  readonly aeTitle: string | null;
  readonly stationName: string | null;
  readonly schedulableResourceId: string | null;
}

/** `PATCH /diagnostic-equipment/:id` (claves de F5a). */
export interface UpdateEquipmentLocation {
  readonly careSpaceId?: string | null;
  readonly aeTitle?: string | null;
  readonly stationName?: string | null;
}

/** `GET /diagnostic-equipment/:id/mwl-station`. */
export interface MwlStation {
  readonly scheduledStationAETitle: string | null;
  readonly scheduledStationName: string | null;
  readonly spsLocation: string | null;
}

/**
 * Claves que el DTO publicado de la API todavía no declara y F5a agrega: el
 * cliente **sí** las manda a la API real (mismo criterio que
 * `REFERRAL_CONTRACT_PENDING_KEYS`); se borran al regenerar el contrato.
 */
export const EQUIPMENT_LOCATION_CONTRACT_PENDING_KEYS = ['careSpaceId', 'aeTitle', 'stationName'] as const;

/** La regla DICOM del AE Title, igual que `ck_diagnostic_equipment_ae_title`. */
export function aeTitleProblem(value: string): string | null {
  if (value === '') return null;
  if (value.length > 16) return 'El AE Title admite hasta 16 caracteres.';
  if (!/^[\x20-\x7E]+$/.test(value)) return 'Sólo caracteres ASCII imprimibles.';
  if (value.includes('\\')) return 'No puede llevar barra invertida.';
  if (value.trim() === '') return 'No puede ser sólo espacios.';
  return null;
}
