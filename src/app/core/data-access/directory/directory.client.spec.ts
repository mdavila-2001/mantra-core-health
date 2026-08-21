import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DirectoryClient } from './directory.client';
import type { TenantCreated, TenantListItem } from './directory.types';

describe('DirectoryClient', () => {
  let client: DirectoryClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(DirectoryClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * El backend valida con `forbidNonWhitelisted`: un opcional presente en
   * `undefined` viaja como clave declarada y la petición vuelve con 400.
   */
  it('searchTenants sin filtros no declara ninguna clave', () => {
    client.searchTenants().subscribe();

    const req = http.expectOne((r) => r.url === '/admin/tenants');
    expect(req.request.params.keys()).toEqual([]);

    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  it('searchTenants traduce query a q y statusConceptId a status', () => {
    client.searchTenants({ query: 'farmacia', statusConceptId: 'c-activo', limit: 25 }).subscribe();

    const req = http.expectOne((r) => r.url === '/admin/tenants');
    expect(req.request.params.get('q')).toBe('farmacia');
    expect(req.request.params.get('status')).toBe('c-activo');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  it('searchTenants convierte la fecha y quita los null del transporte', () => {
    let filas: readonly TenantListItem[] = [];
    client.searchTenants().subscribe((pagina) => (filas = pagina.items));

    http
      .expectOne((r) => r.url === '/admin/tenants')
      .flush({
        items: [
          {
            id: 't-1',
            code: 'FARMACIA-SUR',
            legalName: 'Farmacia del Sur S.R.L.',
            tradeName: null,
            tenantTypeConceptId: 'c-farmacia',
            statusConceptId: 'c-pendiente',
            verificationStatusConceptId: 'c-sin-verificar',
            parentTenantId: null,
            createdAt: '2026-08-09T12:00:00.000Z',
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });

    expect(filas[0].createdAt).toBeInstanceOf(Date);
    expect('tradeName' in filas[0]).toBe(false);
    expect('parentTenantId' in filas[0]).toBe(false);
  });

  it('createTenant no manda las claves opcionales ausentes', () => {
    client
      .createTenant({
        code: 'CLINICA-NORTE',
        legalName: 'Clínica Norte S.A.',
        ownerUserId: 'u-1',
        tenantType: 'HOSPITAL',
      })
      .subscribe();

    const req = http.expectOne('/admin/tenants');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body as object)).toEqual([
      'code',
      'legalName',
      'ownerUserId',
      'tenantType',
    ]);

    req.flush({
      id: 't-2',
      code: 'CLINICA-NORTE',
      legalName: 'Clínica Norte S.A.',
      status: 'c-pendiente',
      verificationStatus: 'c-sin-verificar',
      createdAt: '2026-08-09T12:00:00.000Z',
    });
  });

  /**
   * La respuesta del alta llama `status` a un concept id. El cliente lo
   * renombra para que ninguna pantalla lo confunda con una etiqueta.
   */
  it('createTenant renombra los concept ids y convierte la fecha', () => {
    let creado: TenantCreated | undefined;
    client
      .createTenant({
        code: 'ASEG-ANDINA',
        legalName: 'Aseguradora Andina S.A.',
        ownerUserId: 'u-2',
        tenantType: 'PAYER',
        payer: {
          carrierCode: 'ANDINA',
          regulatorIdentifier: 'APS-123',
          sigla: 'AND',
          address: 'Av. Siempre Viva 123',
        },
      })
      .subscribe((tenant) => (creado = tenant));

    const req = http.expectOne('/admin/tenants');
    expect(req.request.body).toEqual(
      expect.objectContaining({
        payer: {
          carrierCode: 'ANDINA',
          regulatorIdentifier: 'APS-123',
          sigla: 'AND',
          address: 'Av. Siempre Viva 123',
        },
      }),
    );

    req.flush({
      id: 't-3',
      code: 'ASEG-ANDINA',
      legalName: 'Aseguradora Andina S.A.',
      status: 'c-pendiente',
      verificationStatus: 'c-sin-verificar',
      createdAt: '2026-08-09T12:00:00.000Z',
    });

    expect(creado?.statusConceptId).toBe('c-pendiente');
    expect(creado?.verificationStatusConceptId).toBe('c-sin-verificar');
    expect(creado?.createdAt).toBeInstanceOf(Date);
    expect(creado !== undefined && 'parentTenantId' in creado).toBe(false);
  });
});
