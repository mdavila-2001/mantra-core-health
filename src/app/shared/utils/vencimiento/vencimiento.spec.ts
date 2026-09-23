import {
  AVISO_DE_VENCIMIENTO_DIAS,
  varianteDeVencimiento,
  vencimientoEnPalabras,
} from './vencimiento';

/**
 * Las aserciones son **las mismas** que ya cubrían la copia privada de esta
 * regla en la ficha de organización médica. Se repiten acá a propósito: son el
 * contrato que la consolidación futura tiene que seguir cumpliendo, y si un día
 * las dos versiones se separan, esto lo dice antes que ninguna pantalla.
 */
describe('vencimiento', () => {
  describe('vencimientoEnPalabras', () => {
    it('dice el vencido en positivo, sin obligar a interpretar un signo', () => {
      expect(vencimientoEnPalabras(-14)).toBe('vencido hace 14 días');
    });

    it('concuerda el singular en los dos sentidos del plazo', () => {
      expect(vencimientoEnPalabras(-1)).toBe('vencido hace 1 día');
      expect(vencimientoEnPalabras(1)).toBe('vence en 1 día');
    });

    it('el día de hoy es su propia frase: ni vencido ni con plazo', () => {
      expect(vencimientoEnPalabras(0)).toBe('vence hoy');
    });

    it('un documento sin fecha de caducidad lo dice, no finge un plazo', () => {
      expect(vencimientoEnPalabras(null)).toBe('sin vencimiento declarado');
    });
  });

  describe('varianteDeVencimiento', () => {
    it('lo vencido es un error, no un aviso', () => {
      expect(varianteDeVencimiento(-1)).toBe('error');
    });

    it('avisa desde un mes antes, y el día del umbral todavía avisa', () => {
      expect(varianteDeVencimiento(10)).toBe('warning');
      expect(varianteDeVencimiento(AVISO_DE_VENCIMIENTO_DIAS)).toBe('warning');
      expect(varianteDeVencimiento(AVISO_DE_VENCIMIENTO_DIAS + 1)).toBe('success');
    });

    it('lo que falta mucho está en orden', () => {
      expect(varianteDeVencimiento(400)).toBe('success');
    });

    it('sin fecha no hay severidad que afirmar: informa', () => {
      expect(varianteDeVencimiento(null)).toBe('info');
    });
  });

  it('el aviso previo es de un mes: es el plazo con el que se renueva un papel', () => {
    expect(AVISO_DE_VENCIMIENTO_DIAS).toBe(30);
  });
});
