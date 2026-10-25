import { HttpHeaders } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';

import type { MedicalCenterPage } from '../../data-access/medical-centers/medical-centers.types';
import { orderList, type SimulatedOrder } from '../fixtures/clinic';
import {
  MEDICAL_CENTER_SITES,
  PROCEDURE_COLONOSCOPY,
  PROCEDURE_ENDOSCOPY,
} from '../fixtures/medical-centers';
import { MEDICAL, PACIENTE, PATIENTS } from '../fixtures/people';
import { MockRouter } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registerMedicalCenters } from './medical-centers.handlers';

describe('handlers de la búsqueda de centros médicos', () => {
  const router = new MockRouter();
  registerMedicalCenters(router);

  const patientUser = buscarUsuario('paciente')!;
  const NORTH = uuid('site-cm-norte-1');
  const SOUTH = uuid('site-cm-sur-1');

  interface Reply<T> {
    readonly status: number;
    readonly body: T;
  }

  function call<T = MedicalCenterPage>(
    path: string,
    query: Record<string, string>,
    user: ReturnType<typeof buscarUsuario> | null = patientUser,
  ): Reply<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const result = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: user ?? null,
    });
    if (result !== null && typeof result === 'object' && 'status' in result && 'body' in result) {
      return result as Reply<T>;
    }
    return { status: 200, body: result as T };
  }

  const searchPublic = (query: Record<string, string>): MedicalCenterPage =>
    call('/medical-centers/search', query).body;

  const both = `${PROCEDURE_ENDOSCOPY},${PROCEDURE_COLONOSCOPY}`;
  const siteIds = (page: MedicalCenterPage): string[] => page.items.map((item) => item.practiceSiteId);

  const created: string[] = [];
  function addOrder(
    id: string,
    patientProfileId: string,
    procedure: string,
    extra: object = {},
  ): string {
    const row = {
      id,
      patientProfileId,
      codeConceptId: procedure,
      categoryConceptId: uuid('categoria-procedimiento'),
      priorityConceptId: uuid('prioridad'),
      statusConceptId: uuid('estado'),
      requesterProfileId: MEDICAL.id,
      reasonText: 'Control',
      createdAt: new Date().toISOString(),
      ...extra,
    } as SimulatedOrder;
    orderList.agregar(row);
    created.push(id);
    return id;
  }

  afterEach(() => {
    for (const id of created.splice(0)) orderList.borrar(id);
  });

  describe('GET /medical-centers/search', () => {
    it('ordena como la API: completos antes que parciales', () => {
      const page = searchPublic({ procedureConceptIds: both, includePartial: 'true' });

      expect(siteIds(page)).toEqual([NORTH, SOUTH]);
      expect(page.items.map((item) => item.complete)).toEqual([true, false]);
    });

    it('entre completos, ordena por distancia con los nulos al final', () => {
      const south = MEDICAL_CENTER_SITES[1]!;
      // Desde la puerta de la sede sur, la sur queda más cerca.
      const near = searchPublic({
        procedureConceptIds: PROCEDURE_ENDOSCOPY,
        includePartial: 'false',
        lat: String(south.latitude),
        lng: String(south.longitude),
      });
      expect(siteIds(near)).toEqual([SOUTH, NORTH]);
      expect(near.items[0]?.distanceKm).toBe(0);

      // Sin origen no hay distancias y gana el precio total (la sur es más barata).
      const noOrigin = searchPublic({ procedureConceptIds: PROCEDURE_ENDOSCOPY, includePartial: 'false' });
      expect(noOrigin.items.map((item) => item.distanceKm)).toEqual([null, null]);
      expect(siteIds(noOrigin)).toEqual([SOUTH, NORTH]);
    });

    it('includePartial=false deja solo los completos', () => {
      const page = searchPublic({ procedureConceptIds: both, includePartial: 'false' });

      expect(siteIds(page)).toEqual([NORTH]);
      expect(page.items.every((item) => item.complete)).toBe(true);
    });

    it('sin includePartial se comporta como false: solo completos', () => {
      expect(siteIds(searchPublic({ procedureConceptIds: both }))).toEqual([NORTH]);
    });

    it('el parcial dice qué le falta por concepto y no inventa un total', () => {
      const page = searchPublic({ procedureConceptIds: both, includePartial: 'true' });
      const partial = page.items[1]!;

      expect(partial.practiceSiteId).toBe(SOUTH);
      expect(partial.missingProcedureConceptIds).toEqual([PROCEDURE_COLONOSCOPY]);
      expect(partial.totalPrice).toBeNull();
      expect(page.items[0]?.totalPrice).toBe(1550);
    });

    it('/search público no trae los distintivos del médico', () => {
      for (const item of searchPublic({ procedureConceptIds: both, includePartial: 'true' }).items) {
        expect('practitionerWorksHere' in item).toBe(false);
        expect('suggestedByPractitioner' in item).toBe(false);
      }
    });

    it('no devuelve sedes que no ofrecen ninguno de los procedimientos', () => {
      expect(
        searchPublic({ procedureConceptIds: uuid('proc-inexistente'), includePartial: 'true' }).items,
      ).toEqual([]);
    });

    it('corta la página después de ordenar', () => {
      const page = searchPublic({ procedureConceptIds: both, includePartial: 'true', limit: '1', offset: '1' });

      expect(page).toMatchObject({ total: 2, limit: 1, offset: 1 });
      expect(siteIds(page)).toEqual([SOUTH]);
    });

    it('lat sin lng, o ninguno o más de 50 ids, es un 400', () => {
      expect(call('/medical-centers/search', { procedureConceptIds: both, lat: '-17.7' }).status).toBe(400);
      expect(call('/medical-centers/search', {}).status).toBe(400);
      const many = Array.from({ length: 51 }, (_, i) => `c-${i}`).join(',');
      expect(call('/medical-centers/search', { procedureConceptIds: many }).status).toBe(400);
    });
  });

  describe('GET /medical-centers/search/for-my-orders', () => {
    const ask = (...ids: string[]): MedicalCenterPage =>
      call('/medical-centers/search/for-my-orders', {
        serviceRequestIds: ids.join(','),
        includePartial: 'true',
      }).body;

    it('los procedimientos salen de las órdenes y los distintivos solo vienen acá', () => {
      const a = addOrder('cm09-orden-a', PACIENTE.id, PROCEDURE_ENDOSCOPY);
      const b = addOrder('cm09-orden-b', PACIENTE.id, PROCEDURE_COLONOSCOPY);

      const page = ask(a, b);

      expect(siteIds(page)).toEqual([NORTH, SOUTH]);
      // La médica de ejemplo trabaja en la sede sur, que no es la primera.
      expect(page.items.map((item) => item.practitionerWorksHere)).toEqual([false, true]);
      expect(page.items.map((item) => item.suggestedByPractitioner)).toEqual([false, false]);
    });

    it('con y sin sugerencia: la misma lista de sedes en el mismo orden (CI-1)', () => {
      const withoutSuggestion = addOrder('cm09-sin', PACIENTE.id, PROCEDURE_ENDOSCOPY);
      const withSuggestion = addOrder('cm09-con', PACIENTE.id, PROCEDURE_ENDOSCOPY, {
        suggestedPracticeSiteId: SOUTH,
      });

      const base = ask(withoutSuggestion);
      const suggested = ask(withSuggestion);

      expect(siteIds(suggested)).toEqual(siteIds(base));
      expect(suggested.items.find((item) => item.practiceSiteId === SOUTH)?.suggestedByPractitioner).toBe(true);
      expect(base.items.some((item) => item.suggestedByPractitioner)).toBe(false);
    });

    it('mover la sugerencia de una sede a la otra no cambia el orden (CI-2)', () => {
      const orderIds = [NORTH, SOUTH].map((site, i) =>
        addOrder(`cm09-ci2-${i}`, PACIENTE.id, PROCEDURE_ENDOSCOPY, { suggestedPracticeSiteId: site }),
      );
      const [suggestsNorth, suggestsSouth] = orderIds.map((id) => ask(id));

      expect(siteIds(suggestsNorth!)).toEqual(siteIds(suggestsSouth!));
      expect(suggestsNorth!.items.map((item) => item.suggestedByPractitioner)).not.toEqual(
        suggestsSouth!.items.map((item) => item.suggestedByPractitioner),
      );
      // Y el vínculo de la médica con la sede sur tampoco mueve nada.
      expect(suggestsNorth!.items.map((item) => item.practitionerWorksHere)).toEqual(
        suggestsSouth!.items.map((item) => item.practitionerWorksHere),
      );
    });

    it('una orden ajena responde 404, igual que una que no existe', () => {
      const foreign = addOrder('cm09-ajena', PATIENTS[1]!.id, PROCEDURE_ENDOSCOPY);

      const reply = call('/medical-centers/search/for-my-orders', { serviceRequestIds: foreign });
      const missing = call('/medical-centers/search/for-my-orders', { serviceRequestIds: 'no-existe' });

      expect(reply.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(reply.body).toEqual(missing.body);
    });

    it('sin sesión es un 401', () => {
      const id = addOrder('cm09-anonimo', PACIENTE.id, PROCEDURE_ENDOSCOPY);

      expect(call('/medical-centers/search/for-my-orders', { serviceRequestIds: id }, null).status).toBe(401);
    });

    it('sin ids es un 400', () => {
      expect(call('/medical-centers/search/for-my-orders', {}).status).toBe(400);
    });
  });
});
