import { MOTIVOS_DE_PUNTOS } from '../../../core/data-access/loyalty/loyalty.types';
import {
  etiquetaDeMotivo,
  etiquetaDeMultiplicador,
  movimientoEnPalabras,
  puntosEnPalabras,
  signoDe,
  tonoDeMovimiento,
  unidadDePuntos,
} from './punto-motivo';

/**
 * La presentación de un movimiento de puntos. Lo que se fija: que ningún
 * código del value set llegue a la pantalla, que el ámbar no se use acá
 * —está reservado para la acción única— y que el signo se diga con palabras,
 * porque el color no puede ser lo único que distinga sumar de restar.
 */
describe('presentación del movimiento de puntos', () => {
  it('todos los motivos del catálogo tienen etiqueta en castellano', () => {
    for (const motivo of MOTIVOS_DE_PUNTOS) {
      const etiqueta = etiquetaDeMotivo(motivo);

      expect(etiqueta).not.toBe('');
      // El código del catálogo jamás se muestra.
      expect(etiqueta).not.toBe(motivo);
      expect(etiqueta).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it('un motivo que la API no reconoció se dice sin adivinar', () => {
    expect(etiquetaDeMotivo(null)).toBe('Movimiento');
  });

  it('nunca usa el tono ámbar: está reservado para la acción de la pantalla', () => {
    expect(tonoDeMovimiento('POINTS_EARN')).toBe('success');
    expect(tonoDeMovimiento('POINTS_REDEEM')).toBe('secondary');
    expect(tonoDeMovimiento('POINTS_EXPIRE')).toBe('secondary');
    expect(tonoDeMovimiento(null)).toBe('secondary');
  });

  it('el signo distingue sumar de restar en el texto, no sólo en el color', () => {
    expect(signoDe('POINTS_EARN')).toBe('+');
    expect(signoDe('POINTS_REDEEM')).toBe('−');
    expect(signoDe('POINTS_EXPIRE')).toBe('−');
  });

  it('un ajuste no lleva signo inventado: el catálogo no dice hacia dónde movió', () => {
    expect(signoDe('POINTS_ADJUST')).toBe('');
    expect(signoDe(null)).toBe('');
  });

  it('lo que escucha un lector de pantalla dice el verbo, no el signo', () => {
    expect(movimientoEnPalabras('POINTS_EARN', '45', 'REASON_EVENT')).toBe(
      'Sumaste 45 puntos — actividad en la app',
    );
    expect(movimientoEnPalabras('POINTS_REDEEM', '150', 'REASON_REDEMPTION')).toBe(
      'Restaste 150 puntos — canje',
    );
  });

  it('sin dirección conocida no se afirma el sentido del movimiento', () => {
    expect(movimientoEnPalabras(null, '20', null)).toBe('Movimiento de 20 puntos — movimiento');
  });

  it('el vencimiento se dice como lo que es, sin alarmar', () => {
    expect(etiquetaDeMotivo('REASON_EXPIRY')).toBe('Puntos vencidos');
    expect(movimientoEnPalabras('POINTS_EXPIRE', '30', 'REASON_EXPIRY')).toContain(
      'puntos vencidos',
    );
  });

  it('un solo punto se dice en singular', () => {
    expect(puntosEnPalabras('1')).toBe('1 punto');
    expect(unidadDePuntos('1')).toBe('punto');
  });

  it('cualquier otra cantidad va en plural, el cero incluido', () => {
    expect(puntosEnPalabras('0')).toBe('0 puntos');
    expect(puntosEnPalabras('2')).toBe('2 puntos');
    expect(puntosEnPalabras('150')).toBe('150 puntos');
    // 21 no es «21 punto»: la concordancia mira la cifra entera, no su final.
    expect(puntosEnPalabras('21')).toBe('21 puntos');
  });

  it('la concordancia llega al anuncio para lector de pantalla', () => {
    expect(movimientoEnPalabras('POINTS_REDEEM', '1', 'REASON_REDEMPTION')).toBe(
      'Restaste 1 punto — canje',
    );
  });

  it('el multiplicador de promoción se dice «x2», un solo texto para reusar', () => {
    expect(etiquetaDeMultiplicador('2')).toBe('x2');
    expect(etiquetaDeMultiplicador('3')).toBe('x3');
    expect(etiquetaDeMultiplicador(' 2 ')).toBe('x2');
  });
});
