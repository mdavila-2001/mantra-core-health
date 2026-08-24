import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué autoridad',
      hint: 'Cómo se identifica el registro oficial.',
      campos: [
        { key: 'authorityCode', label: 'Código de la autoridad', hint: 'Único; hasta 100 caracteres. Por ejemplo, RENAPER.', control: 'text', required: true, mensajeDeError: 'Ingresá el código (hasta 100 caracteres).' },
        { key: 'name', label: 'Nombre', control: 'text', required: true, mensajeDeError: 'Ingresá el nombre (hasta 200 caracteres).' },
      ],
    },
    {
      titulo: 'Alcance',
      hint: 'Para qué organización rige y de qué tipo es.',
      campos: [
        { key: 'tenantId', label: 'Organización', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'authorityTypeConceptId', label: 'Tipo de autoridad (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'jurisdictionConceptId', label: 'Jurisdicción (concepto)', hint: 'Opcional: dónde rige la autoridad.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'assuranceFrameworkConceptId', label: 'Marco de aseguramiento (concepto)', hint: 'Opcional: bajo qué marco emite sus niveles.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
  ]);

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
