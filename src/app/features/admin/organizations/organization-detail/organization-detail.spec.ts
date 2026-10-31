import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, throwError, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  BranchListItem,
  NewBranch,
} from '../../../../core/data-access/directory/directory.types';
import { IamClient } from '../../../../core/data-access/iam/iam.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import { OrganizationDetail } from './organization-detail';

/**
 * La ficha de organización contra `GET /tenants/{id}` y sus tres listas.
 *
 * Fijan lo que la auditoría encontró roto: los nueve estados (antes todo lo
 * que no era `ready` o `error` quedaba en «Cargando…» para siempre), las altas
 * arriba y no sólo en el vacío, el cursor de plantilla y sub-organizaciones,
 * la persona por su nombre y la asignación de sede releída tras guardar.
 */
const TENANT = 't-1';
const BASE = `/tenants/${TENANT}`;

const FICHA = {
  id: TENANT,
  code: 'OLIVOS',
  legalName: 'Clínica Los Olivos S.R.L.',
  tradeName: 'Clínica Los Olivos',
  tenantTypeConceptId: 'c-tipo',
  statusConceptId: 'c-estado',
  verificationStatusConceptId: 'c-verif',
  parentTenantId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SUCURSAL = {
  id: 'b-1',
  code: 'CENTRAL',
  name: 'Sede Central',
  branchTypeConceptId: 'c-clinica',
  statusConceptId: 'c-activa',
  timeZone: 'America/La_Paz',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MEMBRESIA = {
  id: 'm-1',
  userId: 'u-ana',
  tenantRoleConceptId: 'c-staff',
  statusConceptId: 'c-activa',
  accessScopeConceptId: 'c-branch',
  primaryBranchId: null,
  startDate: null,
  endDate: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

function pagina(items: unknown[], nextCursor: string | null = null) {
  return { items, count: items.length, limit: 25, nextCursor };
}

describe('OrganizationDetail', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function abrir(roles: readonly string[], url = `/administration/organizations/${TENANT}`) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/organizations/:tenantId', component: OrganizationDetail },
          { path: '**', children: [] },
        ]),
      ],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-sesion', name: 'Sesión Actual', roles, tenants: [TENANT] }),
      refreshToken: 'r',
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, OrganizationDetail);
  }

  afterEach(() => http.verify());

  function texto(): string {
    return (harness.routeNativeElement as HTMLElement).textContent ?? '';
  }

  function raiz(): HTMLElement {
    return harness.routeNativeElement as HTMLElement;
  }

  /** Responde las cuatro lecturas iniciales con lo que el caso necesita. */
  function responder(opciones: {
    ficha?: unknown;
    fichaError?: { status: number; body: object | null; headers?: Record<string, string> };
    sucursales?: unknown[];
    membresias?: { items: unknown[]; next?: string | null };
    hijas?: unknown[];
  }): void {
    const ficha = http.expectOne(BASE);
    if (opciones.fichaError) {
      ficha.flush(opciones.fichaError.body, {
        status: opciones.fichaError.status,
        statusText: 'x',
        headers: opciones.fichaError.headers ?? {},
      });
    } else {
      ficha.flush(opciones.ficha ?? FICHA);
    }
    const sucursales = opciones.sucursales ?? [];
    http.expectOne(`${BASE}/branches`).flush({ items: sucursales, count: sucursales.length });
    http
      .expectOne((r) => r.url === `${BASE}/memberships`)
      .flush(pagina(opciones.membresias?.items ?? [], opciones.membresias?.next ?? null));
    http.expectOne((r) => r.url === `${BASE}/child-tenants`).flush(pagina(opciones.hijas ?? []));
    for (const req of http.match((r) => r.url === '/terminology/concepts')) {
      req.flush({ items: [], count: 0, limit: 50 });
    }
    harness.detectChanges();
  }

  describe('los nueve estados de la organización', () => {
    it('S5: un 403 dice «no tenés acceso» y no queda cargando', async () => {
      await abrir(['SECURITY_ADMIN']);
      responder({
        fichaError: {
          status: 403,
          body: { statusCode: 403, code: 'FORBIDDEN', message: 'No pertenecés a esta organización' },
        },
      });

      expect(texto()).toContain('No tiene acceso a esta sección');
      expect(texto()).not.toContain('Cargando');
      expect(raiz().querySelector('app-tabs')).toBeNull();
    });

    it('S6: un 404 no muestra ningún dato y ofrece volver al listado', async () => {
      await abrir(['SECURITY_ADMIN']);
      responder({
        fichaError: {
          status: 404,
          body: { statusCode: 404, code: 'NOT_FOUND', message: 'Organización no encontrada' },
        },
      });

      expect(texto()).toContain('No encontramos lo que busca');
      expect(texto()).not.toContain('Organización no encontrada');
      expect(raiz().querySelector('app-tabs')).toBeNull();
      const volver = [...raiz().querySelectorAll('a')].find((a) =>
        a.textContent?.includes('Volver al listado'),
      );
      expect(volver?.getAttribute('href')).toBe('/administration/organizations');
    });

    it('S9: un 500 muestra el código de soporte', async () => {
      await abrir(['SECURITY_ADMIN']);
      responder({
        fichaError: { status: 500, body: null, headers: { 'x-request-id': 'req-9f2' } },
      });

      expect(texto()).toContain('Algo salió mal');
      expect(texto()).toContain('req-9f2');
    });

    it('S8: sin conexión ofrece reintentar, y reintentar vuelve a pedir', async () => {
      await abrir(['SECURITY_ADMIN']);
      http.expectOne(BASE).error(new ProgressEvent('error'), { status: 0 });
      http.expectOne(`${BASE}/branches`).flush({ items: [], count: 0 });
      http.expectOne((r) => r.url === `${BASE}/memberships`).flush(pagina([]));
      http.expectOne((r) => r.url === `${BASE}/child-tenants`).flush(pagina([]));
      harness.detectChanges();

      expect(texto()).toContain('Sin conexión');
      const reintentar = [...raiz().querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Reintentar'),
      );
      reintentar?.click();
      responder({});
      expect(texto()).toContain('Clínica Los Olivos S.R.L.');
    });

    it('S3: el vacío de un miembro sin permiso no enlaza a un alta que le darían 403', async () => {
      await abrir(['USER']);
      responder({});
      http.expectOne('/tenants/me').flush({ items: [] });
      harness.detectChanges();

      expect(texto()).toContain('Pídaselo a quien administra la organización');
      expect(raiz().querySelector('[data-testid="ficha-nueva-sucursal"]')).toBeNull();
    });
  });

  describe('acciones de la cabecera', () => {
    it('la plataforma ve las tres altas aunque las listas tengan filas', async () => {
      await abrir(['SECURITY_ADMIN']);
      responder({ sucursales: [SUCURSAL], membresias: { items: [MEMBRESIA] }, hijas: [FICHA] });
      http.expectOne('/iam/users/u-ana').flush({
        id: 'u-ana',
        displayName: 'Ana Rojas',
        statusConceptId: 'c',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      harness.detectChanges();

      expect(raiz().querySelector('[data-testid="ficha-nueva-sucursal"]')?.getAttribute('href')).toBe(
        `/administration/organizations/${TENANT}/branches/new`,
      );
      expect(raiz().querySelector('[data-testid="ficha-sumar-persona"]')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="ficha-nueva-hija"]')).not.toBeNull();
    });

    it('un ADMIN de la organización (canAdminister) ve sucursal y plantilla, no sub-organización', async () => {
      await abrir(['USER']);
      responder({});
      http.expectOne('/tenants/me').flush({
        items: [
          {
            ...FICHA,
            myRoleConceptId: 'c-admin',
            canAdminister: true,
            isVerified: true,
          },
        ],
      });
      harness.detectChanges();

      expect(raiz().querySelector('[data-testid="ficha-nueva-sucursal"]')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="ficha-sumar-persona"]')).not.toBeNull();
      expect(raiz().querySelector('[data-testid="ficha-nueva-hija"]')).toBeNull();
      expect(texto()).not.toContain('Volver al listado');
    });
  });

  describe('plantilla', () => {
    it('pagina por cursor: «Siguiente» pide la página con el cursor de la API', async () => {
      await abrir(['SECURITY_ADMIN'], `/administration/organizations/${TENANT}?tab=plantilla`);
      responder({ membresias: { items: [MEMBRESIA], next: 'cur-2' } });
      http.expectOne('/iam/users/u-ana').flush({
        id: 'u-ana',
        displayName: 'Ana Rojas',
        statusConceptId: 'c',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      harness.detectChanges();

      const siguiente = [...raiz().querySelectorAll('[data-testid="ficha-plantilla"] button')].find(
        (b) => b.textContent?.includes('Siguiente'),
      ) as HTMLButtonElement | undefined;
      expect(siguiente).toBeDefined();
      siguiente?.click();

      const req = http.expectOne((r) => r.url === `${BASE}/memberships`);
      expect(req.request.params.get('cursor')).toBe('cur-2');
      expect(req.request.params.get('limit')).toBe('25');
      req.flush(pagina([], null));
    });

    it('muestra a la persona por su nombre y nunca el uuid', async () => {
      await abrir(['SECURITY_ADMIN'], `/administration/organizations/${TENANT}?tab=plantilla`);
      responder({ membresias: { items: [MEMBRESIA, { ...MEMBRESIA, id: 'm-2', userId: 'u-sesion' }] } });
      http.expectOne('/iam/users/u-ana').flush({
        id: 'u-ana',
        displayName: 'Ana Rojas',
        statusConceptId: 'c',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      harness.detectChanges();

      expect(texto()).toContain('Ana Rojas');
      // La propia sesión se reconoce sin preguntarle a la API.
      expect(texto()).toContain('Sesión Actual');
      expect(texto()).not.toContain('u-ana');
    });

    it('sin SECURITY_ADMIN no pide fichas de cuenta que darían 403: dice «no disponible»', async () => {
      await abrir(['USER'], `/administration/organizations/${TENANT}?tab=plantilla`);
      responder({ membresias: { items: [MEMBRESIA] } });
      http.expectOne('/tenants/me').flush({ items: [] });
      harness.detectChanges();

      http.expectNone('/iam/users/u-ana');
      expect(texto()).toContain('Nombre no disponible');
    });

    it('asigna una sede desde la ficha y la confirma releyendo (UI → POST → GET → UI)', async () => {
      await abrir(['SECURITY_ADMIN'], `/administration/organizations/${TENANT}?tab=plantilla`);
      responder({ sucursales: [SUCURSAL], membresias: { items: [MEMBRESIA] } });
      http.expectOne('/iam/users/u-ana').flush({
        id: 'u-ana',
        displayName: 'Ana Rojas',
        statusConceptId: 'c',
        emailVerified: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      harness.detectChanges();

      raiz().querySelector<HTMLButtonElement>('[data-testid="ficha-asignar-sede"]')?.click();
      harness.detectChanges();
      const lectura = `${BASE}/memberships/m-1/branch-assignments`;
      http.expectOne(lectura).flush({ items: [], count: 0 });
      harness.detectChanges();

      const dialogo = harness.fixture.debugElement.query(
        (el) => el.name === 'app-branch-assignment-dialog',
      );
      const instancia = dialogo.componentInstance as Record<string, unknown>;
      (instancia['elegir'] as (v: string) => void).call(instancia, 'b-1');
      (instancia['asignar'] as () => void).call(instancia);

      const alta = http.expectOne((r) => r.url === lectura && r.method === 'POST');
      expect(alta.request.body).toEqual({ branchId: 'b-1' });
      expect(alta.request.headers.get('X-Tenant-Id')).toBe(TENANT);
      alta.flush({ id: 'a-1', branchId: 'b-1', statusConceptId: 'c', createdAt: '2026-01-01T00:00:00.000Z' });

      // La prueba de persistencia es la relectura, no el 201.
      http.expectOne((r) => r.url === lectura && r.method === 'GET').flush({
        items: [{ id: 'a-1', branchId: 'b-1', statusConceptId: 'c', createdAt: '2026-01-01T00:00:00.000Z' }],
        count: 1,
      });
      harness.detectChanges();

      expect(texto()).toContain('Sede Central ya figura entre sus sedes');
    });
  });
});

/**
 * La ficha de la organización, en lo que suma la carga masiva: las sucursales
 * del archivo se crean de a una, en orden, con código derivado cuando falta, y
 * una que la API rechaza no frena a las demás.
 */
const TENANT_LOTE = 'tenant-1';

const EXISTENTE: BranchListItem = {
  id: 'b-0',
  code: 'NORTE',
  name: 'Norte',
  statusConceptId: 'st',
  createdAt: new Date('2026-01-01'),
};

function borrador(parcial: Partial<BranchDraft>): BranchDraft {
  return {
    name: 'Sucursal',
    description: '',
    locationUrl: '',
    address: '',
    code: '',
    coordinates: null,
    ...parcial,
  };
}

interface Internal {
  crearSucursalesEnLote: (lote: readonly BranchDraft[]) => void;
  rechazosDelLote: () => readonly { nombre: string; motivo: string }[];
  nombresDeSucursales: () => readonly string[];
}

describe('OrganizationDetail · sucursales en lote', () => {
  let fixture: ComponentFixture<OrganizationDetail>;
  let enviadas: NewBranch[];
  let respuesta: (branch: NewBranch) => Observable<BranchListItem>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    enviadas = [];
    respuesta = (branch) =>
      of({ ...EXISTENTE, id: `b-${enviadas.length}`, code: branch.code, name: branch.name });

    const directory = {
      getTenant: () =>
        of({
          id: TENANT_LOTE,
          code: 'CLI',
          legalName: 'Clínica',
          tenantTypeConceptId: 't',
          statusConceptId: 's',
          verificationStatusConceptId: 'v',
          createdAt: new Date('2026-01-01'),
        }),
      listBranches: () => of({ items: [EXISTENTE], count: 1 }),
      listMemberships: () => of({ items: [], count: 0, limit: 25, nextCursor: null }),
      listChildTenants: () => of({ items: [], count: 0, limit: 25, nextCursor: null }),
      // La ficha pregunta `canAdminister` a quien no es de la plataforma.
      listMyOrganizations: () => of([]),
      createBranch: vi.fn((_tenant: string, branch: NewBranch) => {
        enviadas.push(branch);
        return respuesta(branch);
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DirectoryClient, useValue: directory },
        { provide: TerminologyClient, useValue: { readConceptLabels: () => of(new Map()) } },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: IamClient, useValue: { getUser: vi.fn() } },
        {
          provide: SessionStore,
          useValue: { roles: signal([]), userId: signal(null), displayName: signal(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ tenantId: TENANT_LOTE })),
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(OrganizationDetail);
    fixture.detectChanges();
  });

  it('conoce los nombres ya cargados, para que el archivo no los repita', () => {
    expect(internal().nombresDeSucursales()).toEqual(['Norte']);
  });

  it('crea cada fila en orden, deriva el código que falta sin chocar y manda el punto y el enlace', () => {
    internal().crearSucursalesEnLote([
      borrador({
        name: 'Norte Dos',
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.76,-63.19',
        coordinates: { latitude: -17.76, longitude: -63.19 },
      }),
      borrador({ name: 'norte', code: '' }),
      borrador({ name: 'Sur', code: 'S-01' }),
    ]);

    expect(enviadas).toEqual([
      {
        code: 'NORTE-DOS',
        name: 'Norte Dos',
        latitude: -17.76,
        longitude: -63.19,
        description: 'Planta baja',
        locationUrl: 'https://www.google.com/maps?q=-17.76,-63.19',
      },
      // «NORTE» ya es el código de la sucursal existente.
      { code: 'NORTE-2', name: 'norte' },
      { code: 'S-01', name: 'Sur' },
    ]);
    expect(internal().rechazosDelLote()).toEqual([]);
  });

  it('una rechazada por la API no frena a las demás y queda dicha con su motivo', () => {
    respuesta = (branch) =>
      branch.code === 'DUP'
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: {
                  statusCode: 409,
                  code: 'CONFLICT',
                  message: 'Ya existe una branch con ese código en el tenant',
                },
              }),
          )
        : of({ ...EXISTENTE, code: branch.code, name: branch.name });

    internal().crearSucursalesEnLote([
      borrador({ name: 'Repetida', code: 'DUP' }),
      borrador({ name: 'Buena' }),
    ]);

    expect(enviadas.map((b) => b.name)).toEqual(['Repetida', 'Buena']);
    const rechazos = internal().rechazosDelLote();
    expect(rechazos).toHaveLength(1);
    expect(rechazos[0]!.nombre).toBe('Repetida');
    expect(rechazos[0]!.motivo).toBe('Ya existe una branch con ese código en el tenant');
  });
});
