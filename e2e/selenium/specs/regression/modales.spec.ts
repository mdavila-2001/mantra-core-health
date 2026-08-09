import { describe, expect, test } from 'vitest';

import { DialogComponent } from '../../components/dialog.component';
import { usarNavegador } from '../../core/test.lifecycle';
import { DesignSystemPage } from '../../pages/design-system.page';

/**
 * Diálogos de confirmación.
 *
 * Montados sobre el `<dialog>` **nativo**, que es lo que trae gratis el fondo,
 * la inertización de lo que queda detrás y el cierre con `Escape`. En jsdom
 * nada de eso existe —`showModal()` ni siquiera está implementado— así que
 * **ninguna prueba unitaria puede afirmar que funcionen**. Es el hueco exacto
 * que llena una prueba con navegador.
 *
 * La regla de negocio que fijan: **cerrar nunca es confirmar**. Ni con
 * `Escape`, ni con el botón de cancelar. En una acción destructiva sobre una
 * historia clínica, esa distinción no es un detalle.
 */
describe('Regresión · modales', () => {
  const navegador = usarNavegador();

  test('abrir el diálogo lo muestra, lo enfoca y bloquea el fondo', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    await vitrina.pedirConfirmacionDeGuardado();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();

    expect(await dialogo.tituloVisible()).toMatch(/guardar la evolución/i);
    // Sin foco dentro, quien navega con teclado sigue tabulando por la página
    // de atrás sin enterarse de que hay algo abierto delante.
    expect(await dialogo.tieneElFoco()).toBe(true);
    expect(await dialogo.elFondoEstaBloqueado()).toBe(true);
  });

  test('confirmar devuelve la confirmación', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.pedirConfirmacionDeGuardado();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();
    await dialogo.confirmar_();

    expect(await vitrina.esperarUltimaConfirmacion(/confirmó/i)).toMatch(/confirmó/i);
  });

  test('cancelar no confirma', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.pedirConfirmacionDeGuardado();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();
    await dialogo.cancelar_();

    expect(await vitrina.esperarUltimaConfirmacion(/canceló/i)).toMatch(/canceló/i);
  });

  test('Escape cierra devolviendo «no»: cerrar nunca es confirmar', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.pedirConfirmacionDestructiva();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();
    await dialogo.cerrarConEscape();

    // Si `Escape` resolviera `true`, una tecla de escape anularía una orden de
    // laboratorio. Esta es la prueba que lo impide.
    expect(await vitrina.esperarUltimaConfirmacion(/canceló/i)).toMatch(/canceló/i);
  });

  test('en una acción destructiva, cancelar va primero y es lo que recibe el foco', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.pedirConfirmacionDestructiva();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();

    // El orden del DOM es la decisión: en algo que no se puede deshacer, la
    // salida segura tiene que estar antes que la peligrosa.
    const acciones = await dialogo.accionesEnOrden();
    expect(acciones[0]).toMatch(/cancelar/i);
    expect(await dialogo.elementoEnfocado()).toBe('dialogo-cancelar');
  });

  test('el diálogo desaparece del DOM al cerrarse, no queda escondido', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();
    await vitrina.pedirConfirmacionDeGuardado();

    const dialogo = new DialogComponent(navegador());
    await dialogo.esperarAbierto();
    await dialogo.confirmar_();

    // Un modal «cerrado» que sigue en el DOM se lleva el foco de vuelta en el
    // próximo tabulado y deja botones alcanzables que nadie ve.
    expect(await dialogo.estaVisible()).toBe(false);
  });
});
