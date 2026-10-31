import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BedBoardCell, CleaningPriorityCode, CleaningTypeCode } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/** Orden manual — `POST /sites/:siteId/cleaning-orders` (409 si ya hay una abierta). */
@Component({
  selector: 'app-new-order-dialog',
  imports: [AppButton, ContentDialog, FormField, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog heading="Pedir una limpieza" description="La orden entra a la cola con su prioridad." [dismissible]="!sending()" (closed)="closed.emit()">
      @if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      <form class="new-order" id="new-order-form" (submit)="$event.preventDefault(); submit()">
        <app-form-field label="Espacio" [required]="true" [errorMessage]="tried() && !space() ? 'Elija el espacio.' : ''">
          <app-select [(value)]="space" [options]="spaces()" placeholder="Elija una cama" data-testid="new-order-space" />
        </app-form-field>
        <app-form-field label="Tipo" [required]="true">
          <app-select [(value)]="type" [options]="types" />
        </app-form-field>
        <app-form-field label="Prioridad" [required]="true">
          <app-select [(value)]="priority" [options]="priorities" />
        </app-form-field>
        <app-form-field label="Nota" hint="Opcional.">
          <app-textarea [(value)]="note" [rows]="2" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button type="submit" form="new-order-form" [disabled]="sending()" data-testid="new-order-submit">Pedir</button>
      </div>
    </app-content-dialog>
  `,
  styles: `.new-order { display: grid; gap: var(--sp-4); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrderDialog {
  private readonly client = inject(InfrastructureOpsClient);

  readonly siteId = input.required<string>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly types: SelectOption<CleaningTypeCode>[] = [
    { value: 'CLEAN_ROUTINE', label: 'Rutina' },
    { value: 'CLEAN_SPOT', label: 'Puntual' },
    { value: 'CLEAN_TERMINAL', label: 'Terminal' },
  ];
  protected readonly priorities: SelectOption<CleaningPriorityCode>[] = [
    { value: 'CLN_PRIO_ROUTINE', label: 'Rutina' },
    { value: 'CLN_PRIO_URGENT', label: 'Urgente' },
    { value: 'CLN_PRIO_STAT', label: 'Inmediata' },
  ];
  protected readonly space = signal<string | null>(null);
  protected readonly type = signal<CleaningTypeCode | null>('CLEAN_ROUTINE');
  protected readonly priority = signal<CleaningPriorityCode | null>('CLN_PRIO_ROUTINE');
  protected readonly note = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  private readonly cells = signal<readonly BedBoardCell[]>([]);

  protected readonly spaces = computed<SelectOption<string>[]>(() =>
    this.cells().filter((c) => c.openCleaningOrderId === null).map((c) => ({ value: c.id, label: `${c.code} · ${c.hygiene.display}` })),
  );

  constructor() {
    effect(() => {
      const id = this.siteId();
      untracked(() =>
        this.client.getBedBoard(id).subscribe({
          next: (b) => this.cells.set(b.units.flatMap((u) => u.cells)),
          error: (e: unknown) => this.failure.set(errorToViewState<never>(e)),
        }),
      );
    });
  }

  protected submit(): void {
    this.tried.set(true);
    const s = this.space();
    if (s === null) return;
    this.sending.set(true);
    this.client
      .createCleaningOrder(this.siteId(), { careSpaceId: s, typeCode: this.type() ?? 'CLEAN_ROUTINE', priorityCode: this.priority() ?? 'CLN_PRIO_ROUTINE', ...(this.note().trim() ? { note: this.note().trim() } : {}) })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.saved.emit();
        },
        error: (e: unknown) => {
          this.sending.set(false);
          this.failure.set(errorToViewState<never>(e));
        },
      });
  }
}
