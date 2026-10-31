import { encounterList } from '../fixtures/clinic';
import { SHOWCASES } from '../fixtures/community';
import { patientById, professionalById } from '../fixtures/people';
import { forbidden, validation, type MockRouter } from '../mock-router';
import { TENANT_NAMES } from '../mock-session';
import { cuerpo, nuevoId } from '../mock-store';
import { emitirNotificacion } from './notifications.handlers';
import { servicios } from './practice.handlers';
import {
  BRANCHES,
  filled,
  invalid,
  isClinician,
  ORGANIZATIONS,
  preconditionInDetails,
  REFERRAL_STATUS,
  REFERRAL_TYPES,
  referralError,
  referralList,
  servicesOfOrganization,
  targetNotFound,
  view,
  type SimulatedReferral,
} from './referrals.handlers';

/* ============================================================================
    Emitir una derivación (`POST /referrals`) y el aviso a la persona.

    Separado de `referrals.handlers.ts` por tamaño, como el ciclo de vida
    (`referral-lifecycle.handlers.ts`): comparte su colección y sus reglas.
    Copia las de `referrals.service.ts#create` de la API, en ese orden (ver
    el encabezado de `referrals.handlers.ts`).
    ========================================================================== */

export function registerReferralIssue(router: MockRouter): void {
  router.post('/referrals', (request) => {
    if (!isClinician(request)) return forbidden();
    const body = cuerpo<{
      patientProfileId: string;
      sourceEncounterId: string;
      targetProfileId: string;
      targetTenantId: string;
      targetBranchId: string;
      targetExternalName: string;
      targetExternalContact: string;
      targetServiceCatalogId: string;
      referralType: string;
      specialtyConceptId: string;
      reasonText: string;
      validUntil: string;
      priorityConceptId: string;
      requestedServiceText: string;
      diagnosisText: string;
      clinicalSummary: string;
      treatmentGivenText: string;
      informedConsentId: string;
    }>(request);
    if (body.patientProfileId === undefined) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    // El vínculo nace del consentimiento, no del alta.
    if (body.informedConsentId !== undefined) {
      return invalid(
        'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
        'El consentimiento se vincula registrándolo con targetType=REFERRAL sobre la derivación',
        ['informedConsentId'],
      );
    }
    if (body.referralType !== undefined && !(REFERRAL_TYPES as readonly string[]).includes(body.referralType)) {
      return validation('Tipo de derivación desconocido.', [{ message: 'Tipo de derivación desconocido.' }]);
    }
    const hasService = filled(body.targetServiceCatalogId);
    const hasTarget =
      filled(body.targetProfileId) ||
      filled(body.targetTenantId) ||
      filled(body.targetBranchId) ||
      filled(body.targetExternalName);
    // `assertTypedReferralRules`: con tipo y sin un servicio del catálogo,
    // destino y servicio en texto + resumen clínico (400 con `reason` arriba).
    if (body.referralType !== undefined && !hasService) {
      if (!hasTarget) {
        return invalid('REFERRAL_TARGET_REQUIRED', 'La derivación necesita al menos un destino', [
          'targetProfileId',
          'targetTenantId',
          'targetBranchId',
          'targetExternalName',
        ]);
      }
      const missing = (['clinicalSummary', 'requestedServiceText'] as const).filter((f) => !filled(body[f]));
      if (missing.length > 0) {
        return invalid(
          'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
          'Falta el resumen clínico o el servicio pedido',
          missing,
        );
      }
    }
    if ((body.reasonText ?? '').length > 1000) {
      return validation('El motivo admite hasta 1000 caracteres.', [
        { message: 'El motivo admite hasta 1000 caracteres.' },
      ]);
    }
    // Sin tipo y sin nada que identifique el destino: 422 con `details.reason`.
    // Un servicio del catálogo, solo, ya es destino.
    if (!hasTarget && !hasService) {
      return preconditionInDetails(
        'REFERRAL_TARGET_REQUIRED',
        'La derivación necesita un destino: profesional, organización, servicio, sede o destino externo.',
      );
    }
    const referralType = body.referralType ?? 'CONSULTATION';

    if (filled(body.targetProfileId) && professionalById(body.targetProfileId) === undefined) {
      return targetNotFound({ targetProfileId: body.targetProfileId });
    }
    let serviceTenant: string | undefined;
    const serviceId = body.targetServiceCatalogId;
    if (filled(serviceId)) {
      const located = locateService(serviceId);
      if (located.state === 'MISSING') {
        return referralError(404, 'NOT_FOUND', 'REFERRAL_SERVICE_NOT_FOUND', 'Servicio no encontrado', {
          targetServiceCatalogId: body.targetServiceCatalogId,
        });
      }
      if (located.state === 'INACTIVE') {
        return preconditionInDetails('REFERRAL_SERVICE_INACTIVE', 'Ese servicio está inactivo en el catálogo.', {
          targetServiceCatalogId: body.targetServiceCatalogId,
        });
      }
      const offeredByPractitioner =
        !filled(body.targetProfileId) ||
        servicesOfOrganization(professionalById(body.targetProfileId)?.tenantId ?? null).some(
          (s) => s.id === body.targetServiceCatalogId,
        );
      if ((filled(body.targetTenantId) && located.tenantId !== body.targetTenantId) || !offeredByPractitioner) {
        return preconditionInDetails(
          'REFERRAL_SERVICE_TARGET_MISMATCH',
          'El servicio no pertenece al destino.',
          { targetServiceCatalogId: body.targetServiceCatalogId },
        );
      }
      serviceTenant = located.tenantId;
    }
    if (body.sourceEncounterId !== undefined) {
      const encounter = encounterList.get(body.sourceEncounterId);
      if (encounter === undefined || encounter.patientProfileId !== body.patientProfileId) {
        return referralError(404, 'NOT_FOUND', 'REFERRAL_ENCOUNTER_NOT_FOUND', 'Encuentro no encontrado', {
          encounterId: body.sourceEncounterId,
        });
      }
    }

    // 409 como `findDuplicate`: sólo con encuentro, y con un servicio, o
    // profesional y especialidad, o **sólo** una organización (sin profesional
    // ni servicio; la especialidad no cuenta) que identifique el destino. El
    // tipo es parte de la clave; una fila anterior al tipo cuenta como
    // `CONSULTATION`.
    const organizationOnly = filled(body.targetTenantId) && !filled(body.targetProfileId) && !hasService;
    if (
      body.sourceEncounterId !== undefined &&
      (hasService || organizationOnly || (filled(body.targetProfileId) && filled(body.specialtyConceptId)))
    ) {
      const sameType = (type: string | null): boolean =>
        type === referralType || (type === null && referralType === 'CONSULTATION');
      const equivalent = referralList.filtrar(
        (d) =>
          d.sourceEncounterId === body.sourceEncounterId &&
          sameType(d.referralType) &&
          (hasService
            ? d.targetServiceCatalogId === body.targetServiceCatalogId &&
              d.targetProfileId === (body.targetProfileId ?? null)
            : organizationOnly
              ? d.targetTenantId === body.targetTenantId &&
                d.targetProfileId === null &&
                d.targetServiceCatalogId === null
              : d.targetProfileId === body.targetProfileId &&
              (d.specialtyConceptId ?? null) === body.specialtyConceptId &&
              d.targetServiceCatalogId === null),
      );
      if (equivalent.length > 0) {
        return referralError(409, 'CONFLICT', 'REFERRAL_ALREADY_EXISTS', 'Ya existe una referencia equivalente', {
          sourceEncounterId: body.sourceEncounterId,
        });
      }
    }
    const branch = filled(body.targetBranchId) ? BRANCHES[body.targetBranchId] : undefined;
    if (filled(body.targetBranchId) && branch === undefined) {
      return referralError(404, 'NOT_FOUND', 'REFERRAL_TARGET_BRANCH_NOT_FOUND', 'Sede no encontrada', {
        targetBranchId: body.targetBranchId,
      });
    }

    const practitioner = body.targetProfileId === undefined ? undefined : professionalById(body.targetProfileId);
    // Como la API: con servicio, la organización es la del servicio si no vino otra.
    const targetTenantId = body.targetTenantId ?? serviceTenant ?? branch?.tenantId ?? null;
    const service =
      serviceTenant === undefined
        ? undefined
        : servicesOfOrganization(serviceTenant).find((s) => s.id === body.targetServiceCatalogId);

    const created = referralList.agregar({
      id: nuevoId('referral'),
      patientProfileId: body.patientProfileId,
      sourceEncounterId: body.sourceEncounterId ?? null,
      referringProfileId: request.user?.practitionerProfileId ?? null,
      targetProfileId: body.targetProfileId ?? null,
      targetTenantId,
      targetServiceCatalogId: body.targetServiceCatalogId ?? null,
      referralType,
      specialtyConceptId: body.specialtyConceptId ?? null,
      reasonText: body.reasonText ?? null,
      priorityConceptId: body.priorityConceptId ?? null,
      statusConceptId: REFERRAL_STATUS['REF_REQUESTED']!,
      validUntil: body.validUntil === undefined ? null : `${body.validUntil}T00:00:00.000Z`,
      respondedAt: null,
      createdAt: new Date().toISOString(),
      targetDisplayName:
        practitioner?.displayName ??
        (targetTenantId === null ? null : (TENANT_NAMES[targetTenantId] ?? null)) ??
        body.targetExternalName ??
        null,
      targetServiceName: service?.name ?? null,
      targetBranchId: body.targetBranchId ?? null,
      targetExternalName: body.targetExternalName ?? null,
      targetExternalContact: body.targetExternalContact ?? null,
      requestedServiceText: body.requestedServiceText ?? null,
      diagnosisText: body.diagnosisText ?? null,
      clinicalSummary: body.clinicalSummary ?? null,
      treatmentGivenText: body.treatmentGivenText ?? null,
    });

    notifyPatient(created, request.user?.practitionerProfileId ?? null);
    return { status: 201, body: view(created) };
  });
}

/**
 * Dónde está un servicio del catálogo, como lo busca `assertServiceOfTarget`:
 * activo y de qué organización, inactivo, o inexistente.
 */
function locateService(
  id: string,
):
  | { readonly state: 'ACTIVE'; readonly tenantId: string }
  | { readonly state: 'INACTIVE' }
  | { readonly state: 'MISSING' } {
  for (const { id: tenantId } of ORGANIZATIONS) {
    if (servicesOfOrganization(tenantId).some((s) => s.id === id)) return { state: 'ACTIVE', tenantId };
  }
  return servicios.get(id) === undefined ? { state: 'MISSING' } : { state: 'INACTIVE' };
}

/**
 * El aviso a la persona, como `ReferralNotifier` de la API: sólo con encuentro
 * y con un destino de la plataforma. A un profesional, su ficha
 * (`PRACTITIONER_PROFILE`); a una organización, `ORGANIZATION_PROFILE` con
 * `payloadJson.route = '/o/{slug}'` **sólo si tiene ficha pública**; sin ella
 * el aviso sale sin destino ni ruta. A un destino externo no se avisa.
 */
function notifyPatient(referral: SimulatedReferral, referringProfileId: string | null): void {
  if (referral.sourceEncounterId === null) return;
  const patient = patientById(referral.patientProfileId);
  if (patient === undefined) return;
  if (referral.targetProfileId !== null) {
    const author =
      (referringProfileId === null ? undefined : professionalById(referringProfileId))?.displayName ??
      'Su profesional';
    const target = professionalById(referral.targetProfileId)?.displayName ?? 'otro profesional';
    emitirNotificacion({
      userId: patient.userId,
      category: 'CLINICAL',
      subject: 'Tiene una derivación nueva',
      bodyText: `${author} le recomienda consultar con ${target}. Puede ver su ficha y reservar.`,
      destination: { type: 'PRACTITIONER_PROFILE', id: referral.targetProfileId },
      payloadJson: { kind: 'REFERRAL_RECOMMENDED', referralId: referral.id },
    });
    return;
  }
  if (referral.targetTenantId === null) return;
  const tenantId = referral.targetTenantId;
  const slug = SHOWCASES.find((s) => s.kind === 'ORGANIZATION' && s.tenantId === tenantId)?.slug;
  const name = TENANT_NAMES[tenantId] ?? 'una organización médica';
  // Como la API: sin el motivo (la persona lo ve en su lista de derivaciones),
  // con el servicio si lo hay, y la frase del enlace sólo con ficha pública.
  const service = referral.targetServiceName === null ? '' : ` para ${referral.targetServiceName}`;
  const link = slug === undefined ? '' : ' Puede ver su ficha en la plataforma.';
  emitirNotificacion({
    userId: patient.userId,
    category: 'CLINICAL',
    subject: 'Tiene una derivación nueva',
    bodyText: `Su médico le derivó a ${name}${service}.${link}`,
    ...(slug === undefined ? {} : { destination: { type: 'ORGANIZATION_PROFILE', id: tenantId } }),
    payloadJson: {
      kind: 'REFERRAL_RECOMMENDED',
      referralId: referral.id,
      ...(slug === undefined ? {} : { route: `/o/${slug}` }),
    },
  });
}
