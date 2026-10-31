import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';

import { SampleCollectionClient } from '../../../../../core/data-access/diagnostics/sample-collection.client';
import type { SampleCollectionPoint } from '../../../../../core/data-access/diagnostics/sample-collection.types';
import { INFRA_INTEGRATION_FLAGS } from '../../../../../core/data-access/infra-flags';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';

/** El valor que significa «que lo elija la sede» (el primer punto disponible). */
const FIRST_AVAILABLE = '';

/**
 * **Punto de toma** de la orden (F5b, `CONTRATO-F2-F5.md` §F5b).
 *
 * Ofrece sólo los puntos activos y disponibles de la sede **del ejecutante
 * elegido** (`GET /sites/:siteId/sample-collection-points`): sin sede elegida
 * no se ofrece nada, porque un punto de otra sede daría 422. Sin elegir, la
 * API usa el primer punto disponible de esa sede.
 *
 * Detrás de la bandera `collectionPoints` (apagada): la API todavía no acepta
 * `suggestedCareSpaceId` y mandarlo haría fallar la orden con 400. Apagada, no
 * se pide nada ni se suma nada al cuerpo. No lee la consola de la
 * organización: la sede la da el selector de ejecutante.
 */
@Component({
  selector: 'app-collection-point-select',
  imports: [FormField, Select],
  template: `
    @if (enabled && siteId() && points().length > 0) {
      <app-form-field label="Punto de toma" hint="Dónde se le toma la muestra. Sin elegir, el primero disponible de la sede.">
        <app-select [options]="options()" [value]="choice()" ariaLabel="Punto de toma" data-testid="order-collection-point" (valueChange)="choice.set($event ?? '')" />
      </app-form-field>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionPointSelect {
  private readonly client = inject(SampleCollectionClient);
  protected readonly enabled = inject(INFRA_INTEGRATION_FLAGS).collectionPoints;

  /** La sede del ejecutante elegido; `null` = no hay de dónde ofrecer puntos. */
  readonly siteId = input<string | null>(null);

  protected readonly points = signal<readonly SampleCollectionPoint[]>([]);
  protected readonly choice = signal<string>(FIRST_AVAILABLE);

  protected readonly options = computed<readonly SelectOption<string>[]>(() => [
    { value: FIRST_AVAILABLE, label: 'El primero disponible de la sede del ejecutante' },
    ...this.points().map((p) => ({ value: p.careSpace.id, label: `${p.careSpace.code} · ${p.careSpace.name}`, description: [p.unit?.name, p.hours].filter(Boolean).join(' · ') })),
  ]);

  constructor() {
    // Cambiar de sede cancela la lectura anterior y limpia la elección.
    toObservable(this.siteId)
      .pipe(
        switchMap((siteId) => {
          this.choice.set(FIRST_AVAILABLE);
          if (!this.enabled || siteId === null) return of([] as readonly SampleCollectionPoint[]);
          // Sin puntos no se ofrece nada: la orden sigue funcionando sin sugerencia.
          return this.client.listPoints(siteId).pipe(catchError(() => of([] as readonly SampleCollectionPoint[])));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((points) => this.points.set(points));
  }

  /**
   * Lo que suma al cuerpo de la orden: sólo el punto elegido. La sede sugerida
   * la pone el selector de ejecutante; con un punto de otra sede la API
   * responde 422 `COLLECTION_POINT_INVALID`, y sin punto elige el primero
   * disponible de esa sede.
   */
  fields(): { suggestedCareSpaceId?: string } {
    return !this.enabled || this.points().length === 0 || this.choice() === FIRST_AVAILABLE ? {} : { suggestedCareSpaceId: this.choice() };
  }

  reset(): void {
    this.choice.set(FIRST_AVAILABLE);
  }
}
