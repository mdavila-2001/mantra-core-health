import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import type { ProcedureNomenclatureItem } from '../../../../core/data-access/services-catalog/services-catalog.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ProcedureImport } from './procedure-import';

/*
 * Lo que se prueba acá es el aviso cuando el alta falla. Antes cualquier
 * fallo —un 422, un 500, un corte de red— se presentaba como «exige permiso
 * de administración», y la persona salía a pedir un permiso que ya tenía.
 */

const ITEM: ProcedureNomenclatureItem = {
  conceptId: 'concept-1',
  code: 'ARA-0101',
  display: 'Electrocardiograma',
  specialty: 'Cardiología',
  group: null,
  referencePrice: '120',
  priceUnit: 'UMA',
  ocrSuspect: false,
};

function apiError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return new HttpErrorResponse({
    status,
    error: { code, message, timestamp: '', path: '/billing/service-catalog', correlationId: 'corr-imp', ...extra },
    headers: new HttpHeaders(),
  });
}

describe('ProcedureImport — fallo al importar', () => {
  let create: ReturnType<typeof vi.fn>;
  let avisos: ReturnType<typeof vi.spyOn>;
  let importar: (item: ProcedureNomenclatureItem) => void;
  let importando: () => string | null;

  beforeEach(() => {
    create = vi.fn();
    TestBed.configureTestingModule({
      imports: [ProcedureImport],
      providers: [
        provideRouter([]),
        {
          provide: ServicesCatalogClient,
          useValue: {
            listPractices: () => of([{ id: 'pr1', code: 'P1', name: 'Práctica 1' }]),
            listProcedureSpecialties: () => of([]),
            searchProcedures: () => of({ items: [ITEM], nextCursor: null }),
            search: () => of({ items: [], count: 0, limit: 500, nextCursor: null }),
            create,
          },
        },
      ],
    });
    avisos = vi.spyOn(TestBed.inject(ToastService), 'show');
    const fixture = TestBed.createComponent(ProcedureImport);
    fixture.detectChanges();
    const componente = fixture.componentInstance as unknown as {
      importar: (item: ProcedureNomenclatureItem) => void;
      importando: () => string | null;
    };
    importar = (item) => componente.importar(item);
    importando = () => componente.importando();
  });

  it('sólo un FORBIDDEN habla de permisos, y lleva el código de soporte', () => {
    create.mockReturnValue(throwError(() => apiError(403, 'FORBIDDEN', 'Forbidden resource')));

    importar(ITEM);

    expect(avisos).toHaveBeenLastCalledWith({
      type: 'error',
      title: 'No pudimos importarlo',
      message:
        'El alta de servicios exige permiso de administración. Pídalo a quien administre la organización. (Código de soporte: corr-imp)',
    });
    expect(importando()).toBeNull();
  });

  it('un 500 no se presenta como falta de permiso', () => {
    create.mockReturnValue(throwError(() => apiError(500, 'INTERNAL', 'Internal server error')));

    importar(ITEM);

    const mensaje = (avisos.mock.lastCall?.[0] as { message: string }).message;
    expect(mensaje).toBe('No se pudo importar «Electrocardiograma». Intente de nuevo. (Código de soporte: corr-imp)');
    expect(mensaje).not.toMatch(/permiso/);
  });

  it('un rechazo de validación dice que los datos del arancel no entran, no que falta permiso', () => {
    create.mockReturnValue(
      throwError(() =>
        apiError(422, 'VALIDATION_FAILED', 'Error de validación', {
          details: { fields: [{ field: 'defaultPrice', constraints: ['isDecimal'], messages: ['bad'] }] },
        }),
      ),
    );

    importar(ITEM);

    expect((avisos.mock.lastCall?.[0] as { message: string }).message).toBe(
      'El catálogo no admite los datos de «Electrocardiograma» tal como vienen del arancel. (Código de soporte: corr-imp)',
    );
  });

  it('si ya existe, el aviso es el motivo de la API', () => {
    create.mockReturnValue(
      throwError(() => apiError(409, 'CONFLICT', 'Ya existe un servicio con ese código en la práctica.')),
    );

    importar(ITEM);

    expect((avisos.mock.lastCall?.[0] as { message: string }).message).toBe(
      'Ya existe un servicio con ese código en la práctica. (Código de soporte: corr-imp)',
    );
  });
});
