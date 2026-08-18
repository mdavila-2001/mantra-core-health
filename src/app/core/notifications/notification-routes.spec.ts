import { rutaDeNotificacion } from './notification-routes';

/**
 * Lo que estas pruebas fijan: que un destino **sin pantalla** devuelve `null`
 * en vez de una ruta inventada. Es la diferencia entre una notificación que se
 * pinta como texto y una que se pinta como enlace y no lleva a ningún lado —
 * lo segundo se lee como producto roto.
 */
describe('rutaDeNotificacion', () => {
  it('lleva la receta y la consulta al expediente propio', () => {
    expect(rutaDeNotificacion({ type: 'PRESCRIPTION', id: 'rx-1' })).toBe(
      '/my-account/medical-record',
    );
    expect(rutaDeNotificacion({ type: 'ENCOUNTER', id: 'e-1' })).toBe(
      '/my-account/medical-record',
    );
  });

  it('lleva el hilo de mensajería a su conversación, con el id', () => {
    expect(rutaDeNotificacion({ type: 'CONVERSATION', id: 'c-9' })).toBe(
      '/messaging/c-9',
    );
  });

  it('devuelve null cuando el tipo todavía no tiene pantalla', () => {
    expect(rutaDeNotificacion({ type: 'POST', id: 'p-1' })).toBeNull();
  });

  it('devuelve null cuando el tipo es desconocido o no hay destino', () => {
    expect(rutaDeNotificacion({ type: 'ALGO_NUEVO', id: 'x' })).toBeNull();
    expect(rutaDeNotificacion(undefined)).toBeNull();
  });
});
