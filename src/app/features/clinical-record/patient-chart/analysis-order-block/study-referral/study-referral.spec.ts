import { TestBed } from '@angular/core/testing';

import type { EstudioEnFicha } from '../analysis-order-block.helpers';
import { OrderReferralDialog } from '../order-referral-dialog/order-referral-dialog';
import { StudyReferral } from './study-referral';

const study = (extra: Partial<EstudioEnFicha> = {}): EstudioEnFicha =>
  ({ id: 's-1', estudio: 'Hemograma', category: 'LAB', statusCode: 'ST-ACTIVE', referral: null, ...extra }) as EstudioEnFicha;
const referral = (status: 'PENDING' | 'ACCEPTED' | 'REJECTED') => ({ status, performerName: 'Laboratorio Central', requestedByName: 'Dra. Quispe' });

describe('StudyReferral', () => {
  // The dialog loads centers from the network: this row only decides what to offer.
  beforeEach(() => TestBed.overrideComponent(StudyReferral, { remove: { imports: [OrderReferralDialog] }, add: { imports: [] } }));

  function render(value: EstudioEnFicha): HTMLElement {
    const fixture = TestBed.createComponent(StudyReferral);
    fixture.componentRef.setInput('study', value);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const canRefer = (el: HTMLElement) => el.querySelector('[data-testid="study-refer"]') !== null;

  it.each(['LAB', 'IMAGING'] as const)('an open %s order can be referred', (category) => {
    expect(canRefer(render(study({ category })))).toBe(true);
  });

  it('a completed order cannot', () => {
    expect(canRefer(render(study({ statusCode: 'ST-COMPLETED' })))).toBe(false);
  });

  it('a study that is not laboratory/imaging cannot', () => {
    expect(canRefer(render(study({ category: 'OTHER' })))).toBe(false);
  });

  it('pending and accepted referrals are told and are not offered again', () => {
    const pending = render(study({ referral: referral('PENDING') }));
    expect(pending.querySelector('[data-testid="estudios-derivacion"]')?.textContent).toContain('espera la aceptación del paciente');
    expect(canRefer(pending)).toBe(false);
  });

  it('an accepted referral is told and not offered again', () => {
    const accepted = render(study({ referral: referral('ACCEPTED') }));
    expect(accepted.querySelector('[data-testid="estudios-derivacion"]')?.textContent).toContain('el paciente aceptó');
    expect(canRefer(accepted)).toBe(false);
  });

  it('after a rejection it is told and can be referred to another center', () => {
    const el = render(study({ referral: referral('REJECTED') }));
    expect(el.querySelector('[data-testid="estudios-derivacion"]')?.textContent).toContain('El paciente rechazó la derivación a Laboratorio Central');
    expect(canRefer(el)).toBe(true);
  });
});
