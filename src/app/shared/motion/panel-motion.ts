import { prefersReducedMotion } from './motion-tokens';

/* ============================================================================
    Movimiento de los paneles que se abren desde un control (Carril F).

    Dos funciones, las dos sin estado y sin dependencias de Angular, para que las
    usen por igual `app-dialog`, `app-content-dialog`, `app-select`,
    `app-tree-select` y `app-date-picker`:

      · `fijarOrigenDelPanel` — de DÓNDE nace. El panel se abre con la escala y
        la opacidad de la clase `.panel-muelle` (`styles.css`), y esa escala
        crece desde `--origen-x/y`: el centro del control que lo abrió. Sin
        control (apertura por código) el origen es el centro del panel.
      · `cerrarConSalida` — A DÓNDE vuelve. Una salida corta hacia ese mismo
        origen y recién entonces se cierra el `<dialog>`.

    La salida usa la Web Animations API y se abstiene cuando no hay nada que
    animar (jsdom, `prefers-reduced-motion`): ahí cierra EN EL ACTO y de forma
    síncrona, que es lo que las pruebas y quien pidió menos movimiento esperan.
    ========================================================================== */

/** Lo que dura la salida. Más corta que la entrada: irse no se mira, se siente. */
export const SALIDA_DEL_PANEL_MS = 140;

/**
 * Marca en el panel de dónde nace: el centro del `disparador` medido contra el
 * `marco` (el `<dialog>`, que no lleva transformaciones propias).
 *
 * Es inocua si falta cualquiera de los dos o si no hay layout (jsdom): el CSS
 * cae a `50% 50%`.
 */
export function fijarOrigenDelPanel(
  panel: HTMLElement | null | undefined,
  marco: HTMLElement | null | undefined,
  disparador: Element | null | undefined,
): void {
  if (!panel || !marco || !disparador || typeof disparador.getBoundingClientRect !== 'function') {
    return;
  }
  const cuadroMarco = marco.getBoundingClientRect();
  const cuadroDisparador = disparador.getBoundingClientRect();
  if (cuadroMarco.width === 0 || cuadroDisparador.width === 0) {
    return;
  }
  const x = cuadroDisparador.left + cuadroDisparador.width / 2 - cuadroMarco.left;
  const y = cuadroDisparador.top + cuadroDisparador.height / 2 - cuadroMarco.top;
  // Acotado al marco: un disparador lejos no debe lanzar el panel desde fuera
  // de la pantalla, sólo inclinar de qué lado crece.
  panel.style.setProperty('--origen-x', `${Math.round(Math.min(Math.max(x, 0), cuadroMarco.width))}px`);
  panel.style.setProperty('--origen-y', `${Math.round(Math.min(Math.max(y, 0), cuadroMarco.height))}px`);
}

/**
 * Abre el `<dialog>` como modal y fija de dónde nace su panel. El `typeof` es
 * por jsdom, que no implementa `showModal()`: ahí cae al atributo `open`.
 */
export function abrirModal(
  dialog: HTMLDialogElement,
  selectorDelPanel: string,
  disparador: Element | null | undefined,
): void {
  if (!dialog.open) {
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }
  fijarOrigenDelPanel(dialog.querySelector<HTMLElement>(selectorDelPanel), dialog, disparador);
}

/**
 * Anima la salida del panel y después ejecuta `cerrar`.
 *
 * Sin animación posible, `cerrar` corre **de inmediato y en el mismo turno**.
 * Con ella corre una sola vez, aunque se llame dos veces mientras sale.
 */
export function cerrarConSalida(panel: HTMLElement | null | undefined, cerrar: () => void): void {
  if (!panel || typeof panel.animate !== 'function' || prefersReducedMotion()) {
    cerrar();
    return;
  }
  if (panel.dataset['saliendo'] === 'true') {
    return;
  }
  panel.dataset['saliendo'] = 'true';
  const terminar = (): void => {
    delete panel.dataset['saliendo'];
    cerrar();
  };
  const salida = panel.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.94)' },
    ],
    { duration: SALIDA_DEL_PANEL_MS, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'both' },
  );
  salida.finished.then(
    () => {
      terminar();
      // `fill: both` dejaría el panel invisible en la siguiente apertura.
      salida.cancel();
    },
    terminar,
  );
}
