import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';

import { amountOf } from '../../../core/data-access/space-billing/space-billing.rules';
import { SpaceBillingClient } from '../../../core/data-access/space-billing/space-billing.client';
import type { ChargeCapture } from '../../../core/data-access/space-billing/space-billing.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, mapData, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { durationOf } from '../interventions.presentation';

/**
 * Pestaña **Cargos** de la ficha del caso (F4 → F5e): el uso de quirófano por
 * tiempo que se devenga al cerrar el caso con la Salida OMS hecha. Minutos de
 * salida menos entrada a sala, en fracciones de la tarifa (con su mínimo), al
 * precio vigente al inicio; nadie lo escribe a mano.
 */
@Component({
  selector: 'app-case-charges',
  imports: [AppButtonLink, Badge, EmptyState, FactList, RouterLink, ViewStateHost],
  template: `
    @if (encounterId() === null) {
      <app-empty-state
        variant="empty"
        title="El cargo de quirófano todavía no se generó"
        description="Se devenga solo al cerrar el caso con la fase «Salida» completa: minutos de salida menos entrada a sala, por la tarifa de quirófano vigente al inicio."
      >
        <a empty-actions app-button variant="ghost" size="sm" routerLink="/administration/services-catalog" [queryParams]="{ tab: 'space-tariffs' }">Ver las tarifas de espacios</a>
      </app-empty-state>
    } @else {
      <app-view-state-host [state]="state()" (retry)="reload()">
        @for (c of charges(); track c.id) {
          <div class="case-charges__row" data-testid="case-charge">
            <app-badge [variant]="c.status.code === 'CHG_VOIDED' ? 'error' : c.status.code === 'CHG_INVOICED' ? 'success' : 'warning'">{{ c.status.display }}</app-badge>
            <app-fact-list [hechos]="factsOf(c)" etiqueta="Cargo de uso de quirófano" />
          </div>
        }
      </app-view-state-host>
    }
  `,
  styles: [
    `
      .case-charges__row {
        display: grid;
        gap: var(--sp-2);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseCharges {
  private readonly billing = inject(SpaceBillingClient);

  /** El encuentro del caso; `null` mientras el caso no se cerró. */
  readonly encounterId = input<string | null>(null);
  readonly caseId = input.required<string>();

  private readonly loaded = signal<ViewState<readonly ChargeCapture[]>>(loading());

  protected readonly state = computed<ViewState<readonly ChargeCapture[]>>(() => {
    const s = mapData(this.loaded(), (list) => list.filter((c) => c.sourceKind.code === 'CHG_SRC_OR_TIME' && c.sourceRefId === this.caseId()));
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Se genera al cerrar el caso' }, 'El caso todavía no tiene cargo de quirófano.') : s;
  });

  protected readonly charges = computed(() => (this.state().status === 'ready' ? (this.state() as { data: readonly ChargeCapture[] }).data : []));

  constructor() {
    effect(() => {
      const id = this.encounterId();
      if (id === null) return;
      untracked(() => this.load(id));
    });
  }

  protected factsOf(c: ChargeCapture): readonly Hecho[] {
    const amount = amountOf(c.quantity, c.unitPrice);
    return [
      { etiqueta: 'Quirófano', valor: `${c.careSpace.code} · ${c.careSpace.name}` },
      { etiqueta: 'Tiempo en sala', valor: c.minutes == null ? null : durationOf(c.minutes) },
      { etiqueta: 'Fracciones facturadas', valor: c.quantity },
      { etiqueta: 'Precio por fracción', valor: c.unitPrice === null ? 'Sin tarifa vigente' : `${Number(c.unitPrice).toFixed(2)} ${c.currencyCode}`, tono: c.unitPrice === null ? 'aviso' : 'ok' },
      { etiqueta: 'Importe', valor: amount === null ? null : `${amount} ${c.currencyCode}` },
      { etiqueta: 'Centro de costo', valor: c.costCenter?.name ?? 'Sin centro de costo (la unidad no tiene uno)' },
      { etiqueta: 'Clave', valor: c.idempotencyKey },
    ];
  }

  protected reload(): void {
    const id = this.encounterId();
    if (id !== null) this.load(id);
  }

  private load(id: string): void {
    this.loaded.set(loading());
    this.billing.getEncounterCharges(id).subscribe({
      next: (d) => this.loaded.set(ready(d.charges)),
      error: (error: unknown) => this.loaded.set(errorToViewState<readonly ChargeCapture[]>(error)),
    });
  }
}
