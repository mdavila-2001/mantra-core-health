import { offers } from '../fixtures/offered-services';
import { MEDICAL } from '../fixtures/people';
import { STANDARD_SURVEY_CATALOG, type StandardTemplate } from '../fixtures/survey-catalog';
import { forbidden, reply, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { servicios } from './practice.handlers';
import { PREGUNTAS_BASE_CONSULTA, TITULO_BASE_CONSULTA } from './surveys-insights.simulator';

/* Standard surveys per service (06/11/2026): `GET /surveys/standard-catalog` and
   `GET|PUT|DELETE /surveys/service-assignments`. Also makes the imported
   templates readable like the API materializes them: they appear in
   `GET /surveys/catalog` and open in `GET /surveys/templates/:id(/responses)`.
   Registered from `index.ts`, after the forms and catalog handlers it wraps. */

/**
 * The survey attached to each service: at most ONE active per (practitioner,
 * service), like the model's partial unique index. `catalogCode: null` is a
 * legacy hand-made survey attached before the catalog existed: the API never
 * issues it any more. Persisted so «Importar» survives a reload.
 */
interface ServiceAssignmentRecord {
  /** `${practitionerProfileId}:${serviceId}`: the contract's uniqueness. */
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly serviceId: string;
  readonly assignmentId: string;
  readonly catalogCode: string | null;
  readonly title: string;
  readonly templateId: string;
  readonly versionId: string;
  readonly assignedAt: string;
}

const templateIdOf = (practitionerId: string, code: string): string => uuid(`std-template-${practitionerId}-${code}`);

const serviceAssignments = new Coleccion<ServiceAssignmentRecord>(
  [
    // The echo already has the imaging survey, so both cases show.
    {
      id: `${MEDICAL.id}:${uuid('service-ECO-DOPPLER')}`,
      practitionerProfileId: MEDICAL.id,
      serviceId: uuid('service-ECO-DOPPLER'),
      assignmentId: uuid('service-assignment-eco'),
      catalogCode: 'STD_IMAGING_V1',
      title: 'Estudios por imágenes',
      templateId: templateIdOf(MEDICAL.id, 'STD_IMAGING_V1'),
      versionId: uuid(`std-template-${MEDICAL.id}-STD_IMAGING_V1-v1`),
      assignedAt: iso(-12, 10),
    },
    // A recent import (a week ago): only three answers so far, below the summary's minimum of five.
    {
      id: `${MEDICAL.id}:${uuid('service-HOLTER')}`,
      practitionerProfileId: MEDICAL.id,
      serviceId: uuid('service-HOLTER'),
      assignmentId: uuid('service-assignment-holter'),
      catalogCode: 'STD_OTHER_V1',
      title: 'Satisfacción general con el servicio',
      templateId: templateIdOf(MEDICAL.id, 'STD_OTHER_V1'),
      versionId: uuid(`std-template-${MEDICAL.id}-STD_OTHER_V1-v1`),
      assignedAt: iso(-7, 10),
    },
    // Legacy: the hand-made teleconsultation survey, still linked from before the catalog.
    {
      id: `${MEDICAL.id}:${uuid('service-TELE-CARDIO')}`,
      practitionerProfileId: MEDICAL.id,
      serviceId: uuid('service-TELE-CARDIO'),
      assignmentId: uuid('assignment-teleconsulta'),
      catalogCode: null,
      title: 'Experiencia de teleconsulta',
      templateId: uuid('survey-teleconsulta'),
      versionId: uuid('survey-teleconsulta-v1'),
      assignedAt: iso(-40, 10),
    },
  ],
  'encuestas-por-servicio',
);

/**
 * When each imported template was FIRST imported: its answers start there and
 * survive removing and re-importing it (like the API keeps the template).
 */
const firstImports = new Coleccion<{ readonly id: string; readonly at: string }>(
  [
    { id: templateIdOf(MEDICAL.id, 'STD_IMAGING_V1'), at: iso(-12, 10) },
    { id: templateIdOf(MEDICAL.id, 'STD_OTHER_V1'), at: iso(-7, 10) },
  ],
  'encuestas-por-servicio-primera-importacion',
);

/** Resets the seeded attachments. Tests only. */
export function resetServiceSurveyAssignments(): void {
  serviceAssignments.reiniciar();
  firstImports.reiniciar();
}

/** The caller's practitioner profile; without a session (tests), the demo doctor. Same roles as the API. */
function callerPractitioner(user: MockRequest['user']): string | null {
  if (user === null) return MEDICAL.id;
  if (!user.roles.some((role) => role === 'PRACTITIONER' || role === 'CLINICIAN')) return null;
  return user.practitionerProfileId ?? MEDICAL.id;
}

/** The practitioner's services (active offers), grouped by catalog service. */
function servicesOf(practitionerId: string): readonly { serviceId: string; serviceName: string }[] {
  const seen = new Map<string, string>();
  for (const offer of offers.todos()) {
    if (offer.practitionerProfileId !== practitionerId || !offer.isActive || seen.has(offer.serviceCatalogId)) continue;
    seen.set(offer.serviceCatalogId, servicios.get(offer.serviceCatalogId)?.name ?? 'Servicio');
  }
  return [...seen.entries()].map(([serviceId, serviceName]) => ({ serviceId, serviceName })).sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'es'));
}

function rowFor(practitionerId: string, serviceId: string, serviceName: string) {
  const record = serviceAssignments.get(`${practitionerId}:${serviceId}`);
  return {
    serviceId,
    serviceName,
    assignment:
      record === undefined
        ? null
        : { assignmentId: record.assignmentId, catalogCode: record.catalogCode, title: record.title, templateId: record.templateId, versionId: record.versionId, assignedAt: record.assignedAt },
  };
}

const templateFor = (code: string | null): StandardTemplate | undefined => STANDARD_SURVEY_CATALOG.find((t) => t.code === code);

/** The practitioner's imported (catalog) templates, each with the services that send it. */
function importedTemplates(practitionerId: string) {
  const byTemplate = new Map<string, { template: StandardTemplate; records: ServiceAssignmentRecord[] }>();
  for (const record of serviceAssignments.filtrar((r) => r.practitionerProfileId === practitionerId && r.catalogCode !== null)) {
    const template = templateFor(record.catalogCode);
    if (template === undefined) continue;
    const entry = byTemplate.get(record.templateId) ?? { template, records: [] };
    entry.records.push(record);
    byTemplate.set(record.templateId, entry);
  }
  return [...byTemplate.entries()].map(([id, { template, records }]) => ({ id, template, records }));
}

/** The oldest attachment date among a template's records. */
function oldestImport(records: readonly ServiceAssignmentRecord[]): string {
  return records.map((r) => r.assignedAt).sort()[0]!;
}

function templateSummary(id: string, template: StandardTemplate) {
  return { id, title: template.title, description: template.description, status: 'ACTIVE', latestVersionNumber: 1, published: true, questionCount: template.questions.length };
}

/**
 * Deterministic answers for an imported template, only AFTER it was imported:
 * one every two days since then, up to six. A fresh import has none. The optional
 * «report delivery» question is skipped after the third answer, so the sheet's
 * Resumen shows a question below its own minimum (per-question privacy rule).
 */
function responsesFor(id: string, template: StandardTemplate, importedAt: string) {
  const days = Math.floor((Date.now() - new Date(importedAt).getTime()) / 86_400_000);
  const count = Math.max(0, Math.min(6, Math.floor(days / 2)));
  return Array.from({ length: count }, (_, n) => ({
    id: uuid(`${id}-response-${n}`),
    invitationId: uuid(`${id}-invitation-${n}`),
    submittedAt: `${iso(-(n * 2 + 1), 0).slice(0, 10)}T00:00:00.000Z`,
    answers: template.questions.flatMap((q, i) => (q.dimension === 'entrega_resultados' && n >= 3 ? [] : [{
      questionId: uuid(`${id}-q-${i}`),
      questionText: q.text,
      answerType: q.answerType,
      ...(q.answerType === 'SCALE' ? { valueNumber: (q.scaleMin ?? 1) + ((n + i) % ((q.scaleMax ?? 5) - (q.scaleMin ?? 1) + 1)) } : {}),
      ...(q.answerType === 'BOOLEAN' ? { valueBoolean: (n + i) % 3 !== 0 } : {}),
      ...(q.answerType === 'SINGLE_CHOICE' || q.answerType === 'MULTIPLE_CHOICE' ? { valueChoices: [q.options?.[(n + i) % (q.options?.length || 1)] ?? ''] } : {}),
      ...(q.answerType === 'TEXT' ? { valueText: ['Todo claro y puntual.', 'Me explicaron bien el estudio.', 'Esperé un poco más de lo previsto.'][n % 3]! } : {}),
    }])),
  }));
}

export function registerServiceSurveyAssignments(router: MockRouter): void {
  router.get('/surveys/standard-catalog', ({ user }) => {
    if (callerPractitioner(user) === null) return forbidden('Solo el profesional puede ver el catálogo de encuestas.');
    return { items: STANDARD_SURVEY_CATALOG };
  });

  router.get('/surveys/service-assignments', ({ user }) => {
    const practitionerId = callerPractitioner(user);
    if (practitionerId === null) return forbidden('Solo el profesional puede ver sus encuestas por servicio.');
    return {
      consultation: {
        system: true,
        title: 'Cita médica',
        templateTitle: TITULO_BASE_CONSULTA,
        questionCount: PREGUNTAS_BASE_CONSULTA.length,
        replaceable: false,
        questions: PREGUNTAS_BASE_CONSULTA.map((q) => ({
          text: q.questionText,
          answerType: q.answerType,
          required: q.required,
          dimension: q.dimension,
          ...(q.options === undefined ? {} : { options: q.options }),
          ...(q.scaleMin === undefined ? {} : { scaleMin: q.scaleMin }),
          ...(q.scaleMax === undefined ? {} : { scaleMax: q.scaleMax }),
        })),
      },
      services: servicesOf(practitionerId).map((s) => rowFor(practitionerId, s.serviceId, s.serviceName)),
    };
  });

  /** Import or change: deactivates the previous one and keeps ONE active (idempotent per code). */
  router.put('/surveys/service-assignments/:serviceId', (request) => {
    const practitionerId = callerPractitioner(request.user);
    if (practitionerId === null) return forbidden();
    const serviceId = request.params['serviceId']!;
    const service = servicesOf(practitionerId).find((s) => s.serviceId === serviceId);
    if (service === undefined) return forbidden('Ese servicio no es suyo.');
    const template = templateFor(cuerpo<{ catalogCode?: string }>(request).catalogCode ?? null);
    if (template === undefined) {
      return reply(404, { statusCode: 404, code: 'NOT_FOUND', reason: 'SURVEY_CATALOG_CODE_UNKNOWN', details: { reason: 'SURVEY_CATALOG_CODE_UNKNOWN' }, message: 'La encuesta del catálogo no existe.', error: 'Not Found' });
    }
    const id = `${practitionerId}:${serviceId}`;
    const templateId = templateIdOf(practitionerId, template.code);
    if (firstImports.get(templateId) === undefined) firstImports.agregar({ id: templateId, at: ahora() });
    if (serviceAssignments.get(id)?.catalogCode !== template.code) {
      serviceAssignments.borrar(id);
      serviceAssignments.agregar({
        id,
        practitionerProfileId: practitionerId,
        serviceId,
        assignmentId: nuevoId('service-assignment'),
        catalogCode: template.code,
        title: template.title,
        templateId,
        versionId: uuid(`std-template-${practitionerId}-${template.code}-v1`),
        assignedAt: ahora(),
      });
    }
    return rowFor(practitionerId, serviceId, service.serviceName);
  });

  router.delete('/surveys/service-assignments/:serviceId', (request) => {
    const practitionerId = callerPractitioner(request.user);
    if (practitionerId === null) return forbidden();
    const serviceId = request.params['serviceId']!;
    if (!servicesOf(practitionerId).some((s) => s.serviceId === serviceId)) return forbidden('Ese servicio no es suyo.');
    serviceAssignments.borrar(`${practitionerId}:${serviceId}`);
    return reply(204);
  });

  // The Buzón lists imported templates too (they are what the services send).
  router.wrap('GET', '/surveys/catalog', (request, next) => {
    const listed = next(request);
    const practitionerId = callerPractitioner(request.user);
    if (!Array.isArray(listed) || practitionerId === null) return listed;
    const imported = importedTemplates(practitionerId).map(({ id, template, records }) => ({
      ...templateSummary(id, template),
      origin: 'PRACTITIONER',
      assignments: records.map((r) => ({ id: r.assignmentId, targetType: 'SERVICE', targetId: r.serviceId, targetName: servicios.get(r.serviceId)?.name ?? null })),
    }));
    return [...listed, ...imported];
  });

  // And their sheet opens and reads like any template.
  const imported = (request: MockRequest) => importedTemplates(callerPractitioner(request.user) ?? MEDICAL.id).find((t) => t.id === request.params['id']);
  router.wrap('GET', '/surveys/templates/:id', (request, next) => {
    const found = imported(request);
    if (found === undefined) return next(request);
    const { id, template, records } = found;
    return {
      ...templateSummary(id, template),
      latestVersionId: records[0]!.versionId,
      responseWindowDays: 7,
      effectiveFrom: (firstImports.get(id)?.at ?? oldestImport(records)).slice(0, 10),
      effectiveTo: null,
      questions: template.questions.map((q, i) => ({ id: uuid(`${id}-q-${i}`), position: i + 1, questionText: q.text, answerType: q.answerType, required: q.required, ...(q.options ? { options: q.options } : {}), ...(q.scaleMin === undefined ? {} : { scaleMin: q.scaleMin, scaleMax: q.scaleMax }) })),
      assignments: records.map((r) => ({ id: r.assignmentId, targetType: 'SERVICE', targetId: r.serviceId })),
    };
  });
  router.wrap('GET', '/surveys/templates/:id/responses', (request, next) => {
    const found = imported(request);
    if (found === undefined) return next(request);
    // Answers start at the template's first import (the oldest), not at the latest re-import.
    return responsesFor(found.id, found.template, firstImports.get(found.id)?.at ?? oldestImport(found.records));
  });
}
