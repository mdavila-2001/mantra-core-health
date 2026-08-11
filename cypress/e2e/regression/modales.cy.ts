import { Dialogo } from '../../support/components/dialog.component';
import { DesignSystemPage } from '../../support/pages/design-system.page';

/**
 * Diálogos de confirmación.
 *
 * Montados sobre el `<dialog>` **nativo**, que es lo que trae gratis el fondo,
 * la inertización de lo que queda detrás y el cierre con `Escape`. En jsdom nada
 * de eso existe —`showModal()` ni siquiera está implementado— así que **ninguna
 * prueba unitaria puede afirmar que funcionen**. Es el hueco exacto que llena
 * una prueba con navegador.
 *
 * La regla de negocio que fijan: **cerrar nunca es confirmar**. Ni con `Escape`,
 * ni con el botón de cancelar. En una acción destructiva sobre una historia
 * clínica, esa distinción no es un detalle.
 */
describe('Regresión · modales', () => {
  it('abrir el diálogo lo muestra, lo enfoca y bloquea el fondo', () => {
    DesignSystemPage.abrir();

    DesignSystemPage.pedirConfirmacionDeGuardado();

    Dialogo.esperarAbierto();
    Dialogo.tituloVisible().should('match', /guardar la evolución/i);
    // Sin foco dentro, quien navega con teclado sigue tabulando por la página
    // de atrás sin enterarse de que hay algo abierto delante.
    Dialogo.esperarConFoco();
    Dialogo.esperarFondoBloqueado();
  });

  it('confirmar devuelve la confirmación', () => {
    DesignSystemPage.abrir();
    DesignSystemPage.pedirConfirmacionDeGuardado();

    Dialogo.esperarAbierto();
    Dialogo.confirmar();

    DesignSystemPage.esperarUltimaConfirmacion(/confirmó/i);
  });

  it('cancelar no confirma', () => {
    DesignSystemPage.abrir();
    DesignSystemPage.pedirConfirmacionDeGuardado();

    Dialogo.esperarAbierto();
    Dialogo.cancelar();

    DesignSystemPage.esperarUltimaConfirmacion(/canceló/i);
  });

  it('Escape cierra devolviendo «no»: cerrar nunca es confirmar', () => {
    DesignSystemPage.abrir();
    DesignSystemPage.pedirConfirmacionDestructiva();

    Dialogo.esperarAbierto();
    Dialogo.cerrarConEscape();

    // Si `Escape` resolviera `true`, una tecla de escape anularía una orden de
    // laboratorio. Esta es la prueba que lo impide.
    DesignSystemPage.esperarUltimaConfirmacion(/canceló/i);
  });

  it('en una acción destructiva, cancelar va primero y es lo que recibe el foco', () => {
    DesignSystemPage.abrir();
    DesignSystemPage.pedirConfirmacionDestructiva();

    Dialogo.esperarAbierto();

    // El orden del DOM es la decisión: en algo que no se puede deshacer, la
    // salida segura tiene que estar antes que la peligrosa.
    Dialogo.accionesEnOrden().then((acciones) => {
      expect(acciones[0]).to.match(/cancelar/i);
    });
    Dialogo.elementoEnfocado().should('equal', 'dialogo-cancelar');
  });

  it('el diálogo desaparece del DOM al cerrarse, no queda escondido', () => {
    DesignSystemPage.abrir();
    DesignSystemPage.pedirConfirmacionDeGuardado();

    Dialogo.esperarAbierto();
    Dialogo.confirmar();

    // Un modal «cerrado» que sigue en el DOM se lleva el foco de vuelta en el
    // próximo tabulado y deja botones alcanzables que nadie ve.
    Dialogo.esperarCerrado();
  });
});
