import { buildOverride, cleanAdmission, isJustificationValid, justificationLength, justificationMissing, stayDays } from './adt.logic';
import type { AdmissionRequest, CompatibilityViolation } from './adt.types';

describe('lógica de internación', () => {
  it('la justificación cuenta sin los espacios de borde', () => {
    expect(justificationLength('   abc   ')).toBe(3);
    expect(isJustificationValid(`  ${'a'.repeat(19)}  `)).toBe(false);
    expect(isJustificationValid(`  ${'a'.repeat(20)}  `)).toBe(true);
    expect(justificationMissing('a'.repeat(5))).toBe(15);
    expect(justificationMissing('a'.repeat(30))).toBe(0);
  });

  it('el espacio del medio sí cuenta', () => {
    expect(isJustificationValid('a'.repeat(10) + ' ' + 'b'.repeat(9))).toBe(true);
  });

  it('el override junta solo las reglas forzables, sin repetir, y recorta el texto', () => {
    const v: CompatibilityViolation[] = [
      { rule: 'SEX', severity: 'OVERRIDABLE', detail: 'x' },
      { rule: 'AGE', severity: 'OVERRIDABLE', detail: 'y' },
      { rule: 'SEX', severity: 'OVERRIDABLE', detail: 'z' },
      { rule: 'HYGIENE', severity: 'BLOCKING', detail: 'w' },
    ];
    expect(buildOverride(v, '  motivo suficiente de verdad  ')).toEqual({ justification: 'motivo suficiente de verdad', ruleCodes: ['SEX', 'AGE'] });
  });

  it('el cuerpo del ingreso omite lo vacío y lo indefinido', () => {
    const body = { patientProfileId: 'p', practiceSiteId: 's', attendingPractitionerId: 'a', levelOfCareCode: 'L', admissionSourceCode: 'A', reasonText: 'r', isolationOrganismText: '', expectedDischargeAt: undefined } as AdmissionRequest;
    expect(Object.keys(cleanAdmission(body)).sort()).toEqual(['admissionSourceCode', 'attendingPractitionerId', 'levelOfCareCode', 'patientProfileId', 'practiceSiteId', 'reasonText']);
  });

  it('los días de estancia son la diferencia de fechas locales, mínimo 1', () => {
    expect(stayDays('2026-10-01T14:00:00Z', '2026-10-01T20:00:00Z')).toBe(1);
    expect(stayDays('2026-10-01T14:00:00Z', '2026-10-04T08:00:00Z')).toBe(3);
    // 23:30 local del 1 y 00:30 local del 2: dos fechas distintas, un día.
    expect(stayDays('2026-10-02T03:30:00Z', '2026-10-02T04:30:00Z')).toBe(1);
  });
});
