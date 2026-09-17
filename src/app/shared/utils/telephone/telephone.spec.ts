import { dialable, whatsappDigits, whatsappUrl } from './telephone';

describe('telephone', () => {
  describe('dialable', () => {
    it('conserva dígitos y el signo +, quita espacios y separadores', () => {
      expect(dialable('+591 715 48278')).toBe('+59171548278');
      expect(dialable('800-10-6060')).toBe('800106060');
      expect(dialable('(591) 3 3487273')).toBe('59133487273');
    });
  });

  describe('whatsappDigits', () => {
    it('deja sólo dígitos, sin el signo +', () => {
      expect(whatsappDigits('+591 71 548278')).toBe('59171548278');
    });
  });

  describe('whatsappUrl', () => {
    it('arma la URL de wa.me con los dígitos limpios y el mensaje codificado', () => {
      const url = whatsappUrl('+591 71 548278', 'Hola, solicitud CLM-2026-0177');
      expect(url).toBe(
        'https://wa.me/59171548278?text=' +
          encodeURIComponent('Hola, solicitud CLM-2026-0177'),
      );
    });

    it('devuelve null si no quedan dígitos suficientes para ser un número real', () => {
      expect(whatsappUrl('123', 'texto')).toBeNull();
      expect(whatsappUrl('', 'texto')).toBeNull();
    });
  });
});
