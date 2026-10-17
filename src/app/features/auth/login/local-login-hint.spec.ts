import { localLoginHint } from './local-login-hint';

describe('localLoginHint', () => {
  const original = (globalThis as { ngDevMode?: unknown }).ngDevMode;

  afterEach(() => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = original;
  });

  it('en modo desarrollo y desde localhost ofrece la cuenta de administración local', () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = true;
    expect(localLoginHint()).toEqual({ identifier: 'admin@alovidasalud.com', password: '12345678' });
  });

  it('un build de desarrollo servido desde otro host (túnel, servidor compartido) no la ofrece… salvo con el simulador', () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = true;
    // En `mockup` el simulador acepta cualquier contraseña: no hay secreto que proteger, así que
    // el host no la esconde. El caso «otro host → null» vive en `dev`, donde la API es real.
    expect(localLoginHint('dev.alovida.example')).not.toBeNull();
  });

  it('en `mockup` se ofrece también fuera del modo desarrollo, porque el simulador está encendido', () => {
    // El caso «producción sin simulador → null» no se puede ejercitar en esta rama: su entorno
    // trae `mockBackend: true` siempre. Está cubierto en `dev`.
    (globalThis as { ngDevMode?: unknown }).ngDevMode = false;
    expect(localLoginHint()).toEqual({ identifier: 'admin@alovidasalud.com', password: '12345678' });
  });
});
