import {
  CAMPO_DE_LA_API,
  RAZON_DE_LA_API,
  violacionesDelConsentimiento,
  type InformedConsentRuleViolation,
  type CreateInformedConsentInput,
  type InformedConsentTargetType,
} from '../../data-access/informed-consents/informed-consents.types';
import type { WireInformedConsent } from '../../data-access/informed-consents/informed-consents.client';
import { recetas } from '../fixtures/clinica';
import { MEDICA, PACIENTE } from '../fixtures/personas';
import { notFound, reply, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Consentimiento informado DIRIGIDO (`src/modules/consent`, contrato §2).

    Valida con las mismas reglas que la API —la función es la misma que usa el
    panel— y responde 400 con `details.reason` estable, que es lo que la API
    promete. Guarda en colección persistida: lo que el expediente hace después
    de registrar es releer, y un consentimiento que no vuelve de la lectura se
    ve igual que una escritura que falló.
   ========================================================================== */

type FilaDeConsentimiento = WireInformedConsent;

interface EvidenciaSimulada {
  readonly id: string;
  readonly subjectId: string;
  readonly documentFileId: string | null;
  readonly evidenceTypeConceptId: string;
  readonly capturedChannelConceptId: string | null;
  readonly recordedAt: string;
}

const EVIDENCIA_FIRMA = uuid('concept-EVIDENCE_TYPE_SIGNATURE');

const MENSAJES: Readonly<Record<string, string>> = {
  TARGET_PAIR_INCOMPLETE: 'targetType y targetId van juntos: los dos o ninguno.',
  PURPOSE_REQUIRED: 'Falta la naturaleza y el objetivo de lo que se propone.',
  BENEFITS_REQUIRED: 'Faltan los beneficios esperados.',
  RISKS_REQUIRED: 'Faltan los riesgos frecuentes y graves.',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'Una excepción al consentimiento exige su justificación.',
  REPRESENTATIVE_NAME_REQUIRED: 'Falta el nombre de quien otorga en representación.',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'Falta el parentesco o la calidad del representante.',
  ASSENT_REQUIRED: 'Con representante, declará si hubo asentimiento de la persona representada.',
  REVOCATION_RIGHT_REQUIRED: 'Falta la constancia de que se informó el derecho a revocar.',
  DECISION_REQUIRED: 'Falta la decisión: acepta o no acepta.',
  ENCOUNTER_REQUIRED: 'El consentimiento se registra dentro de una atención (encounterId).',
};

/** El 400 de la API: `reason` estable arriba y los campos en `details.fields`. */
function rechazo(clave: string, reason: string, fields: readonly string[]) {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: MENSAJES[clave] ?? 'El consentimiento no es válido.',
    error: 'Bad Request',
    reason,
    details: { fields },
  });
}

/** Como la API: falla en la primera regla, con todos los campos de esa misma razón. */
function rechazoDeLaRegla(violaciones: readonly InformedConsentRuleViolation[]) {
  const primera = violaciones[0]!;
  const reason = RAZON_DE_LA_API[primera];
  const fields = violaciones.filter((v) => RAZON_DE_LA_API[v] === reason).map((v) => CAMPO_DE_LA_API[v]);
  return rechazo(primera, reason, fields);
}

function fila(datos: Partial<FilaDeConsentimiento> & { id: string; patientProfileId: string; decision: 'ACCEPTED' | 'DECLINED'; createdAt: string }): FilaDeConsentimiento {
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
    signedAt: datos.createdAt,
    withdrawnAt: null,
    ...datos,
  };
}

/** Una receta sembrada de la paciente de demostración ya trae su consentimiento aceptado. */
const primeraReceta = recetas.filtrar((r) => r.patientProfileId === PACIENTE.id)[0];

const consentimientos = new Coleccion<FilaDeConsentimiento>(
  primeraReceta === undefined
    ? []
    : [
        fila({
          id: uuid('consent-rx-paciente-0'),
          patientProfileId: PACIENTE.id,
          encounterId: primeraReceta.encounterId ?? null,
          decision: 'ACCEPTED',
          targetType: 'MEDICATION_REQUEST',
          targetId: primeraReceta.id,
          targetLabel: `Receta · ${primeraReceta.doseText ?? ''} ${primeraReceta.frequencyText ?? ''}`.trim(),
          purposeText: 'Tratamiento farmacológico de la condición diagnosticada.',
          benefitsText: 'Control de los síntomas y prevención de complicaciones.',
          risksText: 'Molestias digestivas leves; reacción alérgica rara.',
          informedByProfileId: MEDICA.id,
          createdAt: iso(-20, 10, 5),
        }),
      ],
);
consentimientos.persistirEn('mock.consent.treatmentInformedConsents');

/** La firma del consentimiento sembrado: sin ella, todo se vería «Firma pendiente». */
const evidencias = new Coleccion<EvidenciaSimulada>(
  primeraReceta === undefined
    ? []
    : [
        {
          id: uuid('consent-evidence-rx-paciente-0'),
          subjectId: uuid('consent-rx-paciente-0'),
          documentFileId: null,
          evidenceTypeConceptId: EVIDENCIA_FIRMA,
          capturedChannelConceptId: null,
          recordedAt: iso(-20, 10, 6),
        },
      ],
);
evidencias.persistirEn('mock.consent.evidence');

/** Lo que responde la API: la fila con su evidencia y el estado de firma derivado. */
function vista(c: FilaDeConsentimiento): FilaDeConsentimiento {
  const evidence = evidencias
    .filtrar((e) => e.subjectId === c.id)
    .map((e) => ({ id: e.id, evidenceTypeConceptId: e.evidenceTypeConceptId, capturedChannelConceptId: e.capturedChannelConceptId, recordedAt: e.recordedAt }));
  return { ...c, evidence, signatureStatus: evidence.length > 0 ? 'SIGNED' : 'PENDING' };
}

const TIPOS: readonly InformedConsentTargetType[] = ['MEDICATION_REQUEST', 'SERVICE_REQUEST', 'REFERRAL', 'PROCEDURE', 'CARE_PLAN'];

export function registrarConsentimientos(router: MockRouter): void {
  router.get('/consent/treatment-informed-consents', ({ query }) => {
    const paciente = texto(query, 'patientProfileId');
    const tipo = texto(query, 'targetType');
    const objeto = texto(query, 'targetId');
    const items = consentimientos
      .filtrar(
        (c) =>
          (paciente === null || c.patientProfileId === paciente) &&
          (tipo === null || c.targetType === tipo) &&
          (objeto === null || c.targetId === objeto),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(vista);
    return { items };
  });

  router.get('/consent/treatment-informed-consents/:id', ({ params }) => {
    const c = consentimientos.get(params['id']!);
    return c === undefined ? notFound('Consentimiento no encontrado') : vista(c);
  });

  router.post('/consent/treatment-informed-consents', (request) => {
    const datos = cuerpo<CreateInformedConsentInput>(request);
    // Las dos primeras las rechaza el `ValidationPipe` (DTO), no el servicio.
    if ((datos.encounterId ?? '').trim() === '') return rechazo('ENCOUNTER_REQUIRED', 'VALIDATION_FAILED', ['encounterId']);
    if (datos.decision !== 'ACCEPTED' && datos.decision !== 'DECLINED') return rechazo('DECISION_REQUIRED', 'VALIDATION_FAILED', ['decision']);
    if (datos.targetType !== undefined && !TIPOS.includes(datos.targetType)) {
      return rechazo('TARGET_PAIR_INCOMPLETE', 'VALIDATION_FAILED', ['targetType']);
    }
    const violaciones = violacionesDelConsentimiento(datos);
    if (violaciones.length > 0) return rechazoDeLaRegla(violaciones);

    const instante = ahora();
    const nuevo = consentimientos.agregar(
      fila({
        ...Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined)),
        id: nuevoId('consent'),
        patientProfileId: datos.patientProfileId ?? '',
        decision: datos.decision,
        grantedBy: datos.grantedBy ?? 'PATIENT',
        informationLanguage: datos.informationLanguage ?? 'es',
        channel: datos.channel ?? 'IN_PERSON',
        informedByProfileId: datos.informedByProfileId ?? request.user?.practitionerProfileId ?? null,
        createdAt: instante,
        signedAt: instante,
      }),
    );
    return reply(201, vista(nuevo));
  });

  router.patch('/consent/treatment-informed-consents/:id/withdraw', (request) => {
    const actual = consentimientos.get(request.params['id']!);
    if (actual === undefined) return notFound('Consentimiento no encontrado');
    if (actual.status === 'WITHDRAWN') {
      return reply(409, { statusCode: 409, code: 'CONFLICT', message: 'El consentimiento ya estaba revocado.', error: 'Conflict', reason: 'INFORMED_CONSENT_ALREADY_WITHDRAWN' });
    }
    const motivo = (cuerpo<{ reason: string }>(request).reason ?? '').trim();
    if (motivo === '') {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'La revocación exige su motivo.',
        error: 'Bad Request',
        details: { fields: ['reason'] },
      });
    }
    const revocado = consentimientos.actualizar(actual.id, {
      status: 'WITHDRAWN',
      withdrawnAt: ahora(),
      withdrawalReason: motivo,
    });
    return revocado === undefined ? notFound('Consentimiento no encontrado') : vista(revocado);
  });

  router.patch('/consent/treatment-informed-consents/:id/post-emergency-information', (request) => {
    const actual = consentimientos.get(request.params['id']!);
    if (actual === undefined) return notFound('Consentimiento no encontrado');
    if (actual.exceptionType !== 'EMERGENCY') {
      return reply(409, { statusCode: 409, code: 'CONFLICT', message: 'Sólo un consentimiento exceptuado por urgencia se informa a posteriori.', error: 'Conflict', reason: 'INFORMED_CONSENT_NOT_EMERGENCY' });
    }
    const cuando = cuerpo<{ informedAt: string }>(request).informedAt ?? ahora();
    const informado = consentimientos.actualizar(actual.id, { postEmergencyInformedAt: cuando });
    return informado === undefined ? notFound('Consentimiento no encontrado') : vista(informado);
  });

  /* La evidencia: `POST …/:id/evidence`. La API reutiliza
     `ConsentEvidenceService`; el sujeto lo pone la ruta. */
  router.post('/consent/treatment-informed-consents/:id/evidence', (request) => {
    const consentimiento = consentimientos.get(request.params['id']!);
    if (consentimiento === undefined) return notFound('Consentimiento no encontrado');
    const datos = cuerpo<{ documentFileId?: string; signatureId?: string; evidenceTypeConceptId?: string; capturedChannelConceptId?: string }>(request);
    const nueva = evidencias.agregar({
      id: nuevoId('consent-evidence'),
      subjectId: consentimiento.id,
      documentFileId: datos.documentFileId ?? null,
      evidenceTypeConceptId: datos.evidenceTypeConceptId ?? EVIDENCIA_FIRMA,
      capturedChannelConceptId: datos.capturedChannelConceptId ?? null,
      recordedAt: ahora(),
    });
    return reply(201, { id: nueva.id, subjectId: nueva.subjectId, recordedAt: nueva.recordedAt });
  });
}
