import type { Condition } from '../../core/data-access/clinical/clinical.types';
import { diagnosisStateOf } from './diagnosis-state';

/** Identificadores sintéticos: el helper recibe IDs, no etiquetas ni códigos fijos. */
const CODES = { confirmed: 'confirmed-id', refuted: 'refuted-id', active: 'active-id' };
const NOW = new Date('2026-09-25T12:00:00.000Z');

function condition(fields: Partial<Condition> = {}): Condition {
  return {
    id: 'condition-id',
    codeConceptId: 'diagnosis-id',
    verificationStatusConceptId: CODES.confirmed,
    clinicalStatusConceptId: CODES.active,
    createdAt: NOW,
    ...fields,
  };
}

describe('diagnosisStateOf: ocho escenarios del contrato C0', () => {
  it('confirmado y activo sin fin esperado permanece activo', () => {
    expect(diagnosisStateOf(condition(), CODES, NOW)).toBe('ACTIVE');
  });

  it('el fin futuro o exactamente igual a ahora sigue vigente, con reloj inyectado o actual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      for (const expectedResolutionAt of [
        new Date('2026-09-25T12:00:00.001Z'),
        new Date('2026-09-25T08:00:00.000-04:00'),
      ]) {
        expect(diagnosisStateOf(condition({ expectedResolutionAt }), CODES, NOW)).toBe('ACTIVE');
        expect(diagnosisStateOf(condition({ expectedResolutionAt }), CODES)).toBe('ACTIVE');
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it('el fin ya vencido pasa a histórico aunque haya vencido en el mismo día', () => {
    const expired = condition({ expectedResolutionAt: new Date('2026-09-25T11:59:59.999Z') });

    expect(diagnosisStateOf(expired, CODES, NOW)).toBe('HISTORIC');
  });

  it('la fecha de resolución cierra un diagnóstico confirmado aunque el estado siga activo', () => {
    const resolved = condition({ resolvedAt: new Date('2026-09-24T12:00:00.000Z') });

    expect(diagnosisStateOf(resolved, CODES, NOW)).toBe('HISTORIC');
  });

  it('confirmado con estado resuelto, en remisión o sin estado clínico es histórico', () => {
    for (const clinicalStatusConceptId of ['resolved-id', 'remission-id', undefined]) {
      expect(diagnosisStateOf(condition({ clinicalStatusConceptId }), CODES, NOW)).toBe('HISTORIC');
    }
  });

  it('provisional, diferencial o sin certeza sigue en estudio aunque tenga resolución', () => {
    for (const verificationStatusConceptId of ['provisional-id', 'differential-id', undefined]) {
      const unconfirmed = condition({
        verificationStatusConceptId,
        resolvedAt: new Date('2026-09-24T12:00:00.000Z'),
      });
      expect(diagnosisStateOf(unconfirmed, CODES, NOW)).toBe('IN_STUDY');
    }
  });

  it('rechazado tiene precedencia sobre el estado clínico y las fechas de resolución', () => {
    const refuted = condition({
      verificationStatusConceptId: CODES.refuted,
      resolvedAt: NOW,
      expectedResolutionAt: new Date('2026-09-24T12:00:00.000Z'),
    });

    expect(diagnosisStateOf(refuted, CODES, NOW)).toBe('REFUTED');
  });

  it('un diagnóstico crónico confirmado y activo sin fin esperado permanece activo', () => {
    const chronic = condition({ clinicalCourseConceptId: 'chronic-id' });

    expect(diagnosisStateOf(chronic, CODES, NOW)).toBe('ACTIVE');
  });
});
