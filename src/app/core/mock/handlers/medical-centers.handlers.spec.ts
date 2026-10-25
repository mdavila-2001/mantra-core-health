import { HttpHeaders } from '@angular/common/http';
import { afterEach, describe, expect, it } from 'vitest';

import type { MedicalCenterPage } from '../../data-access/medical-centers/medical-centers.types';
import { ordenes, type OrdenSimulada } from '../fixtures/clinica';
import {
  PROCEDURE_COLONOSCOPY,
  PROCEDURE_ENDOSCOPY,
  SEDES_DE_CENTROS_MEDICOS,
} from '../fixtures/medical-centers';
import { MEDICA, PACIENTE, PACIENTES } from '../fixtures/personas';
import { MockRouter } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { uuid } from '../mock-store';
import { registerMedicalCenters } from './medical-centers.handlers';

describe('handlers de la búsqueda de centros médicos', () => {
  const router = new MockRouter();
  registerMedicalCenters(router);

  const paciente = buscarUsuario('paciente')!;
  const NORTE = uuid('site-cm-norte-1');
  const SUR = uuid('site-cm-sur-1');

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = MedicalCenterPage>(
    path: string,
    query: Record<string, string>,
    user: ReturnType<typeof buscarUsuario> | null = paciente,
  ): Respuesta<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const resultado = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: user ?? null,
    });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  const buscar = (query: Record<string, string>): MedicalCenterPage =>
    llamar('/medical-centers/search', query).body;

  const ambos = `${PROCEDURE_ENDOSCOPY},${PROCEDURE_COLONOSCOPY}`;
  const sitios = (page: MedicalCenterPage): string[] => page.items.map((item) => item.practiceSiteId);

  const creadas: string[] = [];
  function orden(id: string, patientProfileId: string, procedimiento: string, extra: object = {}): string {
    const fila = {
      id,
      patientProfileId,
      codeConceptId: procedimiento,
      categoryConceptId: uuid('categoria-procedimiento'),
      priorityConceptId: uuid('prioridad'),
      statusConceptId: uuid('estado'),
      requesterProfileId: MEDICA.id,
      reasonText: 'Control',
      createdAt: new Date().toISOString(),
      ...extra,
    } as OrdenSimulada;
    ordenes.agregar(fila);
    creadas.push(id);
    return id;
  }

  afterEach(() => {
    for (const id of creadas.splice(0)) ordenes.borrar(id);
  });

  describe('GET /medical-centers/search', () => {
    it('ordena como la API: completos antes que parciales', () => {
      const page = buscar({ procedureConceptIds: ambos, includePartial: 'true' });

      expect(sitios(page)).toEqual([NORTE, SUR]);
      expect(page.items.map((item) => item.complete)).toEqual([true, false]);
    });

    it('entre completos, ordena por distancia con los nulos al final', () => {
      const [primero] = SEDES_DE_CENTROS_MEDICOS;
      // Desde la puerta de la sede sur, la sur queda más cerca.
      const sur = SEDES_DE_CENTROS_MEDICOS[1]!;
      const cerca = buscar({
        procedureConceptIds: PROCEDURE_ENDOSCOPY,
        includePartial: 'false',
        lat: String(sur.latitude),
        lng: String(sur.longitude),
      });
      expect(sitios(cerca)).toEqual([SUR, NORTE]);
      expect(cerca.items[0]?.distanceKm).toBe(0);
      expect(primero?.practiceSiteId).toBe(NORTE);

      // Sin origen no hay distancias y gana el precio total (la sur es más barata).
      const sinOrigen = buscar({ procedureConceptIds: PROCEDURE_ENDOSCOPY, includePartial: 'false' });
      expect(sinOrigen.items.map((item) => item.distanceKm)).toEqual([null, null]);
      expect(sitios(sinOrigen)).toEqual([SUR, NORTE]);
    });

    it('includePartial=false deja solo los completos', () => {
      const page = buscar({ procedureConceptIds: ambos, includePartial: 'false' });

      expect(sitios(page)).toEqual([NORTE]);
      expect(page.items.every((item) => item.complete)).toBe(true);
    });

    it('sin includePartial se comporta como false: solo completos', () => {
      expect(sitios(buscar({ procedureConceptIds: ambos }))).toEqual([NORTE]);
    });

    it('el parcial dice qué le falta por concepto y no inventa un total', () => {
      const parcial = buscar({ procedureConceptIds: ambos, includePartial: 'true' }).items[1]!;

      expect(parcial.practiceSiteId).toBe(SUR);
      expect(parcial.missingProcedureConceptIds).toEqual([PROCEDURE_COLONOSCOPY]);
      expect(parcial.totalPrice).toBeNull();
      expect(buscar({ procedureConceptIds: ambos, includePartial: 'true' }).items[0]?.totalPrice).toBe(1550);
    });

    it('/search público no trae los distintivos del médico', () => {
      for (const item of buscar({ procedureConceptIds: ambos, includePartial: 'true' }).items) {
        expect('practitionerWorksHere' in item).toBe(false);
        expect('suggestedByPractitioner' in item).toBe(false);
      }
    });

    it('no devuelve sedes que no ofrecen ninguno de los procedimientos', () => {
      expect(buscar({ procedureConceptIds: uuid('proc-inexistente'), includePartial: 'true' }).items).toEqual([]);
    });

    it('corta la página después de ordenar', () => {
      const page = buscar({ procedureConceptIds: ambos, includePartial: 'true', limit: '1', offset: '1' });

      expect(page).toMatchObject({ total: 2, limit: 1, offset: 1 });
      expect(sitios(page)).toEqual([SUR]);
    });

    it('lat sin lng, o ninguno o más de 50 ids, es un 400', () => {
      expect(llamar('/medical-centers/search', { procedureConceptIds: ambos, lat: '-17.7' }).status).toBe(400);
      expect(llamar('/medical-centers/search', {}).status).toBe(400);
      const muchos = Array.from({ length: 51 }, (_, i) => `c-${i}`).join(',');
      expect(llamar('/medical-centers/search', { procedureConceptIds: muchos }).status).toBe(400);
    });
  });

  describe('GET /medical-centers/search/for-my-orders', () => {
    const pedir = (...ids: string[]): MedicalCenterPage =>
      llamar('/medical-centers/search/for-my-orders', {
        serviceRequestIds: ids.join(','),
        includePartial: 'true',
      }).body;

    it('los procedimientos salen de las órdenes y los distintivos solo vienen acá', () => {
      const a = orden('cm09-orden-a', PACIENTE.id, PROCEDURE_ENDOSCOPY);
      const b = orden('cm09-orden-b', PACIENTE.id, PROCEDURE_COLONOSCOPY);

      const page = pedir(a, b);

      expect(sitios(page)).toEqual([NORTE, SUR]);
      // La médica de ejemplo trabaja en la sede sur, que no es la primera.
      expect(page.items.map((item) => item.practitionerWorksHere)).toEqual([false, true]);
      expect(page.items.map((item) => item.suggestedByPractitioner)).toEqual([false, false]);
    });

    it('con y sin sugerencia: la misma lista de sedes en el mismo orden (CI-1)', () => {
      const sinSugerencia = orden('cm09-sin', PACIENTE.id, PROCEDURE_ENDOSCOPY);
      const conSugerencia = orden('cm09-con', PACIENTE.id, PROCEDURE_ENDOSCOPY, {
        suggestedPracticeSiteId: SUR,
      });

      const base = pedir(sinSugerencia);
      const sugerida = pedir(conSugerencia);

      expect(sitios(sugerida)).toEqual(sitios(base));
      expect(sugerida.items.find((item) => item.practiceSiteId === SUR)?.suggestedByPractitioner).toBe(true);
      expect(base.items.some((item) => item.suggestedByPractitioner)).toBe(false);
    });

    it('mover la sugerencia de una sede a la otra no cambia el orden (CI-2)', () => {
      const ordenes = [NORTE, SUR].map((sede, i) =>
        orden(`cm09-ci2-${i}`, PACIENTE.id, PROCEDURE_ENDOSCOPY, { suggestedPracticeSiteId: sede }),
      );
      const [sugiereNorte, sugiereSur] = ordenes.map((id) => pedir(id));

      expect(sitios(sugiereNorte!)).toEqual(sitios(sugiereSur!));
      expect(sugiereNorte!.items.map((item) => item.suggestedByPractitioner)).not.toEqual(
        sugiereSur!.items.map((item) => item.suggestedByPractitioner),
      );
      // Y el vínculo de la médica con la sede sur tampoco mueve nada.
      expect(sugiereNorte!.items.map((item) => item.practitionerWorksHere)).toEqual(
        sugiereSur!.items.map((item) => item.practitionerWorksHere),
      );
    });

    it('una orden ajena responde 404, igual que una que no existe', () => {
      const ajena = orden('cm09-ajena', PACIENTES[1]!.id, PROCEDURE_ENDOSCOPY);

      const respuesta = llamar('/medical-centers/search/for-my-orders', { serviceRequestIds: ajena });
      const inexistente = llamar('/medical-centers/search/for-my-orders', { serviceRequestIds: 'no-existe' });

      expect(respuesta.status).toBe(404);
      expect(inexistente.status).toBe(404);
      expect(respuesta.body).toEqual(inexistente.body);
    });

    it('sin sesión es un 401', () => {
      const id = orden('cm09-anonimo', PACIENTE.id, PROCEDURE_ENDOSCOPY);

      expect(llamar('/medical-centers/search/for-my-orders', { serviceRequestIds: id }, null).status).toBe(401);
    });

    it('sin ids es un 400', () => {
      expect(llamar('/medical-centers/search/for-my-orders', {}).status).toBe(400);
    });
  });
});
