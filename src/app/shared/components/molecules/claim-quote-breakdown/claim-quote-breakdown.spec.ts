import { TestBed } from '@angular/core/testing';

import { ClaimQuoteBreakdown } from './claim-quote-breakdown';
import type { ClaimQuoteBreakdownVm } from './claim-quote-breakdown.types';

/** Un cobro de 500 Bs con copago 50 y 80 %: el ejemplo que fijó el propietario (REQ-16-035.1). */
const VM_CON_REPARTO: ClaimQuoteBreakdownVm = {
  currencyCode: 'BOB',
  headline: { coverage: '80', copay: '50.00', patient: '140.00', insurer: '360.00' },
  lines: [
    {
      key: 'l1',
      serviceLabel: 'Consulta de especialidad',
      billedAmount: '500.00',
      coveragePercent: '80',
      copayAmount: '50.00',
      patientAmount: '140.00',
      insurerAmount: '360.00',
      covered: true,
      authorizationStatus: 'NOT_REQUIRED',
      authorizationLabel: 'No requiere aprobación previa',
    },
  ],
};

function crear(vm: ClaimQuoteBreakdownVm): HTMLElement {
  const fixture = TestBed.createComponent(ClaimQuoteBreakdown);
  fixture.componentRef.setInput('vm', vm);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function textoDe(elemento: HTMLElement, testId: string): string {
  return elemento.querySelector(`[data-testid="${testId}"]`)?.textContent?.trim() ?? '';
}

describe('ClaimQuoteBreakdown', () => {
  it('pinta las cuatro cifras tal cual llegan del servidor, con su moneda y sin recalcular', () => {
    const el = crear(VM_CON_REPARTO);

    expect(textoDe(el, 'claim-quote-total-coverage')).toBe('80 %');
    expect(textoDe(el, 'claim-quote-total-copay')).toBe('50.00 Bs');
    expect(textoDe(el, 'claim-quote-total-patient')).toBe('140.00 Bs');
    expect(textoDe(el, 'claim-quote-total-insurer')).toBe('360.00 Bs');
  });

  it('dice «Sin calcular» cuando el servidor no entrega una cifra, sin inventarla', () => {
    const el = crear({
      ...VM_CON_REPARTO,
      headline: { coverage: null, copay: null, patient: null, insurer: null },
      lines: [],
    });

    expect(textoDe(el, 'claim-quote-total-patient')).toBe('Sin calcular');
    expect(textoDe(el, 'claim-quote-total-insurer')).toBe('Sin calcular');
  });

  it('pinta una línea por ítem con su parte del paciente y de la aseguradora', () => {
    const el = crear(VM_CON_REPARTO);

    const linea = el.querySelector('[data-testid="claim-quote-line-l1"]');
    expect(linea).not.toBeNull();
    expect(linea?.querySelector('[data-testid="claim-quote-line-patient"]')?.textContent).toContain(
      '140.00 Bs',
    );
    expect(linea?.querySelector('[data-testid="claim-quote-line-insurer"]')?.textContent).toContain(
      '360.00 Bs',
    );
  });

  it('usa el tono de cada estado de aprobación previa, y no solo el color para bloquear', () => {
    const el = crear({
      ...VM_CON_REPARTO,
      lines: [
        {
          ...VM_CON_REPARTO.lines[0]!,
          key: 'faltante',
          authorizationStatus: 'MISSING',
          authorizationLabel: 'Falta la aprobación previa',
        },
      ],
    });

    const badge = el.querySelector('[data-testid="claim-quote-line-auth-faltante"]');
    expect(badge?.textContent).toContain('Falta la aprobación previa');
    expect(badge?.getAttribute('ng-reflect-variant') ?? badge?.className).toMatch(/warning/);
  });

  it('marca «No cubierto» cuando la línea no tiene porcentaje de cobertura', () => {
    const el = crear({
      ...VM_CON_REPARTO,
      lines: [
        {
          ...VM_CON_REPARTO.lines[0]!,
          coveragePercent: null,
          patientAmount: null,
          insurerAmount: null,
          covered: false,
          authorizationStatus: null,
          authorizationLabel: 'Sin beneficio vigente',
        },
      ],
    });

    expect(el.textContent).toContain('No cubierto');
    expect(textoDe(el, 'claim-quote-line-patient')).toBe('Sin calcular');
  });
});
