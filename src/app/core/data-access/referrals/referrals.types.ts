/**
 * Derivaciones del paciente (`clinical_ext.referrals`, CV-10).
 *
 * La API devuelve la fila tal cual y **los estados, la prioridad y la
 * especialidad viajan como identificadores de concepto**: la pantalla los
 * resuelve con `TerminologyClient.readConceptLabels` en una sola lectura por
 * página, no uno por derivación.
 */
export interface MyReferral {
  readonly id: string;
  readonly patientProfileId: string;
  /** Concepto del estado (solicitada, aceptada, rechazada…). */
  readonly statusConceptId: string;
  readonly specialtyConceptId?: string;
  readonly reasonConceptId?: string;
  readonly reasonText?: string;
  readonly priorityConceptId?: string;
  /** Profesional que derivó; la API no expone su nombre, sólo el perfil. */
  readonly referringProfileId?: string;
  readonly targetProfileId?: string;
  /** Vigencia de la derivación, `YYYY-MM-DD` interpretado como fecha civil. */
  readonly validUntil?: Date;
  readonly respondedAt?: Date;
  readonly createdAt: Date;
}
