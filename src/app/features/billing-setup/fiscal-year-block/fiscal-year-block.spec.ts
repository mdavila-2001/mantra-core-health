import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AccountingClient } from '../../../core/data-access/accounting/accounting.client';
import type { FiscalYear } from '../../../core/data-access/accounting/accounting.types';
import { FiscalYearOpeningClient } from '../../../core/data-access/billing-setup/fiscal-year-opening.client';
import { FiscalYearBlock } from './fiscal-year-block';

const FY: FiscalYear = {
  fiscalYearId: 'fy-1',
  name: 'FY2026',
  startsOn: '2026-01-01',
  endsOn: '2026-12-31',
  currentPeriodId: 'p-10',
  periods: Array.from({ length: 12 }, (_, i) => ({
    id: `p-${i + 1}`,
    periodNumber: i + 1,
    name: `2026-${String(i + 1).padStart(2, '0')}`,
    startsOn: '2026-01-01',
    endsOn: '2026-01-31',
    status: 'OPEN' as const,
  })),
};

function apiError(status: number, code: string, message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message, timestamp: '', path: '' } });
}

describe('FiscalYearBlock', () => {
  let fixture: ComponentFixture<FiscalYearBlock>;
  let fiscalYear: ReturnType<typeof vi.fn>;
  let openFiscalYear: ReturnType<typeof vi.fn>;

  function mount(): HTMLElement {
    TestBed.configureTestingModule({
      imports: [FiscalYearBlock],
      providers: [
        { provide: AccountingClient, useValue: { fiscalYear } },
        { provide: FiscalYearOpeningClient, useValue: { openFiscalYear } },
      ],
    });
    fixture = TestBed.createComponent(FiscalYearBlock);
    fixture.componentRef.setInput('practiceId', 'pr-1');
    fixture.componentRef.setInput('yearDraft', '2026');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const byTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    fiscalYear = vi.fn();
    openFiscalYear = vi.fn();
  });

  it('con ejercicio vigente lo muestra con sus fechas y el mes en curso', () => {
    fiscalYear.mockReturnValue(of(FY));
    const host = mount();

    expect(fiscalYear).toHaveBeenCalledWith('pr-1');
    const facts = byTestId('fiscal-year-current')!.textContent!;
    expect(facts).toContain('FY2026');
    expect(facts).toContain('01/01/2026');
    expect(facts).toContain('31/12/2026');
    expect(facts).toContain('2026-10');
    expect(host.querySelector('[data-testid="fiscal-year-open"]')).toBeNull();
  });

  it('un 404 NOT_FOUND ofrece «Abrir ejercicio»; abrirlo manda el año con doce meses y vuelve a leer', () => {
    fiscalYear
      .mockReturnValueOnce(throwError(() => apiError(404, 'NOT_FOUND', 'La práctica no tiene ejercicios fiscales')))
      .mockReturnValueOnce(of(FY));
    openFiscalYear.mockReturnValue(of({ id: 'fy-1', code: 'FY2026', status: 'open', periodIds: [] }));
    mount();

    expect(byTestId('fiscal-year-missing')).not.toBeNull();
    byTestId('fiscal-year-open')!.click();
    fixture.detectChanges();

    const body = openFiscalYear.mock.calls[0]![0];
    expect(body).toMatchObject({ practiceId: 'pr-1', code: 'FY2026', startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(body.periods).toHaveLength(12);
    expect(fiscalYear).toHaveBeenCalledTimes(2);
    expect(byTestId('fiscal-year-current')).not.toBeNull();
  });

  it.each([
    [403, 'FORBIDDEN', 'Solo la administración de la práctica o el médico titular de su consultorio pueden abrir el ejercicio fiscal'],
    [409, 'CONFLICT', 'El ejercicio ya existe en la práctica'],
  ])('un %s al abrir muestra el texto de la API', (status, code, message) => {
    fiscalYear.mockReturnValue(throwError(() => apiError(404, 'NOT_FOUND', 'x')));
    openFiscalYear.mockReturnValue(throwError(() => apiError(status, code, message)));
    mount();

    byTestId('fiscal-year-open')!.click();
    fixture.detectChanges();

    expect(byTestId('fiscal-year-error')!.textContent).toContain(message);
    expect(byTestId('fiscal-year-missing')).not.toBeNull();
  });

  it('un año que no tiene cuatro cifras no se manda', () => {
    fiscalYear.mockReturnValue(throwError(() => apiError(404, 'NOT_FOUND', 'x')));
    mount();
    fixture.componentRef.setInput('yearDraft', '26');
    fixture.detectChanges();

    expect(byTestId('fiscal-year-open')!.getAttribute('aria-disabled')).toBe('true');
    byTestId('fiscal-year-open')!.click();
    expect(openFiscalYear).not.toHaveBeenCalled();
  });

  it('otro error de lectura no se confunde con «no hay ejercicio»', () => {
    fiscalYear.mockReturnValue(new Subject());
    mount();
    expect(byTestId('fiscal-year-missing')).toBeNull();
    fiscalYear.mockReturnValue(throwError(() => apiError(403, 'FORBIDDEN', 'No')));
    (fixture.componentInstance as unknown as { reload(): void }).reload();
    fixture.detectChanges();
    expect(byTestId('fiscal-year-missing')).toBeNull();
    expect(byTestId('fiscal-year-current')).toBeNull();
  });
});
