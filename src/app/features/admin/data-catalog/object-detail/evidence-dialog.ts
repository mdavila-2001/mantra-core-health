import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type { Evidence, EvidenceKind } from '../../../../core/data-access/admin-portal/data-catalog.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { errorDeApi } from '../../platform/platform-labels';

export const EVIDENCE_KINDS: readonly { readonly value: EvidenceKind; readonly label: string }[] = [
  { value: 'VAULT_NOTE', label: 'Nota de la bóveda del modelo' },
  { value: 'MIGRATION', label: 'Migración o patch SQL' },
  { value: 'CODE_REFERENCE', label: 'Referencia a código' },
  { value: 'OPENAPI', label: 'Contrato OpenAPI' },
  { value: 'OWNER_STATEMENT', label: 'Declaración del responsable' },
  { value: 'DOCUMENT', label: 'Documento' },
  { value: 'SCHEMA_COMMENT', label: 'Comentario del esquema' },
];

/**
 * Enlaza una evidencia verificable a la tabla: una ruta, URL o identificador,
 * nunca un secreto ni filas de producción. Sin evidencia no se aprueba una ficha.
 */
@Component({
  selector: 'app-evidence-dialog',
  imports: [ReactiveFormsModule, AppButton, Input, Select, Textarea, Alert, FormField, ContentDialog],
  template: `
    <app-content-dialog
      heading="Añadir evidencia"
      description="Algo que otra persona pueda abrir y comprobar. Nunca un secreto ni datos de pacientes."
      [dismissible]="!guardando()"
      (closed)="closed.emit()"
    >
      @if (error(); as mensaje) {
        <app-alert tone="error">{{ mensaje }}</app-alert>
      }
      <form class="evidencia-form" [formGroup]="form" novalidate>
        <app-form-field label="Tipo" [required]="true">
          <app-select ariaLabel="Tipo de evidencia" [options]="tipos" [value]="tipo()" (valueChange)="tipo.set($event ?? 'DOCUMENT')" />
        </app-form-field>
        <app-form-field
          label="Referencia"
          hint="Ruta del archivo, URL o identificador."
          [required]="true"
          [errorMessage]="form.controls.reference.touched && form.controls.reference.invalid ? 'Escribí una referencia verificable.' : ''"
        >
          <app-input formControlName="reference" testId="evidence-reference" />
        </app-form-field>
        <app-form-field label="Commit o versión" hint="Opcional: fija la versión exacta que se cita.">
          <app-input formControlName="sourceRevision" />
        </app-form-field>
        <app-form-field label="Extracto" hint="Opcional, breve.">
          <app-textarea formControlName="excerpt" [rows]="3" [maxLength]="2000" />
        </app-form-field>
      </form>
      <div dialog-actions class="evidencia-form__acciones">
        <button app-button variant="ghost" [disabled]="guardando()" (clicked)="closed.emit()">Cancelar</button>
        <button app-button variant="primary" data-testid="evidence-save" [isLoading]="guardando()" (clicked)="guardar()">Añadir</button>
      </div>
    </app-content-dialog>
  `,
  styles: `
    .evidencia-form { display: flex; flex-direction: column; gap: var(--e3); }
    .evidencia-form__acciones { display: flex; justify-content: flex-end; gap: var(--e2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EvidenceDialog {
  private readonly catalog = inject(DataCatalogClient);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly objectId = input.required<string>();
  readonly saved = output<Evidence>();
  readonly closed = output<void>();

  protected readonly tipos = EVIDENCE_KINDS;
  protected readonly tipo = signal<EvidenceKind>('MIGRATION');
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = this.fb.group({
    reference: this.fb.control('', [Validators.required, Validators.minLength(3), Validators.maxLength(1000)]),
    sourceRevision: this.fb.control(''),
    excerpt: this.fb.control(''),
  });

  protected guardar(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.guardando.set(true);
    this.error.set(null);
    this.catalog
      .addEvidence(this.objectId(), {
        kind: this.tipo(),
        reference: v.reference.trim(),
        ...(v.sourceRevision.trim() ? { sourceRevision: v.sourceRevision.trim() } : {}),
        ...(v.excerpt.trim() ? { excerpt: v.excerpt.trim() } : {}),
      })
      .subscribe({
        next: (item) => {
          this.guardando.set(false);
          this.saved.emit(item);
        },
        error: (e: unknown) => {
          this.guardando.set(false);
          this.error.set(errorDeApi(e).message ?? 'No se pudo añadir la evidencia.');
        },
      });
  }
}
