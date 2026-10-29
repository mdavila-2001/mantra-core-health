import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS } from '../fixtures/agenda';
import { conjunto, define, displayOf } from '../fixtures/concepts';
import { PACIENTE, PROFESSIONALS, professionalById } from '../fixtures/people';
import type { ProfesionalSimulado } from '../fixtures/people.types';
import { conflict, forbidden, validation, type MockRequest, type MockRouter } from '../mock-router';
import {
  TENANT_CLINICA,
  TENANT_CONSULTORIO,
  TENANT_HOSPITAL,
  TENANT_LABORATORIO,
  TENANT_NAMES,
} from '../mock-session';
import { Coleccion, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';
import { servicios, serviciosPublicadosDe } from './practice.handlers';

/* ============================================================================
    Derivaciones (`/referrals`, módulo `clinical_ext` de la API).

    Espeja el contrato acordado con la API: buscar un destino —practitioner u
    organización médica—, leer sus servicios concretos, emitir la derivación y
    releer las de la persona. Lo que se emite se guarda por pestaña
    (`persistirEn`), así que sobrevive a un F5 y la mutación se puede
    demostrar de punta a punta: alta → respuesta → relectura → pantalla.
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
]);

const REFERRAL_TYPES = ['TREATMENT', 'CONSULTATION', 'DIAGNOSTIC_STUDY', 'PROCEDURE', 'SECOND_OPINION'] as const;

/** Las organizaciones médicas que pueden recibir una derivación, con lo que las distingue. */
const ORGANIZATIONS: readonly { readonly id: string; readonly subtitle: string }[] = [
  { id: TENANT_HOSPITAL, subtitle: 'Hospital · Santa Cruz de la Sierra' },
  { id: TENANT_CLINICA, subtitle: 'Clínica · Santa Cruz de la Sierra' },
  { id: TENANT_CONSULTORIO, subtitle: 'Consultorio · Santa Cruz de la Sierra' },
  // Sin catálogo a propósito: es el caso del destino que no publica servicios,
  // que la pantalla tiene que poder mostrar (S3 con próxima acción).
  { id: TENANT_LABORATORIO, subtitle: 'Laboratorio · Santa Cruz de la Sierra' },
];

interface SimulatedReferral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly sourceEncounterId: string | null;
  readonly referringProfileId: string | null;
  readonly targetProfileId: string | null;
  readonly targetTenantId: string | null;
  readonly targetServiceCatalogId: string | null;
  readonly referralType: string | null;
  readonly reasonText: string | null;
  readonly priorityConceptId: string | null;
  readonly statusConceptId: string;
  readonly validUntil: string | null;
  readonly respondedAt: string | null;
  readonly createdAt: string;
  readonly targetDisplayName: string | null;
  readonly targetServiceName: string | null;
}

interface TargetService {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly price: string | null;
  readonly currency: string | null;
  readonly tenantId: string | null;
  readonly practiceName: string | null;
}

/** Los servicios que una organización ofrece. Siempre los mismos para el mismo destino. */
function servicesOfOrganization(tenantId: string | null): readonly TargetService[] {
  const name = tenantId === null ? null : (TENANT_NAMES[tenantId] ?? null);
  const practice =
    tenantId === TENANT_CLINICA
      ? PRACTICE_OLIVOS
      : tenantId === TENANT_CONSULTORIO
        ? PRACTICE_CONSULTORIO
        : null;
  if (practice !== null) {
    return servicios
      .filtrar((s) => s.practiceId === practice && s.isActive)
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.descriptionText ?? null,
        price: s.defaultPrice,
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
      price: s.price,
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
function isClinician(request: MockRequest): boolean {
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
]).persistirEn('mock.clinical.derivaciones');

export function registerReferrals(router: MockRouter): void {
  router.get('/referrals/targets', (request) => {
    if (!isClinician(request)) return forbidden();
    const q = texto(request.query, 'q');
    if (q === null || q.trim().length < 2) {
      return validation('Escriba al menos dos letras para buscar.', [
        { message: 'Escriba al menos dos letras para buscar.' },
      ]);
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
      return { items: servicesOfOrganization(p?.tenantId ?? null) };
    }
    if (organization !== null) {
      return { items: servicesOfOrganization(organization) };
    }
    return validation('Indique un profesional o una organización.', [
      { message: 'Indique un profesional o una organización.' },
    ]);
  });

  router.get('/referrals', (request) => {
    if (!isClinician(request)) return forbidden();
    const patientId = texto(request.query, 'patientProfileId');
    if (patientId === null) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    return referralList
      .filtrar((d) => d.patientProfileId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  router.post('/referrals', (request) => {
    if (!isClinician(request)) return forbidden();
    const body = cuerpo<{
      patientProfileId: string;
      sourceEncounterId: string;
      targetProfileId: string;
      targetTenantId: string;
      targetServiceCatalogId: string;
      referralType: string;
      reasonText: string;
      validUntil: string;
      priorityConceptId: string;
    }>(request);
    if (body.patientProfileId === undefined) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    if (body.targetProfileId === undefined && body.targetTenantId === undefined) {
      return validation('Indique a quién se deriva.', [
        { message: 'Indique a quién se deriva: un profesional o una organización.' },
      ]);
    }
    if (body.referralType !== undefined && !(REFERRAL_TYPES as readonly string[]).includes(body.referralType)) {
      return validation('Tipo de derivación desconocido.', [{ message: 'Tipo de derivación desconocido.' }]);
    }
    if ((body.reasonText ?? '').length > 1000) {
      return validation('El motivo admite hasta 1000 caracteres.', [
        { message: 'El motivo admite hasta 1000 caracteres.' },
      ]);
    }

    // La API responde 409 ante una equivalente: mismo encuentro, mismo destino
    // y mismo servicio. Sin encuentro no hay con qué compararla.
    const equivalent = referralList.filtrar(
      (d) =>
        body.sourceEncounterId !== undefined &&
        d.sourceEncounterId === body.sourceEncounterId &&
        d.targetProfileId === (body.targetProfileId ?? null) &&
        d.targetTenantId === (body.targetTenantId ?? null) &&
        d.targetServiceCatalogId === (body.targetServiceCatalogId ?? null),
    );
    if (equivalent.length > 0) {
      return conflict('Ya existe una referencia equivalente');
    }

    const practitioner = body.targetProfileId === undefined ? undefined : professionalById(body.targetProfileId);
    const serviceTenantId = body.targetTenantId ?? practitioner?.tenantId ?? null;
    const service =
      body.targetServiceCatalogId === undefined
        ? undefined
        : servicesOfOrganization(serviceTenantId).find((s) => s.id === body.targetServiceCatalogId);

    const created = referralList.agregar({
      id: nuevoId('referral'),
      patientProfileId: body.patientProfileId,
      sourceEncounterId: body.sourceEncounterId ?? null,
      referringProfileId: request.user?.practitionerProfileId ?? null,
      targetProfileId: body.targetProfileId ?? null,
      targetTenantId: body.targetTenantId ?? null,
      targetServiceCatalogId: body.targetServiceCatalogId ?? null,
      referralType: body.referralType ?? null,
      reasonText: body.reasonText ?? null,
      priorityConceptId: body.priorityConceptId ?? null,
      statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
      validUntil: body.validUntil === undefined ? null : `${body.validUntil}T00:00:00.000Z`,
      respondedAt: null,
      createdAt: new Date().toISOString(),
      targetDisplayName:
        practitioner?.displayName ??
        (body.targetTenantId === undefined ? null : (TENANT_NAMES[body.targetTenantId] ?? null)),
      targetServiceName: service?.name ?? null,
    });

    return {
      status: 201,
      body: {
        id: created.id,
        patientProfileId: created.patientProfileId,
        statusConceptId: created.statusConceptId,
        createdAt: created.createdAt,
      },
    };
  });
}
