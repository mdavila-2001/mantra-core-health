import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { ContextCreated } from '../../../core/data-access/health-context/health-context.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import { errorMessageOf, UUID_ERROR, UUID_PATTERN } from '../../../shared/forms/form-support';

/**
 * Alta de un contexto de país (V44-03·F, `POST /health-context/contexts`).
 *
 * El contexto es la **raíz**: nace en borrador, sin versión vigente, y la
 * resolución para consumo responde 422 hasta que una versión pase por revisión
 * y se publique. La combinación país + dominio + clave es única — el duplicado
 * es un 409.
 */
@Component({
  selector: 'app-context-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    Link,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './context-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextForm {
  private readonly client = inject(HealthContextClient);
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
      titulo: 'Dónde vive',
      hint: 'País, dominio y clave forman la identidad del contexto: la combinación repetida es un duplicado.',
      campos: [
        { key: 'countryConceptId', label: 'País', hint: 'Identificador del concepto de país (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'contextDomainConceptId', label: 'Dominio del contexto', hint: 'Identificador del concepto de dominio (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'contextKey', label: 'Clave del contexto', hint: 'La clave dentro del dominio, como cobertura.publica. Máx. 200 caracteres.', control: 'text', required: true, mensajeDeError: 'Escribí la clave del contexto (máx. 200 caracteres).' },
      ],
    },
    {
      titulo: 'Cómo se presenta',
      hint: 'El título es el que se lee en los reportes.',
      campos: [
        { key: 'title', label: 'Título', control: 'text', required: true, mensajeDeError: 'Escribí el título del contexto (máx. 300 caracteres).' },
        { key: 'description', label: 'Descripción', hint: 'Opcional.', control: 'textarea' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    countryConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    contextDomainConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    contextKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    title: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    description: new FormControl('', { nonNullable: true }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<ContextCreated | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para crear contextos.'),
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
    const descripcion = valores.description.trim();

    this.state.set(loading());

    this.client
      .createContext({
        countryConceptId: valores.countryConceptId.trim(),
        contextDomainConceptId: valores.contextDomainConceptId.trim(),
        contextKey: valores.contextKey.trim(),
        title: valores.title.trim(),
        ...(descripcion === '' ? {} : { description: descripcion }),
      })
      .subscribe({
        next: (contexto) => {
          this.state.set(ready(null));
          this.created.set(contexto);
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
