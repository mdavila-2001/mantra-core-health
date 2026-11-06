import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { LabOrderIntakeClient } from '../../../../core/data-access/lab-portal/lab-order-intake.client';
import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { LabOrderIntakeDialog } from './lab-order-intake-dialog';

interface Internal {
  nationalId: { set(v: string): void };
  study: { set(v: string | null): void };
  requester: { set(v: string): void };
  patient(): unknown;
  error(): string | null;
  category(): string | null;
  notDiagnostic(): boolean;
  canSave(): boolean;
  lookUp(): void;
  save(): void;
}

const ORDER: LabOrder = {
  orderId: 'sr-1',
  studyName: 'Hemograma',
  patientName: 'Ana Pérez',
  requesterName: 'Dra. Rojas',
  requestedAt: '2026-11-06T10:00:00Z',
  status: 'DRAFT',
  reason: null,
  registeredByPerformer: true,
  canEdit: true,
  codeConceptId: 'study-lab',
  priorityConceptId: null,
  externalRequesterName: 'Dra. Rojas',
  externalRequesterLicense: null,
  files: [],
};

describe('LabOrderIntakeDialog', () => {
  let fixture: ComponentFixture<LabOrderIntakeDialog>;
  const lookupPatient = vi.fn();
  const createOrder = vi.fn(() => of(ORDER));
  const updateOrder = vi.fn(() => of(ORDER));
  const studyFamily = vi.fn((id: string) => of(id === 'study-lab' ? 'LAB' : 'CARDIO'));
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  function create(order: LabOrder | null = null): void {
    fixture = TestBed.createComponent(LabOrderIntakeDialog);
    fixture.componentRef.setInput('order', order);
    fixture.detectChanges();
  }

  beforeEach(() => {
    [lookupPatient, createOrder, updateOrder, studyFamily].forEach((fn) => fn.mockClear());
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LabOrderIntakeClient,
          useValue: { lookupPatient, createOrder, updateOrder, studyFamily },
        },
      ],
    });
  });

  it('alta: busca al paciente por documento y carga la orden con la categoría del catálogo', () => {
    lookupPatient.mockReturnValue(
      of({ patientProfileId: 'p-1', displayName: 'Ana Pérez', patientCode: null }),
    );
    create();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);

    expect(internal().canSave()).toBe(false);
    internal().nationalId.set(' 1234567 ');
    internal().lookUp();
    internal().study.set('study-lab');
    internal().requester.set('  Dra. Rojas ');
    fixture.detectChanges();

    expect(lookupPatient).toHaveBeenCalledWith('1234567');
    expect(internal().category()).toBe('LAB');
    expect(internal().canSave()).toBe(true);
    internal().save();
    expect(createOrder).toHaveBeenCalledExactlyOnceWith({
      codeConceptId: 'study-lab',
      category: 'LAB',
      priorityConceptId: undefined,
      externalRequesterName: 'Dra. Rojas',
      externalRequesterLicense: undefined,
      patientProfileId: 'p-1',
    });
    expect(saved).toHaveBeenCalledWith(ORDER);
  });

  it('sin paciente encontrado no se puede cargar, y el 404 se dice con el mensaje de la API', () => {
    lookupPatient.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: {
              code: 'NOT_FOUND',
              message: 'No hay ningún paciente registrado con ese documento.',
              reason: 'LAB_PATIENT_NOT_FOUND',
            },
          }),
      ),
    );
    create();
    internal().nationalId.set('999');
    internal().lookUp();
    internal().study.set('study-lab');
    fixture.detectChanges();

    expect(internal().patient()).toBeNull();
    expect(internal().error()).toBe('No hay ningún paciente registrado con ese documento.');
    expect(internal().canSave()).toBe(false);
  });

  it('un estudio que no es de laboratorio ni de imagen no se puede mandar', () => {
    create(ORDER);
    internal().study.set('study-cardio');
    fixture.detectChanges();

    expect(internal().category()).toBeNull();
    expect(internal().notDiagnostic()).toBe(true);
    expect(internal().canSave()).toBe(false);
  });

  it('edición: el paciente no se pide y se reemplaza lo editable con PUT', () => {
    create(ORDER);
    internal().requester.set('');
    fixture.detectChanges();

    expect(internal().canSave()).toBe(true);
    internal().save();
    expect(lookupPatient).not.toHaveBeenCalled();
    expect(updateOrder).toHaveBeenCalledExactlyOnceWith('sr-1', {
      codeConceptId: 'study-lab',
      category: 'LAB',
      priorityConceptId: undefined,
      externalRequesterName: undefined,
      externalRequesterLicense: undefined,
    });
  });
});
