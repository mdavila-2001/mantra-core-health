import { TestBed } from '@angular/core/testing';
import type { OwnCoverage } from '../../../../core/data-access/profiles/profiles.types';
import { PatientCoverageCard } from './patient-coverage-card';

const coverage: OwnCoverage = {
  id: 'coverage-1',
  carrierName: 'Seguros Andina',
  isPublic: false,
  verified: true,
  policyIdentifier: 'POL-24',
  currencyCode: 'BOB',
  validityStatus: 'CURRENT',
  benefits: [],
};

describe('PatientCoverageCard', () => {
  function mount(value: OwnCoverage) {
    const fixture = TestBed.createComponent(PatientCoverageCard);
    fixture.componentRef.setInput('coverage', value);
    fixture.componentRef.setInput('patientName', 'Ana Rojas');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('keeps null, zero, fractional percentages and specific services distinct', () => {
    const element = mount({
      ...coverage,
      benefits: [
        {
          id: 'b1',
          categoryName: 'Consulta',
          coveragePercent: '80.50',
          copayAmount: '0.00',
          effectiveFrom: '2026-01-01',
        },
        {
          id: 'b2',
          categoryName: 'Consulta',
          serviceConceptId: 'service',
          serviceName: 'Seguimiento',
          deductibleAmount: '120.00',
        },
      ],
    });
    expect(element.textContent).toContain('80.50%');
    expect(element.textContent).toContain('0.00 Bs');
    expect(element.textContent).toContain('120.00 Bs');
    expect(element.textContent).toContain('No informado');
    expect(element.textContent).toContain('Beneficio general');
    expect(element.textContent).toContain('Seguimiento');
    expect(element.textContent).toContain('01/01/2026');
  });

  it.each([
    ['USD', '20.00 USD'],
    [undefined, '20.00 (moneda no informada)'],
  ])('does not invent Bs for %s', (currencyCode, amount) => {
    const element = mount({
      ...coverage,
      currencyCode,
      benefits: [{ id: 'b', copayAmount: '20.00' }],
    });
    expect(element.textContent).toContain(amount);
    expect(element.textContent).not.toContain('20.00 Bs');
  });

  it('renders call center independently and labels a provisional identifier', () => {
    const element = mount({
      ...coverage,
      verified: false,
      policyIdentifier: undefined,
      memberIdentifier: 'TEMP-12',
      carrierCallCenterPhone: '800-10-6060',
    });
    expect(element.querySelector('a')?.getAttribute('href')).toBe('tel:800106060');
    expect(element.textContent).toContain('Identificador declarado');
    expect(element.textContent).toContain('provisional');
    expect(element.textContent).toContain('WhatsApp: No informado');
  });

  it('offers a safe WhatsApp link without calling an affiliate identifier a policy', () => {
    const element = mount({
      ...coverage,
      policyIdentifier: undefined,
      memberIdentifier: 'TEMP-12',
      carrierWhatsappNumber: '+59170011223',
    });
    const link = element.querySelector('a')!;
    const url = new URL(link.href);
    expect(url.hostname).toBe('wa.me');
    expect(url.searchParams.get('text')).toContain('Ana Rojas');
    expect(url.searchParams.get('text')).toContain('Seguros Andina');
    expect(url.searchParams.get('text')).not.toContain('Póliza: TEMP');
    expect(link.rel).toContain('noopener');
    expect(link.target).toBe('_blank');
    expect(link.textContent).toContain('pestaña nueva');
  });

  it.each([
    { statusCode: 'COVERAGE_ACTIVE', validityStatus: 'EXPIRED' as const, label: 'Vencida' },
    {
      statusCode: 'insurance:COVERAGE_ACTIVE',
      validityStatus: 'EXPIRED' as const,
      label: 'Vencida',
    },
    {
      statusCode: 'insurance:COVERAGE_ACTIVE',
      validityStatus: 'UPCOMING' as const,
      label: 'Vigencia futura',
    },
  ])(
    'prioritizes $validityStatus for $statusCode while preserving public classification',
    ({ statusCode, validityStatus, label }) => {
      const element = mount({
        ...coverage,
        isPublic: true,
        validityStatus,
        statusCode,
        status: 'Cobertura activa',
      });
      expect(element.textContent).toContain('Público');
      expect(element.textContent).toContain(label);
      expect(element.textContent).not.toContain('Cobertura activa');
    },
  );
});
