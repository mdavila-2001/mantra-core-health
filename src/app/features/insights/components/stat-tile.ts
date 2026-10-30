import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { StatusPill } from './status-pill';
import type { HealthStatus } from '../domain/insights.types';

/**
 * Cifra compacta para métricas que no son un KPI de campaña (embudo, uso de la
 * app, redes). Mismo contrato: `null` dice «Sin dato» y una nota explica por qué.
 */
@Component({
  selector: 'ins-stat',
  imports: [StatusPill],
  template: `
    <div class="st">
      <p class="st__top">
        <span class="st__label">{{ label() }}</span>
        @if (status(); as s) {
          <ins-status [status]="s" [short]="true" />
        }
      </p>
      <p class="st__value" [class.st__value--none]="value() === null">{{ value() ?? 'Sin dato' }}</p>
      @if (delta()) {
        <p class="st__delta" [class.st__delta--good]="good() === true" [class.st__delta--bad]="good() === false"><span aria-hidden="true">{{ arrow() }}</span> {{ delta() }}</p>
      }
      @if (hint()) {
        <p class="st__hint">{{ hint() }}</p>
      }
    </div>
  `,
  styleUrl: './stat-tile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string | null>();
  readonly hint = input('');
  /** Variación ya formateada («+4,2 %»). */
  readonly delta = input('');
  readonly good = input<boolean | null>(null);
  readonly status = input<HealthStatus | null>(null);

  protected arrow(): string {
    const d = this.delta();
    return d.startsWith('−') || d.startsWith('-') ? '↓' : d.startsWith('+') ? '↑' : '→';
  }
}
