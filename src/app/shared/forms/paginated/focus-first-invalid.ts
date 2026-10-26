import { afterNextRender, type Injector } from '@angular/core';

/** Lo que el teclado alcanza: el destino del foco dentro de un campo con error. */
const ENFOCABLE =
  'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * El atributo con el que el campo sabe que el foco le llegó solo, por un error,
 * y no porque la persona lo buscó: `form-field.css` no abre su globo de
 * descripción mientras esté puesto. Se va con la primera tecla, el primer clic
 * o al perder el foco.
 */
export const FOCO_POR_ERROR = 'data-foco-por-error';

/**
 * Lleva el foco al campo con error que el formulario por partes señala, en la
 * página visible.
 *
 * Sin esto el foco se quedaba en «Siguiente»: quien navega con teclado o con
 * lector de pantalla oía que nada pasaba y tenía que recorrer la página
 * buscando qué estaba mal. Va **después** de pintar (`afterNextRender`)
 * porque el `aria-invalid` lo escribe el campo recién cuando se dibuja su
 * error, y le gana al foco del título cuando el envío salta a otra página.
 *
 * El campo se busca por su clave (`data-campo`), no por el primer
 * `aria-invalid` de la página: un campo `custom` —las casillas de nombre— no
 * siempre lo expone, y el foco caía en el siguiente que sí («Apellido
 * paterno» antes que el nombre). Dentro del campo se prefiere el control que
 * dice `aria-invalid`, si no la opción marcada de un grupo, si no el primero
 * enfocable.
 *
 * Tres cuidados de cómo se mueve:
 *
 * - `preventScroll` y un desplazamiento propio: el del navegador deja el
 *   control al ras del borde, con el rótulo cortado arriba. Si el campo ya se
 *   ve entero no se mueve nada; si no, se centra el campo **con su rótulo**.
 * - Sin globo de descripción: abrirlo sobre el rótulo es tapar justo lo que
 *   la persona tiene que leer (ver {@link FOCO_POR_ERROR}).
 *
 * @param raiz - El host del formulario: se busca dentro de su página visible.
 * @param clave - La clave del primer campo con error de la página.
 * @param injector - El del formulario, para agendar después del render.
 */
export function enfocarCampoInvalido(raiz: HTMLElement, clave: string, injector: Injector): void {
  afterNextRender(
    () => {
      const pagina = raiz.querySelector('.paginated-form__pagina');
      const campo = [...(pagina?.querySelectorAll<HTMLElement>('[data-campo]') ?? [])].find(
        (candidato) => candidato.dataset['campo'] === clave,
      );
      if (campo === undefined) return;
      const objetivo = destinoDelFoco(campo);
      if (objetivo === null) return;

      campo.setAttribute(FOCO_POR_ERROR, '');
      const soltar = () => {
        campo.removeAttribute(FOCO_POR_ERROR);
        campo.removeEventListener('keydown', soltar);
        campo.removeEventListener('pointerdown', soltar);
        campo.removeEventListener('focusout', soltar);
      };
      campo.addEventListener('keydown', soltar);
      campo.addEventListener('pointerdown', soltar);
      campo.addEventListener('focusout', soltar);

      objetivo.focus({ preventScroll: true });
      const caja = campo.getBoundingClientRect();
      if (caja.top < 0 || caja.bottom > window.innerHeight) {
        campo.scrollIntoView({ block: 'center' });
      }
    },
    { injector },
  );
}

/** Dentro del campo: el control inválido, la opción marcada o el primero enfocable. */
function destinoDelFoco(campo: HTMLElement): HTMLElement | null {
  const invalido = campo.querySelector<HTMLElement>('[aria-invalid="true"]');
  if (invalido !== null) {
    if (invalido.matches(ENFOCABLE)) return invalido;
    const adentro =
      invalido.querySelector<HTMLElement>('input:checked') ??
      invalido.querySelector<HTMLElement>(ENFOCABLE);
    if (adentro !== null) return adentro;
  }
  return campo.querySelector<HTMLElement>(ENFOCABLE);
}
