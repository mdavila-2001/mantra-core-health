import type { Symptom } from './symptoms.data';

/** Sex from the patient's own profile, when it is known (P-04). */
export type KnownSex = 'MALE' | 'FEMALE';

/** Specialties that only treat one sex: a man is never sent to Gynecology or Obstetrics. */
const SPECIALTY_ONLY_FOR: ReadonlyMap<string, KnownSex> = new Map([
  ['Ginecología', 'FEMALE'],
  ['Obstetricia', 'FEMALE'],
]);

/** Whether a symptom fits the profile's sex. Unknown sex filters nothing. */
export function fitsSex(symptom: Symptom, sex: KnownSex | undefined): boolean {
  return sex === undefined || symptom.soloParaSexo === undefined || symptom.soloParaSexo === sex;
}

/**
 * The symptom without the specialties that do not treat the profile's sex:
 * «un bulto en la mama» in a man's account goes to Oncology/Surgery, not Gynecology.
 */
export function withSpecialtiesForSex(symptom: Symptom, sex: KnownSex | undefined): Symptom {
  if (sex === undefined) return symptom;
  const especialidades = symptom.especialidades.filter((e) => (SPECIALTY_ONLY_FOR.get(e.nombre) ?? sex) === sex);
  return especialidades.length === symptom.especialidades.length ? symptom : { ...symptom, especialidades };
}
