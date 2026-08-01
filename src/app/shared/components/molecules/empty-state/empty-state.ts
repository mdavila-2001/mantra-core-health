import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { EmptyStateVariant } from './empty-state.types';

/**
 * Estado vacío (UX **S7**). Cero lógica: título, descripción y dos huecos.
 *
 * ```html
 * <app-empty-state variant="no-results" title="Sin resultados"
 *                  description="Probá con otro documento o apellido.">
 *   <svg empty-icon …></svg>
 *   <button app-button empty-actions variant="ghost">Limpiar filtros</button>
 * </app-empty-state>
 * ```
 *
 * Solo `no-results` es región viva: aparece **como respuesta** a una búsqueda
 * y hay que anunciarlo. Un vacío inicial o un error ya se anuncian por otras
 * vías —el error, además, suele venir con su `app-alert`— y declararlos vivos
 * sería hablar dos veces.
 */
@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'emptyStateClasses()',
    '[attr.role]': 'isSearchResponse() ? "status" : null',
    '[attr.aria-live]': 'isSearchResponse() ? "polite" : null',
  },
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly description = input<string>('');
  readonly variant = input<EmptyStateVariant>('empty');

  protected readonly isSearchResponse = computed(() => this.variant() === 'no-results');

  readonly emptyStateClasses = computed(
    () => `empty-state empty-state--${this.variant()}`,
  );
}
