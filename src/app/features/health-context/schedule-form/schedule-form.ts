import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { ScheduleCreated } from '../../../core/data-access/health-context/health-context.types';
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

/** Entero no negativo o vacío. */
const ENTERO_NO_NEGATIVO = /^\d*$/;

/** El `@Min(60)` del DTO: una vigencia menor a un minuto no tiene sentido. */
const MIN_TTL_SEGUNDOS = 60;

/**
 * Programar una recolección (V44-08, `POST /health-context/schedules`).
 *
 * Cada agenda dice qué agente vuelve a mirar qué país y cada cuánto. La
 * expresión de programación viaja como texto —el scheduler la interpreta— y la
 * vigencia mínima del dato es de un minuto: menos que eso el backend lo
 * rechaza.
 */
@Component({
  selector: 'app-schedule-form',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    PageHeader,
    PaginatedForm,
  ],
  templateUrl: './schedule-form.html',
  styleUrl: '../m44.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleForm {
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
      titulo: 'Qué se recolecta',
      hint: 'Un agente, un país, una cadencia. El scheduler la ejecuta con corridas idempotentes.',
      campos: [
        { key: 'countryConceptId', label: 'País', hint: 'Identificador del concepto de país (UUID).', control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'agentId', label: 'Agente', hint: UUID_HINT, control: 'text', required: true, mensajeDeError: UUID_ERROR },
        { key: 'scheduleExpression', label: 'Expresión de programación', hint: 'La cadencia, como una expresión cron: 0 3 * * * corre todos los días a las 3.', control: 'text', required: true, mensajeDeError: 'Escribí la expresión de programación (máx. 200 caracteres).' },
      ],
    },
    {
      titulo: 'Ajustes',
      hint: 'Opcionales: zona horaria, cuántos días hacia atrás mirar y cuánto vive el dato.',
      campos: [
        { key: 'timezoneConceptId', label: 'Zona horaria', hint: 'Identificador del concepto de zona (UUID).', control: 'text', mensajeDeError: UUID_ERROR },
        { key: 'lookbackDays', label: 'Ventana hacia atrás (días)', control: 'text', mensajeDeError: 'Ingresá un número entero de días, sin signo.' },
        { key: 'freshnessTtlSeconds', label: 'Vigencia del dato (segundos)', hint: 'Cuánto se considera fresco lo recolectado. Mínimo 60.', control: 'text', mensajeDeError: 'Ingresá un número entero de segundos, de 60 en adelante.' },
        { key: 'nextRunAt', label: 'Primera corrida', hint: 'Sin este dato, la calcula el scheduler a partir de la expresión.', control: 'datetime' },
      ],
    },
  ]);

  protected readonly form = new FormGroup({
    countryConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    agentId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(UUID_PATTERN)],
    }),
    scheduleExpression: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(200)],
    }),
    timezoneConceptId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(UUID_PATTERN)],
    }),
    lookbackDays: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_NO_NEGATIVO)],
    }),
    freshnessTtlSeconds: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(ENTERO_NO_NEGATIVO), validarTtl],
    }),
    /** Primera corrida, si no se deja que la calcule el scheduler. */
    nextRunAt: new FormControl<Date | null>(null),
  });


  protected readonly state = signal<ViewState<null>>(ready(null));
  protected readonly isSubmitting = computed(() => this.state().status === 'loading');

  protected readonly created = signal<ScheduleCreated | null>(null);

  protected readonly errorMessage = computed(() =>
    errorMessageOf(this.state(), 'No tenés permiso para programar recolecciones.'),
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
    const zona = valores.timezoneConceptId.trim();
    const ventana = valores.lookbackDays.trim();
    const vigencia = valores.freshnessTtlSeconds.trim();
    const primera = valores.nextRunAt;

    this.state.set(loading());

    this.client
      .createSchedule({
        countryConceptId: valores.countryConceptId.trim(),
        agentId: valores.agentId.trim(),
        scheduleExpression: valores.scheduleExpression.trim(),
        ...(zona === '' ? {} : { timezoneConceptId: zona }),
        ...(ventana === '' ? {} : { lookbackDays: Number(ventana) }),
        ...(vigencia === '' ? {} : { freshnessTtlSeconds: Number(vigencia) }),
        ...(primera === null ? {} : { nextRunAt: primera.toISOString() }),
      })
      .subscribe({
        next: (agenda) => {
          this.state.set(ready(null));
          this.created.set(agenda);
        },
        error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
      });
  }

  protected otraAgenda(): void {
    this.form.reset();
    this.created.set(null);
    this.state.set(ready(null));
  }
}

/** Vacío es válido; con valor, el mínimo del contrato es 60 segundos. */
function validarTtl(control: { value: string }): { ttlCorto: true } | null {
  const texto = control.value.trim();
  if (texto === '' || !/^\d+$/.test(texto)) {
    return null;
  }
  return Number(texto) >= MIN_TTL_SEGUNDOS ? null : { ttlCorto: true };
}
