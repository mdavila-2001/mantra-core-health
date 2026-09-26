import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/** Lo que se devuelve al confirmar: la cláusula (obligatoria) y la justificación. */
export interface DenyItemReason {
  readonly policyClauseReference: string;
  readonly denialRationale: string | null;
}

/** Límites del contrato (`ItemDeterminationDto`). */
const CLAUSE_MAX = 255;
const RATIONALE_MAX = 4000;

/**
 * «No aprobar» un ítem: pide la cláusula del contrato que lo excluye y, si se
 * quiere, una justificación.
 *
 * El registro de procesos es explícito: el paciente tiene que saber **por qué**
 * no se aprobó, según la cláusula del contrato. Por eso la cláusula es
 * obligatoria acá igual que en la API (400 sin ella), y la justificación no.
 *
 * No envía nada: devuelve el motivo y la pantalla lo guarda como borrador del
 * ítem. La respuesta completa (todos los ítems) se envía junta. Se abre
 * siempre vacío —ver `docs/components/composition-rules.md` §6: lo escrito y
 * no aplicado no sobrevive al cierre.
 */
@Component({
  selector: 'app-deny-item-dialog',
  imports: [ReactiveFormsModule, AppButton, ContentDialog, FormField, Input, Textarea],
  templateUrl: './deny-item-dialog.html',
  styleUrl: './deny-item-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DenyItemDialog {
  /** Nombre del ítem, para el encabezado. */
  readonly itemName = input.required<string>();
  readonly confirmed = output<DenyItemReason>();
  readonly closed = output<void>();

  private readonly fb = inject(FormBuilder);
  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly clauseMax = CLAUSE_MAX;
  protected readonly rationaleMax = RATIONALE_MAX;

  protected readonly form = this.fb.nonNullable.group({
    policyClauseReference: [
      '',
      [Validators.required, Validators.maxLength(CLAUSE_MAX), Validators.pattern(/\S/)],
    ],
    denialRationale: ['', Validators.maxLength(RATIONALE_MAX)],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { policyClauseReference, denialRationale } = this.form.getRawValue();
    this.confirmed.emit({
      policyClauseReference: policyClauseReference.trim(),
      denialRationale: denialRationale.trim() === '' ? null : denialRationale.trim(),
    });
    this.dialog().close();
  }
}
