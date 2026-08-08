import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
    Select,
    SetItemsEditor,
    Textarea,
  ],
  templateUrl: './permission-set-form.html',
  styleUrl: '../m29.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionSetForm {
  private readonly client = inject(DelegatedAccessClient);
  private readonly navigation = inject(NavigationService);
  private readonly session = inject(SessionStore);

  private readonly editor = viewChild.required(SetItemsEditor);

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
  });

  /** Las organizaciones del token: un set pertenece a una que administrás. */
  protected readonly organizaciones = computed<readonly SelectOption<string>[]>(() =>
    this.session.tenants().map((id) => ({ value: id, label: this.session.tenantName(id) })),
  );

  /** Con una sola organización no hay nada que elegir: queda elegida. */
  protected readonly tenantId = linkedSignal<string | null>(() => {
    const organizaciones = this.organizaciones();
    return organizaciones.length === 1 ? (organizaciones[0]?.value ?? null) : null;
  });

  protected readonly sinOrganizaciones = computed(() => this.organizaciones().length === 0);

  protected readonly delegateType = signal<PermissionSetDelegateType | null>(null);

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly published = signal<PermissionSetVersion | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para publicar sets de permisos.'),
  );

  protected elegirTipo(valor: unknown): void {
    this.delegateType.set(opcionDe(DELEGATE_TYPES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const tenantId = this.tenantId();
    const items = this.editor().intentarEnvio();

    if (this.form.invalid || tenantId === null || items === null) {
      this.form.markAllAsTouched();
      return;
    }

    const { code, name, description } = this.form.getRawValue();
    const tipo = this.delegateType();
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
    this.delegateType.set(null);
    this.published.set(null);
    this.state.set(ready(null));
  }
}
