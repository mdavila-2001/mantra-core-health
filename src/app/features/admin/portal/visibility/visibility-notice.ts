import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * El aviso fijo de las tres pantallas: ocultar no es seguridad. No se puede cerrar, porque es la
 * regla que evita el error más caro de esta función: creer que un botón oculto es un botón
 * protegido. Va en una línea a la vista y el porqué se despliega: el texto completo sigue en la
 * página (y en el árbol accesible), sólo deja de ocupar media pantalla.
 */
@Component({
  selector: 'app-visibility-notice',
  imports: [Alert],
  template: `
    <app-alert tone="warning" data-testid="visibility-notice">
      <details class="notice">
        <summary class="notice__summary">
          <strong>Ocultar no es proteger.</strong>
          Estas reglas deciden qué se <strong>muestra</strong>; no conceden ni quitan acceso.
          <span class="notice__more">Por qué</span>
        </summary>
        <p class="notice__text">
          Un elemento oculto sigue funcionando si alguien llama a su dirección de la API: lo que
          permite o niega cada acción son los permisos del rol, y los decide el servidor en cada
          petición. Para impedir de verdad una acción, quite el permiso.
        </p>
      </details>
    </app-alert>
  `,
  styles: `
    :host {
      display: block;
    }
    .notice__summary {
      cursor: pointer;
    }
    .notice__summary:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }
    .notice__more {
      margin-inline-start: var(--sp-1);
      text-decoration: underline;
      white-space: nowrap;
    }
    .notice[open] .notice__more {
      display: none;
    }
    .notice__text {
      margin: var(--sp-2) 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisibilityNotice {}
