import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { AuthProvidersClient } from '../../../core/data-access/auth-providers/auth-providers.client';
import type {
  CreatedProvider,
  IdpCategory,
  IdpProtocol,
  NewIdentityProvider,
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
  opcionDe,
  UUID_ERROR,
  UUID_PATTERN,
} from '../../../shared/forms/form-support';

const PROTOCOLS: readonly IdpProtocol[] = ['OIDC', 'SAML', 'OAUTH2'];
const CATEGORIES: readonly IdpCategory[] = ['ENTERPRISE', 'SOCIAL', 'GOVERNMENT'];

/**
 * Registrar un proveedor de identidad (V40-03,
 * `POST /auth-providers/identity-providers`).
 *
 * El proveedor nace en borrador: hasta configurar su protocolo no puede
 * autenticar a nadie. La regla «un proveedor no global necesita organización
 * dueña» vive en el servicio del backend, no en el DTO, así que acá es ayuda
 * del campo y no un bloqueo: el backend tiene la última palabra.
 */
@Component({
  selector: 'app-provider-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './provider-form.html',
  styleUrl: '../m40.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProviderForm {
  private readonly client = inject(AuthProvidersClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
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
      titulo: 'Qué proveedor',
      hint: 'Cómo se identifica y se muestra.',
      campos: [
        { key: 'code', label: 'Código del proveedor', hint: 'Único; el login federado lo usa para elegir el proveedor.', control: 'text', required: true, mensajeDeError: 'Ingresá el código (hasta 100 caracteres).' },
        { key: 'name', label: 'Nombre', control: 'text', required: true, mensajeDeError: 'Ingresá el nombre (hasta 200 caracteres).' },
        { key: 'issuer', label: 'Emisor declarado por el proveedor', hint: 'Opcional: el issuer con el que firma sus tokens.', control: 'textarea' },
      ],
    },
    {
      titulo: 'Protocolo y naturaleza',
      hint: 'Definen qué configuración va a exigir el entorno.',
      campos: [
        { key: 'protocol', label: 'Protocolo', control: 'radio', options: [{ value: 'OIDC', label: 'OpenID Connect' }, { value: 'SAML', label: 'SAML' }, { value: 'OAUTH2', label: 'OAuth 2.0' }], required: true },
        { key: 'category', label: 'Categoría', control: 'radio', options: [{ value: 'ENTERPRISE', label: 'Corporativo' }, { value: 'SOCIAL', label: 'Social' }, { value: 'GOVERNMENT', label: 'Gubernamental' }], required: true },
      ],
    },
    {
      titulo: 'Disponibilidad',
      hint: 'Global lo ven todas las organizaciones; si no, necesita una dueña.',
      campos: [
        { key: 'tenantId', label: 'Organización dueña', hint: 'Si el proveedor no es global, necesita una dueña: pegá su identificador (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'isGlobal', label: 'Disponible para todas las organizaciones sin vínculo explícito', control: 'switch' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    issuer: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
    tenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    isGlobal: new FormControl(false, { nonNullable: true }),
    /** Obligatorios por contrato; arrancan sin elegir para no decidir por nadie. */
    protocol: new FormControl<IdpProtocol | null>(null, {
      validators: [Validators.required],
    }),
    category: new FormControl<IdpCategory | null>(null, {
      validators: [Validators.required],
    }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedProvider | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar proveedores de identidad.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const datos = this.datos();
    if (this.form.invalid || datos === null) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.client.createProvider(datos).subscribe({
      next: (provider) => {
        this.state.set(ready(null));
        this.created.set(provider);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  protected otroProveedor(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewIdentityProvider | null {
    const protocolo = opcionDe(PROTOCOLS, this.form.getRawValue().protocol);
    const categoria = opcionDe(CATEGORIES, this.form.getRawValue().category);
    if (protocolo === null || categoria === null) {
      return null;
    }

    const valores = this.form.getRawValue();
    const tenant = valores.tenantId.trim();
    const emisor = valores.issuer.trim();

    return {
      ...(tenant === '' ? {} : { tenantId: tenant }),
      code: valores.code.trim(),
      name: valores.name.trim(),
      protocol: protocolo,
      category: categoria,
      ...(emisor === '' ? {} : { issuer: emisor }),
      // El interruptor viaja siempre, apagado o prendido: es una decisión
      // explícita («valor por defecto explícito», dice la ficha).
      isGlobal: valores.isGlobal,
    };
  }
}
