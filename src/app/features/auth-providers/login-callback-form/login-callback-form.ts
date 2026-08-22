import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
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

/**
   * El formulario, servido de a una página.
   *
   * El tope de cuatro y la barra de avance los pone el motor; acá sólo se
   * declara qué campo va en qué sección. Las secciones que no entran en una
   * página se parten conservando su nombre.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué devolvió el proveedor',
      hint: 'El «state» liga esta respuesta con el intento iniciado antes.',
      campos: [
        { key: 'providerCode', label: 'Código del proveedor', hint: 'El código con el que se registró el proveedor, no su UUID.', control: 'text', required: true, mensajeDeError: 'Ingresá el código del proveedor.' },
        { key: 'state', label: 'State devuelto por el proveedor', hint: 'Tal cual lo entregó «Iniciar login federado».', control: 'text', required: true, mensajeDeError: 'Ingresá el state, hasta 200 caracteres.' },
        { key: 'externalSubject', label: 'Sujeto externo', hint: 'El identificador del sujeto en el proveedor.', control: 'text', required: true, mensajeDeError: 'Ingresá el sujeto externo, hasta 300 caracteres.' },
        { key: 'claims', label: 'Claims recibidos (JSON)', hint: 'Un objeto JSON con los claims ya verificados por quien llama.', control: 'textarea', required: true, mensajeDeError: 'Tiene que ser un objeto JSON válido, como {&quot;sub&quot;: &quot;valor&quot;}.' },
      ],
    },
    {
      titulo: 'A dónde entra',
      hint: 'El módulo no crea usuarios: sin usuario local, el login sin identidad previa devuelve un token de vinculación.',
      campos: [
        { key: 'tenantId', label: 'Organización en la que se entra', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'userId', label: 'Usuario local ya resuelto por IAM', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Rastro del intento',
      hint: 'De dónde vino la respuesta; queda en el registro.',
      campos: [
        { key: 'ip', label: 'IP de origen', hint: 'Opcional: vacía, no viaja.', control: 'text', mensajeDeError: 'Hasta 100 caracteres.' },
        { key: 'userAgent', label: 'Agente de usuario', hint: 'Opcional: el navegador o cliente que devolvió el callback.', control: 'textarea', mensajeDeError: 'Hasta 500 caracteres.' },
      ],
    },
  ]);

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
