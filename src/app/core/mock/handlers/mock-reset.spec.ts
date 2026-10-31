import { permisos, vinculos } from '../fixtures/support-hospital';
import { VINCULO_MARIELA } from '../fixtures/support-hospital-inbox';
import { buscarUsuario } from '../mock-session';
import { cerrarOtrasSesiones } from './auth.handlers';
import { reiniciarElGobiernoDeAccesos, reiniciarLaSesionDelSimulador } from './mock-reset';

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

/**
 * Causa raíz de las fallas intermitentes de `support-access.session.handlers.spec.ts` (Mariela entraba con 200 donde la
 * política de su hospital la niega): el vínculo de Mariela no está en la semilla de `vinculos`, lo agrega el módulo de la
 * bandeja al cargarse. `reiniciarElGobiernoDeAccesos` volvía a la semilla y la dejaba sin vínculo para el resto del worker,
 * así que las políticas del personal dejaban de alcanzarla según el orden de los archivos.
 */
describe('reiniciarElGobiernoDeAccesos', () => {
  it('conserva a Mariela con su vínculo y su permiso del hospital', () => {
    reiniciarElGobiernoDeAccesos();
    expect(vinculos.get(VINCULO_MARIELA.id)?.status).toBe('ACTIVE');
    expect(permisos.filtrar((p) => p.engagementId === VINCULO_MARIELA.id)).toHaveLength(1);
  });
});
