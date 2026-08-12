import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { HealthContextClient } from '../../../core/data-access/health-context/health-context.client';
import type { ScheduleCreated } from '../../../core/data-access/health-context/health-context.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { FormActions } from '../../../shared/components/organisms/form-actions/form-actions';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { FormSection } from '../../../shared/components/organisms/form-section/form-section';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
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
    ReactiveFormsModule,
    Alert,
    AnnounceOnAppear,
    AppButton,
    DatePicker,
    FormActions,
    FormField,
    FormSection,
    Input,
    PageHeader,
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
  });

  /** Primera corrida, si no se deja que la calcule el scheduler. */
  protected readonly nextRunAt = signal<Date | null>(null);

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
    const primera = this.nextRunAt();

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
    this.nextRunAt.set(null);
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
