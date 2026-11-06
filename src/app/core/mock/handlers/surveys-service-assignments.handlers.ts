import { offers } from '../fixtures/offered-services';
import { MEDICAL } from '../fixtures/people';
import { STANDARD_SURVEY_CATALOG, type StandardTemplate } from '../fixtures/survey-catalog';
import { forbidden, reply, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { servicios } from './practice.handlers';
import { PREGUNTAS_BASE_CONSULTA, TITULO_BASE_CONSULTA } from './surveys-insights.simulator';

/* Standard surveys per service (06/11/2026): `GET /surveys/standard-catalog` and
   `GET|PUT|DELETE /surveys/service-assignments`. Registered from `index.ts`. */

/**
 * The standard survey attached to each service: at most ONE active per
 * (practitioner, service), like the model's partial unique index. Persisted
 * under its own key so «Importar» survives a page reload.
 */
interface ServiceAssignmentRecord {
  /** `${practitionerProfileId}:${serviceId}`: the contract's uniqueness. */
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly serviceId: string;
  readonly assignmentId: string;
  readonly catalogCode: string;
  readonly title: string;
  readonly templateId: string;
  readonly versionId: string;
  readonly assignedAt: string;
}

const serviceAssignments = new Coleccion<ServiceAssignmentRecord>(
  [
    // Seeded: the echo already has the imaging survey, so both cases show.
    {
      id: `${MEDICAL.id}:${uuid('service-ECO-DOPPLER')}`,
      practitionerProfileId: MEDICAL.id,
      serviceId: uuid('service-ECO-DOPPLER'),
      assignmentId: uuid('service-assignment-eco'),
      catalogCode: 'STD_IMAGING_V1',
      title: 'Estudios por imágenes',
      templateId: uuid(`std-template-${MEDICAL.id}-STD_IMAGING_V1`),
      versionId: uuid(`std-template-${MEDICAL.id}-STD_IMAGING_V1-v1`),
      assignedAt: iso(-12, 10),
    },
  ],
  'encuestas-por-servicio',
);

/** Resets the seeded attachments. Tests only. */
export function resetServiceSurveyAssignments(): void {
  serviceAssignments.reiniciar();
}

/** The caller's practitioner profile; without a session (tests), the demo doctor. */
function callerPractitioner(user: MockRequest['user']): string | null {
  if (user === null) return MEDICAL.id;
  // Same roles as the API controller: PRACTITIONER and CLINICIAN.
  if (!user.roles.some((r) => r === 'PRACTITIONER' || r === 'CLINICIAN')) return null;
  return user.practitionerProfileId ?? MEDICAL.id;
}

/** The practitioner's services (active offers), grouped by catalog service. */
function servicesOf(practitionerProfileId: string): readonly { serviceId: string; serviceName: string }[] {
  const vistos = new Map<string, string>();
  for (const oferta of offers.todos()) {
    if (oferta.practitionerProfileId !== practitionerProfileId || !oferta.isActive) continue;
    if (vistos.has(oferta.serviceCatalogId)) continue;
    vistos.set(oferta.serviceCatalogId, servicios.get(oferta.serviceCatalogId)?.name ?? 'Servicio');
  }
  return [...vistos.entries()]
    .map(([serviceId, serviceName]) => ({ serviceId, serviceName }))
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName, 'es'));
}

function rowFor(practitionerProfileId: string, serviceId: string, serviceName: string) {
  const a = serviceAssignments.get(`${practitionerProfileId}:${serviceId}`);
  return {
    serviceId,
    serviceName,
    assignment:
      a === undefined
        ? null
        : { assignmentId: a.assignmentId, catalogCode: a.catalogCode, title: a.title, templateId: a.templateId, versionId: a.versionId, assignedAt: a.assignedAt },
  };
}

function templateFor(code: string): StandardTemplate | undefined {
  return STANDARD_SURVEY_CATALOG.find((p) => p.code === code);
}

export function registerServiceSurveyAssignments(router: MockRouter): void {
  router.get('/surveys/standard-catalog', ({ user }) => {
    if (callerPractitioner(user) === null) return forbidden('Solo el profesional puede ver el catálogo de encuestas.');
    return { items: STANDARD_SURVEY_CATALOG };
  });

  router.get('/surveys/service-assignments', ({ user }) => {
    const profesional = callerPractitioner(user);
    if (profesional === null) return forbidden('Solo el profesional puede ver sus encuestas por servicio.');
    return {
      consultation: {
        system: true,
        title: 'Cita médica',
        templateTitle: TITULO_BASE_CONSULTA,
        questionCount: PREGUNTAS_BASE_CONSULTA.length,
        replaceable: false,
        // Additive (not in the contract): the questions, for «Ver preguntas».
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
      services: servicesOf(profesional).map((s) => rowFor(profesional, s.serviceId, s.serviceName)),
    };
  });

  /** Import or change: deactivates the previous one and keeps ONE active (idempotent per code). */
  router.put('/surveys/service-assignments/:serviceId', (request) => {
    const profesional = callerPractitioner(request.user);
    if (profesional === null) return forbidden();
    const serviceId = request.params['serviceId']!;
    const servicio = servicesOf(profesional).find((s) => s.serviceId === serviceId);
    if (servicio === undefined) return forbidden('Ese servicio no es suyo.');
    const datos = cuerpo<{ catalogCode?: string }>(request);
    const plantilla = templateFor(datos.catalogCode ?? '');
    if (plantilla === undefined) {
      return reply(404, { statusCode: 404, code: 'NOT_FOUND', reason: 'SURVEY_CATALOG_CODE_UNKNOWN', details: { reason: 'SURVEY_CATALOG_CODE_UNKNOWN' }, message: 'La encuesta del catálogo no existe.', error: 'Not Found' });
    }
    const id = `${profesional}:${serviceId}`;
    const previa = serviceAssignments.get(id);
    if (previa?.catalogCode !== plantilla.code) {
      serviceAssignments.borrar(id);
      serviceAssignments.agregar({
        id,
        practitionerProfileId: profesional,
        serviceId,
        assignmentId: nuevoId('service-assignment'),
        catalogCode: plantilla.code,
        title: plantilla.title,
        templateId: uuid(`std-template-${profesional}-${plantilla.code}`),
        versionId: uuid(`std-template-${profesional}-${plantilla.code}-v1`),
        assignedAt: ahora(),
      });
    }
    return rowFor(profesional, serviceId, servicio.serviceName);
  });

  router.delete('/surveys/service-assignments/:serviceId', (request) => {
    const profesional = callerPractitioner(request.user);
    if (profesional === null) return forbidden();
    const serviceId = request.params['serviceId']!;
    if (!servicesOf(profesional).some((s) => s.serviceId === serviceId)) return forbidden('Ese servicio no es suyo.');
    serviceAssignments.borrar(`${profesional}:${serviceId}`);
    return reply(204);
  });
}
