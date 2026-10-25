import { PERFORMER_SELECTION_CODES, performerSelectionCodeOf } from './service-request-performer.types';

describe('performerSelectionCodeOf', () => {
  it.each([
    ['SELF', 'SELF'],
    ['ORGANIZATION', 'ORGANIZATION'],
    ['PATIENT_CHOICE', 'PATIENT_CHOICE'],
    ['SR_PERF_SELF', 'SELF'],
    ['SR_PERF_ORGANIZATION', 'ORGANIZATION'],
    ['SR_PERF_PATIENT_CHOICE', 'PATIENT_CHOICE'],
    ['clinical:SR_PERF_SELF', 'SELF'],
    ['clinical:ORGANIZATION', 'ORGANIZATION'],
  ])('%s → %s', (codigo, modo) => {
    expect(performerSelectionCodeOf(codigo)).toBe(modo);
  });

  it('un código que no es de los tres, o ausente, no se interpreta', () => {
    expect(performerSelectionCodeOf('SR_PERF_OTRO')).toBeNull();
    expect(performerSelectionCodeOf('self')).toBeNull();
    expect(performerSelectionCodeOf('')).toBeNull();
    expect(performerSelectionCodeOf(undefined)).toBeNull();
    expect(performerSelectionCodeOf(null)).toBeNull();
  });

  it('son exactamente tres modos', () => {
    expect([...PERFORMER_SELECTION_CODES].sort()).toEqual(['ORGANIZATION', 'PATIENT_CHOICE', 'SELF']);
  });
});
