import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  IssuedAssertion,
  NewIdentityAssertion,
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
 * Emitir la aserción de un caso (V27-03,
 * `POST /identity/verification-cases/:id/assertions`).
 *
 * La aserción es la credencial que acredita el nivel de aseguramiento
 * alcanzado: la emite una autoridad, vence — por defecto al año — y si algo
 * sale mal después no se borra: se revoca.
 */
@Component({
  selector: 'app-assertion-issue-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './assertion-issue-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssertionIssueForm {
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
      titulo: 'Qué caso',
      hint: 'El expediente resuelto cuyo desenlace se acredita.',
      campos: [
        { key: 'caseId', label: 'Caso de verificación', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'La aserción',
      hint: 'Quién la emite, de qué tipo es y qué nivel acredita.',
      campos: [
        { key: 'issuerIdentityAuthorityId', label: 'Autoridad emisora', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'assertionTypeConceptId', label: 'Tipo de aserción (concepto)', hint: 'Opcional: por defecto, aserción de identidad.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'assuranceLevelConceptId', label: 'Nivel de aseguramiento (concepto)', hint: 'Opcional: por defecto, el nivel solicitado del caso.', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'expiresInHours', label: 'Vence en (horas)', hint: 'Opcional: por defecto, 8760 horas — un año.', control: 'number', mensajeDeError: 'La vigencia empieza en 1 hora.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    caseId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    issuerIdentityAuthorityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    assertionTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    assuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    expiresInHours: new FormControl<number | null>(null, {
      validators: [Validators.min(1)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly issued = signal<IssuedAssertion | null>(null);

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

    const { caseId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.issueAssertion(caseId.trim(), this.datos()).subscribe({
      next: (assertion) => {
        this.state.set(ready(null));
        this.issued.set(assertion);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraAsercion(): void {
    this.form.reset();
    this.issued.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewIdentityAssertion {
    const valores = this.form.getRawValue();
    const tipo = valores.assertionTypeConceptId.trim();
    const nivel = valores.assuranceLevelConceptId.trim();

    return {
      issuerIdentityAuthorityId: valores.issuerIdentityAuthorityId.trim(),
      ...(tipo === '' ? {} : { assertionTypeConceptId: tipo }),
      ...(nivel === '' ? {} : { assuranceLevelConceptId: nivel }),
      ...(valores.expiresInHours === null ? {} : { expiresInHours: valores.expiresInHours }),
    };
  }
}
