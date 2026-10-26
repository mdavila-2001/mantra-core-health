import { ROLE_ASSIGNMENT_STATUS } from '../../data-access/practice-sites/role-assignment-concepts';
import { ROLE_ASSIGNMENT_STATUS_CODE } from '../../data-access/role-assignments/role-assignment-status';
import type { RoleAssignmentRow } from '../../data-access/role-assignments/role-assignments.types';
import { MEDICAL, professionalById } from './people';
import { CARGO, STATUS } from './concepts';
import { PRACTICE_CM_NORTE, PRACTICE_CM_SUR, PROCEDURE_COLONOSCOPY, PROCEDURE_UPPER_ENDOSCOPY, SITE_CM_NORTE_1, SITE_CM_SUR_1, SITES_BY_PRACTICE } from './healthcare-services';
import { reply, validation } from '../mock-router';
import { Coleccion, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Afiliación médico-centro por procedimiento (CM-07). Ids de ejemplo
    compartidos con los demás carriles de centros médicos (`CONTRATO.md`).
    ========================================================================== */

export { PRACTICE_CM_NORTE, PRACTICE_CM_SUR, SITE_CM_NORTE_1, SITE_CM_SUR_1 };

const BOB_CURRENCY = uuid('concept-currency-bob');
const CLINIC_TYPE = uuid('concept-practice-type-clinic');
const ACTIVE_STATUS = STATUS['ST-ACTIVE']!;

/** Las prácticas de ejemplo que suma `GET /practices`. */
export const CM_PRACTICES = [
  { id: PRACTICE_CM_NORTE, code: 'CMNORTE', name: 'Centro Médico Norte', status: 'ACTIVE', typeConceptId: CLINIC_TYPE, statusConceptId: ACTIVE_STATUS, currencyConceptId: BOB_CURRENCY, timeZone: 'America/La_Paz' },
  { id: PRACTICE_CM_SUR, code: 'CMSUR', name: 'Centro Médico Sur', status: 'ACTIVE', typeConceptId: CLINIC_TYPE, statusConceptId: ACTIVE_STATUS, currencyConceptId: BOB_CURRENCY, timeZone: 'America/La_Paz' },
];

/** Un procedimiento publicado por una sede, tal como lo conoce el catálogo (CM-06). */
export interface KnownOffer {
  readonly id: string;
  readonly practiceSiteId: string;
  readonly serviceConceptId: string;
  readonly serviceDisplay: string;
  readonly active: boolean;
}

let findOffer: (id: string) => KnownOffer | undefined = () => undefined;

/**
 * De dónde salen los procedimientos publicados. Lo fija `registerRoleAssignments` con la colección del doble de
 * CM-06; no se importa acá para no cerrar un ciclo con `practice.handlers`, que delega en este archivo.
 */
export function useOfferLookup(find: (id: string) => KnownOffer | undefined): void {
  findOffer = find;
}

/** El procedimiento si la sede lo publica y lo tiene activo; si no, `undefined`. */
export function publishedOffer(practiceId: string, practiceSiteId: string, healthcareServiceId: string): KnownOffer | undefined {
  const offer = findOffer(healthcareServiceId);
  const siteBelongs = SITES_BY_PRACTICE[practiceId]?.some((site) => site.id === practiceSiteId) === true;
  return offer !== undefined && offer.active && offer.practiceSiteId === practiceSiteId && siteBelongs ? offer : undefined;
}

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

function row(id: string, offerId: string, practiceId: string, practiceSiteId: string, concept: string, display: string, code: StatusCode, initiatedBy: RoleAssignmentRow['initiatedBy'], profileId = MEDICAL.id, days = -1): StoredRow {
  return {
    id: uuid(id),
    practitionerProfileId: profileId,
    practitionerName: professionalById(profileId)?.displayName ?? 'Profesional',
    practiceId,
    practiceSiteId,
    healthcareServiceId: offerId,
    serviceConceptId: concept,
    serviceDisplay: display,
    statusConceptId: STATUS_CONCEPT[code],
    statusCode: code,
    initiatedBy,
    createdAt: iso(days),
  };
}

export const affiliations = new Coleccion<StoredRow>([
  row('ra-cm-norte-endoscopia', uuid('offer-cm-norte-endoscopia'), PRACTICE_CM_NORTE, SITE_CM_NORTE_1, PROCEDURE_UPPER_ENDOSCOPY, 'Endoscopia digestiva alta', 'ROLE_ASG_INVITED', 'PRACTICE'),
  // La sede Sur nace sin procedimientos publicados (spec de CM-06): la oferta existe cuando el centro la publica.
  row('ra-cm-sur-colonoscopia', uuid('offer-cm-sur-colonoscopia'), PRACTICE_CM_SUR, SITE_CM_SUR_1, PROCEDURE_COLONOSCOPY, 'Colonoscopia', 'ROLE_ASG_ACTIVE', 'PRACTITIONER', MEDICAL.id, -7),
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
  const offer = publishedOffer(practiceId, practiceSiteId, healthcareServiceId);
  if (offer === undefined) return undefined;
  return affiliations.agregar({
    id: nuevoId('ra-cm'),
    practitionerProfileId: profileId,
    practitionerName: professionalById(profileId)?.displayName ?? 'Profesional',
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
  const offer = findOffer(healthcareServiceId);
  const created = createAffiliation(practiceId, practiceSiteId ?? offer?.practiceSiteId ?? '', healthcareServiceId, profileId, 'ROLE_ASG_PENDING', 'PRACTITIONER');
  return created === undefined ? validation('Ese procedimiento no lo publica la sede') : reply(201, { ...toRow(created), status: created.statusConceptId, createdAt: created.createdAt });
}
