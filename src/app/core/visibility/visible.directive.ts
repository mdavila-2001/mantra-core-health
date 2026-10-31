import {
  computed,
  Directive,
  effect,
  inject,
  input,
  TemplateRef,
  ViewContainerRef,
  type EmbeddedViewRef,
} from '@angular/core';

import { UiVisibilityService } from './ui-visibility.service';

/**
 * Muestra el contenido sólo si la regla de visibilidad de la sesión lo permite.
 *
 * ```html
 * <app-today-agenda *appVisible="ui.todayAgenda" />
 *
 * <app-card *appVisible="'pharmacy.orders.export-card'; else sinPermiso"> … </app-card>
 * <ng-template #sinPermiso> … </ng-template>
 * ```
 *
 * El contenido **no se crea** mientras la clave esté oculta (no es un `display: none`): no consulta datos, no ocupa
 * lugar y no queda en el DOM para quien lea el código fuente. Es reactivo: si las reglas cambian, aparece o desaparece.
 *
 * **Presentación, no seguridad.** Un elemento oculto cuyo endpoint sigue permitido se puede llamar, y eso es
 * correcto: la API autoriza cada petición. Falla abierto: sin reglas cargadas, o si el pedido falló, se muestra.
 *
 * La clave tiene que estar declarada en el catálogo (`declareUiElements`): una regla sólo puede apuntar a lo que existe.
 */
@Directive({ selector: '[appVisible]' })
export class AppVisible {
  private readonly visibilidad = inject(UiVisibilityService);
  private readonly plantilla = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly contenedor = inject(ViewContainerRef);

  /** La clave del elemento en el catálogo. */
  readonly appVisible = input.required<string>();

  /** Qué dibujar en su lugar cuando está oculto (`*appVisible="clave; else otra"`). Nada, por omisión. */
  readonly appVisibleElse = input<TemplateRef<unknown> | null>(null);

  private readonly rama = computed<'then' | 'else'>(() =>
    this.visibilidad.isVisible(this.appVisible()) ? 'then' : 'else',
  );

  private dibujada: 'then' | 'else' | 'nada' | null = null;
  private vista: EmbeddedViewRef<unknown> | null = null;

  constructor() {
    effect(() => {
      const rama = this.rama();
      const alternativa = this.appVisibleElse();
      const quiere: 'then' | 'else' | 'nada' = rama === 'then' ? 'then' : alternativa === null ? 'nada' : 'else';
      if (quiere === this.dibujada && quiere !== 'else') {
        return;
      }
      this.vista?.destroy();
      this.vista = null;
      this.dibujada = quiere;
      if (quiere === 'then') {
        this.vista = this.contenedor.createEmbeddedView(this.plantilla);
      } else if (quiere === 'else' && alternativa !== null) {
        this.vista = this.contenedor.createEmbeddedView(alternativa);
      }
    });
  }
}
