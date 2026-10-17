import { localLoginHint } from './local-login-hint';

describe('localLoginHint', () => {
  const original = (globalThis as { ngDevMode?: unknown }).ngDevMode;

  afterEach(() => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = original;
  });

  it('en modo desarrollo ofrece la cuenta de administración local', () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = true;
    expect(localLoginHint()).toEqual({ identifier: 'admin@alovidasalud.com', password: '12345678' });
  });

  it('fuera del modo desarrollo —producción— no ofrece nada', () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = false;
    expect(localLoginHint()).toBeNull();
  });

  it('sin la bandera definida tampoco', () => {
    (globalThis as { ngDevMode?: unknown }).ngDevMode = undefined;
    expect(localLoginHint()).toBeNull();
  });
});
