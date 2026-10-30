import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, type TemplateRef } from '@angular/core';

import type { TooltipPosition } from './tooltip.types';

/**
 * El globo del tooltip. Nunca se usa directo desde una plantilla: lo crea y lo
 * posiciona la directiva `appTooltip`, que lo cuelga del `<body>` para que no
 * lo recorte ningún contenedor con `overflow`.
 *
 * Texto, o una plantilla **de sólo lectura** (`appTooltipTemplate`) para una
 * ficha corta —código, cantidades, importes— que en una línea no se lee. Nada
 * interactivo: un tooltip se cierra al mover el foco, así que un botón adentro
 * sería inalcanzable con teclado.
 */
@Component({
  selector: 'app-tooltip-panel',
  imports: [NgTemplateOutlet],
  templateUrl: './tooltip-panel.html',
  styleUrl: './tooltip-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'panelClasses()',
    '[id]': 'panelId()',
    role: 'tooltip',
    '[style.top.px]': 'top()',
    '[style.left.px]': 'left()',
  },
})
export class TooltipPanel {
  readonly text = input<string>('');

  /** Si viene, se pinta en vez de `text`: el globo se ensancha para una ficha. */
  readonly template = input<TemplateRef<unknown> | null>(null);

  /** Lado YA resuelto: si el pedido no entraba, la directiva mandó el opuesto. */
  readonly position = input<TooltipPosition>('top');

  /** Destino del `aria-describedby` del control que lo abrió. */
  readonly panelId = input<string>('');

  /** Coordenadas de viewport: el globo va `position: fixed`. */
  readonly top = input<number>(0);
  readonly left = input<number>(0);

  readonly panelClasses = computed(
    () => `tooltip tooltip--${this.position()}${this.template() === null ? '' : ' tooltip--rich'}`,
  );
}
