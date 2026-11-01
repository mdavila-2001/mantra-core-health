import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CatalogEditorClient } from './catalog-editor.client';
import type { AdminServiceItem } from './catalog-editor.types';

describe('CatalogEditorClient', () => {
  let http: HttpTestingController;
  let client: CatalogEditorClient;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(CatalogEditorClient);
  });

  afterEach(() => http.verify());

  it('lista servicios sin mandar claves vacías (la API rechaza las no declaradas)', () => {
    client.listServices({ practiceTypeConceptId: 'tipo-1', q: '', isActive: false }).subscribe();
    const req = http.expectOne((r) => r.url === '/admin/catalogs/services');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('practiceTypeConceptId')).toBe('tipo-1');
    expect(req.request.params.get('isActive')).toBe('false');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  it('entrega el precio como cadena, sin convertirlo a número', () => {
    let recibido: AdminServiceItem | undefined;
    client.getService('s-1').subscribe((s) => (recibido = s));
    http.expectOne('/admin/catalogs/services/s-1').flush({
      id: 's-1',
      practiceId: 'p-1',
      practiceTypeConceptId: 't-1',
      code: 'CONS-1',
      name: 'Consulta',
      defaultPrice: '9007199254740993.10',
      isActive: true,
      rowVersion: 3,
      updatedAt: '2026-10-31T10:00:00.000Z',
    });
    expect(recibido!.defaultPrice).toBe('9007199254740993.10');
    expect(typeof recibido!.defaultPrice).toBe('string');
  });

  it('crea con POST y edita con PATCH mandando expectedRowVersion', () => {
    client.createService({ practiceId: 'p-1', code: 'X', name: 'Y', defaultPrice: '10.00' }).subscribe();
    const alta = http.expectOne('/admin/catalogs/services');
    expect(alta.request.method).toBe('POST');
    expect(alta.request.body).toEqual({ practiceId: 'p-1', code: 'X', name: 'Y', defaultPrice: '10.00' });
    alta.flush({});

    client.updateService('s-1', { expectedRowVersion: 2, name: 'Nuevo' }).subscribe();
    const edicion = http.expectOne('/admin/catalogs/services/s-1');
    expect(edicion.request.method).toBe('PATCH');
    expect(edicion.request.body).toEqual({ expectedRowVersion: 2, name: 'Nuevo' });
    edicion.flush({});
  });

  it('desactiva y reactiva con POST (no existe DELETE)', () => {
    client.deactivateService('s-1', 4).subscribe();
    const baja = http.expectOne('/admin/catalogs/services/s-1/deactivate');
    expect(baja.request.method).toBe('POST');
    expect(baja.request.body).toEqual({ expectedRowVersion: 4 });
    baja.flush({});

    client.reactivateService('s-1', 5).subscribe();
    const alta = http.expectOne('/admin/catalogs/services/s-1/reactivate');
    expect(alta.request.body).toEqual({ expectedRowVersion: 5 });
    alta.flush({});
  });

  it('el glosario exige la audiencia al listar y al leer un término', () => {
    client.listGlossary({ audience: 'patient', state: 'active', q: 'ac' }).subscribe();
    const lista = http.expectOne((r) => r.url === '/admin/catalogs/glossary');
    expect(lista.request.params.get('audience')).toBe('patient');
    expect(lista.request.params.get('state')).toBe('active');
    lista.flush({ items: [], count: 0, limit: 50, nextCursor: null });

    client.getGlossaryTerm('c-1', 'professional').subscribe();
    const uno = http.expectOne((r) => r.url === '/admin/catalogs/glossary/c-1');
    expect(uno.request.params.get('audience')).toBe('professional');
    uno.flush({});
  });

  it('desactivar un término manda versión y audiencia', () => {
    client.deactivateGlossaryTerm('c-1', { expectedRowVersion: 2, audience: 'patient' }).subscribe();
    const req = http.expectOne('/admin/catalogs/glossary/c-1/deactivate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ expectedRowVersion: 2, audience: 'patient' });
    req.flush({});
  });

  it('codifica el identificador en la ruta', () => {
    client.getService('a/b').subscribe();
    http.expectOne('/admin/catalogs/services/a%2Fb').flush({});
  });
});
