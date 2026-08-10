import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  FederatedLoginStart,
  FederatedLoginStartResult,
  IdpEnvironment,
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
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_PATTERN } from '../../../shared/forms/form-support';

const ENVIRONMENTS: readonly IdpEnvironment[] = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];

const MAX_IP = 100;
const MAX_AGENT = 500;

/**
 * Iniciar el login federado (V40-05·A,
 * `POST /auth-providers/identity-providers/by-code/:code/authorize`).
 *
 * Registra el intento y devuelve el material del flujo: la URL de autorización
 * del proveedor y el `state` que el callback (V40-10) tiene que devolver tal
 * cual — sin ese `state`, el desenlace no se puede ligar a este intento.
 */
@Component({
  selector: 'app-login-start-form',
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
    Textarea,
  ],
  templateUrl: './login-start-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginStartForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxIp = MAX_IP;
  protected readonly maxAgent = MAX_AGENT;

  protected readonly form = new FormGroup({
    providerCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    tenantId: new FormControl('', {
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

  /** Nace en el default del contrato; la radio siempre tiene una elección. */
  protected readonly environment = signal<IdpEnvironment>('PRODUCTION');

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly started = signal<FederatedLoginStartResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para operar el login federado.'),
  );

  protected elegirEntorno(valor: unknown): void {
    this.environment.set(opcionDe(ENVIRONMENTS, valor) ?? 'PRODUCTION');
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { providerCode } = this.form.getRawValue();

    this.state.set(loading());

    this.client.startFederatedLogin(providerCode.trim(), this.datos()).subscribe({
      next: (intento) => {
        this.state.set(ready(null));
        this.started.set(intento);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroIntento(): void {
    this.form.reset();
    this.environment.set('PRODUCTION');
    this.started.set(null);
    this.state.set(ready(null));
  }

  private datos(): FederatedLoginStart {
    const valores = this.form.getRawValue();
    const organizacion = valores.tenantId.trim();
    const ip = valores.ip.trim();
    const agente = valores.userAgent.trim();

    return {
      ...(organizacion === '' ? {} : { tenantId: organizacion }),
      // La radio viaja siempre: es una decisión explícita y visible, igual
      // que el resultado del intento en el M27.
      environment: this.environment(),
      ...(ip === '' ? {} : { ip }),
      ...(agente === '' ? {} : { userAgent: agente }),
    };
  }
}
