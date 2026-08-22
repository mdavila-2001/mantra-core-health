import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué asignación',
      hint: 'La asignación de organización que se va a editar.',
      campos: [
        { key: 'assignmentId', label: 'Identificador de la asignación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Qué cambia',
      hint: 'Al menos uno: nuevo supervisor, nuevo alcance o suspensión. Solo viaja lo elegido.',
      campos: [
        { key: 'supervisorUserId', label: 'Nuevo supervisor', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'accessScope', label: 'Nuevo alcance de acceso', control: 'radio', options: [{ value: 'TENANT', label: 'Toda la organización' }, { value: 'PRACTICE', label: 'Práctica' }, { value: 'SITE', label: 'Sede' }, { value: 'UNIT', label: 'Unidad' }] },
      ],
    },
    {
      titulo: 'Concurrencia',
      hint: 'Opcional: protege contra ediciones cruzadas.',
      campos: [
        { key: 'expectedRowVersion', label: 'Versión esperada (row_version)', hint: 'Si otra persona editó primero, el backend responde 409 en vez de pisar su cambio.', control: 'number' },
      ],
    },
  ]);

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
    accessScope: new FormControl<OrgAccessScope | null>(null),
    suspender: new FormControl(false, { nonNullable: true }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  /** Identificador de la asignación actualizada, cuando el PATCH ya pasó. */
  protected readonly updated = signal<string | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para editar asignaciones de organización.'),
  );

  /** La regla del backend: al menos un cambio entre supervisor, alcance y suspensión. */
  protected sinCambios(): boolean {
    const { supervisorUserId, accessScope, suspender } = this.form.getRawValue();
    return supervisorUserId.trim() === '' && accessScope === null && !suspender;
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
    this.updated.set(null);
    this.state.set(ready(null));
  }

  private cambios(): AssignmentUpdate {
    const { supervisorUserId, expectedRowVersion, accessScope, suspender } =
      this.form.getRawValue();
    const supervisor = supervisorUserId.trim();
    const alcance = opcionDe(SCOPES, accessScope);

    return {
      ...(supervisor === '' ? {} : { supervisorUserId: supervisor }),
      ...(alcance === null ? {} : { accessScope: alcance }),
      ...(suspender ? { suspend: true } : {}),
      ...(expectedRowVersion === null ? {} : { expectedRowVersion }),
    };
  }
}
