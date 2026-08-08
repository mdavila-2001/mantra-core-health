import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  OrgAccessScope,
  OrgUserAssignmentUpdate as AssignmentUpdate,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';

const SCOPES: readonly OrgAccessScope[] = ['TENANT', 'PRACTICE', 'SITE', 'UNIT'];

/**
 * Reasignar supervisor o suspender una asignación de organización (V29-01,
 * `PATCH /org/user-assignments/:id`).
 *
 * Es un PATCH: **solo viaja lo que se eligió cambiar**. El backend exige al
 * menos un cambio entre supervisor, alcance y suspensión — sin uno, el envío
 * ni se intenta. La suspensión apagada no viaja como `false`: el caso de uso
 * es suspender (con cascada a las delegaciones), no reactivar.
 */
@Component({
  selector: 'app-org-assignment-update',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    Switch,
  ],
  templateUrl: './org-assignment-update.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrgAssignmentUpdate {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    assignmentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    supervisorUserId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    expectedRowVersion: new FormControl<number | null>(null),
  });

  protected readonly accessScope = signal<OrgAccessScope | null>(null);
  protected readonly suspender = signal(false);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** Identificador de la asignación actualizada, cuando el PATCH ya pasó. */
  protected readonly updated = signal<string | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para editar asignaciones de organización.'),
  );

  protected elegirAlcance(valor: unknown): void {
    this.accessScope.set(opcionDe(SCOPES, valor));
  }

  /** La regla del backend: al menos un cambio entre supervisor, alcance y suspensión. */
  protected sinCambios(): boolean {
    return (
      this.form.getRawValue().supervisorUserId.trim() === '' &&
      this.accessScope() === null &&
      !this.suspender()
    );
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.sinCambios()) {
      this.form.markAllAsTouched();
      return;
    }

    const assignmentId = this.form.getRawValue().assignmentId.trim();

    this.state.set(loading());

    this.client.updateOrgUserAssignment(assignmentId, this.cambios()).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.updated.set(assignmentId);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraEdicion(): void {
    this.form.reset();
    this.accessScope.set(null);
    this.suspender.set(false);
    this.updated.set(null);
    this.state.set(ready(null));
  }

  private cambios(): AssignmentUpdate {
    const { supervisorUserId, expectedRowVersion } = this.form.getRawValue();
    const supervisor = supervisorUserId.trim();
    const alcance = this.accessScope();

    return {
      ...(supervisor === '' ? {} : { supervisorUserId: supervisor }),
      ...(alcance === null ? {} : { accessScope: alcance }),
      ...(this.suspender() ? { suspend: true } : {}),
      ...(expectedRowVersion === null ? {} : { expectedRowVersion }),
    };
  }
}
