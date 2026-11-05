import {
  API_FIELD_BY_RULE,
  API_REASON_BY_RULE,
  consentRuleViolations,
  type InformedConsentRuleViolation,
  type CreateInformedConsentInput,
  type InformedConsentTargetType,
} from '../../data-access/informed-consents/informed-consents.types';
import type { WireInformedConsent } from '../../data-access/informed-consents/informed-consents.client';
import { prescriptionList } from '../fixtures/clinic';
import { MEDICAL, PACIENTE } from '../fixtures/people';
import { notFound, reply, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, texto, uuid } from '../mock-store';
import { linkReferralConsent, referralOfPatient, unlinkReferralConsent } from './referrals.handlers';

/* ============================================================================
    Consentimiento informado DIRIGIDO (`src/modules/consent`, contrato §2).

    Valida con las mismas reglas que la API —la función es la misma que usa el
    panel— y responde 400 con `details.reason` estable, que es lo que la API
    promete. Guarda en colección persistida: lo que el expediente hace después
    de registrar es releer, y un consentimiento que no vuelve de la lectura se
    ve igual que una escritura que falló.
   ========================================================================== */

type ConsentRow = WireInformedConsent;

interface SimulatedEvidence {
  readonly id: string;
  readonly subjectId: string;
  readonly documentFileId: string | null;
  readonly evidenceTypeConceptId: string;
  readonly capturedChannelConceptId: string | null;
  readonly recordedAt: string;
}

const SIGNATURE_EVIDENCE = uuid('concept-EVIDENCE_TYPE_SIGNATURE');

const MESSAGES: Readonly<Record<string, string>> = {
  TARGET_PAIR_INCOMPLETE: 'targetType y targetId van juntos: los dos o ninguno.',
  PURPOSE_REQUIRED: 'Falta la naturaleza y el objetivo de lo que se propone.',
  BENEFITS_REQUIRED: 'Faltan los beneficios esperados.',
  RISKS_REQUIRED: 'Faltan los riesgos frecuentes y graves.',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'Una excepción al consentimiento exige su justificación.',
  REPRESENTATIVE_NAME_REQUIRED: 'Falta el nombre de quien otorga en representación.',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'Falta el parentesco o la calidad del representante.',
  ASSENT_REQUIRED: 'Con representante, declare si hubo asentimiento de la persona representada.',
  REVOCATION_RIGHT_REQUIRED: 'Falta la constancia de que se informó el derecho a revocar.',
  DECISION_REQUIRED: 'Falta la decisión: acepta o no acepta.',
  ENCOUNTER_REQUIRED: 'El consentimiento se registra dentro de una atención (encounterId).',
};

/** El 400 de la API: `reason` estable arriba y los campos en `details.fields`. */
function rejection(key: string, reason: string, fields: readonly string[]) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: MESSAGES[key] ?? 'El consentimiento no es válido.',
    error: 'Bad Request',
    reason,
    details: { fields },
  });
}

/** Como la API: falla en la primera regla, con todos los campos de esa misma razón. */
function ruleRejection(violations: readonly InformedConsentRuleViolation[]) {
  const first = violations[0]!;
  const reason = API_REASON_BY_RULE[first];
  const fields = violations.filter((v) => API_REASON_BY_RULE[v] === reason).map((v) => API_FIELD_BY_RULE[v]);
  return rejection(first, reason, fields);
}

function row(data: Partial<ConsentRow> & { id: string; patientProfileId: string; decision: 'ACCEPTED' | 'DECLINED'; createdAt: string }): ConsentRow {
  return {
    encounterId: null,
    targetType: null,
    targetId: null,
    targetLabel: null,
    status: 'ACTIVE',
    diagnosisText: null,
    purposeText: null,
    benefitsText: null,
    risksText: null,
    personalizedRisksText: null,
    alternativesText: null,
    refusalConsequencesText: null,
    patientQuestionsText: null,
    grantedBy: 'PATIENT',
    representativeName: null,
    representativeDocument: null,
    representativeRelationship: null,
    incapacityReason: null,
    informedByProfileId: null,
    channel: 'IN_PERSON',
    exceptionType: null,
    exceptionJustification: null,
    withdrawalReason: null,
    signedAt: data.createdAt,
    withdrawnAt: null,
    ...data,
  };
}

/** Una receta sembrada de la paciente de demostración ya trae su consentimiento aceptado. */
const firstPrescription = prescriptionList.filtrar((r) => r.patientProfileId === PACIENTE.id)[0];

const consentList = new Coleccion<ConsentRow>(
  firstPrescription === undefined
    ? []
    : [
        row({
          id: uuid('consent-rx-paciente-0'),
          patientProfileId: PACIENTE.id,
          encounterId: firstPrescription.encounterId ?? null,
          decision: 'ACCEPTED',
          targetType: 'MEDICATION_REQUEST',
          targetId: firstPrescription.id,
          targetLabel: `Receta · ${firstPrescription.doseText ?? ''} ${firstPrescription.frequencyText ?? ''}`.trim(),
          purposeText: 'Tratamiento farmacológico de la condición diagnosticada.',
          benefitsText: 'Control de los síntomas y prevención de complicaciones.',
          risksText: 'Molestias digestivas leves; reacción alérgica rara.',
          informedByProfileId: MEDICAL.id,
          createdAt: iso(-20, 10, 5),
        }),
      ],
);
consentList.persistirEn('mock.consent.treatmentInformedConsents');

/** La firma del consentimiento sembrado: sin ella, todo se vería «Firma pendiente». */
const evidenceList = new Coleccion<SimulatedEvidence>(
  firstPrescription === undefined
    ? []
    : [
        {
          id: uuid('consent-evidence-rx-paciente-0'),
          subjectId: uuid('consent-rx-paciente-0'),
          documentFileId: null,
          evidenceTypeConceptId: SIGNATURE_EVIDENCE,
          capturedChannelConceptId: null,
          recordedAt: iso(-20, 10, 6),
        },
      ],
);
evidenceList.persistirEn('mock.consent.evidence');

/** Lo que responde la API: la fila con su evidencia y el estado de firma derivado. */
function view(c: ConsentRow): ConsentRow {
  const evidence = evidenceList
    .filtrar((e) => e.subjectId === c.id)
    .map((e) => ({ id: e.id, evidenceTypeConceptId: e.evidenceTypeConceptId, capturedChannelConceptId: e.capturedChannelConceptId, recordedAt: e.recordedAt }));
  return { ...c, evidence, signatureStatus: evidence.length > 0 ? 'SIGNED' : 'PENDING' };
}

const TARGET_TYPES: readonly InformedConsentTargetType[] = ['MEDICATION_REQUEST', 'SERVICE_REQUEST', 'REFERRAL', 'PROCEDURE', 'CARE_PLAN'];

export function registerTreatmentInformedConsents(router: MockRouter): void {
  router.get('/consent/treatment-informed-consents', ({ query }) => {
    const patient = texto(query, 'patientProfileId');
    const targetType = texto(query, 'targetType');
    const targetId = texto(query, 'targetId');
    const items = consentList
      .filtrar(
        (c) =>
          (patient === null || c.patientProfileId === patient) &&
          (targetType === null || c.targetType === targetType) &&
          (targetId === null || c.targetId === targetId),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(view);
    return { items };
  });

  router.get('/consent/treatment-informed-consents/:id', ({ params }) => {
    const c = consentList.get(params['id']!);
    return c === undefined ? notFound('Consentimiento no encontrado') : view(c);
  });

  router.post('/consent/treatment-informed-consents', (request) => {
    const data = cuerpo<CreateInformedConsentInput>(request);
    // Las dos primeras las rechaza el `ValidationPipe` (DTO), no el servicio.
    if ((data.encounterId ?? '').trim() === '') return rejection('ENCOUNTER_REQUIRED', 'VALIDATION_FAILED', ['encounterId']);
    if (data.decision !== 'ACCEPTED' && data.decision !== 'DECLINED') {
      return rejection('DECISION_REQUIRED', 'VALIDATION_FAILED', ['decision']);
    }
    if (data.targetType !== undefined && !TARGET_TYPES.includes(data.targetType)) {
      return rejection('TARGET_PAIR_INCOMPLETE', 'VALIDATION_FAILED', ['targetType']);
    }
    const violations = consentRuleViolations(data);
    if (violations.length > 0) return ruleRejection(violations);

    // `targetType=REFERRAL`: la derivación tiene que existir y ser de esa persona.
    if (data.targetType === 'REFERRAL' && data.targetId !== undefined) {
      const check = referralOfPatient(data.targetId, data.patientProfileId ?? '');
      if (check === 'MISSING') {
        return reply(404, {
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'No existe el objeto del consentimiento.',
          error: 'Not Found',
          reason: 'INFORMED_CONSENT_TARGET_NOT_FOUND',
        });
      }
      if (check === 'MISMATCH') return rejection('TARGET_PAIR_INCOMPLETE', 'INFORMED_CONSENT_TARGET_PATIENT_MISMATCH', ['targetId']);
    }

    const instant = ahora();
    const created = consentList.agregar(
      row({
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
        id: nuevoId('consent'),
        patientProfileId: data.patientProfileId ?? '',
        decision: data.decision,
        grantedBy: data.grantedBy ?? 'PATIENT',
        informationLanguage: data.informationLanguage ?? 'es',
        channel: data.channel ?? 'IN_PERSON',
        informedByProfileId: data.informedByProfileId ?? request.user?.practitionerProfileId ?? null,
        createdAt: instant,
        signedAt: instant,
      }),
    );
    // El vínculo lo escribe la API en la misma transacción (ACCEPTED + REFERRAL).
    if (created.decision === 'ACCEPTED' && created.targetType === 'REFERRAL' && created.targetId) {
      linkReferralConsent(created.targetId, created.id);
    }
    return reply(201, view(created));
  });

  router.patch('/consent/treatment-informed-consents/:id/withdraw', (request) => {
    const current = consentList.get(request.params['id']!);
    if (current === undefined) return notFound('Consentimiento no encontrado');
    if (current.status === 'WITHDRAWN') {
      return reply(409, {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'El consentimiento ya estaba revocado.',
        error: 'Conflict',
        reason: 'INFORMED_CONSENT_ALREADY_WITHDRAWN',
      });
    }
    const reason = (cuerpo<{ reason: string }>(request).reason ?? '').trim();
    if (reason === '') {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'La revocación exige su motivo.',
        error: 'Bad Request',
        details: { fields: ['reason'] },
      });
    }
    const withdrawn = consentList.actualizar(current.id, {
      status: 'WITHDRAWN',
      withdrawnAt: ahora(),
      withdrawalReason: reason,
    });
    // Revocar desvincula las derivaciones que lo usaban.
    unlinkReferralConsent(current.id);
    return withdrawn === undefined ? notFound('Consentimiento no encontrado') : view(withdrawn);
  });

  router.patch('/consent/treatment-informed-consents/:id/post-emergency-information', (request) => {
    const current = consentList.get(request.params['id']!);
    if (current === undefined) return notFound('Consentimiento no encontrado');
    if (current.exceptionType !== 'EMERGENCY') {
      return reply(409, {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Sólo un consentimiento exceptuado por urgencia se informa a posteriori.',
        error: 'Conflict',
        reason: 'INFORMED_CONSENT_NOT_EMERGENCY',
      });
    }
    const informedAt = cuerpo<{ informedAt: string }>(request).informedAt ?? ahora();
    const informed = consentList.actualizar(current.id, { postEmergencyInformedAt: informedAt });
    return informed === undefined ? notFound('Consentimiento no encontrado') : view(informed);
  });

  /* La evidencia: `POST …/:id/evidence`. La API reutiliza
     `ConsentEvidenceService`; el sujeto lo pone la ruta. */
  router.post('/consent/treatment-informed-consents/:id/evidence', (request) => {
    const consent = consentList.get(request.params['id']!);
    if (consent === undefined) return notFound('Consentimiento no encontrado');
    const data = cuerpo<{
      documentFileId?: string;
      signatureId?: string;
      evidenceTypeConceptId?: string;
      capturedChannelConceptId?: string;
    }>(request);
    const evidence = evidenceList.agregar({
      id: nuevoId('consent-evidence'),
      subjectId: consent.id,
      documentFileId: data.documentFileId ?? null,
      evidenceTypeConceptId: data.evidenceTypeConceptId ?? SIGNATURE_EVIDENCE,
      capturedChannelConceptId: data.capturedChannelConceptId ?? null,
      recordedAt: ahora(),
    });
    return reply(201, { id: evidence.id, subjectId: evidence.subjectId, recordedAt: evidence.recordedAt });
  });
}
