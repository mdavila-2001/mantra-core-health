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

    Espeja el contrato acordado con la API: buscar un destino —profesional u
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

const TIPOS = ['TREATMENT', 'CONSULTATION', 'DIAGNOSTIC_STUDY', 'PROCEDURE', 'SECOND_OPINION'] as const;

/** Las organizaciones médicas que pueden recibir una derivación, con lo que las distingue. */
const ORGANIZACIONES: readonly { readonly id: string; readonly subtitulo: string }[] = [
  { id: TENANT_HOSPITAL, subtitulo: 'Hospital · Santa Cruz de la Sierra' },
  { id: TENANT_CLINICA, subtitulo: 'Clínica · Santa Cruz de la Sierra' },
  { id: TENANT_CONSULTORIO, subtitulo: 'Consultorio · Santa Cruz de la Sierra' },
  // Sin catálogo a propósito: es el caso del destino que no publica servicios,
  // que la pantalla tiene que poder mostrar (S3 con próxima acción).
  { id: TENANT_LABORATORIO, subtitulo: 'Laboratorio · Santa Cruz de la Sierra' },
];

interface DerivacionSimulada {
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

interface ServicioDelDestino {
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
function serviciosDeLaOrganizacion(tenantId: string | null): readonly ServicioDelDestino[] {
  const nombre = tenantId === null ? null : (TENANT_NAMES[tenantId] ?? null);
  const practica =
    tenantId === TENANT_CLINICA
      ? PRACTICE_OLIVOS
      : tenantId === TENANT_CONSULTORIO
        ? PRACTICE_CONSULTORIO
        : null;
  if (practica !== null) {
    return servicios
      .filtrar((s) => s.practiceId === practica && s.isActive)
      .map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        description: s.descriptionText ?? null,
        price: s.defaultPrice,
        currency: s.currencyCode,
        tenantId,
        practiceName: nombre,
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
      practiceName: nombre,
    }));
  }
  return [];
}

function subtituloDe(p: ProfesionalSimulado): string {
  const especialidad = p.especialidades[0];
  return [especialidad === undefined ? null : displayOf(especialidad), p.organizacion]
    .filter((parte): parte is string => parte !== null && parte !== '')
    .join(' · ');
}

/** Sin tildes y en minúscula: «valeria» encuentra a «Valéria». */
function normalizar(valor: string): string {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
}

/** Lo mismo que declara el controlador: `@Roles('CLINICIAN', 'PRACTITIONER')`. */
function esClinico(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return roles.includes('SUPERADMIN') || roles.includes('CLINICIAN') || roles.includes('PRACTITIONER');
}

const MEDICO_DE_LA_SEMILLA = PROFESSIONALS[3] ?? PROFESSIONALS[0]!;

/** Una derivación ya emitida, para que la lista de la paciente de prueba no nazca vacía. */
export const derivaciones = new Coleccion<DerivacionSimulada>([
  {
    id: uuid('referral-paciente-1'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: PROFESSIONALS[0]!.id,
    targetProfileId: null,
    targetTenantId: TENANT_HOSPITAL,
    targetServiceCatalogId: serviciosDeLaOrganizacion(TENANT_HOSPITAL)[0]?.id ?? null,
    referralType: 'DIAGNOSTIC_STUDY',
    reasonText: 'Control de la evolución con estudio complementario.',
    priorityConceptId: null,
    statusConceptId: REFERRAL_STATUS['REF_ACCEPTED']!,
    validUntil: `${isoDia(20)}T00:00:00.000Z`,
    respondedAt: iso(-3, 11),
    createdAt: iso(-5, 10),
    targetDisplayName: TENANT_NAMES[TENANT_HOSPITAL] ?? null,
    targetServiceName: serviciosDeLaOrganizacion(TENANT_HOSPITAL)[0]?.name ?? null,
  },
  {
    id: uuid('referral-paciente-2'),
    patientProfileId: PACIENTE.id,
    sourceEncounterId: null,
    referringProfileId: PROFESSIONALS[0]!.id,
    targetProfileId: MEDICO_DE_LA_SEMILLA.id,
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
    targetDisplayName: MEDICO_DE_LA_SEMILLA.displayName,
    targetServiceName: null,
  },
]).persistirEn('mock.clinical.derivaciones');

export function registrarDerivaciones(router: MockRouter): void {
  router.get('/referrals/targets', (request) => {
    if (!esClinico(request)) return forbidden();
    const q = texto(request.query, 'q');
    if (q === null || q.trim().length < 2) {
      return validation('Escriba al menos dos letras para buscar.', [
        { message: 'Escriba al menos dos letras para buscar.' },
      ]);
    }
    const buscado = normalizar(q.trim());
    const kind = texto(request.query, 'kind') ?? 'PRACTITIONER';
    if (kind === 'ORGANIZATION') {
      return {
        items: ORGANIZACIONES.filter((o) => normalizar(TENANT_NAMES[o.id] ?? '').includes(buscado))
          .slice(0, 20)
          .map((o) => ({
            kind: 'ORGANIZATION',
            id: o.id,
            displayName: TENANT_NAMES[o.id] ?? 'Organización',
            tenantId: o.id,
            subtitle: o.subtitulo,
          })),
      };
    }
    return {
      items: PROFESSIONALS.filter(
        (p) => p.id !== request.user?.practitionerProfileId && normalizar(p.displayName).includes(buscado),
      )
        .slice(0, 20)
        .map((p) => ({
          kind: 'PRACTITIONER',
          id: p.id,
          displayName: p.displayName,
          tenantId: p.tenantId,
          subtitle: subtituloDe(p) || null,
        })),
    };
  });

  router.get('/referrals/target-services', (request) => {
    if (!esClinico(request)) return forbidden();
    const profesional = texto(request.query, 'targetProfileId');
    const organizacion = texto(request.query, 'targetTenantId');
    if (profesional !== null) {
      // El profesional ofrece los servicios de la organización en la que atiende.
      const p = professionalById(profesional);
      return { items: serviciosDeLaOrganizacion(p?.tenantId ?? null) };
    }
    if (organizacion !== null) {
      return { items: serviciosDeLaOrganizacion(organizacion) };
    }
    return validation('Indique un profesional o una organización.', [
      { message: 'Indique un profesional o una organización.' },
    ]);
  });

  router.get('/referrals', (request) => {
    if (!esClinico(request)) return forbidden();
    const paciente = texto(request.query, 'patientProfileId');
    if (paciente === null) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    return derivaciones
      .filtrar((d) => d.patientProfileId === paciente)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  router.post('/referrals', (request) => {
    if (!esClinico(request)) return forbidden();
    const datos = cuerpo<{
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
    if (datos.patientProfileId === undefined) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    if (datos.targetProfileId === undefined && datos.targetTenantId === undefined) {
      return validation('Indique a quién se deriva.', [
        { message: 'Indique a quién se deriva: un profesional o una organización.' },
      ]);
    }
    if (datos.referralType !== undefined && !(TIPOS as readonly string[]).includes(datos.referralType)) {
      return validation('Tipo de derivación desconocido.', [{ message: 'Tipo de derivación desconocido.' }]);
    }
    if ((datos.reasonText ?? '').length > 1000) {
      return validation('El motivo admite hasta 1000 caracteres.', [
        { message: 'El motivo admite hasta 1000 caracteres.' },
      ]);
    }

    // La API responde 409 ante una equivalente: mismo encuentro, mismo destino
    // y mismo servicio. Sin encuentro no hay con qué compararla.
    const equivalente = derivaciones.filtrar(
      (d) =>
        datos.sourceEncounterId !== undefined &&
        d.sourceEncounterId === datos.sourceEncounterId &&
        d.targetProfileId === (datos.targetProfileId ?? null) &&
        d.targetTenantId === (datos.targetTenantId ?? null) &&
        d.targetServiceCatalogId === (datos.targetServiceCatalogId ?? null),
    );
    if (equivalente.length > 0) {
      return conflict('Ya existe una referencia equivalente');
    }

    const profesional = datos.targetProfileId === undefined ? undefined : professionalById(datos.targetProfileId);
    const tenantDelServicio = datos.targetTenantId ?? profesional?.tenantId ?? null;
    const servicio =
      datos.targetServiceCatalogId === undefined
        ? undefined
        : serviciosDeLaOrganizacion(tenantDelServicio).find((s) => s.id === datos.targetServiceCatalogId);

    const nueva = derivaciones.agregar({
      id: nuevoId('referral'),
      patientProfileId: datos.patientProfileId,
      sourceEncounterId: datos.sourceEncounterId ?? null,
      referringProfileId: request.user?.practitionerProfileId ?? null,
      targetProfileId: datos.targetProfileId ?? null,
      targetTenantId: datos.targetTenantId ?? null,
      targetServiceCatalogId: datos.targetServiceCatalogId ?? null,
      referralType: datos.referralType ?? null,
      reasonText: datos.reasonText ?? null,
      priorityConceptId: datos.priorityConceptId ?? null,
      statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
      validUntil: datos.validUntil === undefined ? null : `${datos.validUntil}T00:00:00.000Z`,
      respondedAt: null,
      createdAt: new Date().toISOString(),
      targetDisplayName:
        profesional?.displayName ??
        (datos.targetTenantId === undefined ? null : (TENANT_NAMES[datos.targetTenantId] ?? null)),
      targetServiceName: servicio?.name ?? null,
    });

    return {
      status: 201,
      body: {
        id: nueva.id,
        patientProfileId: nueva.patientProfileId,
        statusConceptId: nueva.statusConceptId,
        createdAt: nueva.createdAt,
      },
    };
  });
}
