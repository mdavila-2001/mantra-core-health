import { SEED_ELEMENTS, SEED_SPACES } from './floor-plan.seed';

describe('seed del plano (paridad con 04-plano-hospital-ejemplo.sql)', () => {
  it('88 espacios: 1 edificio, 2 pisos, 9 áreas, 4 salas, 42 locales, 30 camas', () => {
    const by = (form: string): number => SEED_SPACES.filter((s) => s.form === form).length;
    expect(SEED_SPACES.length).toBe(88);
    expect([by('BUILDING'), by('LEVEL'), by('AREA'), by('WARD'), by('ROOM'), by('BED')]).toEqual([1, 2, 9, 4, 42, 30]);
  });

  it('figuras por lienzo: PB 33, P1 51, campus 2', () => {
    const drawn = (c: string): number => SEED_SPACES.filter((s) => s.canvas === c).length;
    expect([drawn('PB'), drawn('P1'), drawn('CP')]).toEqual([33, 51, 2]);
  });

  it('136 elementos: PB 70, P1 64, campus 2 (calle y norte)', () => {
    const els = (c: string): number => SEED_ELEMENTS.filter((e) => e.canvas === c).length;
    expect(SEED_ELEMENTS.length).toBe(136);
    expect([els('PB'), els('P1'), els('CP')]).toEqual([70, 64, 2]);
  });

  it('42 puertas y 40 ventanas', () => {
    expect(SEED_ELEMENTS.filter((e) => e.kind === 'DOOR').length).toBe(42);
    expect(SEED_ELEMENTS.filter((e) => e.kind === 'WINDOW').length).toBe(40);
  });
});
