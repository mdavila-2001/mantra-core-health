import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { InfrastructureClient } from '../../../../../core/data-access/infrastructure/infrastructure.client';
import { infrastructureErrorToViewState } from '../../../../../core/data-access/infrastructure/infrastructure.errors';
import type {
  ClinicalUnitNode,
  InfraConcept,
  SpaceUnitAssignment,
} from '../../../../../core/data-access/infrastructure/infrastructure.types';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { InfraIssueAlert } from '../issue-alert';

/**
 * **Vincular un espacio con una unidad** (`space_unit_assignments`): quién es la
 * dueña del local (`OWNER`, una sola vigente), quién lo comparte (`SHARED`) o lo
 * tiene prestado (`LOAN`). La API rechaza un segundo dueño vigente; el rechazo
 * se muestra aquí sin cerrar el diálogo.
 */
@Component({
  selector: 'app-unit-link-dialog',
  imports: [AppButton, ContentDialog, FormField, InfraIssueAlert, Select],
  template: `
    <app-content-dialog
      heading="Vincular con una unidad"
      [description]="'«' + spaceName() + '» (' + spaceCode() + ')'"
      closeLabel="Cancelar"
      size="sm"
      (closed)="closed.emit()"
    >
      <div class="vinculo" data-testid="vinculo-dialogo">
        <app-infra-issue-alert [state]="serverState()" heading="No se pudo vincular" />
        <app-form-field label="Unidad" [required]="true">
          <app-select
            [options]="opcionesDeUnidad()"
            [value]="unidad()"
            (valueChange)="unidad.set($event ?? '')"
            placeholder="Elija una unidad"
            data-testid="vinculo-unidad"
          />
        </app-form-field>
        <app-form-field label="Rol" [required]="true" hint="Propietaria: una sola vigente. Compartida o en préstamo: las que haga falta.">
          <app-select
            [options]="opcionesDeRol()"
            [value]="rol()"
            (valueChange)="rol.set($event ?? '')"
            data-testid="vinculo-rol"
          />
        </app-form-field>
      </div>
      <button
        app-button
        dialog-actions
        type="button"
        variant="primary"
        data-testid="vinculo-guardar"
        [disabled]="pending() || unidad() === '' || rol() === ''"
        (clicked)="guardar()"
      >
        {{ pending() ? 'Vinculando…' : 'Vincular' }}
      </button>
    </app-content-dialog>
  `,
  styles: `
    .vinculo {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnitLinkDialog {
  readonly spaceId = input.required<string>();
  readonly spaceName = input.required<string>();
  readonly spaceCode = input.required<string>();
  readonly units = input.required<readonly ClinicalUnitNode[]>();
  readonly roles = input.required<readonly InfraConcept[]>();
  /** Unidades que ya tienen un vínculo vigente: no se ofrecen otra vez. */
  readonly linkedUnitIds = input<ReadonlySet<string>>(new Set());

  readonly linked = output<SpaceUnitAssignment>();
  readonly closed = output<void>();

  private readonly client = inject(InfrastructureClient);

  protected readonly unidad = signal('');
  protected readonly rol = signal('SPACE_UNIT_ROLE_SHARED');
  protected readonly pending = signal(false);
  protected readonly serverState = signal<ViewState<unknown> | null>(null);

  protected readonly opcionesDeUnidad = computed<readonly SelectOption<string>[]>(() =>
    this.units()
      .filter((u) => u.status.code !== 'UNIT_RETIRED' && !this.linkedUnitIds().has(u.id))
      .map((u) => ({ value: u.id, label: `${u.name} (${u.code})` })),
  );

  protected readonly opcionesDeRol = computed<readonly SelectOption<string>[]>(() =>
    this.roles().map((r) => ({ value: r.code, label: r.display })),
  );

  protected guardar(): void {
    if (this.pending()) return;
    this.pending.set(true);
    this.serverState.set(null);
    this.client.addUnitAssignment(this.spaceId(), { clinicalUnitId: this.unidad(), roleCode: this.rol() }).subscribe({
      next: (v) => {
        this.pending.set(false);
        this.linked.emit(v);
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.serverState.set(infrastructureErrorToViewState<unknown>(error));
      },
    });
  }
}
