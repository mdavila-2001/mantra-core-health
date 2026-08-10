import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  FederatedCallback,
  FederatedCallbackResult,
} from '../../../core/data-access/auth-providers/auth-providers.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  objetoJson,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const MAX_STATE = 200;
const MAX_SUBJECT = 300;
const MAX_IP = 100;
const MAX_AGENT = 500;

/** Techo generoso para los claims declarativos; el DDL no fija uno. */
const MAX_CLAIMS = 2000;

/**
 * Procesar el callback del proveedor (V40-10,
 * `POST /auth-providers/identity-providers/by-code/:code/callback`).
 *
 * La vuelta del login federado: el `state` liga la respuesta con el intento
 * iniciado en V40-05·A. Todo desenlace queda registrado, incluso el rechazo —
 * y un login sin identidad previa no crea nada: devuelve un token de
 * vinculación para confirmar la cuenta en V40-01.
 */
@Component({
  selector: 'app-login-callback-form',
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
    Textarea,
  ],
  templateUrl: './login-callback-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginCallbackForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxState = MAX_STATE;
  protected readonly maxSubject = MAX_SUBJECT;
  protected readonly maxClaims = MAX_CLAIMS;
  protected readonly maxAgent = MAX_AGENT;

  protected readonly form = new FormGroup({
    providerCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    state: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_STATE)],
    }),
    externalSubject: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SUBJECT)],
    }),
    claims: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CLAIMS), objetoJson],
    }),
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    userId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    ip: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_IP)],
    }),
    userAgent: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_AGENT)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly processed = signal<FederatedCallbackResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para operar el login federado.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El cuerpo recién se arma con el formulario válido: antes, los claims
    // podrían ni parsear.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { providerCode } = this.form.getRawValue();

    this.state.set(loading());

    this.client.processCallback(providerCode.trim(), this.datos()).subscribe({
      next: (desenlace) => {
        this.state.set(ready(null));
        this.processed.set(desenlace);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroCallback(): void {
    this.form.reset();
    this.processed.set(null);
    this.state.set(ready(null));
  }

  private datos(): FederatedCallback {
    const valores = this.form.getRawValue();
    const organizacion = valores.tenantId.trim();
    const usuario = valores.userId.trim();
    const ip = valores.ip.trim();
    const agente = valores.userAgent.trim();

    return {
      state: valores.state.trim(),
      externalSubject: valores.externalSubject.trim(),
      claims: JSON.parse(valores.claims.trim()) as Record<string, unknown>,
      ...(organizacion === '' ? {} : { tenantId: organizacion }),
      ...(usuario === '' ? {} : { userId: usuario }),
      ...(ip === '' ? {} : { ip }),
      ...(agente === '' ? {} : { userAgent: agente }),
    };
  }
}
