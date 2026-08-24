import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { SessionStore } from '../../../core/auth/session.store';
import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import type {
  PermissionSetDelegateType,
  PermissionSetVersion,
} from '../../../core/data-access/delegated-access/delegated-access.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, opcionDe } from '../../../shared/forms/form-support';
import { SetItemsEditor } from '../set-items-editor/set-items-editor';

const DELEGATE_TYPES: readonly PermissionSetDelegateType[] = [
  'SECRETARY',
  'ASSISTANT',
  'NURSE',
  'BILLING',
];

/** Techos del contrato (`CreatePermissionSetDto`). */
const MAX_CODE = 100;
const MAX_NAME = 200;
const MAX_DESCRIPTION = 1000;

/**
 * Publicar un set de permisos delegados con su versión 1 (V29-08,
 * `POST /delegated-permission-sets`).
 *
 * El tenant propietario se elige entre las organizaciones del token — igual
 * que en la verificación de organización del M27: no hay listado de tenants
 * que consultar, y un `SECURITY_ADMIN` administra los suyos.
 */
@Component({
  selector: 'app-permission-set-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    CampoPersonalizado,
    PageHeader,
    PaginatedForm,
    SetItemsEditor,
  ],
  templateUrl: './permission-set-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionSetForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);
  private readonly session = inject(SessionStore);

/**
   * El editor vive dentro de la página que lo proyecta, así que **no existe**
   * mientras se contesta la primera. Sólo lo lee el envío, que ocurre en la
   * última.
   */
  private readonly editor = viewChild(SetItemsEditor);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly maxDescription = MAX_DESCRIPTION;

  protected readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CODE)],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NAME)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_DESCRIPTION)],
    }),
    tenantId: new FormControl<string | null>(null, { validators: [Validators.required] }),
    delegateType: new FormControl<PermissionSetDelegateType | null>(null),
  });

  /**
   * Las páginas, con el editor de ítems como campo `custom`.
   *
   * Los ítems son una **lista que crece**, no una pregunta: el motor le reserva
   * su sitio y el editor sigue siendo quien la maneja. Las opciones de
   * organización salen del token, así que las páginas son un `computed`.
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'Identidad del set',
        hint: 'A qué organización pertenece y cómo se lo nombra.',
        campos: [
          {
            key: 'tenantId',
            label: 'Organización propietaria',
            control: 'select' as const,
            required: true,
            options: this.organizaciones(),
            placeholder: 'Elegí la organización',
            mensajeDeError: this.sinOrganizaciones()
              ? 'Tu sesión no tiene organizaciones a cargo, así que no hay dónde publicar un set.'
              : 'Elegí la organización propietaria.',
          },
          {
            key: 'code',
            label: 'Código del set',
            hint: 'Único dentro de la organización; si ya existe, el backend responde 409.',
            control: 'text' as const,
            required: true,
            mensajeDeError: 'Escribí un código de hasta 100 caracteres.',
          },
          {
            key: 'name',
            label: 'Nombre legible',
            control: 'text' as const,
            required: true,
            mensajeDeError: 'Escribí un nombre de hasta 200 caracteres.',
          },
          {
            key: 'delegateType',
            label: 'Tipo de delegado',
            hint: 'Opcional: a qué rol está pensado el set.',
            control: 'radio' as const,
            options: [
              { value: 'SECRETARY', label: 'Secretaría' },
              { value: 'ASSISTANT', label: 'Asistente' },
              { value: 'NURSE', label: 'Enfermería' },
              { value: 'BILLING', label: 'Facturación' },
            ],
          },
          { key: 'description', label: 'Descripción', control: 'textarea' as const },
        ],
      },
      {
        titulo: 'Ítems de la versión 1',
        hint: 'Al menos un permiso; cada ítem puede llevar su restricción y exigir step-up.',
        campos: [
          { key: 'items', label: 'Permisos del set', control: 'custom' as const, required: true },
        ],
      },
    ]),
  );

  /** Las organizaciones del token: un set pertenece a una que administrás. */
  protected readonly organizaciones = computed<readonly SelectOption<string>[]>(() =>
    this.session.tenants().map((id) => ({ value: id, label: this.session.tenantName(id) })),
  );

  /**
   * Con una sola organización no hay nada que elegir: queda elegida.
   *
   * Escribe en el control del grupo porque el motor lee de ahí; el efecto es el
   * mismo que tenía la señal enlazada, sin un segundo sitio donde vive el dato.
   */
  private readonly unaSolaOrganizacion = effect(() => {
    const organizaciones = this.organizaciones();
    if (organizaciones.length === 1) {
      this.form.controls.tenantId.setValue(organizaciones[0]?.value ?? null);
    }
  });

  protected readonly sinOrganizaciones = computed(() => this.organizaciones().length === 0);


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly published = signal<PermissionSetVersion | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para publicar sets de permisos.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const items = this.editor()?.intentarEnvio() ?? null;

    if (this.form.invalid || items === null) {
      this.form.markAllAsTouched();
      return;
    }

    const { code, name, description, tenantId, delegateType } = this.form.getRawValue();
    if (tenantId === null) {
      return;
    }
    const tipo = opcionDe(DELEGATE_TYPES, delegateType);
    const descripcion = description.trim();

    this.state.set(loading());

    this.client
      .createPermissionSet({
        tenantId,
        code: code.trim(),
        name: name.trim(),
        ...(tipo === null ? {} : { delegateType: tipo }),
        ...(descripcion === '' ? {} : { description: descripcion }),
        items,
      })
      .subscribe({
        next: (version) => {
          this.state.set(ready(null));
          this.published.set(version);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otroSet(): void {
    // El editor de ítems no se toca: el panel de éxito lo desmontó, y al
    // volver al formulario renace fresco, con su única fila vacía.
    this.form.reset();
    this.published.set(null);
    this.state.set(ready(null));
  }
}
