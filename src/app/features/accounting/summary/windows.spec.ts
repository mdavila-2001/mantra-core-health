import { describe, expect, it } from 'vitest';

import {
  aIsoLocal,
  compare,
  daysUntil,
  esCero,
  isNegative,
  amountBs,
  percentageOf,
  dayWindows,
  monthWindows,
  weekWindows,
} from './windows';

/**
 * Las ventanas del resumen y la aritmética de presentación.
 *
 * Todo recibe el día por parámetro, así que las pruebas fijan la fecha y no
 * dependen de cuándo se corran — que es la razón por la que `windows.ts` no
 * lee el reloj adentro.
 */
describe('ventanas del resumen contable', () => {
  /** Miércoles 16 de septiembre de 2026. Mes con día 1 en martes. */
  const miercoles = new Date(2026, 8, 16);

  describe('aIsoLocal', () => {
    it('usa la fecha local, no UTC', () => {
      // A las 22:00 en Bolivia (UTC−4) `toISOString()` ya está en el día
      // siguiente. El día contable es el local.
      expect(aIsoLocal(new Date(2026, 8, 16, 22, 30))).toBe('2026-09-16');
    });

    it('rellena mes y día con cero', () => {
      expect(aIsoLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
    });
  });

  describe('ventanasDelDia', () => {
    it('es un solo día, y compara contra ayer', () => {
      const { actual, previa, rotuloPrevio } = dayWindows(miercoles);
      expect(actual).toEqual({ from: '2026-09-16', to: '2026-09-16' });
      expect(previa).toEqual({ from: '2026-09-15', to: '2026-09-15' });
      expect(rotuloPrevio).toBe('ayer');
    });

    it('cruza el cambio de mes hacia atrás', () => {
      expect(dayWindows(new Date(2026, 8, 1)).previa).toEqual({
        from: '2026-08-31',
        to: '2026-08-31',
      });
    });
  });

  describe('ventanasDeLaSemana', () => {
    it('arranca el lunes y llega hasta hoy', () => {
      expect(weekWindows(miercoles).actual).toEqual({
        from: '2026-09-14',
        to: '2026-09-16',
      });
    });

    it('el domingo pertenece a la semana que termina, no a la que empieza', () => {
      // 20/09/2026 es domingo: su lunes es el 14, no el 21.
      expect(weekWindows(new Date(2026, 8, 20)).actual.from).toBe('2026-09-14');
    });

    it('compara contra los MISMOS días de la semana pasada, no contra la semana entera', () => {
      // Miércoles contra miércoles: tres días contra tres días.
      expect(weekWindows(miercoles).previa).toEqual({
        from: '2026-09-07',
        to: '2026-09-09',
      });
    });
  });

  describe('ventanasDelMes', () => {
    it('va del día 1 a hoy', () => {
      expect(monthWindows(miercoles).actual).toEqual({
        from: '2026-09-01',
        to: '2026-09-16',
      });
    });

    it('compara contra los mismos días del mes pasado', () => {
      expect(monthWindows(miercoles).previa).toEqual({
        from: '2026-08-01',
        to: '2026-08-16',
      });
    });

    it('recorta el corte al último día del mes previo cuando ese día no existe', () => {
      // 31 de marzo: febrero de 2026 termina el 28. Sin recorte, `Date`
      // resolvería «31 de febrero» como 3 de marzo, en silencio.
      expect(monthWindows(new Date(2026, 2, 31)).previa).toEqual({
        from: '2026-02-01',
        to: '2026-02-28',
      });
    });

    it('cruza el cambio de año hacia atrás', () => {
      expect(monthWindows(new Date(2026, 0, 10)).previa).toEqual({
        from: '2025-12-01',
        to: '2025-12-10',
      });
    });
  });

  describe('comparar', () => {
    it('dice cuánto subió', () => {
      expect(compare('1200.00', '1000.00', 'ayer')).toEqual({
        direccion: 'sube',
        porcentaje: 20,
        rotuloPrevio: 'ayer',
      });
    });

    it('dice cuánto bajó, sin signo en el número', () => {
      expect(compare('800.00', '1000.00', 'ayer')).toEqual({
        direccion: 'baja',
        porcentaje: 20,
        rotuloPrevio: 'ayer',
      });
    });

    it('cuando no cambió lo dice, en vez de un 0 %', () => {
      expect(compare('1000.00', '1000.00', 'ayer')?.direccion).toBe('igual');
    });

    it('sin comparable no inventa una variación', () => {
      // Un período anterior en cero daría «+∞ %» o un «+100 %» falso.
      expect(compare('1000.00', '0.00', 'ayer')).toBeNull();
      expect(compare('1000.00', 'no-es-un-numero', 'ayer')).toBeNull();
    });
  });

  describe('porcentajeDe', () => {
    it('reparte sobre el total', () => {
      expect(percentageOf('250.00', '1000.00')).toBe(25);
    });

    it('con total en cero devuelve cero en vez de dividir por cero', () => {
      expect(percentageOf('250.00', '0.00')).toBe(0);
    });

    it('no se pasa de 100 ni baja de 0', () => {
      expect(percentageOf('2000.00', '1000.00')).toBe(100);
      expect(percentageOf('-500.00', '1000.00')).toBe(0);
    });
  });

  describe('importeBs', () => {
    it('agrupa los miles y usa coma decimal', () => {
      expect(amountBs('17470.00')).toBe('Bs 17 470,00');
    });

    it('un importe chico no se agrupa', () => {
      expect(amountBs('300.00')).toBe('Bs 300,00');
    });

    it('el negativo lleva el signo delante de la moneda', () => {
      expect(amountBs('-1250.50')).toBe('−Bs 1 250,50');
    });

    it('completa los centavos que el servidor no mandó', () => {
      expect(amountBs('42')).toBe('Bs 42,00');
    });
  });

  describe('esCero y esNegativo', () => {
    it('miran el número, no la cadena', () => {
      expect(esCero('0.00')).toBe(true);
      expect(esCero('0')).toBe(true);
      expect(esCero('-0.00')).toBe(true);
      expect(esCero('0.01')).toBe(false);
    });

    it('un texto que no es número se trata como cero: no se dibuja', () => {
      expect(esCero('')).toBe(true);
    });

    it('el negativo se detecta por valor', () => {
      expect(isNegative('-0.01')).toBe(true);
      expect(isNegative('0.00')).toBe(false);
      expect(isNegative('12.00')).toBe(false);
    });
  });

  describe('diasHasta', () => {
    it('positivo si todavía no venció', () => {
      expect(daysUntil('2026-09-20', miercoles)).toBe(4);
    });

    it('cero el mismo día', () => {
      expect(daysUntil('2026-09-16', miercoles)).toBe(0);
    });

    it('negativo si ya venció', () => {
      expect(daysUntil('2026-09-01', miercoles)).toBe(-15);
    });

    it('una fecha ilegible no rompe la pantalla', () => {
      expect(daysUntil('', miercoles)).toBe(0);
    });
  });
});
