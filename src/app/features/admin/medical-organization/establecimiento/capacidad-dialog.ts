import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { DeclaredCapacity, InfrastructureCatalog } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { opcionesDe } from './regulatorio-dialog';

/**
 * Declarar la capacidad habilitada — `POST /sites/:siteId/declared-capacities`.
 *
 * Sólo se declara lo que dice la resolución. Lo real **no** se escribe: se
 * cuenta de los espacios activos, y la diferencia es la brecha que muestra la
 * pestaña.
 */
@Component({
  selector: 'app-capacidad-dialog',
  imports: [AppButton, ContentDialog, FormField, Input, ReactiveFormsModule, Select, ViewStateHost],
  template: `
    <app-content-dialog
      heading="Declarar capacidad habilitada"
      description="Lo que figura en la resolución de habilitación. Reemplaza la declaración anterior del mismo tipo."
      [dismissible]="!enviando()"
      (closed)="cerrado.emit()"
    >
      @if (fallo(); as estado) {
        <app-view-state-host [state]="estado" (retry)="guardar()" />
      }
      <form class="dialogo__rejilla" [formGroup]="form" (ngSubmit)="guardar()" id="form-capacidad">
        <app-form-field label="Tipo" [required]="true">
          <app-select formControlName="kindCode" [options]="tipos()" />
        </app-form-field>
        <app-form-field label="Cantidad" [required]="true" errorMessage="Un número entero, cero o más.">
          <app-input type="number" formControlName="quantity" />
        </app-form-field>
        <app-form-field label="Vigente desde" [required]="true" errorMessage="Falta la fecha.">
          <app-input type="date" formControlName="asOf" />
        </app-form-field>
        <app-form-field label="N.º de resolución">
          <app-input formControlName="resolutionNumber" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="enviando()" (clicked)="cerrado.emit()">Cancelar</button>
        <button app-button type="submit" form="form-capacidad" [disabled]="enviando()" data-testid="capacidad-guardar">
          {{ enviando() ? 'Guardando…' : 'Declarar' }}
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: './dialogos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapacidadDialog {
  private readonly client = inject(InfrastructureClient);

  readonly siteId = input.required<string>();
  readonly catalogo = input.required<InfrastructureCatalog>();
  readonly guardado = output<DeclaredCapacity>();
  readonly cerrado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);
  protected readonly tipos = computed(() => opcionesDe(this.catalogo().regulatory.capacityKind));

  protected readonly form = new FormGroup({
    kindCode: new FormControl('CAP_BEDS_CENSABLE', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)] }),
    asOf: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    resolutionNumber: new FormControl('', { nonNullable: true }),
  });

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.enviando.set(true);
    this.fallo.set(null);
    this.client
      .declareCapacity(this.siteId(), {
        kindCode: v.kindCode,
        quantity: Number(v.quantity),
        asOf: v.asOf,
        resolutionNumber: v.resolutionNumber.trim() === '' ? null : v.resolutionNumber.trim(),
      })
      .subscribe({
        next: (declarada) => {
          this.enviando.set(false);
          this.guardado.emit(declarada);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.fallo.set(errorToViewState<never>(error));
        },
      });
  }
}
