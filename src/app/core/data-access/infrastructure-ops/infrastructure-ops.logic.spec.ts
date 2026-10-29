import {
  ageLabel,
  countCells,
  hasOperationalState,
  isAssignable,
  offerCellActions,
  offerCleaningActions,
  shortDateTime,
  sortCleaningQueue,
  summarizeCell,
  v2CodeOf,
  type AxesInput,
} from './infrastructure-ops.logic';
import type { BedBoardCell, CleaningOrder, OpsAction, OpsViewer } from './infrastructure-ops.types';

const base: AxesInput = {
  lifecycleActive: true,
  availability: 'SPACE_OP_AVAILABLE',
  hygiene: 'HYG_INSPECTED',
  terminalRequired: false,
  isolation: 'ISO_NONE',
  occupancy: 'OCC_FREE',
  inspectionRequired: true,
};

const viewer = (...actions: OpsAction[]): OpsViewer => ({ role: 'NURSING', actions });

function cell(patch: Partial<BedBoardCell> = {}): BedBoardCell {
  return {
    id: 'c1',
    code: '302-A',
    name: 'Cama 302-A',
    path: [],
    form: { code: 'LOC_FORM_BED', display: 'Cama' },
    function: { code: 'SPACE_FN_BED_STANDARD', display: 'Cama estándar' },
    lifecycle: { code: 'SPACE_ACTIVE', display: 'Activo' },
    availability: { code: 'SPACE_OP_AVAILABLE', reasonCode: null, reasonText: null, expectedUntil: null, since: '2026-10-29T10:00:00Z' },
    hygiene: { code: 'HYG_INSPECTED', since: '2026-10-29T10:00:00Z', terminalRequired: false },
    isolation: { code: 'ISO_NONE', since: '2026-10-29T10:00:00Z' },
    occupancy: { code: 'OCC_FREE', since: '2026-10-29T10:00:00Z' },
    v2Code: 'U',
    assignable: true,
    openCleaningOrderId: null,
    lastEventAt: '2026-10-29T10:00:00Z',
    opsVersion: 1,
    ...patch,
  };
}

function order(patch: Partial<CleaningOrder> = {}): CleaningOrder {
  return {
    id: 'o1',
    siteId: 's',
    careSpace: { id: 'c1', code: '302-A', name: 'Cama', pathLabel: '' },
    clinicalUnit: null,
    cleaningType: 'CLEAN_DISCHARGE',
    trigger: 'CLN_TRG_DISCHARGE',
    priority: 'CLN_PRIO_ROUTINE',
    status: 'CLN_PENDING',
    requestedAt: '2026-10-29T10:00:00Z',
    dueAt: null,
    assignedTo: null,
    startedAt: null,
    finishedAt: null,
    finishedByUserId: null,
    inspectedAt: null,
    inspectionResult: null,
    rejectionReason: null,
    cancelReason: null,
    previousOrderId: null,
    note: null,
    rowVersion: 1,
    ...patch,
  };
}

describe('operación de camas · lógica pura', () => {
  describe('mapeo v2-0116 (§F2.2): las siete reglas, en orden', () => {
    it.each([
      ['1 · disponibilidad distinta de «disponible»', { availability: 'SPACE_OP_MAINTENANCE' as const }, 'C'],
      ['1 · ciclo de vida inactivo', { lifecycleActive: false }, 'C'],
      ['2 · higiene contaminada', { hygiene: 'HYG_CONTAMINATED' as const }, 'K'],
      ['3 · con aislamiento', { isolation: 'ISO_DROPLET' as const }, 'I'],
      ['4 · ocupada', { occupancy: 'OCC_OCCUPIED' as const }, 'O'],
      ['5 · reservada', { occupancy: 'OCC_RESERVED' as const }, 'R'],
      ['6 · sucia', { hygiene: 'HYG_DIRTY' as const }, 'H'],
      ['6 · en limpieza', { hygiene: 'HYG_CLEANING' as const }, 'H'],
      ['6 · limpia sin inspeccionar (inspección exigida)', { hygiene: 'HYG_CLEAN' as const }, 'H'],
      ['6 · limpieza terminal pendiente', { terminalRequired: true }, 'H'],
      ['7 · el resto', {}, 'U'],
    ])('%s → %s', (_regla, patch, esperado) => {
      expect(v2CodeOf({ ...base, ...patch })).toBe(esperado);
    });

    it('la primera regla que aplica gana: contaminada y aislada y ocupada es K; aislada y ocupada es I', () => {
      expect(v2CodeOf({ ...base, hygiene: 'HYG_CONTAMINATED', isolation: 'ISO_AIRBORNE', occupancy: 'OCC_OCCUPIED' })).toBe('K');
      expect(v2CodeOf({ ...base, isolation: 'ISO_AIRBORNE', occupancy: 'OCC_OCCUPIED' })).toBe('I');
      expect(v2CodeOf({ ...base, availability: 'SPACE_OP_CLOSED', hygiene: 'HYG_CONTAMINATED' })).toBe('C');
    });

    it('limpia sin inspección es U cuando el establecimiento no exige inspeccionar', () => {
      expect(v2CodeOf({ ...base, hygiene: 'HYG_CLEAN', inspectionRequired: false })).toBe('U');
    });
  });

  describe('asignable', () => {
    it('solo inspeccionada (o limpia sin exigir inspección), libre, disponible, activa y sin bandera terminal', () => {
      expect(isAssignable(base)).toBe(true);
      expect(isAssignable({ ...base, hygiene: 'HYG_CLEAN' })).toBe(false);
      expect(isAssignable({ ...base, hygiene: 'HYG_CLEAN', inspectionRequired: false })).toBe(true);
      expect(isAssignable({ ...base, terminalRequired: true })).toBe(false);
      expect(isAssignable({ ...base, occupancy: 'OCC_RESERVED' })).toBe(false);
      expect(isAssignable({ ...base, availability: 'SPACE_OP_BLOCKED_CLINICAL' })).toBe(false);
      expect(isAssignable({ ...base, lifecycleActive: false })).toBe(false);
    });
  });

  describe('recuentos', () => {
    it('se cuentan de las celdas y agrupan como el contrato', () => {
      const cells = [
        cell(),
        cell({ id: 'c2', occupancy: { code: 'OCC_OCCUPIED', since: '' }, assignable: false, v2Code: 'O' }),
        cell({ id: 'c3', availability: { ...cell().availability, code: 'SPACE_OP_MAINTENANCE' }, assignable: false, v2Code: 'C' }),
        cell({ id: 'c4', availability: { ...cell().availability, code: 'SPACE_OP_CLOSED' }, assignable: false, v2Code: 'C' }),
        cell({ id: 'c5', hygiene: { code: 'HYG_CLEANING', since: '', terminalRequired: false }, assignable: false, v2Code: 'H' }),
        cell({ id: 'c6', isolation: { code: 'ISO_CONTACT', since: '' }, assignable: false, v2Code: 'I' }),
      ];
      expect(countCells(cells)).toEqual({
        total: 6, assignable: 1, occupied: 1, reserved: 0, blocked: 1, maintenance: 1, dirty: 0, cleaning: 1, isolation: 1, contaminated: 0,
      });
    });
  });

  describe('tiempo', () => {
    const now = new Date('2026-10-29T12:00:00Z');
    it.each([
      ['2026-10-29T11:59:58Z', 'hace un momento'],
      ['2026-10-29T11:59:25Z', 'hace 35 s'],
      ['2026-10-29T11:56:00Z', 'hace 4 min'],
      ['2026-10-29T09:00:00Z', 'hace 3 h'],
      ['2026-10-27T12:00:00Z', 'hace 2 d'],
    ])('%s → %s', (iso, texto) => expect(ageLabel(iso, now)).toBe(texto));

    it('«hasta» se escribe en hora de La Paz: día/mes hh:mm', () => {
      expect(shortDateTime('2026-10-30T22:00:00Z')).toBe('30/10 18:00');
      expect(shortDateTime(null)).toBe('—');
    });
  });

  describe('qué decir de una celda', () => {
    it('un mantenimiento dice el motivo y hasta cuándo, no «disponible»', () => {
      const c = cell({
        v2Code: 'C',
        assignable: false,
        availability: { code: 'SPACE_OP_MAINTENANCE', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', reasonText: null, expectedUntil: '2026-10-30T22:00:00Z', since: '' },
      });
      expect(summarizeCell(c)).toEqual({ headline: 'Mantenimiento preventivo', detail: 'hasta 30/10 18:00' });
    });

    it('un bloqueo dice el tipo y el motivo cuando el motivo no repite el tipo', () => {
      const c = cell({
        v2Code: 'C',
        availability: { code: 'SPACE_OP_BLOCKED_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE', reasonText: null, expectedUntil: null, since: '' },
      });
      expect(summarizeCell(c)).toEqual({ headline: 'Bloqueo clínico · Falta de personal', detail: null });
    });

    it('sin permiso para ver al paciente, ocupada no inventa datos', () => {
      expect(summarizeCell(cell({ v2Code: 'O', occupancy: { code: 'OCC_OCCUPIED', since: '' } })).headline).toBe('Con paciente internado');
    });

    it('ocupada muestra iniciales y edad, nunca más del paciente', () => {
      const c = cell({ v2Code: 'O', occupancy: { code: 'OCC_OCCUPIED', since: '', patient: { initials: 'M.R.', sexCode: 'F', ageYears: 54 } } });
      expect(summarizeCell(c).headline).toBe('M.R. · 54 a');
    });

    it('limpia sin inspección y terminal pendiente se distinguen', () => {
      expect(summarizeCell(cell({ v2Code: 'H', hygiene: { code: 'HYG_CLEAN', since: '', terminalRequired: false } })).headline).toBe('Limpia, falta inspección');
      expect(summarizeCell(cell({ v2Code: 'H', hygiene: { code: 'HYG_DIRTY', since: '', terminalRequired: true } })).headline).toBe('Limpieza terminal pendiente');
    });
  });

  describe('qué se ofrece (solo refleja)', () => {
    const codes = (c: BedBoardCell, v: OpsViewer | undefined): string[] => offerCellActions(c, v).map((x) => x.code);

    it('enfermería: bloqueo clínico, sucia, contaminada y aislar sobre una cama libre', () => {
      expect(codes(cell(), viewer('block-clinical', 'mark-dirty', 'mark-contaminated', 'isolate'))).toEqual([
        'block-clinical', 'mark-dirty', 'mark-contaminated', 'isolate',
      ]);
    });

    it('una cama ocupada o reservada no ofrece bloquear ni cerrar', () => {
      const ocupada = cell({ occupancy: { code: 'OCC_OCCUPIED', since: '' }, v2Code: 'O', assignable: false });
      expect(codes(ocupada, viewer('block-clinical', 'block-administrative', 'maintenance', 'close'))).toEqual([]);
    });

    it('limpieza solo puede marcar sucia; sin ningún permiso no se ofrece nada', () => {
      expect(codes(cell(), viewer('mark-dirty', 'clean'))).toEqual(['mark-dirty']);
      expect(codes(cell(), undefined)).toEqual([]);
    });

    it('lo que se levanta depende del tipo de bloqueo y del permiso', () => {
      const bloqueada = cell({ availability: { ...cell().availability, code: 'SPACE_OP_BLOCKED_CLINICAL' }, v2Code: 'C', assignable: false });
      expect(codes(bloqueada, viewer('block-clinical'))).toEqual(['unblock']);
      expect(codes(bloqueada, viewer('block-administrative'))).toEqual([]);
      const mant = cell({ availability: { ...cell().availability, code: 'SPACE_OP_MAINTENANCE' }, v2Code: 'C', assignable: false });
      expect(codes(mant, viewer('maintenance'))).toEqual(['end-maintenance']);
      const cerrada = cell({ availability: { ...cell().availability, code: 'SPACE_OP_CLOSED' }, v2Code: 'C', assignable: false });
      expect(codes(cerrada, viewer('close'))).toEqual(['reopen']);
    });

    it('con una orden abierta no se ofrece marcar sucia; con aislamiento se ofrece levantarlo', () => {
      expect(codes(cell({ openCleaningOrderId: 'o1' }), viewer('mark-dirty'))).toEqual([]);
      const aislada = cell({ isolation: { code: 'ISO_DROPLET', since: '' }, v2Code: 'I' });
      expect(codes(aislada, viewer('isolate'))).toEqual(['lift-isolation']);
    });

    it('la jefatura de quirófano solo opera quirófanos', () => {
      const jefatura: OpsViewer = { role: 'OR_MANAGER', actions: ['block-clinical'] };
      expect(codes(cell(), jefatura)).toEqual([]);
      const qx = cell({ function: { code: 'SPACE_FN_OPERATING_ROOM', display: 'Quirófano' } });
      expect(codes(qx, jefatura)).toEqual(['block-clinical']);
    });
  });

  describe('transiciones de una orden', () => {
    const codes = (o: CleaningOrder, v: OpsViewer, user: string | null = 'u1'): string[] => offerCleaningActions(o, v, user).map((x) => x.code);
    const limpieza = viewer('clean', 'assign');
    const supervision = viewer('clean', 'assign', 'inspect', 'inspect-terminal');

    it('pendiente: asignar e iniciar; en curso: terminar', () => {
      expect(codes(order(), limpieza)).toEqual(['assign', 'start']);
      expect(codes(order({ status: 'CLN_IN_PROGRESS' }), limpieza)).toEqual(['finish']);
    });

    it('terminada: inspecciona otra persona, no quien la terminó', () => {
      const hecha = order({ status: 'CLN_DONE', finishedByUserId: 'u1' });
      expect(codes(hecha, supervision, 'u1')).toEqual([]);
      expect(codes(hecha, supervision, 'u2')).toEqual(['inspect-pass', 'inspect-fail']);
    });

    it('la terminal exige el permiso de supervisión, no basta inspeccionar', () => {
      const terminal = order({ status: 'CLN_DONE', cleaningType: 'CLEAN_TERMINAL', finishedByUserId: 'u9' });
      expect(codes(terminal, viewer('inspect'), 'u2')).toEqual([]);
      expect(codes(terminal, supervision, 'u2')).toEqual(['inspect-pass', 'inspect-fail']);
    });

    it('una orden cerrada no ofrece nada', () => {
      for (const status of ['CLN_INSPECTED', 'CLN_REJECTED', 'CLN_CANCELLED'] as const) {
        expect(codes(order({ status }), supervision)).toEqual([]);
      }
    });

    it('la cola va por prioridad (inmediata, urgente, rutina) y luego por antigüedad', () => {
      const cola = sortCleaningQueue([
        order({ id: 'a', priority: 'CLN_PRIO_ROUTINE', requestedAt: '2026-10-29T08:00:00Z' }),
        order({ id: 'b', priority: 'CLN_PRIO_STAT', requestedAt: '2026-10-29T11:00:00Z' }),
        order({ id: 'c', priority: 'CLN_PRIO_URGENT', requestedAt: '2026-10-29T09:00:00Z' }),
        order({ id: 'd', priority: 'CLN_PRIO_URGENT', requestedAt: '2026-10-29T07:00:00Z' }),
      ]);
      expect(cola.map((o) => o.id)).toEqual(['b', 'd', 'c', 'a']);
    });
  });

  it('solo camas y unos locales llevan estado operativo', () => {
    expect(hasOperationalState('LOC_FORM_BED', 'SPACE_FN_BED_STANDARD')).toBe(true);
    expect(hasOperationalState('LOC_FORM_ROOM', 'SPACE_FN_OPERATING_ROOM')).toBe(true);
    expect(hasOperationalState('LOC_FORM_ROOM', 'SPACE_FN_INPATIENT_ROOM')).toBe(false);
    expect(hasOperationalState('LOC_FORM_LEVEL', 'SPACE_FN_LEVEL_GENERIC')).toBe(false);
  });
});
