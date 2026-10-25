import { HttpHeaders } from '@angular/common/http';

import type { HealthcareServiceOffer } from '../../data-access/healthcare-services/healthcare-services.types';
import {
  PRACTICE_CM_NORTE,
  PRACTICE_CM_SUR,
  PROCEDURE_COLONOSCOPY,
  PROCEDURE_UPPER_ENDOSCOPY,
  SITE_CM_NORTE_1,
  SITE_CM_SUR_1,
} from '../fixtures/healthcare-services';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { uuid } from '../mock-store';
import { registerHealthcareServices } from './healthcare-services.handlers';
import { servicios } from './practice.handlers';

/** El doble de CM-06 sobre un enrutador propio: lo que se prueba es su contrato, no el registro global. */
describe('handlers de procedimientos por sede (CM-06)', () => {
  const router = new MockRouter();
  registerHealthcareServices(router);

  function call(method: MockMethod, path: string, body: unknown = {}, query = ''): unknown {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: null,
    });
  }

  const OFFERS = `/practices/${PRACTICE_CM_NORTE}/healthcare-services`;

  function itemsOf(reply: unknown): HealthcareServiceOffer[] {
    return (reply as { items: HealthcareServiceOffer[] }).items;
  }

  it('los ids de ejemplo salen de uuid(): son los del contrato', () => {
    expect(PRACTICE_CM_NORTE).toBe(uuid('practice-cm-norte'));
    expect(SITE_CM_NORTE_1).toBe(uuid('site-cm-norte-1'));
    expect(PRACTICE_CM_SUR).toBe(uuid('practice-cm-sur'));
    expect(SITE_CM_SUR_1).toBe(uuid('site-cm-sur-1'));
    expect(PROCEDURE_UPPER_ENDOSCOPY).toBe(uuid('proc-endoscopia-alta'));
    expect(PROCEDURE_COLONOSCOPY).toBe(uuid('proc-colonoscopia'));
  });

  it('GET sites devuelve las sedes de la práctica y 404 para una desconocida', () => {
    const sites = call('GET', `/practices/${PRACTICE_CM_SUR}/sites`) as { id: string }[];
    expect(sites.map((s) => s.id)).toEqual([SITE_CM_SUR_1]);

    const missing = call('GET', '/practices/no-existe/sites');
    expect(isMockReply(missing) && missing.status).toBe(404);
  });

  it('GET por sede devuelve sólo esa sede, con la forma de §1', () => {
    const north = itemsOf(call('GET', OFFERS, {}, `practiceSiteId=${SITE_CM_NORTE_1}`));
    expect(north.length).toBeGreaterThanOrEqual(2);
    expect(north.every((o) => o.practiceSiteId === SITE_CM_NORTE_1)).toBe(true);
    expect(Object.keys(north[0]!).sort()).toEqual(
      [
        'active',
        'currencyConceptId',
        'id',
        'overMargin',
        'practiceSiteId',
        'price',
        'referencePrice',
        'referenceUnit',
        'serviceCatalogId',
        'serviceConceptId',
        'serviceDisplay',
        'visibleInSearch',
      ].sort(),
    );

    const south = itemsOf(call('GET', `/practices/${PRACTICE_CM_SUR}/healthcare-services`, {}, `practiceSiteId=${SITE_CM_SUR_1}`));
    expect(south).toEqual([]);
  });

  it('los procedimientos de ejemplo usan los ids del contrato y overMargin es null', () => {
    const north = itemsOf(call('GET', OFFERS, {}, `practiceSiteId=${SITE_CM_NORTE_1}`));
    const concepts = north.map((o) => o.serviceConceptId);
    expect(concepts).toContain(PROCEDURE_UPPER_ENDOSCOPY);
    expect(concepts).toContain(PROCEDURE_COLONOSCOPY);
    expect(north.every((o) => o.overMargin === null)).toBe(true);
    expect(north.find((o) => o.serviceConceptId === PROCEDURE_UPPER_ENDOSCOPY)).toMatchObject({
      price: 350,
      referencePrice: 20,
      referenceUnit: 'UMA',
    });
    expect(north.find((o) => o.serviceConceptId === PROCEDURE_COLONOSCOPY)?.visibleInSearch).toBe(false);
  });

  it('POST con serviceCatalogId → visibleInSearch true, con precio y moneda del ítem de catálogo', () => {
    const priced = servicios.agregar({
      id: uuid('catalog-test-sur-a'),
      practiceId: PRACTICE_CM_SUR,
      code: 'TEST-A',
      name: 'Prueba',
      defaultPrice: '420.00',
      currencyConceptId: uuid('concept-currency-bob'),
      currencyCode: 'BOB',
      isActive: true,
    } as never);

    const reply = call('POST', `/practices/${PRACTICE_CM_SUR}/healthcare-services`, {
      practiceSiteId: SITE_CM_SUR_1,
      serviceConceptId: PROCEDURE_UPPER_ENDOSCOPY,
      serviceCatalogId: priced.id,
    }) as MockReply;

    expect(reply.status).toBe(201);
    const created = reply.body as HealthcareServiceOffer;
    expect(created).toMatchObject({
      practiceSiteId: SITE_CM_SUR_1,
      serviceConceptId: PROCEDURE_UPPER_ENDOSCOPY,
      serviceCatalogId: priced.id,
      price: 420,
      visibleInSearch: true,
      active: true,
      overMargin: null,
    });
  });

  it('POST repetido en la misma sede y concepto → 409 con el mensaje de la pantalla', () => {
    const reply = call('POST', `/practices/${PRACTICE_CM_SUR}/healthcare-services`, {
      practiceSiteId: SITE_CM_SUR_1,
      serviceConceptId: PROCEDURE_UPPER_ENDOSCOPY,
      serviceCatalogId: uuid('catalog-test-sur-a'),
    }) as MockReply;

    expect(reply.status).toBe(409);
    expect((reply.body as { message: string }).message).toBe(
      'Este procedimiento ya está publicado en esta sede',
    );
  });

  it('POST con un concepto fuera del nomenclador → 422', () => {
    const reply = call('POST', OFFERS, {
      practiceSiteId: SITE_CM_NORTE_1,
      serviceConceptId: uuid('no-esta-en-el-nomenclador'),
      serviceCatalogId: uuid('catalog-x'),
    }) as MockReply;

    expect(reply.status).toBe(422);
  });

  it('POST sin serviceCatalogId publica igual, pero no aparece en búsquedas', () => {
    const reply = call('POST', `/practices/${PRACTICE_CM_SUR}/healthcare-services`, {
      practiceSiteId: SITE_CM_SUR_1,
      serviceConceptId: PROCEDURE_COLONOSCOPY,
    }) as MockReply;

    expect(reply.status).toBe(201);
    expect(reply.body).toMatchObject({
      serviceCatalogId: null,
      price: null,
      visibleInSearch: false,
      active: true,
    });
  });

  it('POST con una sede ajena a la práctica → 400', () => {
    const ajena = call('POST', OFFERS, {
      practiceSiteId: SITE_CM_SUR_1,
      serviceConceptId: PROCEDURE_UPPER_ENDOSCOPY,
      serviceCatalogId: uuid('catalog-x'),
    }) as MockReply;
    expect(ajena.status).toBe(400);
  });

  it('PATCH { active: false } → active false y visibleInSearch false; reactivar lo devuelve', () => {
    const north = itemsOf(call('GET', OFFERS, {}, `practiceSiteId=${SITE_CM_NORTE_1}`));
    const endoscopy = north.find((o) => o.serviceConceptId === PROCEDURE_UPPER_ENDOSCOPY)!;

    const off = call('PATCH', `${OFFERS}/${endoscopy.id}`, { active: false }) as HealthcareServiceOffer;
    expect(off.active).toBe(false);
    expect(off.visibleInSearch).toBe(false);

    const on = call('PATCH', `${OFFERS}/${endoscopy.id}`, { active: true }) as HealthcareServiceOffer;
    expect(on.active).toBe(true);
    expect(on.visibleInSearch).toBe(true);
  });

  it('PATCH { serviceCatalogId } fija el precio propio y vuelve visible lo que no lo era', () => {
    const north = itemsOf(call('GET', OFFERS, {}, `practiceSiteId=${SITE_CM_NORTE_1}`));
    const colonoscopy = north.find((o) => o.serviceConceptId === PROCEDURE_COLONOSCOPY)!;
    expect(colonoscopy.visibleInSearch).toBe(false);

    const priced = servicios.agregar({
      id: uuid('catalog-test-norte-colon'),
      practiceId: PRACTICE_CM_NORTE,
      code: 'TEST-B',
      name: 'Colonoscopía',
      defaultPrice: '500.00',
      currencyConceptId: uuid('concept-currency-bob'),
      currencyCode: 'BOB',
      isActive: true,
    } as never);

    const updated = call('PATCH', `${OFFERS}/${colonoscopy.id}`, {
      serviceCatalogId: priced.id,
    }) as HealthcareServiceOffer;
    expect(updated).toMatchObject({ price: 500, visibleInSearch: true, serviceCatalogId: priced.id });
  });

  it('PATCH de un id inexistente → 404', () => {
    const reply = call('PATCH', `${OFFERS}/no-existe`, { active: false }) as MockReply;
    expect(reply.status).toBe(404);
  });
});
