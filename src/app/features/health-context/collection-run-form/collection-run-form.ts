import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type {
  CollectionRunStarted,
  CollectionTrigger,
} from '../../../core/data-access/health-context/health-context.types';
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
import { errorMessageOf, opcionDe, UUID_ERROR, UUID_HINT, UUID_PATTERN } from '../../../shared/forms/form-support';

const DISPARADORES: readonly CollectionTrigger[] = ['SCHEDULED', 'MANUAL'];

/**
 * Iniciar una corrida de recolección (V44-01·F,
 * `POST /health-context/collection-runs`).
 *
 * La corrida es **idempotente por clave**: el scheduler reintenta, y dos
 * corridas de la misma marca duplicarían las observaciones. Si la clave ya
 * existía, la respuesta trae `duplicate: true` y la pantalla lo dice — no es
 * un error, es la idempotencia funcionando.
 *
 * **Una corrida manual debe decir agente y país**, o venir de una programación
 * de la que salgan; deducirlos sería inventarlos. Esa regla del modelo se
 * valida acá antes de gastar la petición.
 */
@Component({
  selector: 'app-collection-run-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './collection-run-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionRunForm {
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
      titulo: 'Identidad de la corrida',
      hint: 'La clave hace la corrida idempotente: reintentar con la misma clave no duplica nada.',
      campos: [
        { key: 'idempotencyKey', label: 'Clave de idempotencia', hint: 'Única por marca de recolección, como msal-2026-08-11. Máx. 200 caracteres.', control: 'text', required: true, mensajeDeError: 'Escribí la clave de idempotencia (máx. 200 caracteres).' },
        { key: 'trigger', label: 'Qué la dispara', control: 'radio', options: [{ value: 'MANUAL', label: 'Manual: alguien la pide ahora' }, { value: 'SCHEDULED', label: 'Programada: la trae una agenda' }], required: true },
      ],
    },
    {
      titulo: 'De dónde sale',
      hint: 'O viene de una agenda, o se declara el agente y el país: deducirlos sería inventarlos.',
      campos: [
        { key: 'scheduleId', label: 'Agenda', hint: 'Si la corrida sale de una programación, su identificador (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'agentId', label: 'Agente', hint: UUID_HINT, control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'countryConceptId', label: 'País', hint: 'Identificador del concepto de país (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    idempotencyKey: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    scheduleId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    agentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    countryConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    trigger: new FormControl<CollectionTrigger | null>(null, {
      validators: [Validators.required],
    }),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly started = signal<CollectionRunStarted | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para iniciar corridas.'),
  );

  /**
   * La regla del modelo, como pregunta que la plantilla puede hacer.
   *
   * Es un **método y no un `computed`** a propósito: lee el `FormGroup`, que no
   * es reactivo para las señales, así que un `computed` memoizaría la primera
   * respuesta y no la soltaría nunca — el aviso quedaría clavado y el envío,
   * bloqueado. Como método, la detección de cambios lo reevalúa en cada pasada.
   */
  protected faltaOrigen(): boolean {
    const valores = this.form.getRawValue();
    const tieneAgenda = valores.scheduleId.trim() !== '';
    const tieneManual = valores.agentId.trim() !== '' && valores.countryConceptId.trim() !== '';
    return !tieneAgenda && !tieneManual;
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid || this.faltaOrigen()) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
    const disparador = opcionDe(DISPARADORES, valores.trigger);
    if (disparador === null) {
      return;
    }
    const agenda = valores.scheduleId.trim();
    const agente = valores.agentId.trim();
    const pais = valores.countryConceptId.trim();

    this.state.set(loading());

    this.client
      .startCollectionRun({
        idempotencyKey: valores.idempotencyKey.trim(),
        trigger: disparador,
        ...(agenda === '' ? {} : { scheduleId: agenda }),
        ...(agente === '' ? {} : { agentId: agente }),
        ...(pais === '' ? {} : { countryConceptId: pais }),
      })
      .subscribe({
        next: (corrida) => {
          this.state.set(ready(null));
          this.started.set(corrida);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraCorrida(): void {
    this.form.reset();
    this.started.set(null);
    this.state.set(ready(null));
  }
}
