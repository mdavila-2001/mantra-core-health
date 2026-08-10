import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
    Switch,
    Textarea,
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
  });

  /** Obligatorios por contrato; arrancan sin elegir para no decidir por nadie. */
  protected readonly protocol = signal<IdpProtocol | null>(null);
  protected readonly category = signal<IdpCategory | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<CreatedProvider | null>(null);

  /** Falta alguna de las dos elecciones obligatorias que no viven en el grupo. */
  protected readonly faltanObligatorios = computed(
    () => this.protocol() === null || this.category() === null,
  );

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar proveedores de identidad.'),
  );

  protected elegirProtocolo(valor: unknown): void {
    this.protocol.set(opcionDe(PROTOCOLS, valor));
  }

  protected elegirCategoria(valor: unknown): void {
    this.category.set(opcionDe(CATEGORIES, valor));
  }

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
    this.protocol.set(null);
    this.category.set(null);
    this.created.set(null);
    this.state.set(ready(null));
  }

  private datos(): NewIdentityProvider | null {
    const protocolo = this.protocol();
    const categoria = this.category();
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
