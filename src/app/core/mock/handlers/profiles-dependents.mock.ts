import { KINSHIP } from '../fixtures/concepts';
import { patientById } from '../fixtures/people';
import type { ApoderamientoSimulado } from './profiles.handlers';

/**
 * Dependent summaries of the mock, as `GET /profiles/patients/me/dependents`
 * returns them. Split out of `profiles.handlers.ts` (frozen in max-lines).
 */

/**
 * Qué es el dependiente para quien lo representa, ya dado vuelta.
 *
 * Espeja `describeDependentRelationship` de la API: la maqueta tiene que decir
 * lo mismo que el servidor, o la pantalla se vería distinta según contra qué
 * corra.
 */
function parentescoInvertido(conceptId: string): { code: string; display: string } {
  const codigo = Object.entries(KINSHIP).find(([, id]) => id === conceptId)?.[0];
  if (codigo === 'RELATIONSHIP_MOTHER' || codigo === 'RELATIONSHIP_FATHER') {
    return { code: 'CHILD', display: 'Hijo/a' };
  }
  if (codigo === 'RELATIONSHIP_CHILD') return { code: 'PARENT', display: 'Padre/Madre' };
  if (codigo === 'RELATIONSHIP_SPOUSE') return { code: 'SPOUSE', display: 'Cónyuge' };
  if (codigo === 'RELATIONSHIP_GUARDIAN') return { code: 'WARD', display: 'Tutelado/a' };
  return { code: 'OTHER', display: 'Otro/a' };
}

/** El resumen que devuelve la API para cada dependiente. */
export function resumenDeDependiente(apoderamiento: ApoderamientoSimulado) {
  const p = patientById(apoderamiento.dependienteId);
  const relacion = parentescoInvertido(apoderamiento.relationshipConceptId);
  return {
    id: apoderamiento.id,
    patientProfileId: apoderamiento.dependienteId,
    personId: p?.personId ?? apoderamiento.dependienteId,
    fullName: p?.displayName ?? '',
    ...(p?.name === undefined || p.name === '' ? {} : { name: p.name }),
    ...(p?.lastName === undefined || p.lastName === '' ? {} : { lastName: p.lastName }),
    ...(p?.birthDate === undefined || p.birthDate === ''
      ? {}
      : { birthDate: p.birthDate, ageYears: edadEnAnios(p.birthDate) }),
    ...(p?.nationalId === undefined || p.nationalId === '' ? {} : { nationalId: p.nationalId }),
    // Like the API: the booking body map draws the dependent with this.
    ...(p?.sexAtBirth === undefined ? {} : { sexAtBirth: p.sexAtBirth }),
    relationshipCode: relacion.code,
    relationshipDisplay: relacion.display,
    isLegalGuardian: true,
  };
}

/** Edad cumplida, con la misma cuenta que hace el servidor. */
function edadEnAnios(fecha: string): number {
  const nacimiento = new Date(fecha);
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - nacimiento.getUTCFullYear();
  const mes = hoy.getUTCMonth() - nacimiento.getUTCMonth();
  if (mes < 0 || (mes === 0 && hoy.getUTCDate() < nacimiento.getUTCDate())) anios -= 1;
  return Math.max(anios, 0);
}
