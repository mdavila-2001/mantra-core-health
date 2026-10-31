import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';
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
 *
 * Lee `pending-charges` (arreglo de `chargeView`, sólo **pendientes**) del
 * encuentro del caso y filtra `source === 'OR_TIME'` de este caso. La lectura
 * es de Facturación (§0.3, `f5e.charge.read`): con otro rol la API responde
 * 403 y se pinta S5. Sin `encounterId` informado no se inventa un encuentro.
 */
@Component({
  selector: 'app-case-charges',
  imports: [AppButtonLink, Badge, EmptyState, FactList, RouterLink, ViewStateHost],
  template: `
    @if (encounterId() === null) {
      <app-empty-state
        variant="empty"
        title="El cargo de quirófano todavía no se generó"
        description="Se devenga solo al cerrar el caso con la fase «Salida» completa: minutos de salida menos entrada a sala, por la tarifa de quirófano vigente al inicio. Se muestra aquí cuando la ficha informa el encuentro del caso."
      >
        <a empty-actions app-button variant="ghost" size="sm" routerLink="/administration/services-catalog" [queryParams]="{ tab: 'space-tariffs' }">Ver las tarifas de espacios</a>
      </app-empty-state>
    } @else {
      <app-view-state-host [state]="state()" (retry)="reload()">
        @for (c of charges(); track c.id) {
          <div class="case-charges__row" data-testid="case-charge">
            <app-badge [variant]="c.status === 'CHG_VOIDED' ? 'error' : c.status === 'CHG_INVOICED' ? 'success' : 'warning'">{{ statusLabels[c.status] }}</app-badge>
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

  /** El encuentro del caso; `null` mientras el caso no se cerró o la ficha no lo informa. */
  readonly encounterId = input<string | null>(null);
  readonly caseId = input.required<string>();
  /** La sala del caso, ya resuelta por la ficha (el cargo trae sólo su id). */
  readonly roomLabel = input<string | null>(null);

  protected readonly statusLabels: Readonly<Record<ChargeCapture['status'], string>> = { CHG_PENDING: 'Pendiente de revisión', CHG_INVOICED: 'Facturado', CHG_VOIDED: 'Anulado' };
  private readonly loaded = signal<ViewState<readonly ChargeCapture[]>>(loading());
  private readonly reloads = signal(0);

  protected readonly state = computed<ViewState<readonly ChargeCapture[]>>(() => {
    const s = mapData(this.loaded(), (list) => list.filter((c) => c.source === 'OR_TIME' && c.sourceRefId === this.caseId()));
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Se genera al cerrar el caso' }, 'El caso todavía no tiene cargo de quirófano.') : s;
  });

  protected readonly charges = computed(() => (this.state().status === 'ready' ? (this.state() as { data: readonly ChargeCapture[] }).data : []));

  constructor() {
    toObservable(computed(() => ({ id: this.encounterId(), n: this.reloads() })))
      .pipe(
        filter((k): k is { id: string; n: number } => k.id !== null),
        switchMap(({ id }) =>
          this.billing.getPendingCharges(id).pipe(
            map((list) => ready(list.filter((c) => c.encounterId === id)) as ViewState<readonly ChargeCapture[]>),
            catchError((e: unknown) => of(errorToViewState<readonly ChargeCapture[]>(e))),
            startWith(loading() as ViewState<readonly ChargeCapture[]>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.loaded.set(s));
  }

  protected factsOf(c: ChargeCapture): readonly Hecho[] {
    const amount = amountOf(c.quantity, c.unitPrice);
    return [
      { etiqueta: 'Quirófano', valor: this.roomLabel() },
      { etiqueta: 'Tiempo en sala', valor: c.minutes == null ? null : durationOf(c.minutes) },
      { etiqueta: 'Fracciones facturadas', valor: c.quantity },
      { etiqueta: 'Precio por fracción', valor: c.unitPrice === null ? 'Sin tarifa vigente' : Number(c.unitPrice).toFixed(2), tono: c.unitPrice === null ? 'aviso' : 'ok' },
      { etiqueta: 'Importe', valor: amount },
      { etiqueta: 'Centro de costo', valor: c.costCenterId === null ? 'Sin centro de costo (la unidad no tiene uno)' : 'Asignado por la unidad del quirófano' },
      { etiqueta: 'Clave', valor: c.idempotencyKey },
    ];
  }

  protected reload(): void {
    this.reloads.update((n) => n + 1);
  }
}
