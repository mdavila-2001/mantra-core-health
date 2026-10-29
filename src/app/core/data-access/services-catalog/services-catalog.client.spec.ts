import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ServicesCatalogClient } from './services-catalog.client';
import type { ServiceCatalogItem, ServiceCatalogPage } from './services-catalog.types';

const item: ServiceCatalogItem = {
  id: 's1',
  practiceId: 'pr1',
  code: 'CONS-01',
  name: 'Consulta general',
  defaultPrice: '100.00',
  isActive: true,
};

function pageOf(items: ServiceCatalogItem[], nextCursor: string | null = null): ServiceCatalogPage {
  return { items, count: items.length, limit: 50, nextCursor };
}

describe('ServicesCatalogClient', () => {
  let client: ServicesCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ServicesCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista las prácticas', () => {
    let recibidas: readonly { id: string }[] | undefined;
    client.listPractices().subscribe((p) => (recibidas = p));

    const req = http.expectOne((r) => r.url === '/practices');
    expect(req.request.method).toBe('GET');
    // El endpoint responde el array pelado, sin envoltorio de página.
    req.flush([{ id: 'pr1', code: 'P1', name: 'Práctica 1' }]);

    expect(recibidas).toEqual([{ id: 'pr1', code: 'P1', name: 'Práctica 1' }]);
  });

  it('busca el catálogo mandando sólo los parámetros presentes', () => {
    client.search('pr1').subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.get('practiceId')).toBe('pr1');
    expect(req.request.params.keys()).toEqual(['practiceId']);

    req.flush(pageOf([item]));
  });

  it('propaga texto, isActive, cursor y tope como parámetros', () => {
    client.search('pr1', { query: 'consul', isActive: true, cursor: 'abc', limit: 10 }).subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.get('q')).toBe('consul');
    expect(req.request.params.get('isActive')).toBe('true');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush(pageOf([]));
  });

  it('no manda texto vacío', () => {
    client.search('pr1', { query: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.has('q')).toBe(false);

    req.flush(pageOf([]));
  });

  it('crea un servicio nuevo', () => {
    let creado: ServiceCatalogItem | undefined;
    client
      .create({ practiceId: 'pr1', code: 'CONS-01', name: 'Consulta general', defaultPrice: '100.00' })
      .subscribe((res) => (creado = res));

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      practiceId: 'pr1',
      code: 'CONS-01',
      name: 'Consulta general',
      defaultPrice: '100.00',
    });
    req.flush(item);

    expect(creado).toEqual(item);
  });

  describe('arancel: especialidades del médico e import en lote', () => {
    const RUTA = '/billing/service-catalog';

    it('lee las especialidades del arancel que le corresponden al médico', () => {
      let recibidas: readonly { specialty: string; count: number }[] | undefined;
      client.listMyProcedureSpecialties().subscribe((e) => (recibidas = e));

      const req = http.expectOne(`${RUTA}/procedure-specialties/mine`);
      expect(req.request.method).toBe('GET');
      req.flush({ items: [{ specialty: 'Cardiología', count: 120 }] });

      expect(recibidas).toEqual([{ specialty: 'Cardiología', count: 120 }]);
    });

    it('acepta que el médico no tenga ninguna especialidad', () => {
      let recibidas: readonly unknown[] | undefined;
      client.listMyProcedureSpecialties().subscribe((e) => (recibidas = e));

      http.expectOne(`${RUTA}/procedure-specialties/mine`).flush({ items: [] });

      expect(recibidas).toEqual([]);
    });

    it('une varias especialidades con `|` en un solo parámetro', () => {
      client.searchProcedures({ specialties: ['Cardiología', 'Pediatría'], query: 'ecg' }).subscribe();

      const req = http.expectOne((r) => r.url === `${RUTA}/procedures`);
      expect(req.request.params.get('specialty')).toBe('Cardiología|Pediatría');
      expect(req.request.params.get('q')).toBe('ecg');
      req.flush({ items: [], nextCursor: null });
    });

    it('sigue aceptando una sola especialidad y no manda las vacías', () => {
      client.searchProcedures({ specialty: 'Cardiología' }).subscribe();
      const una = http.expectOne((r) => r.url === `${RUTA}/procedures`);
      expect(una.request.params.get('specialty')).toBe('Cardiología');
      una.flush({ items: [], nextCursor: null });

      client.searchProcedures({ specialties: [], specialty: '', query: '' }).subscribe();
      const ninguna = http.expectOne((r) => r.url === `${RUTA}/procedures`);
      expect(ninguna.request.params.keys()).toEqual([]);
      ninguna.flush({ items: [], nextCursor: null });
    });

    it('importa en lote mandando sólo las claves presentes', () => {
      let resultado: unknown;
      client
        .importProcedures({ practiceId: 'pr1', specialties: ['Cardiología', 'Pediatría'] })
        .subscribe((r) => (resultado = r));

      const req = http.expectOne(`${RUTA}/import-procedures`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        practiceId: 'pr1',
        specialties: ['Cardiología', 'Pediatría'],
      });
      expect(Object.keys(req.request.body as object)).toEqual(['practiceId', 'specialties']);
      req.flush({ created: 10, skipped: 2, total: 12 });

      expect(resultado).toEqual({ created: 10, skipped: 2, total: 12 });
    });

    it('omite el texto vacío y las listas vacías del cuerpo del import', () => {
      client
        .importProcedures({ practiceId: 'pr1', specialties: [], codes: [], q: '' })
        .subscribe();

      const req = http.expectOne(`${RUTA}/import-procedures`);
      expect(req.request.body).toEqual({ practiceId: 'pr1' });
      req.flush({ created: 0, skipped: 0, total: 0 });
    });

    it('manda texto y códigos cuando están presentes', () => {
      client
        .importProcedures({ practiceId: 'pr1', codes: ['A-1'], q: 'consulta' })
        .subscribe();

      const req = http.expectOne(`${RUTA}/import-procedures`);
      expect(req.request.body).toEqual({ practiceId: 'pr1', codes: ['A-1'], q: 'consulta' });
      req.flush({ created: 1, skipped: 0, total: 1 });
    });
  });
});
