import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS } from '../fixtures/agenda';
import { conjunto, define, displayOf } from '../fixtures/concepts';
import { CORPUS_LABORATORIES } from '../fixtures/bolivia-central-axis';
import { PACIENTE, PROFESSIONALS, professionalById } from '../fixtures/people';
import type { ProfesionalSimulado } from '../fixtures/people.types';
import {
  forbidden,
  reply,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import {
  TENANT_CLINICA,
  TENANT_CONSULTORIO,
  TENANT_HOSPITAL,
  TENANT_LABORATORIO,
  TENANT_NAMES,
} from '../mock-session';
import { Coleccion, iso, isoDia, texto, uuid } from '../mock-store';
import { servicios, serviciosPublicadosDe } from './practice.handlers';

/* ============================================================================
    Derivaciones (`/referrals`, módulo `clinical_ext` de la API).

    Espeja el contrato de la API (v4266, mergeada en `dev` y `test`): buscar
    un destino —practitioner u organización médica—, leer sus servicios
    concretos, emitir la derivación (también a una sede o fuera de la
    plataforma, con servicio en texto y resumen clínico), releer las de la
    persona, leer una, responderla desde el destino, registrar la
    contrarreferencia y anularla. Lo que se emite se guarda por pestaña
    (`persistirEn`), así que sobrevive a un F5 y la mutación se puede
    demostrar de punta a punta: alta → respuesta → relectura → pantalla.

    Todo `reason` va **arriba** del cuerpo de error, como en la API; los 422
    lo repiten en `details.reason`. Buscar con menos de dos letras es 422
    `REFERRAL_TARGET_QUERY_TOO_SHORT`; pedir servicios sin destino, 422
    `REFERRAL_TARGET_REQUIRED`, y de uno que no existe, 404
    `REFERRAL_TARGET_NOT_FOUND`.

    Emitir (`POST /referrals`, en `referral-issue.handlers.ts`) copia
    `referrals.service.ts#create` en su orden: con `referralType` y sin
    servicio del catálogo, destino ≥ 1 y servicio en texto + resumen clínico
    (400); sin ningún destino —ni servicio— 422 `REFERRAL_TARGET_REQUIRED` (un
    alta con sólo `targetServiceCatalogId` vale); el tipo por omisión es
    `CONSULTATION`; profesional inexistente 404 `REFERRAL_TARGET_NOT_FOUND`;
    servicio inexistente 404 `REFERRAL_SERVICE_NOT_FOUND`, inactivo 422
    `REFERRAL_SERVICE_INACTIVE` y ajeno al destino 422
    `REFERRAL_SERVICE_TARGET_MISMATCH`; encuentro que no es de la persona 404
    `REFERRAL_ENCOUNTER_NOT_FOUND`; 409 `REFERRAL_ALREADY_EXISTS` sólo con
    encuentro y con servicio, o profesional y especialidad, o sólo una
    organización, siempre con el tipo en la clave; sede inexistente 404. Con
    encuentro avisa a la persona por un profesional o una organización (no a
    un externo). `informedConsentId` en el alta es 400
    `REFERRAL_CONSENT_LINK_NOT_ALLOWED` (el vínculo lo escribe el
    consentimiento, ver `linkReferralConsent`). El ciclo de vida
    (`referral-lifecycle.handlers.ts`): responder exige organización activa
    (422 `TENANT_REQUIRED`) y ser destino —quien no lo es recibe 404
    `REFERRAL_NOT_FOUND`, como si no existiera—; motivo obligatorio al
    rechazar; contrarreferencia del destino sobre una aceptada, o de quien
    escribe la historia si el destino es sólo externo; anular una pendiente o
    aceptada (422 `REFERRAL_ALREADY_CLOSED`).
    ========================================================================== */

/**
 * El estado de una derivación. Mismos códigos que siembra la API
 * (`clinical_ext.concepts.ts`), para que la pantalla ramifique igual contra
 * las dos. Se registra acá y no en `fixtures/concepts.ts`, que ya está por
 * encima de su techo de líneas: `GET /terminology/concepts?ids=` lo etiqueta
 * igual, porque el registro es uno solo.
 */
conjunto('VS_REFERRAL_STATUS', 'Estado de la derivación', 'En qué quedó una derivación.');
export const REFERRAL_STATUS = define('VS_REFERRAL_STATUS', [
  ['REF_REQUESTED', 'Solicitada'],
  ['REF_ACCEPTED', 'Aceptada'],
  ['REF_REJECTED', 'Rechazada'],
  ['REF_COMPLETED', 'Completada'],
  ['REF_CANCELLED', 'Anulada'],
]);

/** El estado legible que la API deriva del concepto (`ReferralResponseDto.status`). */
const STATUS_BY_CONCEPT: Readonly<Record<string, string>> = {
  [REFERRAL_STATUS['REF_REQUESTED']!]: 'PENDING',
  [REFERRAL_STATUS['REF_ACCEPTED']!]: 'ACCEPTED',
  [REFERRAL_STATUS['REF_REJECTED']!]: 'REJECTED',
  [REFERRAL_STATUS['REF_COMPLETED']!]: 'COMPLETED',
  [REFERRAL_STATUS['REF_CANCELLED']!]: 'CANCELLED',
};

export const REFERRAL_TYPES = [
  'TREATMENT',
  'CONSULTATION',
  'DIAGNOSTIC_STUDY',
  'PROCEDURE',
  'SECOND_OPINION',
  'THERAPY',
  'HOSPITALIZATION',
  'OTHER',
] as const;

/** Las sedes del directorio simulado (`directory.handlers.ts`), con el nombre que se resuelve. */
export const BRANCHES: Readonly<Record<string, { readonly tenantId: string; readonly name: string }>> = {
  [uuid('branch-olivos-central')]: { tenantId: TENANT_CLINICA, name: 'Sede Central' },
  [uuid('branch-olivos-equipetrol')]: { tenantId: TENANT_CLINICA, name: 'Consultorios Equipetrol' },
  [uuid('branch-sanlucas-central')]: { tenantId: TENANT_HOSPITAL, name: 'Hospital central' },
  [uuid('branch-sanlucas-norte')]: { tenantId: TENANT_HOSPITAL, name: 'Anexo Norte' },
};

/** Las organizaciones médicas que pueden recibir una derivación, con lo que las distingue. */
export const ORGANIZATIONS: readonly { readonly id: string; readonly subtitle: string }[] = [
  { id: TENANT_HOSPITAL, subtitle: 'Hospital · Santa Cruz de la Sierra' },
  { id: TENANT_CLINICA, subtitle: 'Clínica · Santa Cruz de la Sierra' },
  { id: TENANT_CONSULTORIO, subtitle: 'Consultorio · Santa Cruz de la Sierra' },
  // Sin catálogo a propósito: es el caso del destino que no publica servicios,
  // que la pantalla tiene que poder mostrar (S3 con próxima acción).
  { id: TENANT_LABORATORIO, subtitle: 'Laboratorio · Santa Cruz de la Sierra' },
];

export interface SimulatedReferral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly sourceEncounterId: string | null;
  readonly referringProfileId: string | null;
  readonly targetProfileId: string | null;
  readonly targetTenantId: string | null;
  readonly targetServiceCatalogId: string | null;
  readonly referralType: string | null;
  readonly specialtyConceptId?: string | null;
  readonly reasonText: string | null;
  readonly priorityConceptId: string | null;
  readonly statusConceptId: string;
  readonly validUntil: string | null;
  readonly respondedAt: string | null;
  readonly createdAt: string;
  readonly targetDisplayName: string | null;
  readonly targetServiceName: string | null;
  // v4266 — opcionales: las filas sembradas antes del campo no los traen.
  readonly targetBranchId?: string | null;
  readonly targetExternalName?: string | null;
  readonly targetExternalContact?: string | null;
  readonly requestedServiceText?: string | null;
  readonly diagnosisText?: string | null;
  readonly clinicalSummary?: string | null;
  readonly treatmentGivenText?: string | null;
  readonly rejectReason?: string | null;
  readonly counterReferralText?: string | null;
  readonly counterReferralAt?: string | null;
  readonly informedConsentId?: string | null;
}

interface TargetService {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /** Siempre número, como la API: `Number(defaultPrice ?? 0)`. */
  readonly price: number;
  readonly currency: string | null;
  readonly tenantId: string | null;
  readonly practiceName: string | null;
}

/** La práctica de cada organización con catálogo propio en el simulador. */
const PRACTICE_OF_TENANT: Readonly<Record<string, string>> = {
  [TENANT_CLINICA]: PRACTICE_OLIVOS,
  [TENANT_CONSULTORIO]: PRACTICE_CONSULTORIO,
};

/** Los servicios que una organización ofrece. Siempre los mismos para el mismo destino. */
export function servicesOfOrganization(tenantId: string | null): readonly TargetService[] {
  const name = tenantId === null ? null : (TENANT_NAMES[tenantId] ?? null);
  const practice = tenantId === null ? undefined : PRACTICE_OF_TENANT[tenantId];
  if (practice !== undefined) {
    return servicios
      .filtrar((s) => s.practiceId === practice && s.isActive)
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.descriptionText ?? null,
        price: Number(s.defaultPrice),
        currency: s.currencyCode,
        tenantId,
        practiceName: name,
      }));
  }
  if (tenantId === TENANT_HOSPITAL) {
    return serviciosPublicadosDe('hospital-san-lucas').map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      description: s.description,
      price: Number(s.price ?? 0),
      currency: s.currency,
      tenantId,
      practiceName: name,
    }));
  }
  return [];
}


function subtitleOf(p: ProfesionalSimulado): string {
  const specialty = p.especialidades[0];
  return [specialty === undefined ? null : displayOf(specialty), p.organizacion]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');
}

/** Sin tildes y en minúscula: «valeria» encuentra a «Valéria». */
function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

/** Lo mismo que declara el controlador: `@Roles('CLINICIAN', 'PRACTITIONER')`. */
export function isClinician(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return roles.includes('SUPERADMIN') || roles.includes('CLINICIAN') || roles.includes('PRACTITIONER');
}

const SEED_PRACTITIONER = PROFESSIONALS[3] ?? PROFESSIONALS[0]!;

/** Una derivación ya emitida, para que la lista de la paciente de prueba no nazca vacía. */
export const referralList = new Coleccion<SimulatedReferral>([
  {
    id: uuid('referral-paciente-1'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: PROFESSIONALS[0]!.id,
    targetProfileId: null,
    targetTenantId: TENANT_HOSPITAL,
    targetServiceCatalogId: servicesOfOrganization(TENANT_HOSPITAL)[0]?.id ?? null,
    referralType: 'DIAGNOSTIC_STUDY',
    reasonText: 'Control de la evolución con estudio complementario.',
    priorityConceptId: null,
    statusConceptId: REFERRAL_STATUS['REF_ACCEPTED']!,
    validUntil: `${isoDia(20)}T00:00:00.000Z`,
    respondedAt: iso(-3, 11),
    createdAt: iso(-5, 10),
    targetDisplayName: TENANT_NAMES[TENANT_HOSPITAL] ?? null,
    targetServiceName: servicesOfOrganization(TENANT_HOSPITAL)[0]?.name ?? null,
  },
  {
    id: uuid('referral-paciente-2'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: PROFESSIONALS[0]!.id,
    targetProfileId: SEED_PRACTITIONER.id,
    targetTenantId: null,
    targetServiceCatalogId: null,
    // Anterior al tipo: la lista tiene que decirlo y no inventarle uno.
    referralType: null,
    reasonText: null,
    priorityConceptId: null,
    statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
    validUntil: null,
    respondedAt: null,
    createdAt: iso(-40, 16),
    targetDisplayName: SEED_PRACTITIONER.displayName,
    targetServiceName: null,
  },
  {
    // Entrante: un colega deriva a la Dra. Rojas. Es la que ella puede aceptar
    // o rechazar en la demostración (ella es el destino).
    id: uuid('referral-paciente-entrante'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: SEED_PRACTITIONER.id,
    targetProfileId: PROFESSIONALS[0]!.id,
    targetTenantId: null,
    targetServiceCatalogId: null,
    referralType: 'CONSULTATION',
    reasonText: null,
    priorityConceptId: null,
    statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
    validUntil: `${isoDia(25)}T00:00:00.000Z`,
    respondedAt: null,
    createdAt: iso(-2, 16),
    targetDisplayName: PROFESSIONALS[0]!.displayName,
    targetServiceName: null,
    requestedServiceText: 'Interconsulta con cardiología por dolor torácico atípico',
    diagnosisText: 'Dolor torácico no especificado (R07.4)',
    clinicalSummary: 'Dolor punzante intermitente de 2 semanas, no relacionado con esfuerzo. ECG en reposo normal.',
  },
  {
    // Fuera de la plataforma: la contrarreferencia la transcribe quien escribe la historia.
    id: uuid('referral-paciente-externa'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: PROFESSIONALS[0]!.id,
    targetProfileId: null,
    targetTenantId: null,
    targetServiceCatalogId: null,
    referralType: 'DIAGNOSTIC_STUDY',
    reasonText: null,
    priorityConceptId: null,
    statusConceptId: REFERRAL_STATUS['REF_COMPLETED']!,
    validUntil: `${isoDia(-10)}T00:00:00.000Z`,
    respondedAt: iso(-20, 9),
    createdAt: iso(-30, 9),
    targetDisplayName: null,
    targetServiceName: null,
    targetExternalName: CORPUS_LABORATORIES[0]?.name ?? 'Laboratorio de análisis clínicos',
    targetExternalContact: CORPUS_LABORATORIES[0]?.sites[0]?.phone ?? null,
    requestedServiceText: 'Perfil lipídico completo y hemoglobina glicosilada',
    diagnosisText: 'Dislipidemia mixta (E78.2)',
    clinicalSummary: 'Control a los tres meses del inicio de estatina.',
    counterReferralText: 'LDL 96 mg/dL, HbA1c 7,1 %. Se envían resultados firmados.',
    counterReferralAt: iso(-15, 12),
  },
]).persistirEn('mock.clinical.derivaciones');

/**
 * El vínculo consentimiento ↔ derivación, como lo escribe la API: registrar un
 * consentimiento ACCEPTED con `targetType=REFERRAL` fija
 * `referral.informedConsentId` si estaba vacío (o apuntaba a uno que ya no
 * vale). Lo llama el simulador de consentimientos.
 */
export function linkReferralConsent(referralId: string, consentId: string): void {
  if (referralList.get(referralId) !== undefined) {
    referralList.actualizar(referralId, { informedConsentId: consentId });
  }
}

/** Revocar desvincula: todas las derivaciones que lo usaban quedan sin consentimiento. */
export function unlinkReferralConsent(consentId: string): void {
  for (const referral of referralList.filtrar((r) => r.informedConsentId === consentId)) {
    referralList.actualizar(referral.id, { informedConsentId: null });
  }
}

/** La derivación de esa persona, o `undefined`: la verificación de `targetType=REFERRAL`. */
export function referralOfPatient(referralId: string, patientProfileId: string): 'OK' | 'MISMATCH' | 'MISSING' {
  const referral = referralList.get(referralId);
  if (referral === undefined) return 'MISSING';
  return referral.patientProfileId === patientProfileId ? 'OK' : 'MISMATCH';
}

/** La vista que devuelve la API: estado legible y nombres de tenant y sede resueltos. */
export function view(r: SimulatedReferral) {
  const branch = r.targetBranchId == null ? undefined : BRANCHES[r.targetBranchId];
  const tenant = r.targetTenantId ?? branch?.tenantId ?? null;
  return {
    ...r,
    status: STATUS_BY_CONCEPT[r.statusConceptId] ?? null,
    targetTenantName: tenant === null ? null : (TENANT_NAMES[tenant] ?? null),
    targetBranchName: branch?.name ?? null,
  };
}

export function filled(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** El error con `reason`, con la forma del filtro global de la API. */
export function referralError(
  status: number,
  code: string,
  reason: string,
  message: string,
  details: Record<string, unknown> = {},
): MockReply {
  return reply(status, { statusCode: status, code, reason, message, details });
}

export const invalid = (reason: string, message: string, fields: readonly string[]): MockReply =>
  referralError(400, 'VALIDATION_FAILED', reason, message, { fields });

/** 422: el `reason` arriba y, como lo deja la API, también en `details`. */
export const precondition = (reason: string, message: string, referralId: string): MockReply =>
  referralError(422, 'PRECONDITION_FAILED', reason, message, { referralId, reason });

/** 422 de `PreconditionFailedException`: el `reason` arriba y también en `details`. */
export const preconditionInDetails = (reason: string, message: string, details: Record<string, unknown> = {}): MockReply =>
  referralError(422, 'PRECONDITION_FAILED', reason, message, { ...details, reason });

export const targetNotFound = (details: Record<string, unknown>): MockReply =>
  referralError(404, 'NOT_FOUND', 'REFERRAL_TARGET_NOT_FOUND', 'Destino no encontrado', details);

export const notFoundReferral = (referralId: string): MockReply =>
  referralError(404, 'NOT_FOUND', 'REFERRAL_NOT_FOUND', 'Referencia no encontrada', { referralId });

export function externalOnly(r: SimulatedReferral): boolean {
  return r.targetProfileId === null && r.targetTenantId === null && r.targetBranchId == null && filled(r.targetExternalName);
}

/**
 * Destino, como `isDestination` de la API: el profesional destino, o quien
 * actúa en el tenant destino (o en el de la sede destino) con ese tenant activo.
 */
export function isDestination(r: SimulatedReferral, request: MockRequest, activeTenantId: string | null): boolean {
  const user = request.user;
  if (user === null) return false;
  if (r.targetProfileId !== null && r.targetProfileId === user.practitionerProfileId) return true;
  const tenant = r.targetTenantId ?? (r.targetBranchId == null ? null : (BRANCHES[r.targetBranchId]?.tenantId ?? null));
  return tenant !== null && activeTenantId === tenant && user.tenants.includes(tenant);
}

/** La organización activa (`X-Tenant-Id`), la que exige `requireTenantId()` de la API. */
export function activeTenant(request: MockRequest): string | null {
  const header = request.headers.get('X-Tenant-Id');
  return header === null || header === '' ? null : header;
}

export function registerReferrals(router: MockRouter): void {
  router.get('/referrals/targets', (request) => {
    if (!isClinician(request)) return forbidden();
    const q = texto(request.query, 'q');
    if (q === null || q.trim().length < 2) {
      return preconditionInDetails('REFERRAL_TARGET_QUERY_TOO_SHORT', 'Escriba al menos dos letras para buscar.');
    }
    const needle = normalize(q.trim());
    const kind = texto(request.query, 'kind') ?? 'PRACTITIONER';
    if (kind === 'ORGANIZATION') {
      return {
        items: ORGANIZATIONS.filter((o) => normalize(TENANT_NAMES[o.id] ?? '').includes(needle))
          .slice(0, 20)
          .map((o) => ({
            kind: 'ORGANIZATION',
            id: o.id,
            displayName: TENANT_NAMES[o.id] ?? 'Organización',
            tenantId: o.id,
            subtitle: o.subtitle,
          })),
      };
    }
    return {
      items: PROFESSIONALS.filter(
        (p) => p.id !== request.user?.practitionerProfileId && normalize(p.displayName).includes(needle),
      )
        .slice(0, 20)
        .map((p) => ({
          kind: 'PRACTITIONER',
          id: p.id,
          displayName: p.displayName,
          tenantId: p.tenantId,
          subtitle: subtitleOf(p) || null,
        })),
    };
  });

  router.get('/referrals/target-services', (request) => {
    if (!isClinician(request)) return forbidden();
    const practitioner = texto(request.query, 'targetProfileId');
    const organization = texto(request.query, 'targetTenantId');
    if (practitioner !== null) {
      // El profesional ofrece los servicios de la organización en la que atiende.
      const p = professionalById(practitioner);
      if (p === undefined) return targetNotFound({ targetProfileId: practitioner });
      return { items: servicesOfOrganization(p.tenantId) };
    }
    if (organization !== null) {
      if (!ORGANIZATIONS.some((o) => o.id === organization)) return targetNotFound({ targetTenantId: organization });
      return { items: servicesOfOrganization(organization) };
    }
    return preconditionInDetails('REFERRAL_TARGET_REQUIRED', 'Indique un profesional o una organización.');
  });

  router.get('/referrals', (request) => {
    if (!isClinician(request)) return forbidden();
    const patientId = texto(request.query, 'patientProfileId');
    if (patientId === null) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    return referralList
      .filtrar((d) => d.patientProfileId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(view);
  });
}
