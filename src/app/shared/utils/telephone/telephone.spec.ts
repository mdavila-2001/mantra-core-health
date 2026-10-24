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

    it('arma la URL con un número escrito con guiones', () => {
      const url = whatsappUrl('+591-71-548278', 'texto');
      expect(url).toBe('https://wa.me/59171548278?text=texto');
    });

    it('arma la URL con un número escrito con paréntesis', () => {
      const url = whatsappUrl('+(591) 71 548278', 'texto');
      expect(url).toBe('https://wa.me/59171548278?text=texto');
    });

    it('arma la URL con un prefijo internacional distinto de Bolivia', () => {
      const url = whatsappUrl('+54 11 4321 5678', 'texto');
      expect(url).toBe('https://wa.me/541143215678?text=texto');
    });

    it('con mensaje vacío arma la URL sin el parámetro ?text=', () => {
      expect(whatsappUrl('+591 71 548278', '')).toBe('https://wa.me/59171548278');
    });

    it('devuelve null si no quedan dígitos suficientes para ser un número real', () => {
      expect(whatsappUrl('123', 'texto')).toBeNull();
      expect(whatsappUrl('', 'texto')).toBeNull();
    });

    it('devuelve null con un número de 7 dígitos, bajo el mínimo E.164 (CA-2.4)', () => {
      expect(whatsappUrl('+5917154', 'texto')).toBeNull();
    });

    it('arma la URL con exactamente 8 dígitos, el mínimo E.164 (CA-2.4)', () => {
      expect(whatsappUrl('+59171548', 'texto')).toBe('https://wa.me/59171548?text=texto');
    });

    it('devuelve null si el valor contiene letras (CA-2.4)', () => {
      expect(whatsappUrl('+591abc78278', 'texto')).toBeNull();
      expect(whatsappUrl('n/a', 'texto')).toBeNull();
    });
  });
});
