import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import { hasOperationalState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type { BlockReason, OperationalState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CellDetail } from '../cell-detail/cell-detail';

/**
 * **Pestaña «Operación»** de la ficha de un espacio (F1 `space-detail`): los
 * ejes, los bloqueos, la orden de limpieza abierta y el historial de estados de
 * la cama o del local, con las acciones que su rol permite.
 *
 * Es la misma vista que el panel del tablero (`app-cell-detail`) dentro de la
 * tarjeta de la ficha, no una tarjeta más: la regla del 09/09/2026 manda una
 * sola tarjeta con pestañas. Solo pide el estado cuando se monta (`app-tab` no
 * dibuja el panel cerrado), así que abrir la ficha no cuesta una lectura más.
 *
 * Un espacio que no lleva estado operativo —un edificio, un piso, una
 * habitación— lo dice en una línea y no hace ninguna petición.
 */
@Component({
  selector: 'app-space-ops-tab',
  imports: [AppButtonLink, CellDetail, RouterLink, ViewStateHost],
  template: `
    @if (operable()) {
      <app-view-state-host [state]="view()" (retry)="load()" (refresh)="load()">
        @if (current(); as s) {
          <div class="ops" data-testid="space-ops-tab">
            <app-cell-detail [state]="s" [reasons]="reasons()" [historyOpen]="true" (stateChange)="current.set($event)" />
            <p class="ops__link">
              <a app-button variant="outline" routerLink="/inpatient/bed-board" [queryParams]="{ site: siteId(), cell: spaceId() }" data-testid="ops-open-board">
                Ver en el tablero de camas
              </a>
            </p>
          </div>
        }
      </app-view-state-host>
    } @else {
      <p class="ops__note" data-testid="space-ops-none">
        Este espacio no lleva estado operativo propio. Los estados (disponibilidad, higiene, aislamiento y ocupación) se llevan en camas,
        quirófanos, salas de partos, boxes de emergencia, salas de procedimientos y salas de imagen.
      </p>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .ops__link,
    .ops__note {
      margin: var(--sp-4) 0 0;
    }
    .ops__note {
      color: var(--text-secondary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceOpsTab {
  readonly spaceId = input.required<string>();
  readonly siteId = input.required<string>();
  readonly formCode = input.required<string>();
  readonly functionCode = input.required<string>();

  private readonly client = inject(InfrastructureOpsClient);

  protected readonly operable = computed(() => hasOperationalState(this.formCode(), this.functionCode()));
  protected readonly current = signal<OperationalState | null>(null);
  protected readonly reasons = signal<readonly BlockReason[]>([]);
  private readonly failure = signal<ViewState<never> | null>(null);
  protected readonly view = computed<ViewState<OperationalState>>(() => {
    const f = this.failure();
    if (f !== null) return f;
    const s = this.current();
    return s === null ? loading() : ready(s);
  });

  constructor() {
    effect(() => {
      const id = this.spaceId();
      const operable = this.operable();
      untracked(() => {
        if (operable && id !== '') this.load();
      });
    });
    this.client.getCatalog().subscribe({ next: (c) => this.reasons.set(c.blockReasons ?? []), error: () => undefined });
  }

  protected load(): void {
    this.failure.set(null);
    this.client.getOperationalState(this.spaceId()).subscribe({
      next: (s) => this.current.set(s),
      error: (error: unknown) => {
        this.current.set(null);
        this.failure.set(opsErrorToViewState<never>(error));
      },
    });
  }
}
