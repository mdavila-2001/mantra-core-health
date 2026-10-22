import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type {
  BranchListItem,
  NewBranch,
} from '../../../../core/data-access/directory/directory.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import type { BranchDraft } from '../../../../shared/utils/branch-import/branch-import';
import { OrganizationDetail } from './organization-detail';

/**
 * La ficha de la organización, en lo que suma la carga masiva: las sucursales
 * del archivo se crean de a una, en orden, con código derivado cuando falta, y
 * una que la API rechaza no frena a las demás.
 */
const TENANT = 'tenant-1';

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
          id: TENANT,
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
        { provide: SessionStore, useValue: { roles: signal([]) } },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ tenantId: TENANT })) },
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
