import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { SampleCollectionClient } from '../../../../../core/data-access/diagnostics/sample-collection.client';
import type { SampleCollectionPoint } from '../../../../../core/data-access/diagnostics/sample-collection.types';
import { SiteContextStore } from '../../../../../core/data-access/operating-rooms/site-context.store';
import { dataOf } from '../../../../../core/view-state/view-state';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';

/** El valor que significa «que lo elija la sede» (el primer punto disponible). */
const FIRST_AVAILABLE = '';

/**
 * **Punto de toma** de la orden (F5b, `CONTRATO-F2-F5.md` §F5b).
 *
 * Ofrece sólo los puntos activos y disponibles de la sede (`GET
 * /sites/:siteId/sample-collection-points`): uno bloqueado no aparece. Sin
 * elegir, la API usa el primer punto disponible de la sede. Si la organización
 * no tiene puntos de toma (un consultorio), no se muestra nada y la orden
 * viaja como siempre.
 */
@Component({
  selector: 'app-collection-point-select',
  imports: [FormField, Select],
  template: `
    @if (points().length > 0) {
      <app-form-field label="Punto de toma" hint="Dónde se le toma la muestra. Sin elegir, el primero disponible de la sede.">
        <app-select [options]="options()" [value]="choice()" ariaLabel="Punto de toma" data-testid="order-collection-point" (valueChange)="choice.set($event ?? '')" />
      </app-form-field>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPointSelect {
  private readonly client = inject(SampleCollectionClient);
  private readonly siteContext = inject(SiteContextStore);

  protected readonly points = signal<readonly SampleCollectionPoint[]>([]);
  protected readonly choice = signal<string>(FIRST_AVAILABLE);

  private readonly siteId = computed(() => dataOf(this.siteContext.state())?.sites[0]?.id ?? null);

  protected readonly options = computed<readonly SelectOption<string>[]>(() => [
    { value: FIRST_AVAILABLE, label: 'El primero disponible de la sede elegida' },
    ...this.points().map((p) => ({ value: p.careSpace.id, label: `${p.careSpace.code} · ${p.careSpace.name}`, description: [p.unit?.name, p.hours].filter(Boolean).join(' · ') })),
  ]);

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      const siteId = this.siteId();
      if (siteId === null) return;
      untracked(() =>
        this.client.listPoints(siteId).subscribe({
          next: (points) => this.points.set(points),
          // Sin puntos no se ofrece nada: la orden sigue funcionando sin sugerencia.
          error: () => this.points.set([]),
        }),
      );
    });
  }

  /**
   * Lo que suma al cuerpo de la orden: sólo el punto elegido. La sede sugerida
   * la pone el selector de ejecutante; con un punto de otra sede la API
   * responde 422 `COLLECTION_POINT_INVALID`, y sin punto elige el primero
   * disponible de esa sede.
   */
  fields(): { suggestedCareSpaceId?: string } {
    return this.points().length === 0 || this.choice() === FIRST_AVAILABLE ? {} : { suggestedCareSpaceId: this.choice() };
  }

  reset(): void {
    this.choice.set(FIRST_AVAILABLE);
  }
}
