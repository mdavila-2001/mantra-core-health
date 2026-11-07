import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import type { NewOrderResult } from './new-order.types';
import { OwnOrderTab } from './own-order-tab';

const MATCH = { patientProfileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'PAC-1' };
const ORDER = { orderId: 'o-1', patientName: 'Ana Pérez', status: 'DRAFT' } as LabOrder;
const STUDIES = { options: [{ conceptId: 'c-glu', code: 'STUDY-GLUCOSA', display: 'Glucosa' }, { conceptId: 'c-hemo', code: 'LAB_HEMOGRAMA', display: 'Hemograma' }, { conceptId: 'c-eco', code: 'IMG_ECO', display: 'Ecografía' }, { conceptId: 'c-ecg', code: 'CAR_ECG', display: 'ECG' }] };

interface Internal {
  nationalId: { set: (v: string) => void };
  study: { set: (v: string | null) => void };
  manualCategory: { set: (v: 'LAB' | 'IMAGING' | null) => void };
  requesterName: { set: (v: string) => void };
  patient: () => unknown;
  errors: () => { patient?: string; study?: string };
  error: () => string | null;
  lookupPatient: () => void;
  changePatient: () => void;
  submit: () => void;
}

describe('OwnOrderTab (way 3: the center registers the order)', () => {
  let lookupPatient: ReturnType<typeof vi.fn>;
  let createOrder: ReturnType<typeof vi.fn>;
  const results: NewOrderResult[] = [];
  let tab: Internal;

  beforeEach(() => {
    results.length = 0;
    lookupPatient = vi.fn(() => of(MATCH));
    createOrder = vi.fn(() => of(ORDER));
    TestBed.configureTestingModule({
      providers: [
        { provide: LabPortalClient, useValue: { lookupPatient, createOrder } },
        { provide: SystemContextClient, useValue: { dynamicEnum: () => of(STUDIES) } },
      ],
    });
    const fixture = TestBed.createComponent(OwnOrderTab);
    fixture.componentInstance.created.subscribe((r) => results.push(r));
    fixture.detectChanges();
    tab = fixture.componentInstance as unknown as Internal;
  });

  it('finds the patient by national id and can switch to another', () => {
    tab.nationalId.set(' 3000000 ');
    tab.lookupPatient();
    expect(lookupPatient).toHaveBeenCalledExactlyOnceWith('3000000');
    expect(tab.patient()).toEqual(MATCH);
    tab.changePatient();
    expect(tab.patient()).toBeNull();
  });

  it('nobody holding the document is told on the field', () => {
    lookupPatient.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    tab.nationalId.set('1');
    tab.lookupPatient();
    expect(tab.errors().patient).toBe('Nadie tiene ese documento.');
  });

  it('without patient or study it marks both fields and sends nothing', () => {
    tab.submit();
    expect(createOrder).not.toHaveBeenCalled();
    expect(tab.errors()).toEqual({ patient: 'Busque al paciente por su documento.', study: 'Elija el estudio.' });
  });

  it('creates the order with the family taken from the study; blank optionals are not sent', () => {
    tab.nationalId.set('1');
    tab.lookupPatient();
    tab.study.set('c-hemo');
    tab.submit();
    expect(createOrder).toHaveBeenCalledExactlyOnceWith({ patientProfileId: 'p-1', codeConceptId: 'c-hemo', category: 'LAB' });
    expect(results).toEqual([{ order: ORDER, created: true }]);
  });

  it('imaging studies go as IMAGING, with the signer when given', () => {
    tab.nationalId.set('1');
    tab.lookupPatient();
    tab.study.set('c-eco');
    tab.requesterName.set(' Dra. Paz ');
    tab.submit();
    expect(createOrder).toHaveBeenCalledWith({ patientProfileId: 'p-1', codeConceptId: 'c-eco', category: 'IMAGING', externalRequesterName: 'Dra. Paz' });
  });

  it('when the catalog code does not say the family, the center picks it by hand', () => {
    tab.nationalId.set('1');
    tab.lookupPatient();
    tab.study.set('c-glu');
    tab.submit();
    expect(createOrder).not.toHaveBeenCalled();
    expect(tab.errors().study).toBe('Indique si es de laboratorio o de imagenología.');
    tab.manualCategory.set('IMAGING');
    tab.submit();
    expect(createOrder).toHaveBeenCalledWith({ patientProfileId: 'p-1', codeConceptId: 'c-glu', category: 'IMAGING' });
  });

  it('a study that is not laboratory or imaging is refused on the field', () => {
    tab.nationalId.set('1');
    tab.lookupPatient();
    tab.study.set('c-ecg');
    tab.submit();
    expect(createOrder).not.toHaveBeenCalled();
    expect(tab.errors().study).toBe('Ese estudio no lo hace un laboratorio ni un centro de imagenología.');
  });

  it('an API refusal is shown with its message and what was typed is kept', () => {
    createOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'VALIDATION_FAILED', message: 'El estudio no está en el catálogo.' } })));
    tab.nationalId.set('1');
    tab.lookupPatient();
    tab.study.set('c-hemo');
    tab.submit();
    expect(tab.error()).toBe('El estudio no está en el catálogo.');
    expect(tab.patient()).toEqual(MATCH);
    expect(results).toEqual([]);
  });
});
