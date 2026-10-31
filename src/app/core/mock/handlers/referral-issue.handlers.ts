import { encounterList } from '../fixtures/clinic';
import { SHOWCASES } from '../fixtures/community';
import { patientById, professionalById } from '../fixtures/people';
import { forbidden, validation, type MockRouter } from '../mock-router';
import { TENANT_NAMES } from '../mock-session';
import { cuerpo, nuevoId } from '../mock-store';
import { emitirNotificacion } from './notifications.handlers';
import { servicios } from './practice.handlers';
import { mergeTransfer, transferProblem, type SimulatedTransfer } from './referral-transfer.rules';
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
      transfer: SimulatedTransfer;
    }>(request);
    if (body.patientProfileId === undefined) {
      return validation('Falta el paciente.', [{ message: 'Falta el paciente.' }]);
    }
    if (body.referralType !== undefined && !(REFERRAL_TYPES as readonly string[]).includes(body.referralType)) {
      return validation('Tipo de derivación desconocido.', [{ message: 'Tipo de derivación desconocido.' }]);
    }
    // Lo que rechaza el DTO (ValidationPipe) va antes que cualquier regla.
    if ((body.reasonText ?? '').length > 1000) {
      return validation('El motivo admite hasta 1000 caracteres.', [
        { message: 'El motivo admite hasta 1000 caracteres.' },
      ]);
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
    // Después de las reglas tipadas, como `create` de la API.
    // El vínculo nace del consentimiento, no del alta.
    if (body.informedConsentId !== undefined) {
      return invalid(
        'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
        'El consentimiento se vincula registrándolo con targetType=REFERRAL sobre la derivación',
        ['informedConsentId'],
      );
    }
    // v4274: el traslado se valida entero antes de abrir la transacción.
    const transfer = body.transfer === undefined ? null : mergeTransfer(null, body.transfer);
    const transferError = transfer === null ? null : transferProblem(transfer);
    if (transferError !== null) return transferError;
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
    // Como la API: con servicio, la organización es la del servicio si no vino
    // otra. **No** se deduce de la sede: la API tampoco lo hace (la lectura
    // resuelve el nombre de la organización desde la sede, ver `view`).
    const targetTenantId = body.targetTenantId ?? serviceTenant ?? null;
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
      transfer,
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
 * El aviso a la persona, copiado de `ReferralNotifier` de la API
 * (`referral-notifier.service.ts`): asuntos, cuerpos y frase de cierre
 * literales. Sólo con encuentro y con un profesional o una organización de
 * destino. Al profesional: con el motivo y `route: '/directory/{id}'`
 * (`PRACTITIONER_PROFILE`). A la organización: sin el motivo, con el servicio
 * si lo hay; `ORGANIZATION_PROFILE` y `route: '/o/{slug}'` sólo si tiene
 * ficha pública. A un destino externo no se avisa. (La API además calla si la
 * persona no tiene cuenta de portal o si la organización está inactiva; acá
 * todas las organizaciones simuladas están activas.)
 */
function notifyPatient(referral: SimulatedReferral, referringProfileId: string | null): void {
  if (referral.sourceEncounterId === null) return;
  if (referral.targetProfileId === null && referral.targetTenantId === null) return;
  const patient = patientById(referral.patientProfileId);
  if (patient === undefined) return;
  const notice =
    referral.targetProfileId !== null
      ? practitionerNotice(referral.targetProfileId, referringProfileId, referral.reasonText)
      : organizationNotice(referral.targetTenantId!, referral.targetServiceName);
  emitirNotificacion({
    userId: patient.userId,
    category: 'CLINICAL',
    subject: notice.subject,
    bodyText: notice.bodyText,
    ...(notice.resource === null ? {} : { destination: notice.resource }),
    payloadJson: {
      kind: 'REFERRAL_RECOMMENDED',
      subject: notice.subject,
      bodyText: notice.bodyText,
      ...(notice.route === null ? {} : { route: notice.route }),
      referralId: referral.id,
    },
  });
}

interface Notice {
  readonly subject: string;
  readonly bodyText: string;
  readonly route: string | null;
  readonly resource: { readonly type: string; readonly id: string } | null;
}

const CLOSING = ' Puede ver su ficha y reservar una cita desde su portal.';

function practitionerNotice(targetProfileId: string, referringProfileId: string | null, reason: string | null): Notice {
  const referrer = referringProfileId === null ? undefined : professionalById(referringProfileId)?.displayName;
  const who = referrer ?? 'Su médico';
  const to = professionalById(targetProfileId)?.displayName ?? 'otro profesional';
  return {
    subject: 'Su médico le recomienda otra consulta',
    bodyText: `${who} le recomienda consultar con ${to}.${reasonSentence(reason)}${CLOSING}`,
    route: `/directory/${targetProfileId}`,
    resource: { type: 'PRACTITIONER_PROFILE', id: targetProfileId },
  };
}

function organizationNotice(tenantId: string, serviceName: string | null): Notice {
  const slug = SHOWCASES.find((s) => s.kind === 'ORGANIZATION' && s.tenantId === tenantId)?.slug;
  const route = slug === undefined ? null : `/o/${slug}`;
  const to = TENANT_NAMES[tenantId] ?? 'otra organización';
  const what = serviceName === null ? '' : ` para ${serviceName}`;
  return {
    subject: `Su médico le derivó a ${to}`,
    bodyText: endWithPeriod(`Su médico le derivó a ${to}${what}`) + (route === null ? '' : CLOSING),
    route,
    resource: route === null ? null : { type: 'ORGANIZATION_PROFILE', id: tenantId },
  };
}

function reasonSentence(reason: string | null): string {
  return reason === null || reason.trim() === '' ? '' : ` Motivo: ${endWithPeriod(reason.trim())}`;
}

/** Cierra la frase: el motivo casi nunca lleva punto y lo que sigue es otra oración. */
function endWithPeriod(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}
