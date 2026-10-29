import type { PlacementCard, SpacePlacementDTO, SpaceState } from '../data-access/floor-plan/floor-plan.types';
import { buildCardModel, reasonNotAssignable } from './card-model';
import { toSpaceView } from './plan-view';

const NOW = Date.parse('2026-10-29T12:00:00Z');
const card: PlacementCard = {
  formDisplay: 'Local', functionDisplay: 'Habitación de internación',
  lifecycle: { code: 'SPACE_ACTIVE', display: 'Activo' },
  ownerUnit: { id: 'u', code: 'MED', name: 'Medicina interna' }, capacity: 2, bedCount: 2, censableBeds: 2, areaDeclaredM2: 42.5,
  technical: { pressure: 'Negativa', airChangesPerHour: 12 },
  path: [{ id: 'a', code: 'A', name: 'Piso 1', form: 'LEVEL' }, { id: 'b', code: 'B', name: 'Internación Medicina', form: 'WARD' }],
};
const dto = (over: Partial<SpacePlacementDTO> = {}): SpacePlacementDTO => ({
  placementId: 'p', spaceId: 's', rowVersion: 1, zOrder: 10, locked: false, inScope: true, bbox: [0, 0, 5, 8.5], areaCalcM2: 42.5,
  geometry: { kind: 'RECT', centerXM: 2.5, centerYM: 4.25, widthM: 5, depthM: 8.5, rotationDeg: 0 },
  code: 'PLANO-P1-101', name: 'Habitación 101', form: { code: 'ROOM' }, function: { code: 'INPATIENT_ROOM' }, parentId: null, card, ...over,
});
const state = (over: Partial<SpaceState> = {}): SpaceState => ({
  lifecycle: { code: 'SPACE_ACTIVE' },
  availability: { code: 'SPACE_OP_AVAILABLE', since: '2026-10-29T08:00:00Z' },
  occupancy: { code: 'OCC_OCCUPIED', since: '2026-10-29T10:00:00Z', patient: { initials: 'CQM', sexCode: 'F', ageYears: 67 } },
  hygiene: { code: 'HYG_CLEAN', since: '2026-10-29T11:25:00Z', terminalRequired: false },
  isolation: { code: 'ISO_NONE', since: '2026-10-28T08:00:00Z' },
  v2Code: 'O', assignable: false, lastEventAt: '2026-10-29T11:00:00Z', opsVersion: 1, ...over,
});
const base = { rollup: undefined, asOf: '2026-10-29T11:58:00Z', now: NOW, canSeeState: true, canSeePatient: true, patientName: null };

describe('modelo de la tarjeta', () => {
  it('trae todas las filas del §5.6: título, ruta, función, unidad, ciclo, estados, técnicos y antigüedad', () => {
    const m = buildCardModel({ ...base, space: toSpaceView(dto()), state: state() });
    expect(m.title).toBe('PLANO-P1-101 · Habitación 101');
    expect(m.path).toBe('Piso 1 › Internación Medicina');
    expect(m.kind).toBe('Habitación de internación · Local');
    expect(m.ownerUnit).toBe('Medicina interna');
    expect(m.lifecycle).toBe('Activo');
    expect(m.rows.map((r) => r.axis)).toEqual(['availability', 'occupancy', 'hygiene', 'isolation']);
    expect(m.rows[2]!.detail).toBe('desde hace 35 min');
    expect(m.technical.map((t) => t.label)).toEqual(['Área declarada', 'Área dibujada', 'Presión', 'Recambios de aire']);
    expect(m.ageText).toBe('Dato de hace 2 min');
    expect(m.stale).toBe(false);
  });

  it('desactualizado pasados 120 s', () => {
    const m = buildCardModel({ ...base, asOf: '2026-10-29T11:56:00Z', space: toSpaceView(dto()), state: state() });
    expect(m.stale).toBe(true);
    expect(m.ageText).toBe('Dato de hace 4 min');
  });

  it('el paciente: iniciales solo si canSeePatient y la API mandó la clave', () => {
    expect(buildCardModel({ ...base, space: toSpaceView(dto()), state: state() }).patientLine).toBe('CQM · Femenino · 67 años');
    expect(buildCardModel({ ...base, canSeePatient: false, space: toSpaceView(dto()), state: state() }).patientLine).toBeNull();
    const withoutKey = state({ occupancy: { code: 'OCC_OCCUPIED', since: '2026-10-29T10:00:00Z' } });
    const m = buildCardModel({ ...base, space: toSpaceView(dto()), state: withoutKey });
    expect(m.patientLine).toBeNull();
    expect(m.rows[1]!.visual.label).toBe('Ocupada');
  });

  it('el nombre del paciente solo aparece si hay línea de paciente; nunca por sí solo', () => {
    expect(buildCardModel({ ...base, patientName: 'Carmen Quispe', space: toSpaceView(dto()), state: state() }).patientName).toBe('Carmen Quispe');
    expect(buildCardModel({ ...base, canSeePatient: false, patientName: 'Carmen Quispe', space: toSpaceView(dto()), state: state() }).patientName).toBeNull();
  });

  it('la serialización completa de la tarjeta de Limpieza no contiene datos de persona', () => {
    const noPatient = state({ occupancy: { code: 'OCC_OCCUPIED', since: '2026-10-29T10:00:00Z' } });
    const model = buildCardModel({ ...base, canSeePatient: false, space: toSpaceView(dto()), state: noPatient });
    expect(model.patientLine).toBeNull();
    expect(model.patientName).toBeNull();
    expect(JSON.stringify(model)).not.toMatch(/CQM|Quispe|años/);
  });

  it('sin permiso de estado: no hay filas y se explica por qué', () => {
    const m = buildCardModel({ ...base, canSeeState: false, space: toSpaceView(dto()), state: undefined });
    expect(m.rows).toEqual([]);
    expect(m.noStateText).toContain('rol');
  });

  it('con el layout lite aún sin ficha: marca las filas faltantes como cargando', () => {
    const m = buildCardModel({ ...base, space: toSpaceView(dto({ card: undefined })), state: state() });
    expect(m.loadingStatic).toBe(true);
    expect(m.path).toBeNull();
  });

  it('fuera de alcance: solo la leyenda, sin código, nombre ni estado', () => {
    const m = buildCardModel({ ...base, space: toSpaceView(dto({ inScope: false, code: undefined, name: undefined, card: undefined })), state: state() });
    expect(m).toMatchObject({ inScope: false, title: 'Espacio fuera de su alcance', rows: [] });
    expect(JSON.stringify(m)).not.toContain('P1-101');
  });

  it('modo elegir cama: explica el motivo de cada cama no asignable', () => {
    const m = buildCardModel({ ...base, pickMode: true, space: toSpaceView(dto()), state: state() });
    expect(m.assignable).toBe(false);
    expect(m.notAssignableWhy).toBe('Está ocupada.');
    expect(reasonNotAssignable(state({ availability: { code: 'SPACE_OP_MAINTENANCE', reasonText: 'Falla del riel', since: 'x' } }))).toBe('Falla del riel');
    expect(reasonNotAssignable(state({ occupancy: { code: 'OCC_FREE', since: 'x' }, hygiene: { code: 'HYG_DIRTY', since: 'x', terminalRequired: false } }))).toBe('Falta limpiarla o inspeccionarla.');
  });

  it('el aislamiento muestra el organismo', () => {
    const m = buildCardModel({ ...base, space: toSpaceView(dto()), state: state({ isolation: { code: 'ISO_AIRBORNE', organism: 'Tuberculosis', since: '2026-10-29T08:00:00Z' } }) });
    expect(m.rows[3]!.detail).toContain('Tuberculosis');
    expect(m.rows[3]!.visual.mark).toBe('A');
  });
});
