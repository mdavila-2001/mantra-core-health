import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import { ISOLATION_LABEL } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  BedBoardCell,
  IsolationCode,
  IsolationRequest,
  IsolationResult,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { OpsIssueAlert } from '../ops-issue-alert/ops-issue-alert';

const OPTIONS: readonly SelectOption<string>[] = (
  ['ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'] as const
).map((code) => ({ value: code, label: ISOLATION_LABEL[code] }));

/**
 * **Aislar una cama** (F2.3 `POST /care-spaces/:id/isolation`).
 *
 * El aislamiento aéreo exige un local de aislamiento aéreo (AIIR) con presión
 * negativa y la validación de climatización vigente; el protector, ambiente
 * protector con presión positiva. El diálogo no lo comprueba: la API responde
 * 422 `ISOLATION_ROOM_NOT_CAPABLE` con lo que falta (`details.missing`) y acá
 * se muestra tal cual, sin cerrar. En una habitación compartida, las camas
 * hermanas libres quedan bloqueadas por cohorte: se avisa antes de aplicar.
 */
@Component({
  selector: 'app-isolation-dialog',
  imports: [Alert, AppButton, ContentDialog, FormField, OpsIssueAlert, Input, Select, Textarea],
  template: `
    <app-content-dialog
      [heading]="'Aislar · ' + cell().code"
      [description]="cell().name"
      closeLabel="Cancelar"
      size="md"
      (closed)="closed.emit()"
    >
      <div class="iso" data-testid="isolation-dialog">
        <app-ops-issue-alert [state]="serverState()" heading="No se pudo aislar" />
        <app-alert tone="info" title="Habitaciones compartidas">
          Las camas libres de la misma habitación quedan bloqueadas por cohorte mientras dure el aislamiento.
        </app-alert>
        <app-form-field label="Tipo de aislamiento" [required]="true">
          <app-select
            [options]="options"
            [value]="code()"
            (valueChange)="code.set($event ?? 'ISO_CONTACT')"
            ariaLabel="Tipo de aislamiento"
            data-testid="isolation-code"
          />
        </app-form-field>
        <app-form-field label="Microorganismo o cuadro" hint="Opcional. Sirve para agrupar por cohorte.">
          <app-input [value]="organism()" (valueChange)="organism.set('' + ($event ?? ''))" testId="isolation-organism" />
        </app-form-field>
        <app-form-field label="Motivo clínico" [required]="true">
          <app-textarea [rows]="2" [maxLength]="300" [value]="reason()" (valueChange)="reason.set($event)" />
        </app-form-field>
      </div>
      <button app-button dialog-actions type="button" variant="primary" data-testid="isolation-confirm" [disabled]="pending()" (clicked)="submit()">
        {{ pending() ? 'Aplicando…' : 'Aislar' }}
      </button>
    </app-content-dialog>
  `,
  styles: `
    .iso {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IsolationDialog {
  readonly cell = input.required<BedBoardCell>();
  readonly saved = output<IsolationResult>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureOpsClient);

  protected readonly options = OPTIONS;
  protected readonly code = signal<string>('ISO_CONTACT');
  protected readonly organism = signal('');
  protected readonly reason = signal('');
  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);
  protected readonly hasState = computed(() => this.serverState() !== null);

  protected submit(): void {
    if (this.pending()) return;
    const cell = this.cell();
    const organism = this.organism().trim();
    const body: IsolationRequest = {
      isolationCode: this.code() as IsolationCode,
      reasonText: this.reason().trim(),
      ...(organism === '' ? {} : { organismText: organism }),
    };
    this.pending.set(true);
    this.serverState.set(null);
    this.client.changeIsolation(cell.id, cell.opsVersion, body).subscribe({
      next: (result) => {
        this.pending.set(false);
        this.saved.emit(result);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.serverState.set(opsErrorToViewState<unknown>(error));
      },
    });
  }
}
