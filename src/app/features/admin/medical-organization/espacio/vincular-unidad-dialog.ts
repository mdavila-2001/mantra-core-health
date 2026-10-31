import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type {
  CareSpaceDetail,
  InfrastructureCatalog,
  SiteStructure,
  SpaceUnitAssignment,
} from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Vincular el espacio a una unidad — `POST /care-spaces/:id/unit-assignments`.
 *
 * Un solo propietario vigente: si ya hay uno, «Propietaria» aparece deshabilitada
 * y se dice por qué. La API lo impide igual (409 `SPACE_OWNER_TAKEN`).
 */
@Component({
  selector: 'app-vincular-unidad-dialog',
  imports: [AppButton, ContentDialog, FormField, ReactiveFormsModule, Select, ViewStateHost],
  template: `
    <app-content-dialog
      heading="Vincular una unidad"
      description="La unidad propietaria es quien tiene el espacio a cargo; compartida y en préstamo lo usan sin ser dueñas."
      [dismissible]="!enviando()"
      (closed)="cerrado.emit()"
    >
      @if (fallo(); as estado) {
        <app-view-state-host [state]="estado" (retry)="vincular()" />
      }
      <form [formGroup]="form" (ngSubmit)="vincular()" id="form-vincular" class="vincular">
        <app-form-field label="Unidad" [required]="true">
          <app-select formControlName="clinicalUnitId" [options]="unidades()" placeholder="Elegí una unidad" />
        </app-form-field>
        <app-form-field label="Rol" [required]="true" [hint]="tienePropietaria() ? 'Ya hay una unidad propietaria: desvinculala para cambiarla.' : ''">
          <app-select formControlName="roleCode" [options]="roles()" />
        </app-form-field>
      </form>
      <div dialog-actions>
        <button app-button variant="ghost" type="button" [disabled]="enviando()" (clicked)="cerrado.emit()">Cancelar</button>
        <button app-button type="submit" form="form-vincular" [disabled]="enviando() || form.invalid" data-testid="vincular-confirmar">
          {{ enviando() ? 'Vinculando…' : 'Vincular' }}
        </button>
      </div>
    </app-content-dialog>
  `,
  styles: `.vincular { display: grid; gap: var(--sp-3); }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VincularUnidadDialog {
  private readonly client = inject(InfrastructureClient);

  readonly espacio = input.required<CareSpaceDetail>();
  readonly estructura = input<SiteStructure | null>(null);
  readonly catalogo = input.required<InfrastructureCatalog>();
  readonly guardado = output<SpaceUnitAssignment>();
  readonly cerrado = output<void>();

  protected readonly enviando = signal(false);
  protected readonly fallo = signal<ViewState<never> | null>(null);

  protected readonly tienePropietaria = computed(() =>
    this.espacio().assignments.some((a) => a.role.code === 'SPACE_UNIT_ROLE_OWNER'),
  );

  protected readonly unidades = computed<SelectOption<string>[]>(() => {
    const vinculadas = new Set(this.espacio().assignments.map((a) => a.clinicalUnitId));
    return (this.estructura()?.units ?? [])
      .filter((u) => u.status.code !== 'UNIT_RETIRED')
      .map((u) => ({ value: u.id, label: `${u.name} (${u.code})`, disabled: vinculadas.has(u.id) }));
  });

  protected readonly roles = computed<SelectOption<string>[]>(() =>
    this.catalogo().attributes.unitRole.map((r) => ({
      value: r.code,
      label: r.display,
      disabled: r.code === 'SPACE_UNIT_ROLE_OWNER' && this.tienePropietaria(),
    })),
  );

  protected readonly form = new FormGroup({
    clinicalUnitId: new FormControl<string | null>(null, { validators: [Validators.required] }),
    roleCode: new FormControl('SPACE_UNIT_ROLE_SHARED', { nonNullable: true, validators: [Validators.required] }),
  });

  protected vincular(): void {
    const { clinicalUnitId, roleCode } = this.form.getRawValue();
    if (clinicalUnitId === null) return;
    this.enviando.set(true);
    this.fallo.set(null);
    this.client.assignUnit(this.espacio().id, { clinicalUnitId, roleCode }).subscribe({
      next: (vinculo) => {
        this.enviando.set(false);
        this.guardado.emit(vinculo);
      },
      error: (error: unknown) => {
        this.enviando.set(false);
        this.fallo.set(errorToViewState<never>(error));
      },
    });
  }
}
