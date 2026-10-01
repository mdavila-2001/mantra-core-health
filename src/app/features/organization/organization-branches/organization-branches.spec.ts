import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    activeTenant = signal<string | null>(TENANT);
    created = [];
    updates = [];
    createReply = (branch) => of({ ...CENTRAL, id: `b-${created.length + 1}`, ...branch });
    updateReply = () => of(CENTRAL);
    listBranches = vi.fn(() => of({ items: [CENTRAL], count: 1 }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { activeTenantId: activeTenant } },
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
    expect(internal().nameError()).toBe('Escribí el nombre de la sucursal.');

    internal().setField('name', 'central');
    internal().save();
    expect(internal().nameError()).toBe('Ya tenés una sucursal con ese nombre.');

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
});
