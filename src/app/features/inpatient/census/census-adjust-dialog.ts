import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { OVERRIDE_MIN_LENGTH } from '../../../core/data-access/adt/adt.catalog';
import { AdtClient } from '../../../core/data-access/adt/adt.client';
import { adtErrorToViewState } from '../../../core/data-access/adt/adt.errors';
import type { CensusDay } from '../../../core/data-access/adt/adt.types';
import type { CensusField } from '../../../core/data-access/adt/adt.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { AdtIssue } from '../shared/adt-issue';

/**
 * El ajuste de un dato de un censo **cerrado**. Es un `confirmWithReason` al
 * que se le suma el valor nuevo —un ajuste sin número no ajusta nada—: motivo
 * obligatorio, autor y código de soporte los pone el servidor, y el snapshot no
 * se toca (se agrega una fila a los ajustes).
 */
@Component({
  selector: 'app-census-adjust-dialog',
  imports: [AdtIssue, AppButton, ContentDialog, FormField, Input, Textarea],
  template: `
    <app-content-dialog heading="Ajustar un dato del censo" closeLabel="Cancelar" size="md" (closed)="closed.emit()">
      <div class="ajuste" data-testid="ajuste">
        <p class="ajuste__resumen">
          <strong>{{ day().unit.name }}</strong> · {{ etiqueta() }}: el snapshot dice <strong class="tabular-nums" data-testid="ajuste-actual">{{ actual() }}</strong>.
          El snapshot <strong>no se modifica</strong>; el ajuste queda aparte, con su motivo y quién lo hizo.
        </p>
        <app-adt-issue [state]="problema()" heading="No se pudo registrar el ajuste" />
        <app-form-field label="Valor correcto" [required]="true" [errorMessage]="errorDeValor()">
          <app-input type="number" [value]="valor()" (valueChange)="valor.set('' + ($event ?? ''))" ariaLabel="Valor correcto" testId="ajuste-valor" [hasError]="errorDeValor() !== ''" />
        </app-form-field>
        <app-form-field label="Motivo del ajuste" [required]="true" [hint]="'Al menos ' + minimo + ' caracteres.'" [errorMessage]="errorDeMotivo()">
          <app-textarea [(value)]="motivo" [rows]="3" ariaLabel="Motivo del ajuste" data-testid="ajuste-motivo" />
        </app-form-field>
        <div class="ajuste__pie">
          <button app-button variant="outline" type="button" (clicked)="closed.emit()">Cancelar</button>
          <button app-button variant="primary" type="button" [disabled]="!listo()" [isLoading]="enviando()" (clicked)="confirmar()" data-testid="ajuste-confirmar">Registrar el ajuste</button>
        </div>
      </div>
    </app-content-dialog>
  `,
  styles: `
    :host { display: contents; }
    .ajuste { display: flex; flex-direction: column; gap: var(--sp-4); }
    .ajuste__resumen { margin: 0; }
    .ajuste__pie { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--sp-3); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CensusAdjustDialog {
  private readonly client = inject(AdtClient);

  readonly day = input.required<CensusDay>();
  readonly field = input.required<CensusField>();
  readonly etiqueta = input.required<string>();
  readonly actual = input.required<number>();
  readonly adjusted = output<void>();
  readonly closed = output<void>();

  protected readonly minimo = OVERRIDE_MIN_LENGTH;
  protected readonly valor = signal('');
  protected readonly motivo = signal('');
  protected readonly enviando = signal(false);
  protected readonly problema = signal<ViewState<unknown> | null>(null);

  private readonly numero = computed(() => (this.valor().trim() === '' ? null : Number(this.valor())));
  protected readonly errorDeValor = computed(() => {
    const n = this.numero();
    if (this.valor().trim() === '') return '';
    return n !== null && Number.isInteger(n) && n >= 0 ? '' : 'Escriba un número entero, cero o mayor.';
  });
  protected readonly errorDeMotivo = computed(() => '');
  protected readonly listo = computed(() => {
    const n = this.numero();
    return !this.enviando() && n !== null && this.errorDeValor() === '' && this.motivo().trim().length >= this.minimo;
  });

  protected confirmar(): void {
    const id = this.day().id;
    const n = this.numero();
    if (!this.listo() || id === null || n === null) return;
    this.enviando.set(true);
    this.problema.set(null);
    this.client.adjustCensus(id, { fieldCode: this.field(), newValue: n, reasonText: this.motivo().trim() }).subscribe({
      next: () => {
        this.enviando.set(false);
        this.adjusted.emit();
      },
      error: (e: unknown) => {
        this.enviando.set(false);
        this.problema.set(adtErrorToViewState<unknown>(e));
      },
    });
  }
}
