import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import type { DeclaredCapacityInput, InfraConcept } from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { PaginatedForm } from '../../../../../shared/components/organisms/paginated-form/paginated-form';
import type { PaginaDeFormulario } from '../../../../../shared/forms/paginated/paginated-form.types';
import { InfraIssueAlert } from '../issue-alert';

function aDia(d: Date | null): string | undefined {
  if (d === null) return undefined;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * **Declarar capacidad** ante la autoridad: cuántas camas censables, quirófanos,
 * consultorios… se declararon, con fecha de corte y resolución. No sobrescribe:
 * agrega una declaración con vigencia. La capacidad **real** no se carga acá
 * (INV-20): se cuenta del árbol, y la diferencia se reporta sin corregir ninguno
 * de los dos lados.
 */
@Component({
  selector: 'app-capacity-form-dialog',
  imports: [ContentDialog, InfraIssueAlert, PaginatedForm],
  template: `
    <app-content-dialog heading="Declarar capacidad" [description]="siteName()" closeLabel="Cancelar" size="md" (closed)="closed.emit()">
      <div data-testid="capacidad-dialogo">
        <app-infra-issue-alert [state]="serverState()" heading="No se pudo registrar la declaración" />
        <app-paginated-form
          [paginas]="paginas()"
          [form]="form"
          label="Capacidad declarada"
          submitLabel="Registrar declaración"
          submitTestId="capacidad-guardar"
          cancelLabel="Cancelar"
          [pending]="pending()"
          (enviado)="guardar()"
          (cancelado)="closed.emit()"
        />
      </div>
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapacityFormDialog {
  readonly siteId = input.required<string>();
  readonly siteName = input.required<string>();
  readonly kinds = input.required<readonly InfraConcept[]>();

  readonly saved = output<void>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  protected readonly form = new FormGroup({
    capacityKindCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    quantity: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    asOf: new FormControl<Date | null>(new Date(), { validators: [Validators.required] }),
    resolutionNumber: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    validTo: new FormControl<Date | null>(null),
  });

  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => [
    {
      titulo: 'Qué se declara',
      clave: 'declaracion',
      campos: [
        { key: 'capacityKindCode', label: 'Tipo de capacidad', control: 'select', required: true, options: this.kinds().map((k) => ({ value: k.code, label: k.display })), testId: 'capacidad-tipo' },
        { key: 'quantity', label: 'Cantidad declarada', control: 'number', required: true, testId: 'capacidad-cantidad' },
        { key: 'asOf', label: 'Fecha de corte', control: 'date', required: true },
        { key: 'resolutionNumber', label: 'Resolución', control: 'text', hint: 'La que respalda la cifra, si la hay.' },
      ],
      disposicion: 'dos-columnas',
    },
    {
      titulo: 'Vigencia',
      clave: 'vigencia',
      hint: 'Opcional: hasta cuándo rige esta declaración.',
      campos: [{ key: 'validTo', label: 'Vigente hasta', control: 'date' }],
    },
  ]);

  protected guardar(): void {
    if (this.pending()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const cuerpo: DeclaredCapacityInput = {
      capacityKindCode: v.capacityKindCode,
      quantity: v.quantity ?? 0,
      asOf: aDia(v.asOf)!,
      ...(v.resolutionNumber.trim() === '' ? {} : { resolutionNumber: v.resolutionNumber.trim() }),
      ...(v.validTo === null ? {} : { validTo: aDia(v.validTo) }),
    };
    this.pending.set(true);
    this.serverState.set(null);
    this.client.declareCapacity(this.siteId(), cuerpo).subscribe({
      next: () => {
        this.pending.set(false);
        this.saved.emit();
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }
}
