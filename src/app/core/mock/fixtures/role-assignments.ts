import { ROLE_ASSIGNMENT_STATUS } from '../../data-access/practice-sites/role-assignment-concepts';
import { ROLE_ASSIGNMENT_STATUS_CODE } from '../../data-access/role-assignments/role-assignment-status';
import type { RoleAssignmentRow } from '../../data-access/role-assignments/role-assignments.types';
import { MEDICA, profesionalPorId } from './personas';
import { CARGO, ESTADO } from './conceptos';
import { reply, validation } from '../mock-router';
import { Coleccion, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Afiliación médico-centro por procedimiento (CM-07). Ids de ejemplo
    compartidos con los demás carriles de centros médicos (`CONTRATO.md`).
    ========================================================================== */

export const PRACTICE_CM_NORTE = uuid('practice-cm-norte');
export const PRACTICE_CM_SUR = uuid('practice-cm-sur');
export const SITE_CM_NORTE_1 = uuid('site-cm-norte-1');
export const SITE_CM_SUR_1 = uuid('site-cm-sur-1');
export const PROC_ENDOSCOPIA_ALTA = uuid('proc-endoscopia-alta');
export const PROC_COLONOSCOPIA = uuid('proc-colonoscopia');

const BOB_CURRENCY = uuid('concept-currency-bob');
const CLINIC_TYPE = uuid('concept-practice-type-clinic');
const ACTIVE_STATUS = ESTADO['ST-ACTIVE']!;

/** Las prácticas de ejemplo que suma `GET /practices`. */
export const CM_PRACTICES = [
  { id: PRACTICE_CM_NORTE, code: 'CMNORTE', name: 'Centro Médico Norte', status: 'ACTIVE', typeConceptId: CLINIC_TYPE, statusConceptId: ACTIVE_STATUS, currencyConceptId: BOB_CURRENCY, timeZone: 'America/La_Paz' },
  { id: PRACTICE_CM_SUR, code: 'CMSUR', name: 'Centro Médico Sur', status: 'ACTIVE', typeConceptId: CLINIC_TYPE, statusConceptId: ACTIVE_STATUS, currencyConceptId: BOB_CURRENCY, timeZone: 'America/La_Paz' },
];

/** Las sedes de ejemplo de los dos centros, para `GET /practices/:practiceId/sites`. */
export const CM_SITES = [
  { id: SITE_CM_NORTE_1, practiceId: PRACTICE_CM_NORTE, code: 'NORTE-1', name: 'Sede Norte 1', addressText: 'Av. Banzer km 5, Santa Cruz de la Sierra' },
  { id: SITE_CM_SUR_1, practiceId: PRACTICE_CM_SUR, code: 'SUR-1', name: 'Sede Sur 1', addressText: 'Av. Santos Dumont 410, Santa Cruz de la Sierra' },
].map((site) => ({ ...site, timeZone: 'America/La_Paz', latitude: null, longitude: null, status: 'ACTIVE' }));

/** Lo que publica cada sede, mientras el catálogo del centro (CM-06) no esté en la base. */
export const PUBLISHED_PROCEDURES = [
  { site: SITE_CM_NORTE_1, practiceId: PRACTICE_CM_NORTE, concept: PROC_ENDOSCOPIA_ALTA, display: 'Endoscopia digestiva alta', active: true },
  { site: SITE_CM_NORTE_1, practiceId: PRACTICE_CM_NORTE, concept: PROC_COLONOSCOPIA, display: 'Colonoscopia', active: true },
  { site: SITE_CM_NORTE_1, practiceId: PRACTICE_CM_NORTE, concept: uuid('proc-retirado'), display: 'Procedimiento retirado del catálogo', active: false },
  { site: SITE_CM_SUR_1, practiceId: PRACTICE_CM_SUR, concept: PROC_COLONOSCOPIA, display: 'Colonoscopia', active: true },
  { site: SITE_CM_SUR_1, practiceId: PRACTICE_CM_SUR, concept: PROC_ENDOSCOPIA_ALTA, display: 'Endoscopia digestiva alta', active: true },
].map((p) => ({
  id: uuid(`healthcare-service-${p.site}-${p.concept}`),
  practiceId: p.practiceId,
  practiceSiteId: p.site,
  serviceConceptId: p.concept,
  serviceDisplay: p.display,
  active: p.active,
}));

const PRACTICE_NAMES: Readonly<Record<string, string>> = {
  [PRACTICE_CM_NORTE]: 'Centro Médico Norte',
  [PRACTICE_CM_SUR]: 'Centro Médico Sur',
};

export type StatusCode = (typeof ROLE_ASSIGNMENT_STATUS_CODE)[keyof typeof ROLE_ASSIGNMENT_STATUS_CODE];

/** El uuid del concepto de cada estado; el front decide por el código, no por esto. */
const STATUS_CONCEPT: Readonly<Record<StatusCode, string>> = {
  ROLE_ASG_INVITED: uuid('concept-role-asg-invited'),
  ROLE_ASG_PENDING: ROLE_ASSIGNMENT_STATUS.PENDING,
  ROLE_ASG_ACTIVE: ROLE_ASSIGNMENT_STATUS.ACTIVE,
  ROLE_ASG_REJECTED: ROLE_ASSIGNMENT_STATUS.REJECTED,
  ROLE_ASG_SUSPENDED: ROLE_ASSIGNMENT_STATUS.SUSPENDED,
  ROLE_ASG_ENDED: ROLE_ASSIGNMENT_STATUS.ENDED,
};

type StoredRow = RoleAssignmentRow & { readonly createdAt: string };

function row(id: string, practiceId: string, practiceSiteId: string, concept: string, display: string, code: StatusCode, initiatedBy: RoleAssignmentRow['initiatedBy'], profileId = MEDICA.id, days = -1): StoredRow {
  return {
    id: uuid(id),
    practitionerProfileId: profileId,
    practitionerName: profesionalPorId(profileId)?.displayName ?? 'Profesional',
    practiceId,
    practiceSiteId,
    healthcareServiceId: uuid(`healthcare-service-${practiceSiteId}-${concept}`),
    serviceConceptId: concept,
    serviceDisplay: display,
    statusConceptId: STATUS_CONCEPT[code],
    statusCode: code,
    initiatedBy,
    createdAt: iso(days),
  };
}

export const affiliations = new Coleccion<StoredRow>([
  row('ra-cm-norte-endoscopia', PRACTICE_CM_NORTE, SITE_CM_NORTE_1, PROC_ENDOSCOPIA_ALTA, 'Endoscopia digestiva alta', 'ROLE_ASG_INVITED', 'PRACTICE'),
  row('ra-cm-sur-colonoscopia', PRACTICE_CM_SUR, SITE_CM_SUR_1, PROC_COLONOSCOPIA, 'Colonoscopia', 'ROLE_ASG_ACTIVE', 'PRACTITIONER', MEDICA.id, -7),
]).persistirEn('mock.practice.afiliaciones-cm');

/** La fila tal como viaja: sin el sello interno de creación. */
export function toRow({ createdAt: _createdAt, ...rest }: StoredRow): RoleAssignmentRow {
  return rest;
}

/** Cambia el estado de una fila, con el concepto que corresponde a su código. */
export function changeStatus(id: string, code: StatusCode): StoredRow | undefined {
  return affiliations.actualizar(id, { statusCode: code, statusConceptId: STATUS_CONCEPT[code] });
}

/** Crea una fila nueva en el estado dado, para un procedimiento de una sede. */
export function createAffiliation(practiceId: string, practiceSiteId: string, healthcareServiceId: string, profileId: string, code: StatusCode, initiatedBy: RoleAssignmentRow['initiatedBy']): StoredRow | undefined {
  const offer = PUBLISHED_PROCEDURES.find((p) => p.id === healthcareServiceId && p.practiceSiteId === practiceSiteId && p.practiceId === practiceId);
  if (offer === undefined) return undefined;
  return affiliations.agregar({
    id: nuevoId('ra-cm'),
    practitionerProfileId: profileId,
    practitionerName: profesionalPorId(profileId)?.displayName ?? 'Profesional',
    practiceId,
    practiceSiteId,
    healthcareServiceId,
    serviceConceptId: offer.serviceConceptId,
    serviceDisplay: offer.serviceDisplay,
    statusConceptId: STATUS_CONCEPT[code],
    statusCode: code,
    initiatedBy,
    createdAt: new Date().toISOString(),
  });
}

/** Lo que `GET /practitioners/me/role-assignments` suma a las vinculaciones de siempre. */
export function myAffiliations(profileId: string) {
  return affiliations.filtrar((f) => f.practitionerProfileId === profileId).map((f) => ({
    ...toRow(f),
    practiceName: PRACTICE_NAMES[f.practiceId] ?? 'Centro médico',
    practiceType: 'Clínica',
    roleConceptId: CARGO['ROLE-MEDICO']!,
    specialtyConceptId: null,
    status: f.statusConceptId,
    isPrimary: false,
    validFrom: null,
    validTo: null,
    createdAt: f.createdAt,
    avatarUrl: null,
  }));
}

/** `POST .../self-request` con un procedimiento: la fila queda pendiente del centro. */
export function requestAffiliation(practiceId: string, practiceSiteId: string | undefined, healthcareServiceId: string, profileId: string) {
  const offer = PUBLISHED_PROCEDURES.find((p) => p.id === healthcareServiceId);
  const created = createAffiliation(practiceId, practiceSiteId ?? offer?.practiceSiteId ?? '', healthcareServiceId, profileId, 'ROLE_ASG_PENDING', 'PRACTITIONER');
  return created === undefined ? validation('Ese procedimiento no lo publica la sede') : reply(201, { ...toRow(created), status: created.statusConceptId, createdAt: created.createdAt });
}
