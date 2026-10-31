import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { CENSUS_FIELDS, type CensusDay, type CensusField } from '../../../core/data-access/adt/adt.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CENSUS_LABEL } from './census-fields';

/**
 * Ajustar un censo cerrado — `POST /census-days/:id/adjustments`.
 * El ajuste es una fila aparte con motivo; la foto del día no cambia.
 */
@Component({
  selector: 'app-adjust-dialog',
  imports: [AppButton, ContentDialog, FormField, Input, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog heading="Ajustar el censo" [description]="day().unitName + ' · el número original se conserva y el ajuste queda con su motivo.'" [dismissible]="!sending()" (closed)="closed.emit()">
      @if (failure(); as f) {
        <app-view-state-host [state]="f" />
      }
      <form class="adjust" id="adjust-form" (submit)="$event.preventDefault(); submit()">
        <app-form-field label="Campo" [required]="true">
          <app-select [(value)]="field" [options]="fields" data-testid="adjust-field" />
        </app-form-field>
        <app-form-field label="Valor corregido" [required]="true" [hint]="'Hoy vale ' + current() + '.'" [errorMessage]="tried() && !validValue() ? 'Un entero mayor o igual a cero.' : ''">
          <app-input type="number" [(value)]="value" data-testid="adjust-value" />
        </app-form-field>
        <app-form-field label="Motivo" [required]="true" [errorMessage]="tried() && !reason().trim() ? 'Todo ajuste exige un motivo.' : ''">
          <app-textarea [(value)]="reason" [rows]="2" data-testid="adjust-reason" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="sending()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button type="submit" form="adjust-form" [disabled]="sending()" data-testid="adjust-submit">Ajustar</button>
      </div>
    </app-content-dialog>
  `,
  styles: `.adjust { display: grid; gap: var(--sp-4); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdjustDialog {
  private readonly adt = inject(AdtClient);

  readonly day = input.required<CensusDay>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly fields: SelectOption<CensusField>[] = CENSUS_FIELDS.map((f) => ({ value: f, label: CENSUS_LABEL[f] }));
  protected readonly field = signal<CensusField | null>('admissions');
  protected readonly value = signal<string | number | null>('');
  protected readonly reason = signal('');
  protected readonly tried = signal(false);
  protected readonly sending = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly current = computed(() => {
    const f = this.field();
    return f === null ? '—' : String(this.day().adjustedCounts[f]);
  });
  protected readonly validValue = computed(() => {
    const n = Number(this.value());
    return this.value() !== '' && this.value() !== null && Number.isInteger(n) && n >= 0;
  });

  protected submit(): void {
    this.tried.set(true);
    const f = this.field();
    const id = this.day().id;
    if (f === null || id === null || !this.validValue() || !this.reason().trim()) return;
    this.sending.set(true);
    this.failure.set(null);
    this.adt.adjustCensus(id, { fieldCode: f, newValue: Number(this.value()), reasonText: this.reason().trim() }).subscribe({
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
