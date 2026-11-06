import { FormControl } from '@angular/forms';

import {
  branchShifts,
  dayProblem,
  defaultWeekHours,
  registrationHoursValidator,
  toShifts,
  weekProblem,
  type RegistrationHours,
  type WeekHours,
} from './opening-hours';
import { laboratoryBranches, pharmacyBranches, type BranchDraftRow } from './branch-payloads';

/**
 * El horario de atención del alta: la plantilla de arranque, las reglas que
 * frenan el paso y cómo viaja a la API (día ISO, un registro por turno).
 */
describe('opening-hours', () => {
  const closedWeek = (): WeekHours => ({
    allDay: false,
    days: defaultWeekHours().days.map((day) => ({ ...day, open: false })),
  });

  it('arranca con lunes a viernes de 08:00 a 18:00 y el sábado de 08:00 a 12:00', () => {
    const shifts = toShifts(defaultWeekHours());
    expect(shifts).toHaveLength(6);
    expect(shifts[0]).toEqual({ dayOfWeek: 1, opensAt: '08:00', closesAt: '18:00' });
    expect(shifts[5]).toEqual({ dayOfWeek: 6, opensAt: '08:00', closesAt: '12:00' });
    expect(shifts.some((s) => s.dayOfWeek === 7)).toBe(false);
  });

  it('«24 h» viaja como 00:00–24:00 los siete días', () => {
    const shifts = toShifts({ ...closedWeek(), allDay: true });
    expect(shifts).toHaveLength(7);
    expect(shifts.every((s) => s.opensAt === '00:00' && s.closesAt === '24:00')).toBe(true);
  });

  it('dos turnos el mismo día viajan como dos registros del mismo día', () => {
    const week = defaultWeekHours();
    const days = week.days.map((day, i) =>
      i === 0
        ? { open: true, shifts: [{ opensAt: '08:00', closesAt: '12:00' }, { opensAt: '14:30', closesAt: '19:00' }] }
        : day,
    );
    expect(toShifts({ ...week, days }).filter((s) => s.dayOfWeek === 1)).toHaveLength(2);
  });

  it('nombra el problema de un día', () => {
    expect(dayProblem({ open: true, shifts: [{ opensAt: '18:00', closesAt: '09:00' }] })).toContain('posterior');
    expect(dayProblem({ open: true, shifts: [{ opensAt: '', closesAt: '12:00' }] })).toContain('Complete');
    expect(
      dayProblem({ open: true, shifts: [{ opensAt: '08:00', closesAt: '13:00' }, { opensAt: '12:00', closesAt: '18:00' }] }),
    ).toContain('segundo turno');
    expect(dayProblem({ open: false, shifts: [] })).toBeNull();
  });

  it('una semana sin ningún día abierto no se acepta', () => {
    expect(weekProblem(closedWeek())).toBe('Marque al menos un día de atención.');
    expect(weekProblem({ ...closedWeek(), allDay: true })).toBeNull();
  });

  it('el validador mira la central y cada sucursal con horario propio', () => {
    const ok: RegistrationHours = { headquarters: defaultWeekHours(), branches: { a: null } };
    expect(registrationHoursValidator(new FormControl(ok))).toBeNull();
    const bad: RegistrationHours = { ...ok, branches: { a: closedWeek() } };
    expect(registrationHoursValidator(new FormControl(bad))).toEqual({
      openingHours: 'Marque al menos un día de atención.',
    });
  });

  it('una sucursal sin horario propio hereda el de la central', () => {
    const hours: RegistrationHours = {
      headquarters: { ...closedWeek(), allDay: true },
      branches: { own: defaultWeekHours() },
    };
    expect(branchShifts(hours, 'inherits')).toHaveLength(7);
    expect(branchShifts(hours, 'own')).toHaveLength(6);
  });

  describe('sucursales en el cuerpo del alta', () => {
    const row = (partial: Partial<BranchDraftRow>): BranchDraftRow => ({
      id: 'b1',
      nombre: 'Norte',
      direccion: 'Calle 1',
      descripcion: '',
      urlUbicacion: '',
      gps: { lat: -17.7, lng: -63.1 },
      ...partial,
    });
    const hours: RegistrationHours = { headquarters: defaultWeekHours(), branches: {} };

    it('farmacia: sólo las que tienen nombre y punto, cada una con su horario', () => {
      const out = pharmacyBranches([row({}), row({ id: 'b2', gps: null }), row({ id: 'b3', nombre: ' ' })], hours);
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ name: 'Norte', latitude: -17.7, longitude: -63.1 });
      expect(out[0].openingHours).toHaveLength(6);
    });

    it('laboratorio: con nombre alcanza; el punto viaja si está', () => {
      const out = laboratoryBranches([row({ gps: null, descripcion: 'PB' }), row({ id: 'b3', nombre: '' })], hours);
      expect(out).toEqual([
        { name: 'Norte', addressLines: ['Calle 1'], description: 'PB', openingHours: toShifts(defaultWeekHours()) },
      ]);
    });
  });
});
