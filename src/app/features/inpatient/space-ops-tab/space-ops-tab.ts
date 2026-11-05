import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild, type TemplateRef } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { CareSpaceBlock } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { opsLabel } from '../../../core/data-access/infrastructure-ops/ops-labels';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { BedPanel } from '../bed-board/bed-panel';
import { shortDateTime } from '../inpatient-presentation';

/**
 * Pestaña **Operación** de la ficha de espacio de F1 (F2.4): los ejes, las
 * acciones operativas que la API ofrezca, el historial A20 y todos los
 * bloqueos del espacio (vigentes y terminados). Reutiliza el panel del tablero:
 * es la misma información, mirada desde la estructura.
 */
@Component({
  selector: 'app-space-ops-tab',
  imports: [Badge, BedPanel, DataTable],
  template: `
    <div class="space-ops" data-testid="space-ops-tab">
      <app-bed-panel [cellId]="careSpaceId()" (changed)="loadBlocks()" />
      <section class="space-ops__blocks" aria-labelledby="space-ops-blocks">
        <h3 id="space-ops-blocks" class="space-ops__title">Bloqueos del espacio</h3>
        <app-data-table data-testid="space-ops-blocks" [state]="blocks()" [columns]="columns()" [trackBy]="byId" caption="Bloqueos vigentes y terminados" stackedOnMobile (retry)="loadBlocks()" />
      </section>
    </div>
    <ng-template #cellKind let-b><app-badge size="sm" [variant]="b.endedAt || b.cancelledAt ? 'secondary' : 'warning'">{{ label(b.kindCode) }}</app-badge></ng-template>
    <ng-template #cellReason let-b>{{ label(b.reasonCode) }}@if (b.reasonText) { · {{ b.reasonText }} }</ng-template>
    <ng-template #cellPeriod let-b>{{ when(b.startsAt) }} → {{ b.endedAt ? when(b.endedAt) : b.cancelledAt ? 'cancelado' : (b.expectedEndAt ? 'estimado ' + when(b.expectedEndAt) : 'vigente') }}</ng-template>
  `,
  styles: `
    .space-ops { display: grid; gap: var(--sp-6); padding-block-start: var(--sp-4); }
    .space-ops__blocks { display: grid; gap: var(--sp-2); }
    .space-ops__title { margin: 0; font-size: var(--fs-body); font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceOpsTab {
  private readonly client = inject(InfrastructureOpsClient);

  readonly careSpaceId = input.required<string>();

  private readonly raw = signal<ViewState<readonly CareSpaceBlock[]>>(loading());
  protected readonly when = (iso: string | null) => shortDateTime(iso) ?? '—';
  protected readonly label = opsLabel;
  private readonly reloads = signal(0);
  protected readonly byId = (b: CareSpaceBlock): string => b.id;

  protected readonly blocks = computed<ViewState<readonly CareSpaceBlock[]>>(() => {
    const s = this.raw();
    return s.status === 'ready' && s.data.length === 0 ? empty({ label: 'Los bloqueos se piden desde el tablero de camas o desde esta pestaña' }, 'Este espacio nunca estuvo bloqueado.') : s;
  });

  private readonly cellKind = viewChild<TemplateRef<{ $implicit: CareSpaceBlock }>>('cellKind');
  private readonly cellReason = viewChild<TemplateRef<{ $implicit: CareSpaceBlock }>>('cellReason');
  private readonly cellPeriod = viewChild<TemplateRef<{ $implicit: CareSpaceBlock }>>('cellPeriod');
  protected readonly columns = computed<readonly ColumnDef<CareSpaceBlock>[]>(() => [
    { key: 'kindCode', header: 'Tipo', priority: 1, cell: this.cellKind() },
    { key: 'reasonCode', header: 'Motivo', priority: 1, cell: this.cellReason() },
    { key: 'startsAt', header: 'Período', priority: 2, cell: this.cellPeriod() },
  ]);

  constructor() {
    // Cambiar de espacio cancela el pedido del anterior.
    toObservable(computed(() => ({ id: this.careSpaceId(), n: this.reloads() })))
      .pipe(
        switchMap(({ id }) =>
          this.client.listBlocks(id, true).pipe(
            map((b) => ready(b) as ViewState<readonly CareSpaceBlock[]>),
            catchError((e: unknown) => of(errorToViewState<readonly CareSpaceBlock[]>(e))),
            startWith(loading() as ViewState<readonly CareSpaceBlock[]>),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.raw.set(s));
  }

  protected loadBlocks(): void {
    this.reloads.update((n) => n + 1);
  }
}
