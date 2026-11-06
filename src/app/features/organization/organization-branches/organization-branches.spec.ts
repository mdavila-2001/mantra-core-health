import { HttpErrorResponse } from '@angular/common/http';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type {
  BranchChanges,
  BranchListItem,
  NewBranch,
} from '../../../core/data-access/directory/directory.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import {
  CARGADOR_DE_LEAFLET,
  type CargadorDeLeaflet,
} from '../../../shared/components/organisms/map/map';
import { CARGADOR_DE_PROVINCIAS } from '../../../shared/components/organisms/map/provinces';
import type { BranchDraft } from '../../../shared/utils/branch-import/branch-import';
import { OrganizationBranches } from './organization-branches';

/**
 * La pestaña «Sucursales» de la farmacia y del laboratorio: lista las de la
 * organización activa, edita una mandando sólo lo que cambió y crea en lote de
 * a una, sin que una rechazada frene a las demás.
 */
const TENANT = 'tenant-farmacia';

const CENTRAL: BranchListItem = {
  id: 'b-1',
  code: 'CENTRAL',
  name: 'Central',
  statusConceptId: 'st',
  description: 'Frente a la plaza',
  locationUrl: 'https://www.google.com/maps?q=-17.78,-63.18',
  latitude: -17.78,
  longitude: -63.18,
  createdAt: new Date('2026-01-01'),
};

/** Pins the map drew, by their `alt` (the site name). */
let drawnPins: string[] = [];

function fakeLeaflet(): unknown {
  return {
    map: () => ({ setView: () => undefined, fitBounds: () => undefined, remove: () => undefined }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: (_coords: unknown, options: { alt: string }) => {
      drawnPins.push(options.alt);
      const marker = {
        bindPopup: () => marker,
        on: () => marker,
        addTo: () => marker,
        getElement: () => document.createElement('div'),
      };
      return marker;
    },
    divIcon: (options: unknown) => options,
    latLngBounds: (bounds: unknown) => bounds,
  };
}

function draft(partial: Partial<BranchDraft>): BranchDraft {
  return {
    name: 'Sucursal',
    description: '',
    locationUrl: '',
    address: '',
    code: '',
    coordinates: null,
    ...partial,
  };
}

interface Internal {
  branches: () => ViewState<readonly BranchListItem[]>;
  openEdit: (branch: BranchListItem) => void;
  openCreate: () => void;
  setField: (field: string, value: string) => void;
  setCategory: (category: string) => void;
  save: () => void;
  hasChanges: () => boolean;
  nameError: () => string;
  saveError: () => string | null;
  createBatch: (drafts: readonly BranchDraft[]) => void;
  rejected: () => readonly { name: string; reason: string }[];
}

describe('OrganizationBranches', () => {
  let fixture: ComponentFixture<OrganizationBranches>;
  let activeTenant: ReturnType<typeof signal<string | null>>;
  let created: NewBranch[];
  let createReply: (branch: NewBranch) => Observable<BranchListItem>;
  let updates: { branchId: string; changes: BranchChanges }[];
  let updateReply: () => Observable<BranchListItem>;
  let listBranches: ReturnType<typeof vi.fn>;
  let tenantType: WritableSignal<string | null>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    activeTenant = signal<string | null>(TENANT);
    tenantType = signal<string | null>('LABORATORY');
    created = [];
    updates = [];
    createReply = (branch) => of({ ...CENTRAL, id: `b-${created.length + 1}`, ...branch });
    updateReply = () => of(CENTRAL);
    listBranches = vi.fn(() => of({ items: [CENTRAL], count: 1 }));

    drawnPins = [];
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(fakeLeaflet())) as CargadorDeLeaflet,
        },
        { provide: CARGADOR_DE_PROVINCIAS, useValue: () => Promise.resolve(null) },
        { provide: SessionStore, useValue: { activeTenantId: activeTenant, activeTenantType: tenantType } },
        {
          provide: DirectoryClient,
          useValue: {
            listBranches,
            createBranch: vi.fn((_tenant: string, branch: NewBranch) => {
              created.push(branch);
              return createReply(branch);
            }),
            updateBranch: vi.fn((_tenant: string, branchId: string, changes: BranchChanges) => {
              updates.push({ branchId, changes });
              return updateReply();
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(OrganizationBranches);
    fixture.detectChanges();
  });

  it('lista las sucursales de la organización activa, con su enlace al mapa', () => {
    expect(listBranches).toHaveBeenCalledWith(TENANT);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Central');
    expect(text).toContain('CENTRAL');
    expect(text).toContain('Frente a la plaza');
    expect(text).toContain('Ver en el mapa');
  });

  it('en una farmacia explica que las sedes de venta importadas no son estas sucursales', () => {
    const note = () =>
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="branches-pharmacy-sites-note"]');
    expect(note()).toBeNull();

    tenantType.set('PHARMACY');
    fixture.detectChanges();

    expect(note()?.textContent).toContain('no aparecen acá');
    expect(note()?.textContent).toContain('Horario y turnos');
  });

  it('sin organización activa no pide nada y dice qué falta', () => {
    listBranches.mockClear();
    activeTenant.set(null);
    fixture.detectChanges();

    expect(listBranches).not.toHaveBeenCalled();
    expect(internal().branches().status).toBe('empty');
  });

  it('editar manda sólo lo que cambió', () => {
    internal().openEdit(CENTRAL);
    expect(internal().hasChanges()).toBe(false);

    internal().setField('description', 'Segundo piso');
    internal().save();

    expect(updates).toEqual([{ branchId: 'b-1', changes: { description: 'Segundo piso' } }]);
  });

  it('un enlace nuevo reemplaza el punto: el que lo trae lo manda, el que no lo borra', () => {
    internal().openEdit(CENTRAL);
    internal().setField('locationUrl', 'https://www.openstreetmap.org/?mlat=-17.80&mlon=-63.20');
    internal().save();

    internal().openEdit(CENTRAL);
    internal().setField('locationUrl', 'https://maps.app.goo.gl/abc123');
    internal().save();

    internal().openEdit(CENTRAL);
    internal().setField('locationUrl', '');
    internal().setField('description', '');
    internal().save();

    expect(updates.map((u) => u.changes)).toEqual([
      {
        locationUrl: 'https://www.openstreetmap.org/?mlat=-17.80&mlon=-63.20',
        latitude: -17.8,
        longitude: -63.2,
      },
      { locationUrl: 'https://maps.app.goo.gl/abc123', latitude: null, longitude: null },
      { description: null, locationUrl: null, latitude: null, longitude: null },
    ]);
  });

  it('sin nombre, con un enlace que no es web o con un nombre repetido no manda nada', () => {
    internal().openCreate();
    internal().setField('name', '   ');
    internal().save();
    expect(internal().nameError()).toBe('Escriba el nombre de la sucursal.');

    internal().setField('name', 'central');
    internal().save();
    expect(internal().nameError()).toBe('Ya tiene una sucursal con ese nombre.');

    internal().setField('name', 'Norte');
    internal().setField('locationUrl', 'javascript:alert(1)');
    internal().save();

    expect(created).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('agregar una deriva el código del nombre si no se escribió', () => {
    internal().openCreate();
    internal().setField('name', 'Norte');
    internal().setField('locationUrl', 'https://www.google.com/maps/@-17.75,-63.17,15z');
    internal().save();

    expect(created).toEqual([
      {
        code: 'NORTE',
        name: 'Norte',
        locationUrl: 'https://www.google.com/maps/@-17.75,-63.17,15z',
        latitude: -17.75,
        longitude: -63.17,
        // Without another choice the site is created as "default" (v4.2.91).
        category: 'default',
      },
    ]);
  });

  it('el motivo de un rechazo de la API queda en el diálogo', () => {
    updateReply = () =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: { statusCode: 404, code: 'NOT_FOUND', message: 'Sucursal no encontrada' },
          }),
      );
    internal().openEdit(CENTRAL);
    internal().setField('name', 'Central Nueva');
    internal().save();

    expect(internal().saveError()).not.toBeNull();
  });

  it('el lote se crea en orden, sin chocar códigos, y una rechazada no frena a las demás', () => {
    createReply = (branch) =>
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
        : of({ ...CENTRAL, ...branch });

    internal().createBatch([
      draft({ name: 'Repetida', code: 'DUP' }),
      draft({ name: 'Central Dos' }),
      draft({ name: 'central' }),
    ]);

    expect(created.map((b) => b.code)).toEqual(['DUP', 'CENTRAL-DOS', 'CENTRAL-2']);
    expect(internal().rejected()).toEqual([
      { name: 'Repetida', reason: 'Ya existe una branch con ese código en el tenant' },
    ]);
    // La tabla se relee de la API: es la prueba de lo que quedó.
    expect(listBranches).toHaveBeenCalledTimes(2);
  });

  describe('categoría y mapa (06/11/2026)', () => {
    const NORTE: BranchListItem = {
      ...CENTRAL,
      id: 'b-2',
      code: 'NORTE',
      name: 'Norte',
      description: undefined,
      locationUrl: undefined,
      latitude: -17.7,
      longitude: -63.1,
      category: 'branch',
    };
    const SIN_PUNTO: BranchListItem = {
      ...CENTRAL,
      id: 'b-3',
      code: 'SINPUNTO',
      name: 'Sin punto',
      description: undefined,
      locationUrl: undefined,
      latitude: undefined,
      longitude: undefined,
      category: 'branch',
    };
    const MATRIZ: BranchListItem = { ...CENTRAL, category: 'head_office' };
    const el = () => fixture.nativeElement as HTMLElement;
    const testId = (id: string) => el().querySelector(`[data-testid="${id}"]`);

    async function showing(items: readonly BranchListItem[]): Promise<void> {
      listBranches.mockReturnValue(of({ items, count: items.length }));
      drawnPins = [];
      activeTenant.set(`${TENANT}-2`);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('la tabla dice la categoría de cada sede; una sin categoría es «Por defecto»', async () => {
      await showing([MATRIZ, NORTE, { ...SIN_PUNTO, category: undefined }]);

      expect(testId('branches-category-CENTRAL')?.textContent).toContain('Casa matriz');
      expect(testId('branches-category-NORTE')?.textContent).toContain('Sucursal');
      expect(testId('branches-category-SINPUNTO')?.textContent).toContain('Por defecto');
    });

    it('el mapa pone un pin en el punto de cada sede y nombra las que no tienen punto', async () => {
      await showing([MATRIZ, NORTE, SIN_PUNTO]);

      expect(drawnPins).toEqual(['Central', 'Norte']);
      expect(testId('branches-map-missing')?.textContent).toContain('«Sin punto»');
      // Without a pasted link, "Ver en el mapa" is built from the point.
      const links = [...el().querySelectorAll('a')].map((a) => a.getAttribute('href'));
      expect(links).toContain('https://www.openstreetmap.org/?mlat=-17.7&mlon=-63.1#map=17/-17.7/-63.1');
    });

    it('filtrar por oleada alcanza a la tabla y al mapa, y queda en la URL', async () => {
      await showing([MATRIZ, NORTE, SIN_PUNTO]);
      drawnPins = [];

      const router = TestBed.inject(Router);
      await router.navigate([], { queryParams: { categoria: 'branch' } });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const text = testId('branches-table')?.textContent ?? '';
      expect(text).toContain('Norte');
      expect(text).not.toContain('Frente a la plaza');
      expect(drawnPins).toEqual(['Norte']);

      const segmented = el().querySelectorAll<HTMLButtonElement>('[data-testid="branches-filter"] button');
      const todas = [...segmented].find((b) => b.textContent?.includes('Todas'));
      todas?.click();
      await fixture.whenStable();
      expect(router.url).not.toContain('categoria');
    });

    it('una oleada vacía lo dice en vez de mostrar una tabla vacía', async () => {
      await showing([MATRIZ, NORTE]);
      const router = TestBed.inject(Router);
      await router.navigate([], { queryParams: { categoria: 'default' } });
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(testId('branches-table')?.textContent).toContain('No hay sedes con la etiqueta «Por defecto»');
    });

    it('editar la categoría manda sólo la categoría', async () => {
      await showing([MATRIZ, NORTE]);
      internal().openEdit(NORTE);
      internal().setCategory('default');
      internal().save();

      expect(updates).toEqual([{ branchId: 'b-2', changes: { category: 'default' } }]);
    });

    it('agregar la casa matriz la manda con su categoría', () => {
      internal().openCreate();
      internal().setField('name', 'Casa matriz');
      internal().setCategory('head_office');
      internal().save();

      expect(created[0]).toEqual(expect.objectContaining({ name: 'Casa matriz', category: 'head_office' }));
    });

    it('el 409 de una segunda casa matriz queda en el diálogo con el mensaje de la API', async () => {
      await showing([MATRIZ, NORTE]);
      updateReply = () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                statusCode: 409,
                code: 'CONFLICT',
                message: 'La organización ya tiene una casa matriz. Cambie primero la categoría de la actual.',
              },
            }),
        );
      internal().openEdit(NORTE);
      internal().setCategory('head_office');
      internal().save();

      expect(internal().saveError()).toContain('ya tiene una casa matriz');
    });
  });
});
