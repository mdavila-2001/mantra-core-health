import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Contra qué proveedor',
      hint: 'El proveedor se busca por su código, no por su identificador.',
      campos: [
        { key: 'providerCode', label: 'Código del proveedor', hint: 'El código con el que se registró el proveedor, no su UUID.', control: 'text', required: true, mensajeDeError: 'Ingresá el código del proveedor.' },
        { key: 'tenantId', label: 'Organización a la que se quiere entrar', hint: 'Opcional: vacía, decide el vínculo del proveedor. Pegá el identificador (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'environment', label: 'Entorno', hint: 'Por defecto, Producción.', control: 'radio', options: [{ value: 'DEVELOPMENT', label: 'Desarrollo' }, { value: 'STAGING', label: 'Staging' }, { value: 'PRODUCTION', label: 'Producción' }] },
      ],
    },
    {
      titulo: 'Rastro del intento',
      hint: 'De dónde sale el login; queda en el registro del intento.',
      campos: [
        { key: 'ip', label: 'IP de origen', hint: 'Opcional: vacía, no viaja.', control: 'text', mensajeDeError: 'Hasta 100 caracteres.' },
        { key: 'userAgent', label: 'Agente de usuario', hint: 'Opcional: el navegador o cliente que inicia el login.', control: 'textarea', mensajeDeError: 'Hasta 500 caracteres.' },
      ],
    },
  ]);

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
    /** Nace en el default del contrato; la radio siempre tiene una elección. */
    environment: new FormControl<IdpEnvironment>('PRODUCTION', { nonNullable: true }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly started = signal<FederatedLoginStartResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para operar el login federado.'),
  );

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
      environment: opcionDe(ENVIRONMENTS, valores.environment) ?? 'PRODUCTION',
      ...(ip === '' ? {} : { ip }),
      ...(agente === '' ? {} : { userAgent: agente }),
    };
  }
}
