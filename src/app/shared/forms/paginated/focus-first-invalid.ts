import { afterNextRender, type Injector } from '@angular/core';

/** Lo que el teclado alcanza: el destino del foco dentro de un campo con error. */
const ENFOCABLE = 'input, select, textarea, button, [tabindex]:not([tabindex="-1"])';

/**
 * Lleva el foco al primer campo con error de la página visible de un
 * formulario por partes.
 *
 * Sin esto el foco se quedaba en «Siguiente»: quien navega con teclado o con
 * lector de pantalla oía que nada pasaba y tenía que recorrer la página
 * buscando qué estaba mal. Va **después** de pintar (`afterNextRender`)
 * porque el `aria-invalid` lo escribe el campo recién cuando se dibuja su
 * error, y le gana al foco del título cuando el envío salta a otra página:
 * ahí también lo útil es el campo que hay que corregir.
 *
 * Un grupo (`role="radiogroup"`) no es enfocable: se enfoca su opción marcada
 * o, si no hay, la primera — que es adonde llevaría el tabulador.
 *
 * @param raiz - El host del formulario: se busca dentro de su página visible.
 * @param injector - El del formulario, para agendar después del render.
 */
export function enfocarPrimerInvalido(raiz: HTMLElement, injector: Injector): void {
  afterNextRender(
    () => {
      const pagina = raiz.querySelector('.paginated-form__pagina');
      const invalido = pagina?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalido === null || invalido === undefined) return;
      const objetivo = invalido.matches(ENFOCABLE)
        ? invalido
        : (invalido.querySelector<HTMLElement>('input:checked') ??
          invalido.querySelector<HTMLElement>(ENFOCABLE));
      objetivo?.focus();
    },
    { injector },
  );
}
