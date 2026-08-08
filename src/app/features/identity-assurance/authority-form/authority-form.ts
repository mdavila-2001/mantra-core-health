import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewIdentityAuthority,
  RegisteredAuthority,
} from '../../../core/data-access/identity/identity-admin.types';
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
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Registrar una autoridad de identidad (V27-09, `POST /identity/authorities`).
 *
 * La autoridad es contra quién se verifica: un registro civil, un colegio
 * profesional, un registro sanitario. Nace sin endpoints — publicarlos
 * (V27-10) es lo que la vuelve consultable por los checks.
 */
@Component({
  selector: 'app-authority-form',
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
  ],
  templateUrl: './authority-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorityForm {
  private readonly client = inject(IdentityAdminClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;

  protected readonly form = new FormGroup({
    authorityCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    authorityTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    jurisdictionConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    assuranceFrameworkConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly registered = signal<RegisteredAuthority | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para administrar la verificación de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.registerAuthority(this.datos()).subscribe({
      next: (authority) => {
        this.state.set(ready(null));
        this.registered.set(authority);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraAutoridad(): void {
    this.form.reset();
    this.registered.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewIdentityAuthority {
    const valores = this.form.getRawValue();
    const jurisdiccion = valores.jurisdictionConceptId.trim();
    const marco = valores.assuranceFrameworkConceptId.trim();

    return {
      tenantId: valores.tenantId.trim(),
      authorityCode: valores.authorityCode.trim(),
      name: valores.name.trim(),
      authorityTypeConceptId: valores.authorityTypeConceptId.trim(),
      ...(jurisdiccion === '' ? {} : { jurisdictionConceptId: jurisdiccion }),
      ...(marco === '' ? {} : { assuranceFrameworkConceptId: marco }),
    };
  }
}
