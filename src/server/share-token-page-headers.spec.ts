import { shareTokenPageHeaders } from './share-token-page-headers';

const TOKEN = 'Q2hhbmdlTWVQbGVhc2VUaGlzSXNOb3RBUmVhbFRva2U';

describe('shareTokenPageHeaders', () => {
  it.each([
    `/rx/${TOKEN}`,
    `/rx//${TOKEN}`,
    `/RX/${TOKEN}?utm=1`,
    `/administration/pharmacy-orders/rx/${TOKEN}`,
  ])('la página con el token (%s) no se indexa ni manda Referer', (url) => {
    expect(shareTokenPageHeaders(url)).toEqual({
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    });
  });

  it.each([
    `/auth?returnUrl=%2Frx%2F${TOKEN}`,
    `/auth?returnUrl=/rx/${TOKEN}`,
    `/auth/organization?returnUrl=%252Frx%252F${TOKEN}`,
  ])('el login que vuelve a la receta (%s) tampoco manda Referer', (url) => {
    expect(shareTokenPageHeaders(url)['Referrer-Policy']).toBe('no-referrer');
  });

  it('la verificación por id no se indexa, y sigue con la política general de Referer', () => {
    expect(shareTokenPageHeaders('/verify/rx/0d9f7d8c-6a0b-4f47-9a65-2a3c0a1c2b3d')).toEqual({
      'X-Robots-Tag': 'noindex, nofollow',
    });
  });

  it.each([
    '/',
    '/auth',
    '/auth?returnUrl=%2Fmy-account',
    '/proxy/x',
    '/rxnorm/x',
    `/auth?returnUrl=%2Fverify%2Frx%2F${TOKEN}`,
  ])('otra página no cambia: %s', (url) => {
    expect(shareTokenPageHeaders(url)['Referrer-Policy']).toBeUndefined();
  });
});
