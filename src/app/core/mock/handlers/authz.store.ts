import { KINSHIP, SPECIALTY, STATUS } from '../fixtures/concepts';
import { MEDICAL, PACIENTE, PATIENTS, PROFESSIONALS } from '../fixtures/people';
import { TENANT_CLINICA, TENANT_CONSULTORIO } from '../mock-session';
import { Coleccion, iso, uuid } from '../mock-store';

/* ============================================================================
    The `authz` bases of access, as the simulator keeps them: care
    relationships (primary practitioner and care episodes), legal
    representations, clinical grants and the access by specialty (granular).
    The routes live in `authz.handlers.ts` and `access-requests.handlers.ts`.
    ========================================================================== */

export const CARE_RELATIONSHIP_TYPE = {
  PRIMARY: uuid('concept-care-rel-primary'),
  TREATING: uuid('concept-care-rel-treating'),
  CONSULTING: uuid('concept-care-rel-consulting'),
} as const;

/** Who opened the request: the other side is the one who answers it. */
export type RequestInitiator = 'PATIENT' | 'PRACTITIONER';

export interface SimulatedCareRelationship {
  readonly id: string;
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly practitionerProfileId: string;
  readonly relationshipTypeConceptId: string;
  readonly statusConceptId: string;
  readonly purposeConceptId: string | null;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly reasonText: string | null;
  /** Rows without it (older tabs) read as opened by the practitioner. */
  readonly requestedBy?: RequestInitiator;
  readonly requestedAt?: string;
  readonly decidedAt?: string | null;
}

export const careRelationships = new Coleccion<SimulatedCareRelationship>([
  {
    id: uuid('care-rel-1'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    practitionerProfileId: MEDICAL.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.TREATING,
    statusConceptId: STATUS['ST-ACTIVE']!,
    purposeConceptId: null,
    validFrom: iso(-400),
    validTo: null,
    reasonText: null,
  },
  {
    id: uuid('care-rel-2'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    practitionerProfileId: PROFESSIONALS[3]!.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.CONSULTING,
    statusConceptId: STATUS['ST-ACTIVE']!,
    purposeConceptId: null,
    validFrom: iso(-12),
    validTo: iso(80),
    reasonText: null,
  },
  {
    id: uuid('care-request-pendiente'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    practitionerProfileId: PROFESSIONALS[6]!.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.TREATING,
    statusConceptId: STATUS['ST-PENDING']!,
    purposeConceptId: null,
    validFrom: iso(0, 8, 30),
    validTo: null,
    reasonText:
      'Le encontré por la derivación de la Dra. Rojas: quisiera ver su expediente antes de la consulta de salud mental.',
  },
  // Ana asked a practitioner to be her primary one: it waits for him (her «Sent» tab).
  {
    id: uuid('care-request-primary-from-ana'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    practitionerProfileId: PROFESSIONALS[2]!.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.PRIMARY,
    statusConceptId: STATUS['ST-PENDING']!,
    purposeConceptId: null,
    validFrom: iso(-2, 10, 15),
    validTo: null,
    reasonText: null,
    requestedBy: 'PATIENT',
    requestedAt: iso(-2, 10, 15),
    decidedAt: null,
  },
  // A patient asked the demo practitioner, in her own practice (her «Received» tab).
  {
    id: uuid('care-request-primary-to-medica'),
    tenantId: TENANT_CONSULTORIO,
    patientProfileId: PATIENTS[2]!.id,
    practitionerProfileId: MEDICAL.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.PRIMARY,
    statusConceptId: STATUS['ST-PENDING']!,
    purposeConceptId: null,
    validFrom: iso(-1, 17, 40),
    validTo: null,
    reasonText: null,
    requestedBy: 'PATIENT',
    requestedAt: iso(-1, 17, 40),
    decidedAt: null,
  },
  ...PATIENTS.slice(1, 6).map((p, i) => ({
    id: uuid(`care-rel-medica-${p.id}`),
    tenantId: TENANT_CLINICA,
    patientProfileId: p.id,
    practitionerProfileId: MEDICAL.id,
    relationshipTypeConceptId: CARE_RELATIONSHIP_TYPE.TREATING,
    statusConceptId: STATUS['ST-ACTIVE']!,
    purposeConceptId: null,
    validFrom: iso(-300 + i * 20),
    validTo: null,
    reasonText: null,
  })),
]);

export const legalRepresentations = new Coleccion<{
  id: string;
  tenantId: string;
  patientProfileId: string;
  representativeUserId: string;
  representativeName: string;
  relationshipConceptId: string;
  statusConceptId: string;
  validFrom: string;
  validTo: string | null;
}>([
  {
    id: uuid('legal-rep-1'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PATIENTS[3]!.id,
    representativeUserId: uuid('user-p-guzman'),
    representativeName: 'Elena María Guzmán Arauz',
    relationshipConceptId: KINSHIP['RELATIONSHIP_MOTHER']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    validFrom: iso(-800),
    validTo: null,
  },
  {
    id: uuid('legal-rep-2'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PATIENTS[11]!.id,
    representativeUserId: uuid('user-p-soliz'),
    representativeName: 'Andrés Solíz Rojas',
    relationshipConceptId: KINSHIP['RELATIONSHIP_FATHER']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    validFrom: iso(-500),
    validTo: null,
  },
]);

/* ---- BR-20 · clinical grants over the patient's record --------------------- */

interface SimulatedClinicalGrant {
  readonly id: string;
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly grantedUserId: string;
  readonly isEmergency: boolean;
  readonly stateConceptId: string;
  readonly validFrom: string;
  readonly validTo: string;
}

export const clinicalGrants = new Coleccion<SimulatedClinicalGrant>([
  {
    id: uuid('clinical-grant-1'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    grantedUserId: MEDICAL.userId,
    isEmergency: false,
    stateConceptId: STATUS['ST-ACTIVE']!,
    validFrom: iso(-30),
    validTo: iso(60),
  },
  {
    // An emergency that already expired: the patient sees it existed and who asked for it.
    id: uuid('clinical-grant-emergencia-vencida'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    grantedUserId: PROFESSIONALS[3]!.userId,
    isEmergency: true,
    stateConceptId: STATUS['ST-ACTIVE']!,
    validFrom: iso(-40, 3, 10),
    validTo: iso(-40, 4, 10),
  },
]);

/* ---- access by specialty (granular): only the practitioner opens one ------- */

export type GranularStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

export interface SimulatedPractitionerAccess {
  readonly id: string;
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly practitionerProfileId: string;
  readonly requestedSpecialtyConceptIds: readonly string[];
  readonly authorizedSpecialtyConceptIds: readonly string[];
  readonly reasonText: string | null;
  readonly status: GranularStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
}

export const practitionerAccesses = new Coleccion<SimulatedPractitionerAccess>([
  {
    id: uuid('practitioner-access-pending-ana'),
    tenantId: TENANT_CLINICA,
    patientProfileId: PACIENTE.id,
    practitionerProfileId: PROFESSIONALS[4]!.id,
    requestedSpecialtyConceptIds: [SPECIALTY['CARDIOLOGIA']!, SPECIALTY['ENDOCRINOLOGIA']!],
    authorizedSpecialtyConceptIds: [],
    reasonText: 'Para el control de su presión antes de la interconsulta.',
    status: 'PENDING',
    requestedAt: iso(-1, 9, 5),
    decidedAt: null,
  },
]);

/**
 * How a practitioner's relationship with a patient stands: `REVOCADA` when the
 * patient revoked it and none is active. The simulated chart read uses it to
 * answer 403 after the revocation (BR-20).
 */
export function practitionerRelationshipState(
  practitionerProfileId: string | undefined,
  patientProfileId: string,
): 'ACTIVA' | 'REVOCADA' | 'NINGUNA' {
  if (practitionerProfileId === undefined) return 'NINGUNA';
  const theirs = careRelationships.filtrar(
    (r) => r.patientProfileId === patientProfileId && r.practitionerProfileId === practitionerProfileId,
  );
  if (theirs.some((r) => r.statusConceptId === STATUS['ST-ACTIVE'])) return 'ACTIVA';
  return theirs.some((r) => r.statusConceptId === STATUS['ST-REVOKED']) ? 'REVOCADA' : 'NINGUNA';
}

/** Whether the user holds a current emergency access over the patient. */
export function hasCurrentEmergencyAccess(userId: string, patientProfileId: string): boolean {
  const nowMs = Date.now();
  return clinicalGrants
    .filtrar((a) => a.patientProfileId === patientProfileId && a.grantedUserId === userId && a.isEmergency)
    .some((a) => a.stateConceptId === STATUS['ST-ACTIVE'] && Date.parse(a.validTo) > nowMs);
}

/** Survive F5 within the tab: see `Coleccion.persistirEn`. Same keys as before the move. */
careRelationships.persistirEn('mock.misc.relaciones');
legalRepresentations.persistirEn('mock.misc.representaciones');
practitionerAccesses.persistirEn('mock.authz.practitioner-access');
