import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import type { DischargeDispositionCode } from '../../../core/data-access/adt/adt.types';
import { opsLabel } from '../../../core/data-access/infrastructure-ops/ops-labels';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

const CODES: readonly DischargeDispositionCode[] = ['DISP_HOME', 'DISP_TRANSFER', 'DISP_DEATH', 'DISP_AGAINST_ADVICE', 'DISP_OTHER'];
export const DISPOSITIONS: SelectOption<DischargeDispositionCode>[] = CODES.map((value) => ({ value, label: opsLabel(value) }));

/**
 * **El** formulario de egreso (A03, M7) — `POST /clinical/encounters/:id/discharge`
 * con `If-Match`. Lo usan el diálogo del tablero y la pestaña «Egreso» de la
 * ficha: un solo lugar para validar, mandar y mostrar el error de la API (S4,
 * S5 o S9 con su `requestId`) **dentro** del formulario, junto al botón.
 */
@Component({
  selector: 'app-discharge-form',
  imports: [AppButton, DatePicker, FormField, Select, Textarea, ViewStateHost],
  template: `
    <form class="discharge-form" (submit)="$event.preventDefault(); submit()" data-testid="discharge-form">
      @if (failure(); as f) {
        <app-view-state-host [state]="f" data-testid="discharge-failure" />
      }
      <app-form-field label="Tipo de egreso" [required]="true" [errorMessage]="tried() && !disposition() ? 'Elija el tipo de egreso.' : ''">
        <app-select [(value)]="disposition" [options]="dispositions" placeholder="Elija" data-testid="discharge-disposition" [hasError]="tried() && !disposition()" />
      </app-form-field>
      <app-form-field label="Hora real del egreso" hint="Si no la cambia, queda la de este momento." [errorMessage]="future() ? 'El egreso no puede ser en el futuro.' : ''">
        <app-date-picker [(value)]="occurredAt" mode="date-time" [hasError]="future()" />
      </app-form-field>
      <app-form-field label="Observación" hint="Opcional.">
        <app-textarea [(value)]="reason" [rows]="2" />
      </app-form-field>
      <p class="discharge-form__note">La cama queda sucia y entra a la cola de limpieza{{ isolated() ? ' con limpieza terminal' : '' }}.</p>
      <div class="discharge-form__actions">
        @if (cancellable()) {
          <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="cancelled.emit()">Cancelar</button>
        }
        <button app-button type="submit" [disabled]="sending()" data-testid="discharge-submit">Dar de alta</button>
      </div>
    </form>
  `,
  styles: `
    .discharge-form { display: grid; gap: var(--sp-4); }
    .discharge-form__note { margin: 0; color: var(--text-secondary); font-size: var(--fs-caption); }
    .discharge-form__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DischargeForm {
  private readonly adt = inject(AdtClient);

  readonly encounterId = input.required<string>();
  readonly rowVersion = input.required<number>();
  readonly isolated = input(false);
  readonly cancellable = input(false);
  readonly saved = output<string>();
  readonly cancelled = output<void>();
  /** Mientras manda, para que el marco (diálogo) no se cierre a mitad. */
  readonly busy = output<boolean>();

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
    this.busy.emit(true);
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
          this.busy.emit(false);
          this.saved.emit(r.requestId ?? '');
        },
        error: (e: unknown) => {
          this.sending.set(false);
          this.busy.emit(false);
          this.failure.set(errorToViewState<never>(e));
        },
      });
  }
}
