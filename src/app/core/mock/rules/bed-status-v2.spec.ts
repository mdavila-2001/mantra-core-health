import { bedStatusV2, isAssignable, type BedAxes } from './bed-status-v2';

/** Prueba de tabla de F2.5 #9: las siete reglas, en orden de precedencia. */
describe('bedStatusV2 (HL7 v2-0116)', () => {
  const base: BedAxes = {
    lifecycleCode: 'SPACE_ACTIVE',
    availabilityCode: 'SPACE_OP_AVAILABLE',
    hygieneCode: 'HYG_INSPECTED',
    isolationCode: 'ISO_NONE',
    occupancyCode: 'OCC_FREE',
    terminalCleaningRequired: false,
    inspectionRequired: true,
  };

  const casos: readonly [string, Partial<BedAxes>, string][] = [
    ['1 · bloqueada', { availabilityCode: 'SPACE_OP_BLOCKED_CLINICAL' }, 'C'],
    ['1 · mantenimiento', { availabilityCode: 'SPACE_OP_MAINTENANCE' }, 'C'],
    ['1 · cerrada', { availabilityCode: 'SPACE_OP_CLOSED' }, 'C'],
    ['1 · ciclo suspendido', { lifecycleCode: 'SPACE_SUSPENDED' }, 'C'],
    ['1 gana sobre 2 y 4', { availabilityCode: 'SPACE_OP_BLOCKED_ADMIN', hygieneCode: 'HYG_CONTAMINATED', occupancyCode: 'OCC_OCCUPIED' }, 'C'],
    ['2 · contaminada', { hygieneCode: 'HYG_CONTAMINATED' }, 'K'],
    ['2 gana sobre 3', { hygieneCode: 'HYG_CONTAMINATED', isolationCode: 'ISO_AIRBORNE' }, 'K'],
    ['3 · aislamiento', { isolationCode: 'ISO_CONTACT' }, 'I'],
    ['3 gana sobre 4', { isolationCode: 'ISO_DROPLET', occupancyCode: 'OCC_OCCUPIED' }, 'I'],
    ['4 · ocupada', { occupancyCode: 'OCC_OCCUPIED', hygieneCode: 'HYG_DIRTY' }, 'O'],
    ['5 · reservada', { occupancyCode: 'OCC_RESERVED' }, 'R'],
    ['6 · sucia', { hygieneCode: 'HYG_DIRTY' }, 'H'],
    ['6 · limpiando', { hygieneCode: 'HYG_CLEANING' }, 'H'],
    ['6 · limpia sin inspeccionar', { hygieneCode: 'HYG_CLEAN' }, 'H'],
    ['6 · terminal pendiente', { terminalCleaningRequired: true }, 'H'],
    ['7 · limpia sin inspección exigida', { hygieneCode: 'HYG_CLEAN', inspectionRequired: false }, 'U'],
    ['7 · inspeccionada', {}, 'U'],
  ];

  for (const [nombre, cambios, esperado] of casos) {
    it(`regla ${nombre} → ${esperado}`, () => {
      expect(bedStatusV2({ ...base, ...cambios })).toBe(esperado);
    });
  }

  it('asignable sólo si está libre, disponible, activa e inspeccionada', () => {
    expect(isAssignable(base)).toBe(true);
    expect(isAssignable({ ...base, hygieneCode: 'HYG_CLEAN' })).toBe(false);
    expect(isAssignable({ ...base, hygieneCode: 'HYG_CLEAN', inspectionRequired: false })).toBe(true);
    expect(isAssignable({ ...base, terminalCleaningRequired: true })).toBe(false);
    expect(isAssignable({ ...base, occupancyCode: 'OCC_RESERVED' })).toBe(false);
    expect(isAssignable({ ...base, availabilityCode: 'SPACE_OP_MAINTENANCE' })).toBe(false);
    expect(isAssignable({ ...base, lifecycleCode: 'SPACE_PLANNED' })).toBe(false);
    expect(isAssignable({ ...base, inForce: false })).toBe(false);
  });
});
