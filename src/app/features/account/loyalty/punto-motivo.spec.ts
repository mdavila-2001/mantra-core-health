import { MOTIVOS_DE_PUNTOS } from '../../../core/data-access/loyalty/loyalty.types';
import {
  etiquetaDeMotivo,
  movimientoEnPalabras,
  signoDe,
  tonoDeMovimiento,
} from './punto-motivo';

/**
 * La presentación de un movimiento de puntos. Lo que se fija: que ningún
 * código del value set llegue a la pantalla, que el ámbar no se use acá
 * —está reservado para la acción única— y que el signo se diga con palabras,
 * porque el color no puede ser lo único que distinga sumar de restar.
 */
describe('presentación del movimiento de puntos', () => {
  it('todos los motivos tienen etiqueta en castellano', () => {
    for (const motivo of MOTIVOS_DE_PUNTOS) {
      const etiqueta = etiquetaDeMotivo(motivo);

      expect(etiqueta).not.toBe('');
      // El código del value set jamás se muestra.
      expect(etiqueta).not.toBe(motivo);
      expect(etiqueta).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it('nunca usa el tono ámbar: está reservado para la acción de la pantalla', () => {
    expect(tonoDeMovimiento('CREDITO')).toBe('success');
    expect(tonoDeMovimiento('DEBITO')).toBe('secondary');
  });

  it('el signo distingue sumar de restar en el texto, no sólo en el color', () => {
    expect(signoDe('CREDITO')).toBe('+');
    expect(signoDe('DEBITO')).toBe('−');
  });

  it('lo que escucha un lector de pantalla dice el verbo, no el signo', () => {
    expect(movimientoEnPalabras('CREDITO', '45', 'COMPRA')).toBe('Sumaste 45 puntos — compra');
    expect(movimientoEnPalabras('DEBITO', '150', 'CANJE')).toBe('Restaste 150 puntos — canje');
  });

  it('el vencimiento se dice como lo que es, sin alarmar', () => {
    expect(etiquetaDeMotivo('VENCIMIENTO')).toBe('Puntos vencidos');
    expect(movimientoEnPalabras('DEBITO', '30', 'VENCIMIENTO')).toContain('puntos vencidos');
  });
});
