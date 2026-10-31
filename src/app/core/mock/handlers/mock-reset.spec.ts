import { buscarUsuario } from '../mock-session';
import { cerrarOtrasSesiones } from './auth.handlers';
import { reiniciarLaSesionDelSimulador } from './mock-reset';

/**
 * Causa raíz de «No fui yo» inestable (specs de grupo con `isolate: false`): las sesiones abiertas por cuenta
 * (`sesionesPorUsuario`, en `auth.handlers.ts`) son memoria del módulo y `reiniciarLaSesionDelSimulador` no las devolvía a las de
 * fábrica. Un archivo del mismo worker que ya había cerrado las otras sesiones de Marcos (cambiar contraseña, «cerrar todas»,
 * «No fui yo») dejaba a este con `revokedSessions: 0` en vez de `1`, según el orden en que el worker recibiera los archivos.
 */
describe('reiniciarLaSesionDelSimulador', () => {
  it('devuelve las sesiones abiertas de cada cuenta a las de fábrica (la actual y otra desde otro equipo)', () => {
    const marcos = buscarUsuario('marcos')!;
    reiniciarLaSesionDelSimulador();
    expect(cerrarOtrasSesiones(marcos)).toBe(1);
    // Ya cerradas: la segunda vez no hay otras.
    expect(cerrarOtrasSesiones(marcos)).toBe(0);

    reiniciarLaSesionDelSimulador();
    expect(cerrarOtrasSesiones(marcos)).toBe(1);
  });
});
