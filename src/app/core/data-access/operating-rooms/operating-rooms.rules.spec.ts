import {
  blockOwnerLabel,
  blockUtilizationPct,
  clippedMinutes,
  currentPhase,
  intervalOf,
  median,
  nextFreeStart,
  nextRoomEvent,
  overlaps,
  percentage,
  releaseAtOf,
  reservedWindow,
  roomEventBlockedReason,
  withTotals,
} from './operating-rooms.rules';

const T = (hhmm: string): string => `2026-11-02T${hhmm}:00.000Z`;
const ms = (hhmm: string): number => Date.parse(T(hhmm));

describe('reglas de quirófano (F4)', () => {
  describe('ventana reservada', () => {
    it('suma preparación antes y limpieza después (proceso 06, criterio 1)', () => {
      // prep 20 + caso 09:00–10:00 + limpieza 30 → 08:40–10:30
      expect(reservedWindow(T('09:00'), T('10:00'), 20, 30)).toEqual({
        reservedStartAt: T('08:40'),
        reservedEndAt: T('10:30'),
      });
    });

    it('sin preparación ni limpieza la ventana es el caso', () => {
      expect(reservedWindow(T('09:00'), T('10:00'), null, undefined)).toEqual({ reservedStartAt: T('09:00'), reservedEndAt: T('10:00') });
    });

    it('criterio F4.5-2: A 08–10 con prep 15 / limpieza 20 choca con B a las 10:10 y no con B a las 10:35', () => {
      const a = reservedWindow(T('08:00'), T('10:00'), 15, 20);
      const bTemprano = reservedWindow(T('10:10'), T('11:10'), 15, 20);
      const bTarde = reservedWindow(T('10:35'), T('11:35'), 15, 20);
      const ia = intervalOf(a.reservedStartAt, a.reservedEndAt);
      expect(overlaps(ia, intervalOf(bTemprano.reservedStartAt, bTemprano.reservedEndAt))).toBe(true);
      expect(overlaps(ia, intervalOf(bTarde.reservedStartAt, bTarde.reservedEndAt))).toBe(false);
    });
  });

  it('tocarse en el borde no es solaparse ([) como la EXCLUDE)', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
    expect(overlaps({ start: 0, end: 11 }, { start: 10, end: 20 })).toBe(true);
  });

  it('propone la próxima ventana libre después del caso que estorba', () => {
    const ocupado = [{ start: ms('07:45'), end: ms('10:20') }];
    // Caso de 60 min con prep 15 y limpieza 20: arranca 15 min después del fin reservado.
    expect(nextFreeStart(ms('10:10'), 60, 15, 20, ocupado)).toBe(T('10:35'));
    expect(nextFreeStart(ms('12:00'), 60, 15, 20, ocupado)).toBe(T('12:00'));
  });

  it('libera el bloque 72 h antes de su inicio', () => {
    expect(releaseAtOf('2026-11-09T12:00:00.000Z', 72)).toBe('2026-11-06T12:00:00.000Z');
  });

  it('acota minutos a una sesión', () => {
    expect(clippedMinutes({ start: ms('07:30'), end: ms('09:00') }, { start: ms('08:00'), end: ms('16:00') })).toBe(60);
    expect(clippedMinutes({ start: ms('17:00'), end: ms('18:00') }, { start: ms('08:00'), end: ms('16:00') })).toBe(0);
  });

  describe('fórmulas de utilización', () => {
    it('porcentaje con un decimal y null sin denominador', () => {
      expect(percentage(95, 480)).toBe(19.8);
      expect(percentage(1, 0)).toBeNull();
    });

    it('mediana de pares e impares', () => {
      expect(median([30, 10, 20])).toBe(20);
      expect(median([10, 20, 30, 41])).toBe(25);
      expect(median([])).toBeNull();
    });

    it('bloque: (usado + recambio) ÷ (asignado − liberado)', () => {
      // 360 asignados, 120 liberados, 150 usados + 30 de recambio → 180 / 240 = 75 %
      expect(blockUtilizationPct(360, 120, 150, 30)).toBe(75);
      expect(blockUtilizationPct(360, 360, 0, 0)).toBeNull();
    });
  });

  describe('check-list OMS bloqueante', () => {
    const ninguna = { SIGN_IN: false, TIME_OUT: false, SIGN_OUT: false };
    const entrada = { ...ninguna, SIGN_IN: true };

    it('la fase vigente es la primera incompleta', () => {
      expect(currentPhase(ninguna)).toBe('SIGN_IN');
      expect(currentPhase(entrada)).toBe('TIME_OUT');
      expect(currentPhase({ SIGN_IN: true, TIME_OUT: true, SIGN_OUT: true })).toBeNull();
    });

    it('el orden de los eventos es obligatorio', () => {
      expect(nextRoomEvent([])).toBe('PATIENT_IN_ROOM');
      expect(roomEventBlockedReason('INCISION', ['PATIENT_IN_ROOM'], entrada)).toContain('Inicio de anestesia');
    });

    it('sin Entrada no hay inicio de anestesia; sin Pausa no hay incisión', () => {
      expect(roomEventBlockedReason('ANESTHESIA_START', ['PATIENT_IN_ROOM'], ninguna)).toContain('Entrada');
      expect(roomEventBlockedReason('ANESTHESIA_START', ['PATIENT_IN_ROOM'], entrada)).toBeNull();
      expect(roomEventBlockedReason('INCISION', ['PATIENT_IN_ROOM', 'ANESTHESIA_START'], entrada)).toContain('Pausa');
    });

    it('sin Salida no hay salida de sala', () => {
      const hechos = ['PATIENT_IN_ROOM', 'ANESTHESIA_START', 'INCISION', 'CLOSURE'];
      expect(roomEventBlockedReason('PATIENT_OUT_OF_ROOM', hechos, { SIGN_IN: true, TIME_OUT: true, SIGN_OUT: false })).toContain('Salida');
      expect(roomEventBlockedReason('PATIENT_OUT_OF_ROOM', hechos, { SIGN_IN: true, TIME_OUT: true, SIGN_OUT: true })).toBeNull();
    });

    it('un evento ya registrado no se ofrece otra vez', () => {
      expect(roomEventBlockedReason('PATIENT_IN_ROOM', ['PATIENT_IN_ROOM'], ninguna)).toBe('Ya está registrado.');
    });
  });

  // La web no autoriza: los permisos de §F4.3 los decide la API (H3). En lugar
  // de las compuertas por rol, se prueban las reglas que reemplazan lo que la
  // API no manda.
  describe('lo que el cliente arma porque la API no lo manda', () => {
    const room = (code: string, session: number, touch: number, p50: number | null, allocated: number, released: number) => ({
      operatingRoomId: code, code, sessionMinutes: session, touchMinutes: touch,
      roomUtilizationPct: session > 0 ? (touch / session) * 100 : null, turnoverMinutesP50: p50,
      blocks: { allocated, released, blockUtilizationPct: null },
    });

    it('sin totals, los suma de rooms[] con las fórmulas de la API', () => {
      const u = withTotals({ from: '2026-11-02', to: '2026-11-08', rooms: [room('QX-01', 360, 180, 20, 360, 60), room('QX-02', 240, 120, 40, 0, 0)] });
      expect(u.totals).toEqual({
        sessionMinutes: 600, touchMinutes: 300, roomUtilizationPct: 50, turnoverMinutesP50: 30,
        blockAllocated: 360, blockReleased: 60, blockUtilizationPct: 100,
      });
    });

    it('si la API ya manda totals, ganan los suyos; el cliente sólo completa lo que falta', () => {
      const api = { sessionMinutes: 1, touchMinutes: 1, roomUtilizationPct: 100, blockUtilizationPct: null };
      const u = withTotals({ from: 'a', to: 'b', rooms: [room('QX-01', 360, 180, 20, 360, 60)], totals: api });
      expect(u.totals).toEqual({ ...api, turnoverMinutesP50: 20, blockAllocated: 360, blockReleased: 60 });
    });

    it('sin rooms los porcentajes son null, no NaN', () => {
      expect(withTotals({ from: 'a', to: 'b', rooms: [] }).totals?.roomUtilizationPct).toBeNull();
    });

    it('el dueño del bloque se nombra con catálogos y nunca sale «undefined»', () => {
      const dir = { specialties: new Map([['sp-1', 'Traumatología']]), units: new Map([['u-1', 'Cirugía general']]), surgeons: new Map([['s-1', 'Dra. Pérez']]) };
      const owner = { kind: 'SERVICE' as const, clinicalUnitId: null, specialtyConceptId: 'sp-1', surgeonProfileId: null };
      expect(blockOwnerLabel(owner, dir)).toBe('Traumatología');
      expect(blockOwnerLabel({ ...owner, specialtyConceptId: null, clinicalUnitId: 'u-1' }, dir)).toBe('Cirugía general');
      expect(blockOwnerLabel({ kind: 'SURGEON', clinicalUnitId: null, specialtyConceptId: null, surgeonProfileId: 's-1' }, dir)).toBe('Dra. Pérez');
      expect(blockOwnerLabel({ ...owner, specialtyConceptId: 'otro' }, dir)).toBe('Servicio');
      expect(blockOwnerLabel({ ...owner, label: 'Rótulo de la API' }, dir)).toBe('Rótulo de la API');
    });
  });
});
