import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { SourceCreated } from '../../../core/data-access/health-context/health-context.types';
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
import { errorMessageOf, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Alta de una fuente (V44-09, `POST /health-context/sources`).
 *
 * La fuente es de dónde sale el dato, y sus dos campos de gobierno no son
 * decoración: **la confianza gobierna qué se acepta** y **la licencia queda
 * registrada con ella** — sin esas dos cosas no se puede defender de dónde
 * salió un dato ni con qué derecho se usa.
 */
@Component({
  selector: 'app-source-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './source-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SourceForm {
  private readonly client = inject(HealthContextClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly uuidHint = UUID_HINT;
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
      titulo: 'Identidad de la fuente',
      hint: 'El código es único; el nombre es el que se lee en los reportes.',
      campos: [
        { key: 'code', label: 'Código', hint: 'Único y estable, como boletin-epidemiologico-msal. Máx. 100 caracteres.', control: 'text', required: true, mensajeDeError: 'Escribí el código de la fuente (máx. 100 caracteres).' },
        { key: 'name', label: 'Nombre', control: 'text', required: true, mensajeDeError: 'Escribí el nombre de la fuente (máx. 200 caracteres).' },
        { key: 'sourceTypeConceptId', label: 'Tipo de fuente', hint: 'Identificador del concepto de tipo (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'Gobierno del dato',
      hint: 'La confianza gobierna qué se acepta, y la licencia dice con qué derecho se usa.',
      campos: [
        { key: 'trustTierConceptId', label: 'Nivel de confianza', hint: 'Identificador del concepto de nivel (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'licenseText', label: 'Texto de la licencia', hint: 'Opcional, pero sin él no se puede defender el uso del dato.', control: 'textarea' },
      ],
    },
    {
      titulo: 'Procedencia',
      hint: 'Opcional: quién publica la fuente, dónde vive y de qué país es.',
      campos: [
        { key: 'ownerName', label: 'Organismo dueño', hint: 'Máx. 200 caracteres.', control: 'text' },
        { key: 'canonicalUrl', label: 'URL canónica', control: 'text' },
        { key: 'countryConceptId', label: 'País', hint: 'Identificador del concepto de país (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
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
    sourceTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    trustTierConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    ownerName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    canonicalUrl: new FormControl('', { nonNullable: true }),
    countryConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    licenseText: new FormControl('', { nonNullable: true }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<SourceCreated | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar fuentes.'),
  );

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const dueno = valores.ownerName.trim();
    const url = valores.canonicalUrl.trim();
    const pais = valores.countryConceptId.trim();
    const licencia = valores.licenseText.trim();

    this.state.set(loading());

    this.client
      .createSource({
        code: valores.code.trim(),
        name: valores.name.trim(),
        sourceTypeConceptId: valores.sourceTypeConceptId.trim(),
        trustTierConceptId: valores.trustTierConceptId.trim(),
        ...(dueno === '' ? {} : { ownerName: dueno }),
        ...(url === '' ? {} : { canonicalUrl: url }),
        ...(pais === '' ? {} : { countryConceptId: pais }),
        ...(licencia === '' ? {} : { licenseText: licencia }),
      })
      .subscribe({
        next: (fuente) => {
          this.state.set(ready(null));
          this.created.set(fuente);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraAlta(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }
}
