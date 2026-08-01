import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { TooltipPosition } from './tooltip.types';

/**
 * El globo del tooltip. Nunca se usa directo desde una plantilla: lo crea y lo
 * posiciona la directiva `appTooltip`, que lo cuelga del `<body>` para que no
 * lo recorte ningún contenedor con `overflow`.
 *
 * Solo texto: un tooltip con contenido interactivo es inalcanzable con teclado
 * —se cierra al mover el foco— así que el contrato es un `string` y nada más.
 */
@Component({
  selector: 'app-tooltip-panel',
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

  /** Lado YA resuelto: si el pedido no entraba, la directiva mandó el opuesto. */
  readonly position = input<TooltipPosition>('top');

  /** Destino del `aria-describedby` del control que lo abrió. */
  readonly panelId = input<string>('');

  /** Coordenadas de viewport: el globo va `position: fixed`. */
  readonly top = input<number>(0);
  readonly left = input<number>(0);

  readonly panelClasses = computed(() => `tooltip tooltip--${this.position()}`);
}
