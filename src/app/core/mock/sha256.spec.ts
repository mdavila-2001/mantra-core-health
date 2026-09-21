import { sha256Hex } from './sha256';

describe('sha256Hex', () => {
  it('del texto vacío, el vector de referencia de FIPS 180-4', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('de "abc", el otro vector de referencia estándar', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('siempre devuelve 64 caracteres hexadecimales en minúscula', () => {
    const hash = sha256Hex('Portabilidad de póliza y siniestros — Bs 12 450');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('es determinista: el mismo texto siempre produce el mismo hash', () => {
    const texto = JSON.stringify({ a: 1, b: 'dos' });
    expect(sha256Hex(texto)).toBe(sha256Hex(texto));
  });

  it('un solo carácter distinto cambia el hash por completo', () => {
    expect(sha256Hex('certificado-1')).not.toBe(sha256Hex('certificado-2'));
  });
});
