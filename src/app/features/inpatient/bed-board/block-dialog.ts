import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type {
  AvailabilityRequest,
  BedBoardCell,
  BlockKindCode,
  FutureCommitmentConflict,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { apiReason } from '../api-reason';
import { OpsCatalogStore } from '../ops-catalog.store';

const TITLE: Readonly<Record<BlockKindCode, string>> = {
  BLOCK_CLINICAL: 'Bloqueo clínico',
  BLOCK_ADMIN: 'Bloqueo administrativo',
  BLOCK_MAINTENANCE: 'Poner en mantenimiento',
  BLOCK_CLOSURE: 'Cerrar el espacio',
};

/**
 * Bloquear un espacio — `POST /care-spaces/:id/availability` con `If-Match-Ops`.
 *
 * Motivo obligatorio (filtrado por el tipo de bloqueo), texto obligatorio con
 * «Otro» y fecha estimada obligatoria en mantenimiento. La API vuelve a validar
 * todo (422) y, si hay compromisos en la ventana, responde 409 con la lista:
 * se muestran y se pide confirmar que se conocen (`acknowledgeConflicts`).
 */
@Component({
  selector: 'app-block-dialog',
  imports: [AppButton, Checkbox, ContentDialog, DatePicker, FormField, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog
      [heading]="title()"
      [description]="'Cama ' + cell().code + '. El motivo queda en el historial y se ve en el tablero.'"
      [dismissible]="!sending()"
      (closed)="closed.emit()"
    >
      @if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      <form class="block-dialog" id="block-dialog-form" (submit)="$event.preventDefault(); submit()">
        <app-form-field label="Motivo" [required]="true" [errorMessage]="tried() && !reasonCode() ? 'Elija el motivo del bloqueo.' : ''">
          <app-select [(value)]="reasonCode" [options]="reasons()" placeholder="Elija un motivo" data-testid="block-reason" [hasError]="tried() && !reasonCode()" />
        </app-form-field>
        <app-form-field
          label="Detalle del motivo"
          [required]="needsText()"
          [hint]="needsText() ? 'Con «Otro» el detalle es obligatorio.' : 'Opcional.'"
          [errorMessage]="tried() && needsText() && !reasonText().trim() ? 'Describa el motivo.' : ''"
        >
          <app-textarea [(value)]="reasonText" [rows]="3" data-testid="block-reason-text" />
        </app-form-field>
        <app-form-field
          label="Fecha estimada de fin"
          [required]="kind() === 'BLOCK_MAINTENANCE'"
          [hint]="kind() === 'BLOCK_MAINTENANCE' ? 'Obligatoria en mantenimiento.' : 'Opcional.'"
          [errorMessage]="tried() && kind() === 'BLOCK_MAINTENANCE' && !until() ? 'Indique hasta cuándo.' : ''"
        >
          <app-date-picker [(value)]="until" mode="date-time" data-testid="block-until" />
        </app-form-field>
        @if (conflicts(); as lista) {
          <div class="block-dialog__conflicts" data-testid="block-conflicts" role="group" aria-label="Compromisos en la ventana">
            <p>Hay {{ lista.length }} compromiso(s) en la ventana del bloqueo:</p>
            <ul>
              @for (c of lista; track c.id) {
                <li>{{ c.kind === 'PROCEDURE_CASE' ? 'Intervención' : 'Turno' }} {{ c.id.slice(0, 8) }} — {{ c.nextAction }}</li>
              }
            </ul>
            <app-checkbox [(checked)]="acknowledge" label="Conozco estos compromisos y bloqueo igual" />
          </div>
        }
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button type="submit" form="block-dialog-form" [disabled]="sending()" data-testid="block-submit">{{ title() }}</button>
      </div>
    </app-content-dialog>
  `,
  styles: `
    .block-dialog { display: grid; gap: var(--sp-4); }
    .block-dialog__conflicts { padding: var(--sp-3); border: 1px solid var(--st-warning-bd); border-radius: var(--r-md); background: var(--st-warning-bg); color: var(--st-warning-fg); }
    .block-dialog__conflicts ul { margin: var(--sp-2) 0; padding-inline-start: var(--sp-5); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlockDialog {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly catalog = inject(OpsCatalogStore);

  readonly cell = input.required<BedBoardCell>();
  readonly kind = input.required<BlockKindCode>();
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly reasonCode = signal<string | null>(null);
  protected readonly reasonText = signal('');
  protected readonly until = signal<Date | null>(null);
  protected readonly acknowledge = signal(false);
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly conflicts = signal<readonly FutureCommitmentConflict[] | null>(null);

  protected readonly title = computed(() => TITLE[this.kind()]);

  protected readonly reasons = computed<SelectOption<string>[]>(() =>
    (this.catalog.catalog()?.blockReasons ?? [])
      .filter((r) => r.kinds.includes(this.kind()))
      .map((r) => ({ value: r.code, label: r.display })),
  );

  protected readonly needsText = computed(
    () => this.catalog.catalog()?.blockReasons.find((r) => r.code === this.reasonCode())?.requiresText === true,
  );

  constructor() {
    this.catalog.ensure();
  }

  protected submit(): void {
    this.tried.set(true);
    const kind = this.kind();
    if (!this.reasonCode() || (this.needsText() && !this.reasonText().trim()) || (kind === 'BLOCK_MAINTENANCE' && this.until() === null)) return;
    const until = this.until();
    const body: AvailabilityRequest = {
      action: kind === 'BLOCK_MAINTENANCE' ? 'start-maintenance' : kind === 'BLOCK_CLOSURE' ? 'close' : 'block',
      ...(kind === 'BLOCK_MAINTENANCE' || kind === 'BLOCK_CLOSURE' ? {} : { kindCode: kind }),
      reasonCode: this.reasonCode()!,
      ...(this.reasonText().trim() ? { reasonText: this.reasonText().trim() } : {}),
      ...(until === null ? {} : { expectedEndAt: until.toISOString() }),
      ...(this.acknowledge() ? { acknowledgeConflicts: true } : {}),
    };
    this.sending.set(true);
    this.failure.set(null);
    this.client.changeAvailability(this.cell().id, this.cell().opsVersion, body).subscribe({
      next: (r) => {
        this.sending.set(false);
        this.saved.emit(r.requestId);
      },
      error: (e: unknown) => {
        this.sending.set(false);
        const r = apiReason(e);
        if (r?.reason === 'FUTURE_COMMITMENTS_CONFLICT') {
          this.conflicts.set((r.details['conflicts'] as FutureCommitmentConflict[] | undefined) ?? []);
          return;
        }
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }
}
