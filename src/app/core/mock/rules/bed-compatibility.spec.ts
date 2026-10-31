import { evaluateCompatibility, overrideProblem, type CompatibilityInput } from './bed-compatibility';

describe('compatibilidad cama ↔ paciente (F3.2)', () => {
  const base: CompatibilityInput = {
    bed: { lifecycleCode: 'SPACE_ACTIVE', availabilityCode: 'SPACE_OP_AVAILABLE', occupancyCode: 'OCC_FREE', hygieneReady: true, functionCode: 'SPACE_FN_BED_STANDARD', ageGroupCode: null },
    room: { functionCode: 'SPACE_FN_INPATIENT_ROOM', sexRestrictionCode: 'SEX_ANY', ageGroupCode: 'AGE_ADULT', pressureCode: null, hvacValid: false },
    roommates: [],
    patient: { sexCode: 'MALE', ageYears: 60, ageDays: 22_000 },
    encounter: { levelOfCareCode: 'LOC_CARE_GENERAL', isolationCode: 'ISO_NONE', organism: null, cohortApproved: false },
  };
  const reglas = (i: CompatibilityInput) => evaluateCompatibility(i).map((v) => `${v.rule}:${v.severity}`);

  it('una cama libre y apta no tiene violaciones', () => {
    expect(reglas(base)).toEqual([]);
  });

  it('ocupación, higiene, disponibilidad y ciclo bloquean y no se fuerzan', () => {
    const r = reglas({ ...base, bed: { ...base.bed, lifecycleCode: 'SPACE_SUSPENDED', availabilityCode: 'SPACE_OP_MAINTENANCE', occupancyCode: 'OCC_OCCUPIED', hygieneReady: false } });
    expect(r).toEqual(['LIFECYCLE:BLOCKING', 'AVAILABILITY:BLOCKING', 'OCCUPANCY:BLOCKING', 'HYGIENE:BLOCKING']);
  });

  it('paciente masculino en habitación SEX_FEMALE: forzable', () => {
    expect(reglas({ ...base, room: { ...base.room, sexRestrictionCode: 'SEX_FEMALE' } })).toEqual(['SEX:OVERRIDABLE']);
  });

  it('habitación compartida con otro sexo (regla NHS)', () => {
    expect(reglas({ ...base, roommates: [{ sexCode: 'FEMALE', isolationCode: 'ISO_NONE', organism: null }] })).toEqual(['SEX:OVERRIDABLE']);
  });

  it('aislamiento aéreo fuera de AIIR validado: bloqueante', () => {
    const aereo = { ...base, encounter: { ...base.encounter, isolationCode: 'ISO_AIRBORNE', organism: 'M. tuberculosis' } };
    expect(reglas(aereo)).toEqual(['ISOLATION_AIRBORNE:BLOCKING']);
    const aiir = { ...aereo, room: { ...base.room, functionCode: 'SPACE_FN_ISOLATION_AIIR', pressureCode: 'PRESSURE_NEGATIVE', hvacValid: true } };
    expect(reglas(aiir)).toEqual([]);
  });

  it('edad: pediátrico en cama de adultos', () => {
    expect(reglas({ ...base, patient: { sexCode: 'MALE', ageYears: 11, ageDays: 4000 } })).toEqual(['AGE:OVERRIDABLE']);
  });

  it('cohorte: sólo mismo organismo y con aval', () => {
    const vecino = [{ sexCode: 'MALE', isolationCode: 'ISO_CONTACT', organism: 'KPC' }];
    const withPrecaution = { ...base, roommates: vecino, encounter: { ...base.encounter, isolationCode: 'ISO_CONTACT', organism: 'KPC' } };
    expect(reglas(withPrecaution)).toEqual(['ISOLATION_COHORT:OVERRIDABLE']);
    expect(reglas({ ...withPrecaution, encounter: { ...withPrecaution.encounter, cohortApproved: true } })).toEqual([]);
    expect(reglas({ ...base, roommates: vecino })).toEqual(['ISOLATION_COHORT:OVERRIDABLE']);
  });

  it('nivel de cuidado: UTI en cama estándar', () => {
    expect(reglas({ ...base, encounter: { ...base.encounter, levelOfCareCode: 'LOC_CARE_ICU' } })).toEqual(['LEVEL_OF_CARE:OVERRIDABLE']);
  });

  it('forzado: bloqueantes nunca, forzables con justificación de 20+ caracteres que cubra cada regla', () => {
    const sexo = evaluateCompatibility({ ...base, room: { ...base.room, sexRestrictionCode: 'SEX_FEMALE' } });
    expect(overrideProblem(sexo, undefined)).toBe('BED_COMPATIBILITY_OVERRIDE_REQUIRED');
    expect(overrideProblem(sexo, { justification: 'corta', ruleCodes: ['SEX'] })).toBe('OVERRIDE_JUSTIFICATION_TOO_SHORT');
    expect(overrideProblem(sexo, { justification: 'Única cama libre del piso, paciente estable', ruleCodes: ['SEX'] })).toBeNull();
    expect(overrideProblem(sexo, { justification: 'Única cama libre del piso, paciente estable', ruleCodes: ['SEX', 'HYGIENE'] })).toBe('OVERRIDE_RULE_NOT_OVERRIDABLE');
    const ocupada = evaluateCompatibility({ ...base, bed: { ...base.bed, occupancyCode: 'OCC_OCCUPIED' } });
    expect(overrideProblem(ocupada, { justification: 'Única cama libre del piso, paciente estable', ruleCodes: ['SEX'] })).toBe('BED_NOT_ASSIGNABLE');
  });
});
