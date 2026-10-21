import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';
import type { MetricTone } from './metric-card.types';

/**
 * Una cifra con nombre: ícono en loseta, rótulo, valor tabular y una pista.
 *
 * El valor llega ya medido. Si es `null` se dice «Sin dato» en lugar de dibujar
 * un 0, porque un cero inventado se lee como una medición.
 */
@Component({
  selector: 'app-metric-card',
  imports: [NavIcon],
  templateUrl: './metric-card.html',
  styleUrl: './metric-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"metric-card metric-card--" + tone()',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
})
export class MetricCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number | null>();
  readonly hint = input('');
  readonly tone = input<MetricTone>('neutral');
  readonly icon = input<NavIconName | null>(null);

  protected readonly shown = computed(() => {
    const valor = this.value();
    if (valor === null) return 'Sin dato';
    return typeof valor === 'number' ? valor.toLocaleString('es-BO') : valor;
  });

  protected readonly ariaLabel = computed(() => `${this.label()}: ${this.shown()}`);
}
