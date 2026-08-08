import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type { PermissionSetVersion } from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../form-support';
import { SetItemsEditor } from '../set-items-editor/set-items-editor';

/**
 * Publicar una versión nueva de un set de permisos (V29-09,
 * `POST /delegated-permission-sets/:id/versions`).
 *
 * El reemplazo es **all-or-nothing**: la versión nueva trae su lista completa
 * de ítems y sustituye entera a la vigente. No hay fusión — lo que no esté en
 * esta lista deja de estar en el set.
 */
@Component({
  selector: 'app-set-version-form',
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
    SetItemsEditor,
  ],
  templateUrl: './set-version-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetVersionForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);

  private readonly editor = viewChild.required(SetItemsEditor);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    setId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly published = signal<PermissionSetVersion | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para versionar sets de permisos.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const items = this.editor().intentarEnvio();

    if (this.form.invalid || items === null) {
      this.form.markAllAsTouched();
      return;
    }

    const setId = this.form.getRawValue().setId.trim();

    this.state.set(loading());

    this.client.publishSetVersion(setId, { items }).subscribe({
      next: (version) => {
        this.state.set(ready(null));
        this.published.set(version);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraVersion(): void {
    // El editor renace fresco al volver al formulario; solo el grupo persiste.
    this.form.reset();
    this.published.set(null);
    this.state.set(ready(null));
  }
}
