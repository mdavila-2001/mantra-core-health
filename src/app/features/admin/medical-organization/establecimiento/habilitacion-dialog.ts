import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type {
  ClinicalUnitNode,
  InfrastructureCatalog,
  SiteLicense,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { opcionesDe } from './regulatorio-dialog';

/**
 * Alta de una habilitación — `POST /sites/:siteId/licenses`.
 *
 * El estado «vencida» no se elige: lo calcula la API al leer si el vencimiento
 * ya pasó. Por eso no figura entre las opciones del alta.
 */
@Component({
  selector: 'app-habilitacion-dialog',
  imports: [AppButton, ContentDialog, FormField, Input, ReactiveFormsModule, Select, Textarea, ViewStateHost],
  template: `
    <app-content-dialog
      size="lg"
      heading="Registrar una habilitación"
      description="Resolución de la autoridad sanitaria. El alcance por unidad es opcional: sin él vale para todo el establecimiento."
      [dismissible]="!enviando()"
      (closed)="cerrado.emit()"
    >
      @if (fallo(); as estado) {
        <app-view-state-host [state]="estado" (retry)="guardar()" />
      }
      <form class="dialogo__rejilla" [formGroup]="form" (ngSubmit)="guardar()" id="form-habilitacion">
        <app-form-field label="Autoridad" [required]="true" errorMessage="Indicá quién la emitió.">
          <app-input formControlName="authorityName" placeholder="SEDES Santa Cruz" />
        </app-form-field>
        <app-form-field label="N.º de resolución" [required]="true" errorMessage="Falta el número.">
          <app-input formControlName="resolutionNumber" />
        </app-form-field>
        <app-form-field label="Emitida el" [required]="true" errorMessage="Falta la fecha.">
          <app-input type="date" formControlName="issuedOn" />
        </app-form-field>
        <app-form-field label="Vence el" hint="Vacío si no vence.">
          <app-input type="date" formControlName="expiresOn" />
        </app-form-field>
        <app-form-field label="Estado" [required]="true">
          <app-select formControlName="statusCode" [options]="estados()" />
        </app-form-field>
        <app-form-field label="Alcance (unidad)">
          <app-select formControlName="clinicalUnitId" [options]="unidadesComoOpciones()" placeholder="Todo el establecimiento" />
        </app-form-field>
        <app-form-field class="dialogo__ancho" label="Notas">
          <app-textarea formControlName="notes" [rows]="2" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="enviando()" (clicked)="cerrado.emit()">Cancelar</button>
        <button app-button type="submit" form="form-habilitacion" [disabled]="enviando()" data-testid="habilitacion-guardar">
          {{ enviando() ? 'Guardando…' : 'Registrar' }}
        </button>
      </div>
    </app-content-dialog>
  `,
  styleUrl: './dialogos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HabilitacionDialog {
  private readonly client = inject(InfrastructureClient);

  readonly siteId = input.required<string>();
  readonly catalogo = input.required<InfrastructureCatalog>();
  readonly unidades = input<readonly ClinicalUnitNode[]>([]);
  readonly guardado = output<SiteLicense>();
  readonly cerrado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);

  protected readonly estados = computed(() =>
    opcionesDe(this.catalogo().regulatory.licenseStatus.filter((s) => s.code !== 'LIC_EXPIRED')),
  );
  protected readonly unidadesComoOpciones = computed(() =>
    this.unidades().map((u) => ({ value: u.id, label: u.name })),
  );

  protected readonly form = new FormGroup({
    authorityName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    resolutionNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    issuedOn: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    expiresOn: new FormControl('', { nonNullable: true }),
    statusCode: new FormControl('LIC_VALID', { nonNullable: true, validators: [Validators.required] }),
    clinicalUnitId: new FormControl<string | null>(null),
    notes: new FormControl('', { nonNullable: true }),
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
      .createLicense(this.siteId(), {
        authorityName: v.authorityName.trim(),
        resolutionNumber: v.resolutionNumber.trim(),
        issuedOn: v.issuedOn,
        expiresOn: v.expiresOn === '' ? null : v.expiresOn,
        statusCode: v.statusCode,
        clinicalUnitId: v.clinicalUnitId,
        notes: v.notes.trim() === '' ? null : v.notes.trim(),
      })
      .subscribe({
        next: (licencia) => {
          this.enviando.set(false);
          this.guardado.emit(licencia);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.fallo.set(errorToViewState<never>(error));
        },
      });
  }
}
