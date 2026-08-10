import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  DiscoveredKey,
  IdpEnvironment,
  NewProtocolConfig,
  ProtocolConfigResult,
  TokenEndpointAuth,
} from '../../../core/data-access/auth-providers/auth-providers.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import {
  errorMessageOf,
  objetoJson,
  opcionDe,
  UUID_ERROR,
  UUID_HINT,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';
import { DiscoveredKeysEditor } from '../discovered-keys-editor/discovered-keys-editor';

const ENVIRONMENTS: readonly IdpEnvironment[] = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'];
const TOKEN_ENDPOINT_AUTHS: readonly TokenEndpointAuth[] = [
  'CLIENT_SECRET_POST',
  'CLIENT_SECRET_BASIC',
  'PRIVATE_KEY_JWT',
];

/** Techo generoso para la configuración adicional; el DDL no fija uno. */
const MAX_EXTRA_CONFIG = 2000;

/** Los cinco endpoints OIDC/OAuth2 del contrato, en el orden del DTO. */
const ENDPOINTS = [
  { control: 'authorizeUrl', label: 'Endpoint de autorización' },
  { control: 'tokenUrl', label: 'Endpoint de token' },
  { control: 'userinfoUrl', label: 'Endpoint de información de usuario' },
  { control: 'jwksUri', label: 'JWKS del proveedor' },
  { control: 'metadataUrl', label: 'Documento de descubrimiento' },
] as const;

/**
 * Configurar el protocolo de un entorno del proveedor (V40-06,
 * `POST /auth-providers/identity-providers/:id/protocol-configs`).
 *
 * Solo hay una configuración activa por entorno: reconfigurar reemplaza a la
 * anterior. Qué campos hacen falta depende del protocolo del proveedor —SAML
 * pide entity ID y ACS; OIDC y OAuth2, cliente y endpoints—, pero esa regla
 * vive en el servicio del backend, no en el DTO: acá todo es opcional salvo el
 * entorno, y el backend rechaza lo que falte.
 */
@Component({
  selector: 'app-protocol-config-form',
  imports: [
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DiscoveredKeysEditor,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
    Radio,
    RadioGroup,
    Switch,
    Textarea,
  ],
  templateUrl: './protocol-config-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProtocolConfigForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
  protected readonly uuidError = UUID_ERROR;
  protected readonly maxExtraConfig = MAX_EXTRA_CONFIG;
  protected readonly endpoints = ENDPOINTS;

  protected readonly editor = viewChild.required(DiscoveredKeysEditor);

  protected readonly form = new FormGroup({
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    clientId: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    clientSecretRef: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
    authorizeUrl: new FormControl('', { nonNullable: true }),
    tokenUrl: new FormControl('', { nonNullable: true }),
    userinfoUrl: new FormControl('', { nonNullable: true }),
    jwksUri: new FormControl('', { nonNullable: true }),
    metadataUrl: new FormControl('', { nonNullable: true }),
    samlEntityId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    samlAcsUrl: new FormControl('', { nonNullable: true }),
    scopes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    responseType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    extraConfigJson: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_EXTRA_CONFIG), objetoJson],
    }),
    // Prendido de entrada: es el default del backend, y apagarlo abre el flujo
    // a interceptación del código. Viaja siempre, como decisión explícita.
    pkceRequired: new FormControl(true, { nonNullable: true }),
  });

  /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
  protected readonly environment = signal<IdpEnvironment | null>(null);

  protected readonly tokenEndpointAuth = signal<TokenEndpointAuth | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly configured = signal<ProtocolConfigResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
  );

  protected elegirEntorno(valor: unknown): void {
    this.environment.set(opcionDe(ENVIRONMENTS, valor));
  }

  protected elegirAutenticacion(valor: unknown): void {
    this.tokenEndpointAuth.set(opcionDe(TOKEN_ENDPOINT_AUTHS, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // Las claves se leen primero para que un solo intento marque los errores
    // de los dos bloques a la vez, no de a uno. El cuerpo recién se arma con
    // el formulario válido: antes, el JSON adicional podría ni parsear.
    const claves = this.editor().intentarEnvio();
    if (this.form.invalid || claves === null || this.environment() === null) {
      this.form.markAllAsTouched();
      return;
    }

    const datos = this.datos(claves);
    if (datos === null) {
      return;
    }

    const { providerId } = this.form.getRawValue();

    this.state.set(loading());

    this.client.configureProtocol(providerId.trim(), datos).subscribe({
      next: (config) => {
        this.state.set(ready(null));
        this.configured.set(config);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otraConfiguracion(): void {
    // El panel de éxito desmontó el editor de claves: renace fresco al volver
    // al formulario, así que acá solo se limpia lo propio.
    this.form.reset();
    this.environment.set(null);
    this.tokenEndpointAuth.set(null);
    this.configured.set(null);
    this.state.set(ready(null));
  }

  private datos(claves: readonly DiscoveredKey[]): NewProtocolConfig | null {
    const entorno = this.environment();
    if (entorno === null) {
      return null;
    }

    const valores = this.form.getRawValue();
    const autenticacion = this.tokenEndpointAuth();
    const cliente = valores.clientId.trim();
    const secreto = valores.clientSecretRef.trim();
    const autorizacion = valores.authorizeUrl.trim();
    const token = valores.tokenUrl.trim();
    const userinfo = valores.userinfoUrl.trim();
    const jwks = valores.jwksUri.trim();
    const metadata = valores.metadataUrl.trim();
    const entidadSaml = valores.samlEntityId.trim();
    const acsSaml = valores.samlAcsUrl.trim();
    const ambitos = valores.scopes.trim();
    const tipoRespuesta = valores.responseType.trim();
    const extra = valores.extraConfigJson.trim();

    return {
      environment: entorno,
      ...(cliente === '' ? {} : { clientId: cliente }),
      ...(secreto === '' ? {} : { clientSecretRef: secreto }),
      ...(autorizacion === '' ? {} : { authorizeUrl: autorizacion }),
      ...(token === '' ? {} : { tokenUrl: token }),
      ...(userinfo === '' ? {} : { userinfoUrl: userinfo }),
      ...(jwks === '' ? {} : { jwksUri: jwks }),
      ...(metadata === '' ? {} : { metadataUrl: metadata }),
      ...(entidadSaml === '' ? {} : { samlEntityId: entidadSaml }),
      ...(acsSaml === '' ? {} : { samlAcsUrl: acsSaml }),
      ...(ambitos === '' ? {} : { scopes: ambitos }),
      ...(tipoRespuesta === '' ? {} : { responseType: tipoRespuesta }),
      ...(autenticacion === null ? {} : { tokenEndpointAuth: autenticacion }),
      pkceRequired: valores.pkceRequired,
      ...(extra === ''
        ? {}
        : { extraConfigJson: JSON.parse(extra) as Record<string, unknown> }),
      ...(claves.length === 0 ? {} : { discoveredKeys: claves }),
    };
  }
}
