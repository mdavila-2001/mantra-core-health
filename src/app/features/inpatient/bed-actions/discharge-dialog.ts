import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { DischargeDispositionCode } from '../../../core/data-access/adt/adt.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

export const DISPOSITIONS: SelectOption<DischargeDispositionCode>[] = [
  { value: 'DISP_HOME', label: 'Alta a domicilio' },
  { value: 'DISP_TRANSFER', label: 'Traslado a otro establecimiento' },
  { value: 'DISP_DEATH', label: 'Fallecimiento' },
  { value: 'DISP_AGAINST_ADVICE', label: 'Alta voluntaria' },
  { value: 'DISP_OTHER', label: 'Otro' },
];

/**
 * Egreso (A03) — `POST /clinical/encounters/:id/discharge` con `If-Match`.
 * La cama queda sucia con su orden de limpieza (terminal si había aislamiento).
 */
@Component({
  selector: 'app-discharge-dialog',
  imports: [AppButton, ContentDialog, DatePicker, FormField, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog heading="Dar de alta" [description]="'Paciente de la cama ' + bedCode() + '. La cama queda sucia y entra a la cola de limpieza.'" [dismissible]="!sending()" (closed)="closed.emit()">
      @if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      <form class="discharge-dialog" id="discharge-dialog-form" (submit)="$event.preventDefault(); submit()">
        <app-form-field label="Tipo de egreso" [required]="true" [errorMessage]="tried() && !disposition() ? 'Elija el tipo de egreso.' : ''">
          <app-select [(value)]="disposition" [options]="dispositions" placeholder="Elija" data-testid="discharge-disposition" [hasError]="tried() && !disposition()" />
        </app-form-field>
        <app-form-field label="Hora real del egreso" hint="Si no la cambia, queda la de este momento." [errorMessage]="future() ? 'El egreso no puede ser en el futuro.' : ''">
          <app-date-picker [(value)]="occurredAt" mode="date-time" [hasError]="future()" />
        </app-form-field>
        <app-form-field label="Observación" hint="Opcional.">
          <app-textarea [(value)]="reason" [rows]="2" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button type="submit" form="discharge-dialog-form" [disabled]="sending()" data-testid="discharge-submit">Dar de alta</button>
      </div>
    </app-content-dialog>
  `,
  styles: `.discharge-dialog { display: grid; gap: var(--sp-4); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DischargeDialog {
  private readonly adt = inject(AdtClient);

  readonly encounterId = input.required<string>();
  readonly rowVersion = input.required<number>();
  readonly bedCode = input('');
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly dispositions = DISPOSITIONS;
  protected readonly disposition = signal<DischargeDispositionCode | null>(null);
  protected readonly occurredAt = signal<Date | null>(null);
  protected readonly reason = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly future = (): boolean => (this.occurredAt()?.getTime() ?? 0) > Date.now();

  protected submit(): void {
    this.tried.set(true);
    const d = this.disposition();
    if (d === null || this.future()) return;
    this.sending.set(true);
    this.failure.set(null);
    this.adt
      .discharge(this.encounterId(), this.rowVersion(), {
        dischargeDispositionCode: d,
        occurredAt: (this.occurredAt() ?? new Date()).toISOString(),
        ...(this.reason().trim() ? { reasonText: this.reason().trim() } : {}),
      })
      .subscribe({
        next: (r) => {
          this.sending.set(false);
          this.saved.emit(r.requestId);
        },
        error: (e: unknown) => {
          this.sending.set(false);
          this.failure.set(errorToViewState<never>(e));
        },
      });
  }
}
