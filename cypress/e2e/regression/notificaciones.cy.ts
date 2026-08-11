import { Avisos } from '../../support/components/toast.component';
import { DesignSystemPage } from '../../support/pages/design-system.page';

/**
 * Avisos (toasts).
 *
 * ## Qué se prueba, y por qué no más
 *
 * En el artefacto de producción **no existe ninguna cola de avisos**: el aviso
 * es una pieza presentacional y su único disparador —el panel de desarrollo—
 * vive tras un `@defer (when isDev)`, así que su fragmento ni se descarga.
 * Probar «lanzar un aviso y verlo aparecer» exigiría montar un disparador que la
 * aplicación no tiene, y eso sería probar el andamio.
 *
 * Lo que sí se fija acá es lo que se rompe sin que nadie mire: **cómo se anuncia
 * cada tipo**. Un error interrumpe (`role="alert"`); el resto espera turno
 * (`role="status"`). Poner `alert` en un aviso de éxito le pisa la frase a quien
 * esté escuchando un lector de pantalla — un defecto invisible en una captura y
 * que ninguna prueba de componente aislado detecta, porque el rol depende del
 * tipo y el tipo llega por `input`.
 *
 * Cuando exista una pantalla que emita avisos de verdad, acá se agrega el
 * journey completo: aparecer, apilarse y cerrarse.
 */
describe('Regresión · notificaciones', () => {
  beforeEach(() => {
    DesignSystemPage.abrir();
    DesignSystemPage.irALosAvisos();
  });

  it('la vitrina muestra los cuatro tipos de aviso', () => {
    Avisos.esperarCantidadMinima(4);
    Avisos.mensajes().should('have.length.at.least', 4);
  });

  it('un aviso de error interrumpe: no puede pasar desapercibido', () => {
    Avisos.esperarRolDelTipo('error', 'alert');
  });

  it('el éxito y la información esperan turno, sin pisar lo que se esté leyendo', () => {
    Avisos.esperarRolDelTipo('success', 'status');
    Avisos.esperarRolDelTipo('info', 'status');
    Avisos.esperarRolDelTipo('warning', 'status');
  });

  it('el tipo se dice en palabras, no solo con color e ícono', () => {
    // Quien no ve el color ni el ícono tiene que enterarse igual de que esto es
    // un error y no una confirmación.
    Avisos.tipoEnPalabras('error').should('match', /error/i);
    // El sustantivo del éxito es «Listo», no «Éxito»: se afirma el que el
    // sistema declara en `TOAST_TYPE_LABEL`, no el que uno esperaría.
    Avisos.tipoEnPalabras('success').should('match', /listo/i);
  });

  it('todos los avisos ofrecen cerrarse, y el botón tiene nombre', () => {
    Avisos.nombresDeCierre().then((nombres) => {
      expect(nombres.length).to.be.at.least(4);
      // Un botón de ícono sin nombre accesible es un control mudo.
      expect(nombres.every((nombre) => /cerrar/i.test(nombre))).to.equal(true);
    });
  });
});
