import { describe, expect, it } from 'vitest';
import { cabe, proponerInicios, restar, sePuedenReabrir, tramoOcupado, unir, type Tramo } from './disponibilidad-de-servicios';

const MIN = 60_000;
/** Minutos desde las 00:00 de un día fijo, como instante. */
const t = (h: number, m = 0): number => Date.UTC(2026, 9, 5, h, m);
const tramo = (desde: number, hasta: number): Tramo => ({ desde, hasta });
const horas = (r: readonly Tramo[]): string[] =>
  r.map((x) => `${new Date(x.desde).toISOString().slice(11, 16)}-${new Date(x.hasta).toISOString().slice(11, 16)}`);
const hh = (instante: number): string => new Date(instante).toISOString().slice(11, 16);

const AYER = Date.UTC(2026, 9, 1);
const LEJOS = Date.UTC(2026, 11, 31);
const servicio = { min: 30, max: 45, preparacion: 0, limpieza: 0 };

describe('disponibilidad de servicios (espejo del motor de la API)', () => {
  describe('unir y restar', () => {
    it('une los tramos que se pisan o se tocan y descarta los de largo cero', () => {
      const r = unir([tramo(t(10), t(11)), tramo(t(8), t(9)), tramo(t(9), t(9, 30)), tramo(t(9, 20), t(9, 40)), tramo(t(12), t(12))]);
      expect(horas(r)).toEqual(['08:00-09:40', '10:00-11:00']);
    });

    it('parte una franja alrededor de lo ocupado', () => {
      expect(horas(restar([tramo(t(8), t(12))], [tramo(t(9), t(9, 30)), tramo(t(11), t(13))]))).toEqual(['08:00-09:00', '09:30-11:00']);
    });

    it('un compromiso que cubre toda la franja no deja nada', () => {
      expect(restar([tramo(t(8), t(9))], [tramo(t(7), t(10))])).toEqual([]);
    });
  });

  describe('proponerInicios', () => {
    const base = { franjas: [tramo(t(8), t(10))], ocupado: [] as Tramo[], noAntesDe: AYER, noDespuesDe: LEJOS };

    it('compromete el MÁXIMO y expone el mínimo como fin posible', () => {
      const [primero] = proponerInicios({ ...base, duracion: servicio });
      expect(hh(primero!.inicio)).toBe('08:00');
      expect(hh(primero!.finMaximo)).toBe('08:45');
      expect(hh(primero!.finMinimo)).toBe('08:30');
    });

    it('el último inicio es el que todavía entra completo en la franja', () => {
      const inicios = proponerInicios({ ...base, duracion: servicio }).map((i) => hh(i.inicio));
      expect(inicios.at(-1)).toBe('09:15');
      expect(inicios).toHaveLength(6);
    });

    it('un servicio más largo que la franja no se ofrece', () => {
      expect(proponerInicios({ ...base, franjas: [tramo(t(8), t(8, 40))], duracion: servicio })).toEqual([]);
    });

    it('el primer inicio de un hueco pega con el fin exacto del compromiso anterior', () => {
      const r = proponerInicios({ ...base, ocupado: [tramo(t(8), t(8, 7))], duracion: servicio });
      expect(hh(r[0]!.inicio)).toBe('08:07');
    });

    it('no ofrece inicios que pisen una cita confirmada', () => {
      const r = proponerInicios({ ...base, ocupado: [tramo(t(8, 30), t(9))], duracion: servicio });
      expect(r.map((i) => hh(i.inicio))).toEqual(['09:00', '09:15']);
    });

    it('la preparación y la limpieza también tienen que caber', () => {
      const r = proponerInicios({ ...base, franjas: [tramo(t(8), t(9))], duracion: { ...servicio, preparacion: 5, limpieza: 10 } });
      expect(r).toHaveLength(1);
      expect(hh(r[0]!.inicio)).toBe('08:05');
    });

    it('respeta el aviso mínimo y el horizonte', () => {
      const r = proponerInicios({ ...base, noAntesDe: t(9), noDespuesDe: t(9, 15), duracion: servicio });
      expect(r.map((i) => hh(i.inicio))).toEqual(['09:00', '09:15']);
    });

    it('corta en el límite pedido', () => {
      expect(proponerInicios({ ...base, duracion: servicio, limite: 2 })).toHaveLength(2);
    });
  });

  describe('cabe', () => {
    const d = { min: 30, max: 45, preparacion: 5, limpieza: 10 };
    const franjas = [tramo(t(8), t(10))];

    it('cabe en un hueco libre y no cabe si la preparación se sale de la franja', () => {
      expect(cabe(franjas, [], d, t(8, 5))).toBe(true);
      expect(cabe(franjas, [], d, t(8))).toBe(false);
    });

    it('no cabe si otro paciente retuvo parte del rango entre tanto', () => {
      expect(cabe(franjas, [tramo(t(8, 40), t(9, 10))], d, t(8, 5))).toBe(false);
    });
  });

  describe('sePuedenReabrir', () => {
    const retraidos = [
      { id: 'a', desde: t(9), hasta: t(9, 30) },
      { id: 'b', desde: t(9, 30), hasta: t(10) },
    ];
    it('vuelven los que ya no chocan, y se queda el que otro turno sigue pisando', () => {
      expect(sePuedenReabrir(retraidos, [])).toEqual(['a', 'b']);
      expect(sePuedenReabrir(retraidos, [tramo(t(9, 45), t(10, 15))])).toEqual(['a']);
    });
  });

  describe('tramoOcupado', () => {
    it('suma la preparación antes y la limpieza después', () => {
      expect(horas([tramoOcupado(t(9), t(9, 45), { preparacion: 5, limpieza: 10 })])).toEqual(['08:55-09:55']);
      expect(tramoOcupado(t(9), t(9, 45), { preparacion: 0, limpieza: 0 }).hasta - t(9)).toBe(45 * MIN);
    });
  });
});
