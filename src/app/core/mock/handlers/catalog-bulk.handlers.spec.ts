import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { BulkResponse } from '../../data-access/pharmacy/pharmacy-bulk.types';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarCargaMasivaDeCatalogo } from './catalog-bulk.handlers';
import { registrarFarmacia } from './pharmacy.handlers';

describe('simulated pharmacy catalog bulk load', () => {
  const router = new MockRouter();
  registrarFarmacia(router);
  registrarCargaMasivaDeCatalogo(router);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the simulator's replies are untyped on purpose
  function ask(method: MockMethod, ruta: string, body: unknown = null, user = 'admin'): any {
    const [path, qs = ''] = ruta.split('?');
    const match = router.match(method, path!)!;
    return match.handler({ method, path: path!, params: match.params, query: new URLSearchParams(qs), body, headers: new HttpHeaders(), user: buscarUsuario(user as never) ?? null });
  }
  const pharmacyId: string = ask('GET', '/pharmacy/pharmacies').items[0].id;
  const bulk = (kind: string, body: object, user?: string) => ask('POST', `/pharmacies/${pharmacyId}/${kind}/bulk`, body, user);
  const names = (): string[] => ask('GET', `/pharmacies/${pharmacyId}/categories`).items.map((c: { name: string }) => c.name);

  it('dryRun writes nothing; the real load persists and a re-run is UNCHANGED', () => {
    const rows = [{ name: 'Carga Prueba Uno' }, { name: 'carga prueba uno' }, { name: 'Carga Prueba Dos' }];
    const preview = bulk('categories', { mode: 'UPSERT', dryRun: true, rows }) as BulkResponse;
    expect(preview.dryRun).toBe(true);
    expect(preview.results.map((r) => r.outcome)).toEqual(['CREATED', 'REJECTED', 'CREATED']);
    expect(preview.results[1]!.errors![0]!.reason).toBe('DUPLICATE_IN_FILE');
    expect(names()).not.toContain('Carga Prueba Uno');

    const real = bulk('categories', { mode: 'UPSERT', rows }) as BulkResponse;
    expect(real.results.map((r) => r.outcome)).toEqual(['CREATED', 'REJECTED', 'CREATED']);
    expect(names()).toEqual(expect.arrayContaining(['Carga Prueba Uno', 'Carga Prueba Dos']));

    const again = bulk('categories', { mode: 'UPSERT', rows: [{ name: 'Carga Prueba Uno' }, { name: 'CARGA PRUEBA DOS' }] }) as BulkResponse;
    expect(again.results.map((r) => r.outcome)).toEqual(['UNCHANGED', 'UPDATED']);
    expect(bulk('categories', { mode: 'CREATE', rows: [{ name: 'carga prueba uno' }] }).results[0].errors[0].reason).toBe('ALREADY_EXISTS');
    expect(bulk('categories', { mode: 'UPDATE', rows: [{ name: 'No existe' }] }).results[0].errors[0].reason).toBe('NOT_FOUND');
  });

  it('prices update a product by productCode and reject unknown codes or bad amounts', () => {
    const code = ask('GET', `/pharmacy/products?pharmacyId=${pharmacyId}&managed=true`).items[0].productCode as string;
    const res = bulk('prices', { mode: 'UPSERT', rows: [{ productCode: code, unitPrice: '12.34' }, { productCode: 'NO-EXISTE', unitPrice: 1 }, { productCode: code, unitPrice: 1 }] }) as BulkResponse;
    expect(res.results.map((r) => r.outcome)).toEqual(['UPDATED', 'REJECTED', 'REJECTED']);
    const stored = ask('GET', `/pharmacy/products?pharmacyId=${pharmacyId}&managed=true`).items.find((p: { productCode: string }) => p.productCode === code);
    expect(Number(stored.unitPrice)).toBe(12.34);
  });

  it('refuses callers without a write role and a malformed body', () => {
    expect((bulk('categories', { mode: 'UPSERT', rows: [{ name: 'x' }] }, 'patient') as MockReply).status).toBe(403);
    expect((bulk('categories', { mode: 'MERGE', rows: [{ name: 'x' }] }) as MockReply).status).toBe(400);
    expect((bulk('categories', { mode: 'UPSERT', rows: [] }) as MockReply).status).toBe(400);
    expect((bulk('categories', { mode: 'UPSERT', dryRun: 'true', rows: [{ name: 'x' }] }) as MockReply).status).toBe(400);
  });

  it('sites are kept by code and reported as created, then unchanged', () => {
    const row = { code: 'SUC-1', name: 'Sucursal Uno' };
    expect(bulk('sites', { mode: 'CREATE', rows: [row] }).results[0].outcome).toBe('CREATED');
    expect(bulk('sites', { mode: 'UPSERT', rows: [row] }).results[0].outcome).toBe('UNCHANGED');
  });
});
