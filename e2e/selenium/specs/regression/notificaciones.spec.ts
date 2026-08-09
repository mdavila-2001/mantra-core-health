import { describe, expect, test } from 'vitest';

import { ToastComponent } from '../../components/toast.component';
import { usarNavegador } from '../../core/test.lifecycle';
import { DesignSystemPage } from '../../pages/design-system.page';

/**
 * Avisos (toasts).
 *
 * ## Qué se prueba, y por qué no más
 *
 * En el artefacto de producción **no existe ninguna cola de avisos**: el aviso
 * es una pieza presentacional y su único disparador —el panel de desarrollo—
 * vive tras un `@defer (when isDev)`, así que su fragmento ni se descarga.
 * Probar «lanzar un aviso y verlo aparecer» exigiría montar un disparador que
 * la aplicación no tiene, y eso sería probar el andamio.
 *
 * Lo que sí se fija acá es lo que se rompe sin que nadie mire: **cómo se
 * anuncia cada tipo**. Un error interrumpe (`role="alert"`); el resto espera
 * turno (`role="status"`). Poner `alert` en un aviso de éxito le pisa la frase
 * a quien esté escuchando un lector de pantalla — un defecto invisible en una
 * captura y que ninguna prueba de componente aislado detecta, porque el rol
 * depende del tipo y el tipo llega por `input`.
 *
 * Cuando exista una pantalla que emita avisos de verdad, acá se agrega el
 * journey completo: aparecer, apilarse y cerrarse.
 */
describe('Regresión · notificaciones', () => {
  const navegador = usarNavegador();

  test('la vitrina muestra los cuatro tipos de aviso', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    const avisos = new ToastComponent(navegador());
    await avisos.esperarAlguno();

    expect(await avisos.cantidad()).toBeGreaterThanOrEqual(4);
    expect((await avisos.mensajes()).length).toBeGreaterThanOrEqual(4);
  });

  test('un aviso de error interrumpe: no puede pasar desapercibido', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    const avisos = new ToastComponent(navegador());
    await avisos.esperarAlguno();

    expect(await avisos.rolDelTipo('error')).toBe('alert');
  });

  test('el éxito y la información esperan turno, sin pisar lo que se esté leyendo', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    const avisos = new ToastComponent(navegador());
    await avisos.esperarAlguno();

    expect(await avisos.rolDelTipo('success')).toBe('status');
    expect(await avisos.rolDelTipo('info')).toBe('status');
    expect(await avisos.rolDelTipo('warning')).toBe('status');
  });

  test('el tipo se dice en palabras, no solo con color e ícono', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    const avisos = new ToastComponent(navegador());
    await avisos.esperarAlguno();

    // Quien no ve el color ni el ícono tiene que enterarse igual de que esto es
    // un error y no una confirmación.
    expect(await avisos.tipoEnPalabras('error')).toMatch(/error/i);
    // El sustantivo del éxito es «Listo», no «Éxito»: se afirma el que el
    // sistema declara en `TOAST_TYPE_LABEL`, no el que uno esperaría.
    expect(await avisos.tipoEnPalabras('success')).toMatch(/listo/i);
  });

  test('todos los avisos ofrecen cerrarse, y el botón tiene nombre', async () => {
    const vitrina = new DesignSystemPage(navegador());
    await vitrina.abrir();

    const avisos = new ToastComponent(navegador());
    await avisos.esperarAlguno();

    const nombres = await avisos.nombresDeCierre();
    expect(nombres.length).toBeGreaterThanOrEqual(4);
    // Un botón de ícono sin nombre accesible es un control mudo.
    expect(nombres.every((nombre) => /cerrar/i.test(nombre))).toBe(true);
  });
});
