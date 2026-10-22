import { MOTIVOS_DE_PUNTOS } from '../../../core/data-access/loyalty/loyalty.types';
import {
  reasonLabel,
  multiplierLabel,
  movementInWords,
  pointsInWords,
  signOf,
  movementTone,
  pointsUnit,
} from './point-reason';

/**
 * La presentación de un movimiento de puntos. Lo que se fija: que ningún
 * código del value set llegue a la pantalla, que el ámbar no se use acá
 * —está reservado para la acción única— y que el signo se diga con palabras,
 * porque el color no puede ser lo único que distinga sumar de restar.
 */
describe('presentación del movimiento de puntos', () => {
  it('todos los motivos del catálogo tienen etiqueta en castellano', () => {
    for (const motivo of MOTIVOS_DE_PUNTOS) {
      const etiqueta = reasonLabel(motivo);

      expect(etiqueta).not.toBe('');
      // El código del catálogo jamás se muestra.
      expect(etiqueta).not.toBe(motivo);
      expect(etiqueta).not.toMatch(/^[A-Z_]+$/);
    }
  });

  it('un motivo que la API no reconoció se dice sin adivinar', () => {
    expect(reasonLabel(null)).toBe('Movimiento');
  });

  it('nunca usa el tono ámbar: está reservado para la acción de la pantalla', () => {
    expect(movementTone('POINTS_EARN')).toBe('success');
    expect(movementTone('POINTS_REDEEM')).toBe('secondary');
    expect(movementTone('POINTS_EXPIRE')).toBe('secondary');
    expect(movementTone(null)).toBe('secondary');
  });

  it('el signo distingue sumar de restar en el texto, no sólo en el color', () => {
    expect(signOf('POINTS_EARN')).toBe('+');
    expect(signOf('POINTS_REDEEM')).toBe('−');
    expect(signOf('POINTS_EXPIRE')).toBe('−');
  });

  it('un ajuste no lleva signo inventado: el catálogo no dice hacia dónde movió', () => {
    expect(signOf('POINTS_ADJUST')).toBe('');
    expect(signOf(null)).toBe('');
  });

  it('lo que escucha un lector de pantalla dice el verbo, no el signo', () => {
    expect(movementInWords('POINTS_EARN', '45', 'REASON_EVENT')).toBe(
      'Sumó 45 puntos — actividad en la app',
    );
    expect(movementInWords('POINTS_REDEEM', '150', 'REASON_REDEMPTION')).toBe(
      'Restó 150 puntos — canje',
    );
  });

  it('sin dirección conocida no se afirma el sentido del movimiento', () => {
    expect(movementInWords(null, '20', null)).toBe('Movimiento de 20 puntos — movimiento');
  });

  it('el vencimiento se dice como lo que es, sin alarmar', () => {
    expect(reasonLabel('REASON_EXPIRY')).toBe('Puntos vencidos');
    expect(movementInWords('POINTS_EXPIRE', '30', 'REASON_EXPIRY')).toContain(
      'puntos vencidos',
    );
  });

  it('un solo punto se dice en singular', () => {
    expect(pointsInWords('1')).toBe('1 punto');
    expect(pointsUnit('1')).toBe('punto');
  });

  it('cualquier otra cantidad va en plural, el cero incluido', () => {
    expect(pointsInWords('0')).toBe('0 puntos');
    expect(pointsInWords('2')).toBe('2 puntos');
    expect(pointsInWords('150')).toBe('150 puntos');
    // 21 no es «21 punto»: la concordancia mira la cifra entera, no su final.
    expect(pointsInWords('21')).toBe('21 puntos');
  });

  it('la concordancia llega al anuncio para lector de pantalla', () => {
    expect(movementInWords('POINTS_REDEEM', '1', 'REASON_REDEMPTION')).toBe(
      'Restó 1 punto — canje',
    );
  });

  it('el multiplicador de promoción se dice «x2», un solo texto para reusar', () => {
    expect(multiplierLabel('2')).toBe('x2');
    expect(multiplierLabel('3')).toBe('x3');
    expect(multiplierLabel(' 2 ')).toBe('x2');
  });
});
