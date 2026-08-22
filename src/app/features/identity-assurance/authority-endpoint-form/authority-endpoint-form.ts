import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { IdentityAdminClient } from '../../../core/data-access/identity/identity-admin.client';
import type {
  NewAuthorityEndpoint,
  PublishedAuthorityEndpoint,
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
 * Publicar un endpoint de verificación de una autoridad (V27-10,
 * `POST /identity/authorities/:id/endpoints`).
 *
 * El endpoint técnico vive en el módulo de integraciones; acá solo se lo
 * asocia a la autoridad con una capacidad — qué sabe responder — y,
 * opcionalmente, el nivel de aseguramiento que alcanza y las versiones de
 * contrato con las que habla.
 */
@Component({
  selector: 'app-authority-endpoint-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './authority-endpoint-form.html',
  styleUrl: '../m27-admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorityEndpointForm {
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
      titulo: 'De qué autoridad',
      hint: 'A quién se le publica el endpoint.',
      campos: [
        { key: 'authorityId', label: 'Autoridad', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Qué publica',
      hint: 'El endpoint técnico del módulo de integraciones y qué sabe responder.',
      campos: [
        { key: 'integrationEndpointId', label: 'Endpoint de integración', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'capabilityConceptId', label: 'Capacidad (concepto)', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'assuranceLevelConceptId', label: 'Nivel de aseguramiento (concepto)', hint: 'Opcional: qué nivel alcanza lo que responde este endpoint.', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Versiones del contrato',
      hint: 'Opcionales: con qué versión pide y con cuál responde.',
      campos: [
        { key: 'requestContractVersion', label: 'Versión del contrato de petición', control: 'text', mensajeDeError: 'Hasta 50 caracteres.' },
        { key: 'responseContractVersion', label: 'Versión del contrato de respuesta', control: 'text', mensajeDeError: 'Hasta 50 caracteres.' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    authorityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    integrationEndpointId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    capabilityConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    assuranceLevelConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    requestContractVersion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    responseContractVersion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly published = signal<PublishedAuthorityEndpoint | null>(null);

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

    const { authorityId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.addAuthorityEndpoint(authorityId.trim(), this.datos()).subscribe({
      next: (endpoint) => {
        this.state.set(ready(null));
        this.published.set(endpoint);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroEndpoint(): void {
    this.form.reset();
    this.published.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewAuthorityEndpoint {
    const valores = this.form.getRawValue();
    const nivel = valores.assuranceLevelConceptId.trim();
    const peticion = valores.requestContractVersion.trim();
    const respuesta = valores.responseContractVersion.trim();

    return {
      integrationEndpointId: valores.integrationEndpointId.trim(),
      capabilityConceptId: valores.capabilityConceptId.trim(),
      ...(nivel === '' ? {} : { assuranceLevelConceptId: nivel }),
      ...(peticion === '' ? {} : { requestContractVersion: peticion }),
      ...(respuesta === '' ? {} : { responseContractVersion: respuesta }),
    };
  }
}
