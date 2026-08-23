import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

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
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
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
    Alert,
    AnnounceOnAppear,
    AppButton,
    DiscoveredKeysEditor,
    CampoPersonalizado,
    PageHeader,
    PaginatedForm,
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

  /**
   * El editor vive dentro de la última página, así que **no existe** mientras se
   * contestan las anteriores. Sólo lo lee el envío, que ocurre ahí.
   */
  protected readonly editor = viewChild(DiscoveredKeysEditor);

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
    /** Obligatorio por contrato; arranca sin elegir para no decidir por nadie. */
    environment: new FormControl<IdpEnvironment | null>(null, {
      validators: [Validators.required],
    }),
    tokenEndpointAuth: new FormControl<TokenEndpointAuth | null>(null),
  });

  /**
   * Las páginas, con el editor de claves descubiertas como campo `custom`.
   *
   * Los cinco endpoints se declaran desde {@link ENDPOINTS} —la lista que ya
   * existía para dibujarlos— en vez de escribirlos uno por uno: son la misma
   * pregunta cinco veces, y el motor los parte en dos páginas.
   */
  protected readonly paginas = paginarCampos([
    {
      titulo: 'Qué se configura',
      hint: 'El proveedor y el entorno al que aplica.',
      campos: [
        {
          key: 'providerId',
          label: 'Identificador del proveedor',
          hint: UUID_HINT,
          control: 'text' as const,
          required: true,
          mensajeDeError: UUID_ERROR,
        },
        {
          key: 'environment',
          label: 'Entorno',
          control: 'radio' as const,
          required: true,
          options: [
            { value: 'DEVELOPMENT', label: 'Desarrollo' },
            { value: 'STAGING', label: 'Staging' },
            { value: 'PRODUCTION', label: 'Producción' },
          ],
        },
      ],
    },
    {
      titulo: 'Cliente ante el proveedor',
      hint: 'El secreto no viaja acá: se referencia por su entrada en el vault.',
      campos: [
        {
          key: 'clientId',
          label: 'Identificador de cliente',
          control: 'text' as const,
          mensajeDeError: 'Hasta 300 caracteres.',
        },
        {
          key: 'clientSecretRef',
          label: 'Referencia del secreto',
          hint: 'La entrada del vault donde vive el secreto, no el secreto.',
          control: 'text' as const,
          mensajeDeError: 'Hasta 300 caracteres.',
        },
      ],
    },
    {
      titulo: 'Endpoints OIDC / OAuth2',
      hint: 'Los que publica el proveedor para este entorno.',
      campos: ENDPOINTS.map((endpoint) => ({
        key: endpoint.control,
        label: endpoint.label,
        hint: 'https://…',
        control: 'text' as const,
      })),
    },
    {
      titulo: 'SAML',
      hint: 'Solo para proveedores SAML.',
      campos: [
        {
          key: 'samlEntityId',
          label: 'Entity ID',
          control: 'textarea' as const,
          mensajeDeError: 'Hasta 500 caracteres.',
        },
        {
          key: 'samlAcsUrl',
          label: 'Assertion Consumer Service (ACS)',
          hint: 'https://…',
          control: 'text' as const,
        },
      ],
    },
    {
      titulo: 'Comportamiento del flujo',
      hint: 'Cómo se piden y se validan los tokens.',
      campos: [
        {
          key: 'scopes',
          label: 'Ámbitos solicitados',
          hint: 'Separados por espacio, como los espera el proveedor.',
          control: 'textarea' as const,
          mensajeDeError: 'Hasta 500 caracteres.',
        },
        {
          key: 'responseType',
          label: 'Response type',
          control: 'text' as const,
          mensajeDeError: 'Hasta 100 caracteres.',
        },
        {
          key: 'tokenEndpointAuth',
          label: 'Autenticación ante el endpoint de token',
          control: 'radio' as const,
          options: [
            { value: 'CLIENT_SECRET_POST', label: 'Secreto en el cuerpo (POST)' },
            { value: 'CLIENT_SECRET_BASIC', label: 'Secreto en Basic' },
            { value: 'PRIVATE_KEY_JWT', label: 'JWT con clave privada' },
          ],
        },
        {
          key: 'pkceRequired',
          label: 'Exigir PKCE (desactivarlo abre el flujo a interceptación del código)',
          control: 'switch' as const,
        },
      ],
    },
    {
      titulo: 'Configuración adicional',
      hint: 'Lo que el proveedor pida y el contrato no nombre.',
      campos: [
        {
          key: 'extraConfigJson',
          label: 'Configuración adicional (JSON)',
          hint: 'Opcional: un objeto JSON. Vacía, no viaja.',
          control: 'textarea' as const,
          mensajeDeError: 'Tiene que ser un objeto JSON válido, como {"campo": "valor"}.',
        },
      ],
    },
    {
      titulo: 'Claves del JWKS',
      hint: 'Opcional: las claves descubiertas se importan con la configuración.',
      campos: [
        { key: 'claves', label: 'Claves descubiertas', control: 'custom' as const },
      ],
    },
  ]);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly configured = signal<ProtocolConfigResult | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para configurar proveedores de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // Las claves se leen primero para que un solo intento marque los errores
    // de los dos bloques a la vez, no de a uno. El cuerpo recién se arma con
    // el formulario válido: antes, el JSON adicional podría ni parsear.
    // Sin claves descubiertas la configuración se guarda igual: son opcionales.
    // Si la página que las pide no se llegó a abrir, el editor no existe y la
    // lista es vacía — que es distinto de «el editor dijo que están mal».
    const claves = this.editor() === undefined ? [] : this.editor()?.intentarEnvio();
    if (this.form.invalid || claves === undefined || claves === null) {
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
    this.configured.set(null);
    this.state.set(ready(null));
  }

  private datos(claves: readonly DiscoveredKey[]): NewProtocolConfig | null {
    const valores = this.form.getRawValue();
    // El grupo ya lo exige; se comprueba contra el contrato porque el tipo del
    // control admite `null` y lo que sale de acá es el cuerpo real.
    const entorno = opcionDe(ENVIRONMENTS, valores.environment);
    if (entorno === null) {
      return null;
    }

    const autenticacion = opcionDe(TOKEN_ENDPOINT_AUTHS, valores.tokenEndpointAuth);
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
