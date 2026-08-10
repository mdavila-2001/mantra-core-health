/**
 * Teclas de verdad, no eventos sintéticos.
 *
 * ## Por qué hace falta
 *
 * `cy.type('{esc}')` despacha un `KeyboardEvent` desde JavaScript, y ese evento
 * lleva `isTrusted: false`. El `<dialog>` nativo **solo cierra con un Escape de
 * verdad**: el navegador no le hace caso a uno sintético, así que la prueba de
 * «Escape cierra devolviendo no» pasaría sin haber cerrado nada. Lo mismo con el
 * tabulador, que Cypress directamente no sabe enviar.
 *
 * ## Por qué sin plugin
 *
 * `cypress-real-events` resuelve esto y es la respuesta habitual, pero lo hace
 * hablando el mismo protocolo que se usa acá — y Cypress ya lo expone. Una
 * dependencia menos que mantener, actualizar y auditar, por treinta líneas.
 *
 * `Cypress.automation('remote:debugger:protocol', …)` habla **CDP**, así que
 * esto solo funciona en navegadores de la familia Chromium. Es la misma
 * restricción que tenía la suite anterior, que solo construía Chrome.
 */

/** Las teclas que la suite necesita, con su código virtual de Windows. */
const TECLAS = {
  Tab: { code: 'Tab', virtual: 9 },
  Escape: { code: 'Escape', virtual: 27 },
  Enter: { code: 'Enter', virtual: 13 },
} as const;

export type TeclaSoportada = keyof typeof TECLAS;

/**
 * Envía una pulsación real y espera a que el navegador la procese.
 *
 * Son dos mensajes —`rawKeyDown` y `keyUp`— porque una tecla que baja y no
 * sube deja el navegador creyendo que sigue apretada, y la siguiente pulsación
 * llega con un modificador fantasma.
 */
export function teclaReal(tecla: TeclaSoportada): Cypress.Chainable<void> {
  const { code, virtual } = TECLAS[tecla];

  const despachar = (tipo: 'rawKeyDown' | 'keyUp'): Promise<unknown> =>
    Cypress.automation('remote:debugger:protocol', {
      command: 'Input.dispatchKeyEvent',
      params: {
        type: tipo,
        key: tecla,
        code,
        windowsVirtualKeyCode: virtual,
        nativeVirtualKeyCode: virtual,
      },
    });

  return cy.wrap(null, { log: false }).then(async () => {
    await despachar('rawKeyDown');
    await despachar('keyUp');
  });
}
