import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../shared/components/molecules/radio-group/radio-group';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
  });

  protected readonly trigger = signal<CollectionTrigger | null>(null);

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

  protected elegirDisparador(valor: unknown): void {
    this.trigger.set(opcionDe(DISPARADORES, valor));
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    const disparador = this.trigger();
    if (this.form.invalid || disparador === null || this.faltaOrigen()) {
      this.form.markAllAsTouched();
      return;
    }

    const valores = this.form.getRawValue();
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
    this.trigger.set(null);
    this.started.set(null);
    this.state.set(ready(null));
  }
}
