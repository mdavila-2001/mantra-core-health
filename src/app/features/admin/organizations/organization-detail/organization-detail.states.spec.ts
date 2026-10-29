import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { AuthzAdminClient } from '../../../../core/data-access/authz-admin/authz-admin.client';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  MembershipListItem,
  MembershipPage,
  TenantListItem,
  TenantPage,
} from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { OrganizationDetail } from './organization-detail';

/**
 * LA FICHA DE LA ORGANIZACIÓN, EN SUS NUEVE ESTADOS Y SU PAGINACIÓN.
 *
 * Los defectos que cierra, tal cual se vieron: un 403, un 404 o un corte de
 * red dejaban la cabecera en «Cargando…» para siempre (el `@switch` sólo
 * conocía listo y error); la plantilla y las sub-organizaciones se leían una
 * sola vez, con tope de 25, sin forma de ver el resto; y la fila de la
 * plantilla no mostraba a la persona.
 */
const TENANT = 'tenant-1';

const FICHA: TenantListItem = {
  id: TENANT,
  code: 'CLI',
  legalName: 'Clínica Los Olivos',
  tenantTypeConceptId: 't',
  statusConceptId: 's',
  verificationStatusConceptId: 'v',
  createdAt: new Date('2026-01-01'),
};

function http(status: number, code: string, correlationId?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { statusCode: status, code, message: 'detalle', ...(correlationId ? { correlationId } : {}) },
  });
}

const sinRed = new HttpErrorResponse({ status: 0 });

function miembro(n: number): MembershipListItem {
  return {
    id: `m-${n}`,
    userId: `user-${String(n).padStart(8, '0')}`,
    tenantRoleConceptId: 'rol',
    statusConceptId: 'st',
    createdAt: new Date('2026-01-01'),
  };
}

function paginaDeMiembros(desde: number, cuantos: number, nextCursor: string | null): MembershipPage {
  return {
    items: Array.from({ length: cuantos }, (_, i) => miembro(desde + i)),
    count: cuantos,
    limit: 25,
    nextCursor,
  };
}

const PAGINA_VACIA: TenantPage = { items: [], count: 0, limit: 25, nextCursor: null };

interface Interno {
  organizacion: () => { status: string; requestId?: string };
  recargar: () => void;
  moverPlantilla: (cursor: string) => void;
  moverHijas: (cursor: string) => void;
  cursorDePlantilla: () => { prevCursor?: string | null; nextCursor?: string | null };
  cursorDeHijas: () => { prevCursor?: string | null; nextCursor?: string | null };
  membresias: () => { status: string };
  hijas: () => { status: string };
  nombreDe: (userId: string) => string | undefined;
  pestana: { set: (i: number) => void };
  accionPrincipal: () => { label: string; route: string } | null;
}

describe('OrganizationDetail · estados de la ficha', () => {
  let fixture: ComponentFixture<OrganizationDetail>;
  let getTenant: ReturnType<typeof vi.fn>;
  let listMemberships: ReturnType<typeof vi.fn>;
  let listChildTenants: ReturnType<typeof vi.fn>;
  let displayNameOf: ReturnType<typeof vi.fn>;

  const interno = (): Interno => fixture.componentInstance as unknown as Interno;
  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function montar(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: DirectoryClient,
          useValue: {
            getTenant,
            listBranches: () => of({ items: [], count: 0 }),
            listMemberships,
            listChildTenants,
          },
        },
        { provide: AuthzAdminClient, useValue: { displayNameOf } },
        { provide: TerminologyClient, useValue: { readConceptLabels: () => of(new Map()) } },
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
        { provide: SessionStore, useValue: { roles: signal([]) } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ tenantId: TENANT })) },
        },
      ],
    });
    fixture = TestBed.createComponent(OrganizationDetail);
    fixture.detectChanges();
  }

  beforeEach(() => {
    getTenant = vi.fn(() => of(FICHA));
    listMemberships = vi.fn(() => of(paginaDeMiembros(1, 2, null)));
    listChildTenants = vi.fn(() => of(PAGINA_VACIA));
    displayNameOf = vi.fn((id: string) => of(`Persona ${id.slice(-2)}`));
  });

  it.each([
    ['403 → forbidden (S5)', http(403, 'FORBIDDEN', 'req-403'), 'forbidden'],
    ['404 → not-found (S6)', http(404, 'NOT_FOUND'), 'not-found'],
    ['sin conexión → offline (S8)', sinRed, 'offline'],
    ['500 → error con requestId (S9)', http(500, 'INTERNAL', 'req-500'), 'error'],
  ] as const)('%s: ya no queda en «Cargando…»', (_nombre, fallo, estado) => {
    getTenant.mockReturnValue(throwError(() => fallo));
    montar();

    expect(interno().organizacion().status).toBe(estado);
    expect(texto()).not.toContain('Cargando la organización');
  });

  it('S9 muestra el código de soporte y S8 ofrece reintentar', () => {
    getTenant.mockReturnValue(throwError(() => http(500, 'INTERNAL', 'req-500')));
    montar();
    expect(texto()).toContain('req-500');

    getTenant.mockReturnValue(throwError(() => sinRed));
    interno().recargar();
    fixture.detectChanges();
    expect(texto()).toContain('Reintentar');
  });

  it('sin ficha no hay pestañas ni acción principal: nada que hacer sobre algo que no se ve', () => {
    getTenant.mockReturnValue(throwError(() => http(404, 'NOT_FOUND')));
    montar();

    expect((fixture.nativeElement as HTMLElement).querySelector('app-tabs')).toBeNull();
    expect(interno().accionPrincipal()).toBeNull();
  });

  it('S7: un corte al releer conserva la ficha con la hora de la última lectura buena', () => {
    montar();
    expect(interno().organizacion().status).toBe('ready');

    getTenant.mockReturnValue(throwError(() => sinRed));
    interno().recargar();
    fixture.detectChanges();

    expect(interno().organizacion().status).toBe('stale');
    expect(texto()).toContain('Clínica Los Olivos');
    expect(texto()).toContain('atrasados');
  });

  it('un 403 al releer sí quita la ficha: ya no se puede afirmar que siga siendo visible', () => {
    montar();
    getTenant.mockReturnValue(throwError(() => http(403, 'FORBIDDEN')));
    interno().recargar();

    expect(interno().organizacion().status).toBe('forbidden');
  });

  it('la acción principal de la cabecera es la de la pestaña abierta', () => {
    montar();
    expect(interno().accionPrincipal()?.label).toBe('Nueva sucursal');
    expect(interno().accionPrincipal()?.route).toBe(`/administration/organizations/${TENANT}/branches/new`);

    interno().pestana.set(1);
    expect(interno().accionPrincipal()?.label).toBe('Sumar a alguien');

    interno().pestana.set(2);
    expect(interno().accionPrincipal()?.label).toBe('Nueva sub-organización');
  });

  describe('paginación por cursor', () => {
    it('la primera página pide 25 sin cursor y ofrece «Siguiente» si la API dio nextCursor', () => {
      listMemberships.mockReturnValue(of(paginaDeMiembros(1, 25, 'c-2')));
      montar();

      expect(listMemberships).toHaveBeenCalledWith(TENANT, { limit: 25 });
      expect(interno().cursorDePlantilla().nextCursor).toBe('c-2');
      expect(interno().cursorDePlantilla().prevCursor).toBeNull();
    });

    it('avanzar pide la página siguiente con su cursor, y volver repite la anterior sin cursor', () => {
      listMemberships.mockReturnValueOnce(of(paginaDeMiembros(1, 25, 'c-2')));
      montar();

      listMemberships.mockReturnValueOnce(of(paginaDeMiembros(26, 3, null)));
      interno().moverPlantilla('c-2');
      expect(listMemberships).toHaveBeenLastCalledWith(TENANT, { limit: 25, cursor: 'c-2' });
      expect(interno().cursorDePlantilla().nextCursor).toBeNull();
      expect(interno().cursorDePlantilla().prevCursor).not.toBeNull();

      listMemberships.mockReturnValueOnce(of(paginaDeMiembros(1, 25, 'c-2')));
      interno().moverPlantilla('anterior');
      expect(listMemberships).toHaveBeenLastCalledWith(TENANT, { limit: 25 });
    });

    it('las sub-organizaciones paginan con su propio cursor, sin tocar el de la plantilla', () => {
      listChildTenants.mockReturnValueOnce(
        of({ ...PAGINA_VACIA, items: [{ ...FICHA, id: 'h-1' }], nextCursor: 'h-2' }),
      );
      montar();
      const llamadasDePlantilla = listMemberships.mock.calls.length;

      listChildTenants.mockReturnValueOnce(of(PAGINA_VACIA));
      interno().moverHijas('h-2');

      expect(listChildTenants).toHaveBeenLastCalledWith(TENANT, { limit: 25, cursor: 'h-2' });
      expect(listMemberships.mock.calls.length).toBe(llamadasDePlantilla);
    });

    it('un fallo al pasar de página deja la pestaña en error y reintentar repite ESA página', () => {
      listMemberships.mockReturnValueOnce(of(paginaDeMiembros(1, 25, 'c-2')));
      montar();

      listMemberships.mockReturnValueOnce(throwError(() => sinRed));
      interno().moverPlantilla('c-2');
      expect(interno().membresias().status).toBe('offline');

      listMemberships.mockReturnValueOnce(of(paginaDeMiembros(26, 1, null)));
      (fixture.componentInstance as unknown as { recargarPlantilla: () => void }).recargarPlantilla();
      expect(listMemberships).toHaveBeenLastCalledWith(TENANT, { limit: 25, cursor: 'c-2' });
      expect(interno().membresias().status).toBe('ready');
    });
  });

  describe('la persona de la plantilla', () => {
    it('se muestra por su nombre, resuelto una vez por cuenta', () => {
      montar();
      fixture.detectChanges();

      expect(displayNameOf).toHaveBeenCalledTimes(2);
      expect(interno().nombreDe('user-00000001')).toBe('Persona 01');
    });

    it('si la API no deja leer el nombre, la fila lo dice y no inventa nada ni frena a las demás', () => {
      displayNameOf.mockImplementation((id: string): Observable<string> =>
        id.endsWith('1') ? throwError(() => http(403, 'FORBIDDEN')) : of('Luis Gómez'),
      );
      montar();

      expect(interno().nombreDe('user-00000001')).toBeUndefined();
      expect(interno().nombreDe('user-00000002')).toBe('Luis Gómez');
    });
  });
});
