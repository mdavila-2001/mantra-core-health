import { TestBed } from '@angular/core/testing';

import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';
import { OrderOrigin } from './order-origin';

const base = { orderId: 'o', studyName: 'Hemograma', patientName: 'Ana', requesterName: 'Dra. Rojas', requestedAt: '', status: 'DRAFT', reason: null, files: [] } as LabOrder;

describe('OrderOrigin', () => {
  function render(origin: LabOrder['origin']): HTMLElement {
    const fixture = TestBed.createComponent(OrderOrigin);
    fixture.componentRef.setInput('order', { ...base, origin });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['PATIENT_QR', 'QR del paciente', 'Por el QR del paciente · pidió Dra. Rojas'],
    ['DOCTOR_REFERRAL', 'Derivada por médico', 'Derivada por Dra. Rojas, aceptada por el paciente'],
    ['LAB_OWN', 'Registrada por el centro', 'Firmó Dra. Rojas'],
  ] as const)('%s shows a chip and its line', (origin, chip, line) => {
    const el = render(origin);
    expect(el.querySelector('[data-testid="lab-order-origin-chip"]')?.textContent).toContain(chip);
    expect(el.querySelector('[data-testid="lab-order-origin"]')?.textContent).toBe(line);
  });

  it('an order that already came addressed to the center (or without origin) has no chip', () => {
    for (const origin of ['CLINIC', undefined] as const) {
      const el = render(origin);
      expect(el.querySelector('[data-testid="lab-order-origin-chip"]')).toBeNull();
      expect(el.querySelector('[data-testid="lab-order-origin"]')?.textContent).toBe('Pidió Dra. Rojas');
    }
  });
});
