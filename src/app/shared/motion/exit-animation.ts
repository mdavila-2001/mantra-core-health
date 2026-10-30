/* ============================================================================
    Salida de una superficie flotante (diálogo, modal, aviso).

    Una superficie que aparece con una entrada y desaparece de golpe se siente
    rota: el ojo ve llegar algo y no lo ve irse, y lo lee como un salto. Esta
    función le da a la salida su cuadro de despedida —más corto que la entrada,
    `pulse.md` §7— y sólo después avisa para que se desmonte.

    No sabe nada de diálogos: pone una clase, espera a que terminen las
    animaciones que esa clase dispara y llama a `done`. El QUÉ se anima lo dice
    el CSS del componente; acá sólo se espera.
    ========================================================================== */

import { prefersReducedMotion } from './motion-tokens';

/**
 * Techo de espera. Una salida dura `--pulse-dur-exit` (140 ms); si por lo que
 * sea no termina —pestaña en segundo plano, animación cancelada— la superficie
 * se cierra igual. Cerrar tarde es tolerable; no cerrar, no.
 */
const MAX_EXIT_WAIT_MS = 400;

/**
 * Reproduce la salida de `element` poniéndole `className` y llama a `done`
 * cuando termina.
 *
 * **Es síncrona cuando no hay nada que animar**: con movimiento reducido, en el
 * servidor o en jsdom (sin `getAnimations`), o si la clase no dispara ninguna
 * animación, `done` corre antes de que la función vuelva. Así quien la usa no
 * cambia de comportamiento en las pruebas ni para quien pidió menos movimiento.
 *
 * @param element - La superficie que se va.
 * @param className - La clase que dispara la animación de salida.
 * @param done - Lo que hay que hacer después: cerrar el `<dialog>`, desmontar.
 */
export function playExitAnimation(element: HTMLElement, className: string, done: () => void): void {
  if (typeof element.getAnimations !== 'function' || prefersReducedMotion()) {
    done();
    return;
  }

  element.classList.add(className);
  const animaciones = element.getAnimations({ subtree: true });
  if (animaciones.length === 0) {
    element.classList.remove(className);
    done();
    return;
  }

  let terminado = false;
  const terminar = (): void => {
    if (terminado) {
      return;
    }
    terminado = true;
    clearTimeout(techo);
    done();
  };
  const techo = setTimeout(terminar, MAX_EXIT_WAIT_MS);
  // `finished` se rechaza si la animación se cancela: también es un final.
  Promise.allSettled(animaciones.map((animacion) => animacion.finished)).then(terminar);
}
