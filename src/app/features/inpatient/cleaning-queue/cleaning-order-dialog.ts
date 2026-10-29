import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import { CLEANING_PRIORITY_LABEL, CLEANING_TYPE_LABEL } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  CleaningOrder,
  CleaningPriority,
  CleaningType,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { OpsIssueAlert } from '../ops-issue-alert/ops-issue-alert';

const TYPES: readonly SelectOption<string>[] = (['CLEAN_ROUTINE', 'CLEAN_SPOT', 'CLEAN_TERMINAL'] as const).map((value) => ({
  value,
  label: CLEANING_TYPE_LABEL[value],
}));
const PRIORITIES: readonly SelectOption<string>[] = (['CLN_PRIO_ROUTINE', 'CLN_PRIO_URGENT', 'CLN_PRIO_STAT'] as const).map((value) => ({
  value,
  label: CLEANING_PRIORITY_LABEL[value],
}));

/**
 * **Pedir una limpieza** (F2.3 `POST /sites/:siteId/cleaning-orders`). La cama se
 * elige de las que el tablero ya conoce. Si la cama ya tiene una orden abierta
 * (409) o exige limpieza terminal (422), el rechazo se muestra sin cerrar.
 */
@Component({
  selector: 'app-cleaning-order-dialog',
  imports: [AppButton, ContentDialog, FormField, OpsIssueAlert, Select, Textarea],
  template: `
    <app-content-dialog heading="Pedir una limpieza" closeLabel="Cancelar" size="md" (closed)="closed.emit()">
      <div class="co" data-testid="cleaning-order-dialog">
        <app-ops-issue-alert [state]="serverState()" heading="No se pudo pedir la limpieza" />
        <app-form-field label="Cama o local" [required]="true">
          <app-select [options]="bedOptions()" [value]="space()" (valueChange)="space.set($event ?? '')" placeholder="Elija una cama" ariaLabel="Cama o local" data-testid="co-space" />
        </app-form-field>
        <app-form-field label="Tipo de limpieza" [required]="true">
          <app-select [options]="types" [value]="type()" (valueChange)="type.set($event ?? 'CLEAN_ROUTINE')" ariaLabel="Tipo de limpieza" data-testid="co-type" />
        </app-form-field>
        <app-form-field label="Prioridad" [required]="true">
          <app-select [options]="priorities" [value]="priority()" (valueChange)="priority.set($event ?? 'CLN_PRIO_ROUTINE')" ariaLabel="Prioridad" data-testid="co-priority" />
        </app-form-field>
        <app-form-field label="Nota" hint="Opcional.">
          <app-textarea [rows]="2" [maxLength]="300" [value]="note()" (valueChange)="note.set($event)" />
        </app-form-field>
      </div>
      <button app-button dialog-actions type="button" variant="primary" data-testid="co-confirm" [disabled]="pending() || space() === ''" (clicked)="submit()">
        {{ pending() ? 'Pidiendo…' : 'Pedir limpieza' }}
      </button>
    </app-content-dialog>
  `,
  styles: `
    .co {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CleaningOrderDialog {
  readonly siteId = input.required<string>();
  /** Las camas elegibles: código, nombre e id. */
  readonly beds = input.required<readonly { readonly id: string; readonly code: string; readonly name: string }[]>();

  readonly created = output<CleaningOrder>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureOpsClient);

  protected readonly types = TYPES;
  protected readonly priorities = PRIORITIES;
  protected readonly space = signal('');
  protected readonly type = signal<string>('CLEAN_ROUTINE');
  protected readonly priority = signal<string>('CLN_PRIO_ROUTINE');
  protected readonly note = signal('');
  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);
  protected readonly bedOptions = computed<readonly SelectOption<string>[]>(() =>
    this.beds().map((b) => ({ value: b.id, label: `${b.code} · ${b.name}` })),
  );

  protected submit(): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.serverState.set(null);
    const note = this.note().trim();
    this.client
      .createCleaningOrder(this.siteId(), {
        careSpaceId: this.space(),
        typeCode: this.type() as CleaningType,
        priorityCode: this.priority() as CleaningPriority,
        ...(note === '' ? {} : { note }),
      })
      .subscribe({
        next: (order) => {
          this.pending.set(false);
          this.created.emit(order);
        },
        error: (error: unknown) => {
          this.pending.set(false);
          this.serverState.set(opsErrorToViewState<unknown>(error));
        },
      });
  }
}
