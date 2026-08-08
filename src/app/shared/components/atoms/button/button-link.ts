import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import type { ButtonSize, ButtonVariant } from './button.types';

/**
 * Enlace con aspecto de acción. Selector de atributo sobre un `<a>`: el host ES
 * el ancla nativa, así que el clic con la rueda, «abrir en pestaña nueva» y el
 * menú contextual siguen funcionando.
 *
 * ```html
 * <a app-button variant="primary" routerLink="/pacientes/nuevo">Nuevo paciente</a>
 * ```
 *
 * ## Por qué existe
 *
 * `app-button` es `button[app-button]`: no se puede poner sobre un `<a>`. Eso
 * dejaba a toda pantalla de listado eligiendo entre dos cosas malas para su
 * acción principal: un `<button>` con `router.navigateByUrl` —que pierde el
 * clic-medio, el «abrir en pestaña nueva» y el destino en la barra de estado— o
 * un enlace de texto, que pierde la jerarquía visual. Esta pieza cierra ese
 * hueco sin duplicar estilos: comparte hoja con `AppButton`, que ya declara
 * todas sus reglas con `:host(...)`.
 *
 * ## Cuándo NO usarlo
 *
 * Si la acción **no navega** —guardar, borrar, abrir un diálogo— va un
 * `<button app-button>`. Un ancla sin destino real es un botón disfrazado: no
 * se activa con Espacio y el lector de pantalla lo anuncia como enlace.
 *
 * ## Deshabilitado
 *
 * Un `<a>` no tiene atributo `disabled`. Se marca con `aria-disabled` y se corta
 * el clic, igual que hace `AppButton`; el ancla sigue siendo enfocable para que
 * el lector de pantalla anuncie el estado en vez de hacer desaparecer el
 * control. Quien lo deshabilite debe además quitar el destino (`href`/`routerLink`),
 * porque `aria-disabled` no impide seguir un enlace con Enter en todos los
 * navegadores.
 */
@Component({
  selector: 'a[app-button]',
  template: '<ng-content />',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'buttonClasses()',
    '[attr.aria-disabled]': 'disabled() || null',
    '(click)': 'handleClick($event)',
  },
})
export class AppButtonLink {
  readonly variant = input<ButtonVariant>('primary');
  readonly size = input<ButtonSize>('md');
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Cuadrado y circular, sin texto: solo el ícono proyectado. */
  readonly iconOnly = input(false, { transform: booleanAttribute });

  readonly buttonClasses = computed(() => {
    const classes = ['btn', `btn--${this.variant()}`, `btn--${this.size()}`];
    if (this.iconOnly()) {
      classes.push('btn--icon-only');
    }
    if (this.disabled()) {
      classes.push('btn--disabled');
    }
    return classes.join(' ');
  });

  protected handleClick(event: MouseEvent): void {
    if (!this.disabled()) {
      return;
    }
    // `aria-disabled` no frena la navegación: se corta acá para que un enlace
    // deshabilitado tampoco navegue si conserva su destino.
    event.preventDefault();
    event.stopPropagation();
  }
}
