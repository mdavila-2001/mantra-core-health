import type { ClaimQuoteLineResult, ClaimQuoteResult } from '../../../core/data-access/insurance/insurance.types';
import { aVistaDeCotizacion, motivoDeBloqueo, rotuloDeLinea } from './claim-quote-vm';

function linea(parcial: Partial<ClaimQuoteLineResult> = {}): ClaimQuoteLineResult {
  return {
    lineSequence: 1,
    serviceConceptId: 'concepto-1',
    billedAmount: '500.00',
    covered: true,
    coveragePercent: '80',
    copayAmount: '50.00',
    deductibleAmount: null,
    requiresPriorAuthorization: false,
    priorAuthorizationStatus: 'NOT_REQUIRED',
    patientAmount: '140.00',
    insurerAmount: '360.00',
    reason: null,
    message: null,
    ...parcial,
  };
}

function cotizacion(lineas: ClaimQuoteLineResult[], parcial: Partial<ClaimQuoteResult> = {}): ClaimQuoteResult {
  return {
    canSubmit: lineas.every((l) => l.reason === null),
    currencyConceptId: null,
    totalBilledAmount: '500.00',
    totalPatientAmount: '140.00',
    totalInsurerAmount: '360.00',
    lines: lineas,
    ...parcial,
  };
}

describe('vista de la cotización', () => {
  it('toma las cifras de cabecera del total del servidor, sin sumar', () => {
    const vm = aVistaDeCotizacion(cotizacion([linea()]), 'Consulta', 'BOB');
    expect(vm.headline).toEqual({ coverage: '80', copay: '50.00', patient: '140.00', insurer: '360.00' });
    expect(vm.currencyCode).toBe('BOB');
    expect(vm.lines[0]!.serviceLabel).toBe('Consulta');
  });

  it('no inventa cobertura ni copago cuando las líneas no los comparten', () => {
    const vm = aVistaDeCotizacion(
      cotizacion([linea(), linea({ lineSequence: 2, coveragePercent: '50', copayAmount: '10.00' })]),
      'Servicio',
      'BOB',
    );
    expect(vm.headline.coverage).toBeNull();
    expect(vm.headline.copay).toBeNull();
    expect(vm.headline.patient).toBe('140.00');
  });

  it('una línea sin cobertura se rotula «No cubierto por el plan»', () => {
    expect(rotuloDeLinea(linea({ priorAuthorizationStatus: null, reason: 'SERVICE_NOT_COVERED' }))).toBe(
      'No cubierto por el plan',
    );
  });

  it('el rótulo de aprobación previa sale del mapa en usted', () => {
    expect(rotuloDeLinea(linea({ priorAuthorizationStatus: 'MISSING' }))).toBe('Falta la aprobación previa');
  });
});

describe('motivo de bloqueo', () => {
  it('no hay motivo cuando el cobro se puede enviar', () => {
    expect(motivoDeBloqueo(cotizacion([linea()]))).toBeNull();
  });

  it.each([
    ['SERVICE_NOT_COVERED', 'El plan no cubre este servicio'],
    ['PRIOR_AUTHORIZATION_REQUIRED', 'requiere una aprobación previa'],
    ['PRIOR_AUTHORIZATION_PENDING', 'todavía está en trámite'],
    ['PRIOR_AUTHORIZATION_MISMATCH', 'no corresponde a este cobro'],
  ])('el motivo %s se explica en usted', (motivo, texto) => {
    const texto2 = motivoDeBloqueo(cotizacion([linea({ reason: motivo, priorAuthorizationStatus: 'MISSING' })]));
    expect(texto2).toContain(texto);
    expect(texto2).not.toMatch(/\b(tú|tu|vos|tenés|podés|revisá)\b/i);
  });
});
