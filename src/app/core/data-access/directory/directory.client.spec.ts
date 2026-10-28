import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DirectoryClient } from './directory.client';
import type { MyOrganization, TenantCreated, TenantListItem } from './directory.types';

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

  it('listMyOrganizations lee la carpeta legal: fechas sin hora y sin los null del transporte', () => {
    let organizaciones: readonly MyOrganization[] = [];
    client.listMyOrganizations().subscribe((items) => (organizaciones = items));

    http
      .expectOne((r) => r.url === '/tenants/me')
      .flush({
        items: [
          {
            id: 't-1',
            code: 'ERBOL',
            legalName: 'ERBOL SRL',
            tenantTypeConceptId: 'c-lab',
            statusConceptId: 'c-activo',
            verificationStatusConceptId: 'c-verificada',
            createdAt: '2026-05-02T14:00:00.000Z',
            myRoleConceptId: 'c-owner',
            canAdminister: true,
            isVerified: true,
            legalEntityType: 'SRL',
            taxIdentifier: '1023456029',
            legalDocuments: [
              {
                role: 'TAX_IDENTIFIER_DOC',
                verificationStatus: 'VERIFICADO',
                documentNumber: '1023456029',
                // Una columna sin hora que el servidor serializa como instante UTC:
                // al oeste de Greenwich no puede retroceder al 1 de mayo.
                registeredAt: '2026-05-02T00:00:00.000Z',
                validTo: null,
              },
              { role: 'CONSTITUTION_DOC', verificationStatus: 'PENDIENTE', documentNumber: null },
            ],
          },
        ],
      });

    const [org] = organizaciones;
    expect(org?.legalEntityType).toBe('SRL');
    expect(org?.taxIdentifier).toBe('1023456029');
    const [nit, constitucion] = org?.legalDocuments ?? [];
    expect(nit?.registeredAt?.getFullYear()).toBe(2026);
    expect(nit?.registeredAt?.getMonth()).toBe(4);
    expect(nit?.registeredAt?.getDate()).toBe(2);
    expect(nit && 'validTo' in nit).toBe(false);
    expect(constitucion && 'documentNumber' in constitucion).toBe(false);
    expect(constitucion && 'registeredAt' in constitucion).toBe(false);
  });

  it('verifyTenant declara como organización la que se verifica, no la activa (A2)', () => {
    client.verifyTenant('t-verificar').subscribe();

    const req = http.expectOne('/admin/tenants/t-verificar/verification');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('X-Tenant-Id')).toBe('t-verificar');
    req.flush({
      id: 't-verificar',
      code: 'FARM-1',
      legalName: 'Farmacia',
      status: 'c-activo',
      verificationStatus: 'c-verificada',
      parentTenantId: null,
      createdAt: '2026-10-26T10:00:00.000Z',
    });
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
