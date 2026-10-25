import { describe, expect, it } from 'vitest';

import {
  AUDIT_URL_KEYS,
  actionHeadline,
  businessAction,
  dataAccessQuery,
  hasFilters,
  logQuery,
  viewOf,
  type AuditUrlValues,
} from './audit.model';

const blank = Object.fromEntries(AUDIT_URL_KEYS.map((k) => [k, ''])) as Record<keyof AuditUrlValues, string>;
const values = (over: Partial<AuditUrlValues>): AuditUrlValues => ({ ...blank, ...over });
const USER = '00000000-0000-4000-8000-000000000001';

describe('audit.model', () => {
  it('la vista por omisión es la bitácora; sólo `data-access` cambia de pestaña', () => {
    expect(viewOf(values({}))).toBe('log');
    expect(viewOf(values({ view: 'data-access' }))).toBe('data-access');
    expect(viewOf(values({ view: 'otra' }))).toBe('log');
  });

  it('manda los filtros válidos con los nombres de la API', () => {
    expect(
      logQuery(values({ userId: USER, result: 'FAILURE', method: 'DELETE', action: ' ROLE_ASSIGNED ', entity: 'role' })),
    ).toEqual({ userId: USER, result: 'FAILURE', method: 'DELETE', action: 'ROLE_ASSIGNED', entity: 'role' });
  });

  it('descarta lo que la API rechazaría con 400 en vez de mandarlo', () => {
    expect(
      logQuery(values({ userId: 'no-es-uuid', result: 'MAYBE', method: 'GET', from: '24/10/2026', action: 'x'.repeat(201) })),
    ).toEqual({});
    expect(dataAccessQuery(values({ operation: 'PEEK', resourceType: '   ' }))).toEqual({});
  });

  it('«hasta» es el último día incluido: a la API va el día siguiente, que ella toma como excluido', () => {
    expect(logQuery(values({ from: '2026-10-01', to: '2026-10-24' }))).toEqual({
      from: '2026-10-01',
      to: '2026-10-25',
    });
    expect(logQuery(values({ to: '2026-12-31' })).to).toBe('2027-01-01');
  });

  it('cada vista sólo mira sus filtros para decidir qué vacío mostrar', () => {
    expect(hasFilters(values({ result: 'SUCCESS' }))).toBe(true);
    // `result` no es filtro de los accesos a datos sensibles.
    expect(hasFilters(values({ view: 'data-access', result: 'SUCCESS' }))).toBe(false);
    expect(hasFilters(values({ view: 'data-access', operation: 'EXPORT' }))).toBe(true);
    expect(hasFilters(values({}))).toBe(false);
  });

  it('la acción se lee por su ruta; el código de negocio sólo se agrega si no repite la ruta', () => {
    const business = { route: '/authz/roles', action: 'ROLE_CREATED' };
    const http = { route: '/admin/catalog/scans', action: 'HTTP POST /admin/catalog/scans' };
    const unknown = { route: null, action: 'CATALOG_REVIEW_DECIDED' };
    expect(actionHeadline(business)).toBe('/authz/roles');
    expect(businessAction(business)).toBe('ROLE_CREATED');
    expect(businessAction(http)).toBeNull();
    expect(actionHeadline(unknown)).toBe('CATALOG_REVIEW_DECIDED');
    expect(businessAction(unknown)).toBeNull();
  });
});
