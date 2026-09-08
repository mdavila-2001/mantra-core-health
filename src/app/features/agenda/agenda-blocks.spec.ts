import {
  aBloqueoVisible,
  componerMotivo,
  leerMotivo,
  tipoDeApi,
  CLASE_POR_DEFECTO,
} from './agenda-blocks';
import type { PublishedException } from '../../core/data-access/scheduling/scheduling.types';

/**
 * El vocabulario de los bloqueos de agenda.
 *
 * Lo que se fija acá es la parte que decide **qué significa** un bloqueo: sin
 * la ida y vuelta de la marca, «trabajo de especialidad» y «vacaciones» serían
 * el mismo `ABSENCE` y la pantalla no podría distinguirlos. El backend no tiene
 * un tipo para el trabajo de especialidad —su enum es `ABSENCE | HOLIDAY |
 * EXTRA`—, así que la marca en `reason` es todo lo que sostiene el concepto.
 */
describe('agenda-blocks', () => {
  describe('la marca de clase', () => {
    it('va y vuelve sin perder el detalle que escribió el profesional', () => {
      const guardado = componerMotivo('especialidad', 'Cirugía programada');
      expect(guardado).toBe('[especialidad] Cirugía programada');

      const leido = leerMotivo(guardado, false);
      expect(leido.clase).toBe('especialidad');
      expect(leido.detalle).toBe('Cirugía programada');
      expect(leido.marcado).toBe(true);
    });

    it('sin detalle guarda sólo la marca, y al leerla el detalle queda vacío', () => {
      expect(componerMotivo('feriado', '   ')).toBe('[feriado]');
      expect(leerMotivo('[feriado]', true).detalle).toBe('');
    });

    /**
     * Los bloqueos anteriores a esta pantalla, y los que cree cualquier otro
     * cliente, no traen marca. Mostrarlos como trabajo de especialidad sería
     * afirmar un dato que nadie declaró.
     */
    it('un motivo sin marca no se inventa como trabajo de especialidad', () => {
      const sinMarca = leerMotivo('Vacaciones', false);
      expect(sinMarca.clase).toBe('ausencia');
      expect(sinMarca.detalle).toBe('Vacaciones');
      expect(sinMarca.marcado).toBe(false);

      // Si el backend dice que es feriado, se respeta: es el único dato duro.
      expect(leerMotivo('Año nuevo', true).clase).toBe('feriado');
    });

    it('un motivo ausente no rompe la lectura', () => {
      expect(leerMotivo(undefined, false).clase).toBe('ausencia');
      expect(leerMotivo(undefined, false).detalle).toBe('');
    });
  });

  describe('el tipo que se manda al backend', () => {
    /**
     * El enum de la API no tiene `SPECIALIST_WORK`. El trabajo de especialidad
     * viaja como `ABSENCE` —cierra la agenda igual— y su significado vive en la
     * marca. Si esto cambiara sin querer, la API rechazaría el alta con un 422.
     */
    it('el trabajo de especialidad y la ausencia van como ABSENCE; el feriado, como HOLIDAY', () => {
      expect(tipoDeApi('especialidad')).toBe('ABSENCE');
      expect(tipoDeApi('ausencia')).toBe('ABSENCE');
      expect(tipoDeApi('feriado')).toBe('HOLIDAY');
    });

    it('la clase por defecto es la razón de ser de la pantalla', () => {
      expect(CLASE_POR_DEFECTO).toBe('especialidad');
    });
  });

  describe('lo que muestra la tabla', () => {
    function excepcion(inicio: string, fin: string, reason?: string): PublishedException {
      return {
        id: 'e-1',
        exceptionTypeConceptId: 'c-absence',
        startAt: inicio,
        endAt: fin,
        ...(reason === undefined ? {} : { reason }),
      };
    }

    it('un día entero mide un día, no cero', () => {
      // De medianoche a medianoche del siguiente son 24 h. Contarlo como la
      // diferencia pelada daría «0 días» para el bloqueo de un día solo.
      const bloqueo = aBloqueoVisible(
        excepcion(
          new Date(2026, 8, 10).toISOString(),
          new Date(2026, 8, 11).toISOString(),
          '[ausencia] Trámite',
        ),
        false,
      );
      expect(bloqueo.diasEnteros).toBe(true);
      expect(bloqueo.dias).toBe(1);
    });

    it('un rango de días enteros cuenta todos los días que cubre', () => {
      const bloqueo = aBloqueoVisible(
        excepcion(new Date(2026, 8, 10).toISOString(), new Date(2026, 8, 24).toISOString()),
        false,
      );
      expect(bloqueo.dias).toBe(14);
    });

    it('una franja no se cuenta como día entero', () => {
      const bloqueo = aBloqueoVisible(
        excepcion(
          new Date(2026, 8, 10, 14, 0).toISOString(),
          new Date(2026, 8, 10, 18, 0).toISOString(),
          '[especialidad] Quirófano',
        ),
        false,
      );
      expect(bloqueo.diasEnteros).toBe(false);
      expect(bloqueo.clase).toBe('especialidad');
      expect(bloqueo.etiquetaDeClase).toBe('Trabajo de especialidad');
      expect(bloqueo.detalle).toBe('Quirófano');
    });

    it('marca como pasado el bloqueo que ya terminó, y no el que viene', () => {
      const ahora = new Date(2026, 8, 15, 12, 0);
      const terminado = aBloqueoVisible(
        excepcion(new Date(2026, 8, 10).toISOString(), new Date(2026, 8, 11).toISOString()),
        false,
        ahora,
      );
      const proximo = aBloqueoVisible(
        excepcion(new Date(2026, 8, 20).toISOString(), new Date(2026, 8, 21).toISOString()),
        false,
        ahora,
      );
      expect(terminado.pasado).toBe(true);
      expect(proximo.pasado).toBe(false);
    });
  });
});
