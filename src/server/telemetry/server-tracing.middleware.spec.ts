import { pathOf } from './server-tracing.middleware';

const TOKEN = 'Q2hhbmdlTWVQbGVhc2VUaGlzSXNOb3RBUmVhbFRva2U';

/** `url.path` y `app.route.template` de la traza del renderizado (S-6). */
describe('pathOf', () => {
  it('la página de la receta compartida queda sin el token', () => {
    expect(pathOf(`/rx/${TOKEN}`)).toBe('/rx/:token');
    expect(pathOf(`/administration/pharmacy-orders/rx/${TOKEN}?x=1`)).toBe(
      '/administration/pharmacy-orders/rx/:token',
    );
  });

  it('la query no entra en la traza', () => {
    expect(pathOf(`/auth?returnUrl=%2Frx%2F${TOKEN}`)).toBe('/auth');
  });

  it('el id de la verificación y las demás rutas quedan como están', () => {
    expect(pathOf('/verify/rx/0d9f7d8c-6a0b-4f47-9a65-2a3c0a1c2b3d')).toBe(
      '/verify/rx/0d9f7d8c-6a0b-4f47-9a65-2a3c0a1c2b3d',
    );
    expect(pathOf('/my-account/pharmacy')).toBe('/my-account/pharmacy');
    expect(pathOf('')).toBe('/');
  });
});
