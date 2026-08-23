import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { AgentCreated } from '../../../core/data-access/health-context/health-context.types';
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
 * Alta de un agente recolector (V44-07, `POST /health-context/agents`).
 *
 * El agente es quién recolecta: un servicio propio, un scraper, una persona.
 * Su código es único —el duplicado es un 409— y su tipo sale del catálogo de
 * terminología.
 *
 * Los `*ConceptId` van como identificador pegado, no como selector: los
 * catálogos dinámicos de `health_context` no tienen bindings sembrados todavía
 * (mismo precedente que M27/M29/M40).
 */
@Component({
  selector: 'app-agent-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './agent-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentForm {
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
      titulo: 'Identidad del agente',
      hint: 'El código es único: un duplicado se rechaza con el detalle del conflicto.',
      campos: [
        { key: 'code', label: 'Código', hint: 'Único y estable, como boletin-msal-scraper. Máx. 100 caracteres.', control: 'text', required: true, mensajeDeError: 'Escribí el código del agente (máx. 100 caracteres).' },
        { key: 'name', label: 'Nombre', control: 'text', required: true, mensajeDeError: 'Escribí el nombre del agente (máx. 200 caracteres).' },
        { key: 'agentTypeConceptId', label: 'Tipo de agente', hint: 'Identificador del concepto de tipo (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
      ],
    },
    {
      titulo: 'De quién depende',
      hint: 'Opcional: el proveedor que lo opera, su referencia técnica y la organización dueña.',
      campos: [
        { key: 'providerId', label: 'Proveedor', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'implementationRef', label: 'Referencia de implementación', hint: 'Dónde vive el agente: un repositorio, una imagen, una URL. Máx. 500 caracteres.', control: 'text' },
        { key: 'ownerTenantId', label: 'Organización dueña', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
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
    agentTypeConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    providerId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    implementationRef: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(500)],
    }),
    ownerTenantId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
  });

  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<AgentCreated | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para registrar agentes.'),
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
    const proveedor = valores.providerId.trim();
    const implementacion = valores.implementationRef.trim();
    const propietario = valores.ownerTenantId.trim();

    this.state.set(loading());

    this.client
      .createAgent({
        code: valores.code.trim(),
        name: valores.name.trim(),
        agentTypeConceptId: valores.agentTypeConceptId.trim(),
        ...(proveedor === '' ? {} : { providerId: proveedor }),
        ...(implementacion === '' ? {} : { implementationRef: implementacion }),
        ...(propietario === '' ? {} : { ownerTenantId: propietario }),
      })
      .subscribe({
        next: (agente) => {
          this.state.set(ready(null));
          this.created.set(agente);
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
