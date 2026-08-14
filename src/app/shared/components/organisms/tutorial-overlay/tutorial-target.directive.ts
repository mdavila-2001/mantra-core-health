import { Directive, computed, input } from '@angular/core';

import { TUTORIAL_TARGET_ATTR } from '../../../../core/tutorials/tutorial.engine';

/**
 * Marca un elemento como objetivo de un paso de tutorial.
 *
 * ```html
 * <app-select appTutorialTarget="agenda-selector-recurso" ... />
 * ```
 *
 * ## Por qué una directiva y no escribir el atributo a mano
 *
 * Escribir `data-tutorial-id="..."` funciona igual y el motor lo encuentra. La
 * directiva existe por dos cosas que el atributo suelto no da:
 *
 * 1. **Se puede buscar.** `appTutorialTarget` aparece en el índice del editor y
 *    en un `grep`; un `data-*` suelto se confunde con los diez `data-testid` que
 *    ya hay en la plantilla y nadie sabe que borrarlo rompe algo.
 * 2. **Es un contrato, no una clase.** Deja escrito que ese elemento lo referencia
 *    algo de afuera, así que quien rediseñe la pantalla lo ve en el diff en vez
 *    de descubrirlo cuando un tutorial se saltea un paso en silencio.
 *
 * No hace nada más: no guarda estado, no se registra en ningún servicio y no
 * escucha nada. El motor busca por atributo en el documento, que es lo que hace
 * que funcione con elementos que aparecen después de una petición, dentro de un
 * modal o dentro de un `@defer`, sin que este archivo se entere.
 */
@Directive({
  selector: '[appTutorialTarget]',
  host: {
    '[attr.data-tutorial-id]': 'targetId()',
  },
})
export class TutorialTarget {
  /** El identificador que los pasos referencian. Vacío = no se marca nada. */
  readonly appTutorialTarget = input.required<string>();

  /**
   * `null` en vez de cadena vacía cuando no hay identificador: con la cadena, el
   * atributo se escribiría igual y el motor podría enganchar el elemento
   * equivocado con un selector `[data-tutorial-id=""]`.
   */
  protected readonly targetId = computed(() => {
    const valor = this.appTutorialTarget().trim();
    return valor === '' ? null : valor;
  });
}

/** El atributo que este contrato produce; lo consume el motor. */
export { TUTORIAL_TARGET_ATTR };
