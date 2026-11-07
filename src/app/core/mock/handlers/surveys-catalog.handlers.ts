import type { MockRequest, MockRouter } from '../mock-router';
import { uuid } from '../mock-store';
import { servicios } from './practice.handlers';
import {
  DESCRIPCION_BASE_CONSULTA,
  DESCRIPCION_BASE_SERVICIO,
  PREGUNTAS_BASE_CONSULTA,
  PREGUNTAS_BASE_SERVICIO,
  TITULO_BASE_CONSULTA,
  TITULO_BASE_SERVICIO,
} from './surveys-insights.simulator';

/**
 * `GET /surveys/catalog` (the «Buzón» list, `SurveysCatalogClient`): the two
 * system base surveys first, then the practitioner's own with the services
 * they are attached to. Built from the existing template routes so the frozen
 * `surveys-forms.handlers.ts` does not grow. Registered after `registrarEncuestas`.
 */
export function registerSurveyCatalog(router: MockRouter): void {
  const call = (request: MockRequest, path: string): unknown => {
    const match = router.match('GET', path);
    return match === null ? null : match.handler({ ...request, path, params: match.params });
  };

  router.get('/surveys/catalog', (request) => {
    const base = (scope: 'CONSULTATION' | 'SERVICE', title: string, description: string, n: number) => ({
      id: uuid(scope === 'CONSULTATION' ? 'survey-base-consulta' : 'survey-base-servicio'),
      title,
      description,
      status: 'ACTIVE',
      latestVersionNumber: 2,
      published: true,
      questionCount: n,
      origin: 'SYSTEM',
      scope,
      assignments: [],
    });
    const own = (call(request, '/surveys/templates') as { id: string }[] | null) ?? [];
    return [
      base('CONSULTATION', TITULO_BASE_CONSULTA, DESCRIPCION_BASE_CONSULTA, PREGUNTAS_BASE_CONSULTA.length),
      base('SERVICE', TITULO_BASE_SERVICIO, DESCRIPCION_BASE_SERVICIO, PREGUNTAS_BASE_SERVICIO.length),
      ...own.map((summary) => {
        const detail = call(request, `/surveys/templates/${summary.id}`) as {
          assignments?: { id: string; targetType: string; targetId: string }[];
        } | null;
        const assignments = (detail?.assignments ?? []).map((a) => ({
          ...a,
          targetName: a.targetType === 'SERVICE' ? (servicios.get(a.targetId)?.name ?? null) : null,
        }));
        return { ...summary, origin: 'PRACTITIONER', assignments };
      }),
    ];
  });
}
