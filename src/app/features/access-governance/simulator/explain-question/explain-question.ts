import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** La pregunta «¿puede esta persona hacer esto, aquí y ahora?». Lo que no se elige se omite. */
export interface QuestionValue {
  readonly action: string;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly patientProfileId?: string;
  /** Instante de la consulta (ISO). Sin él la API usa «ahora». */
  readonly at?: string;
  /** Inicio de la cita sobre la que se pregunta (ISO). */
  readonly appointmentStartAt?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONE = '';

/** Fecha y hora locales → ISO; `undefined` si falta alguna de las dos o no son válidas. */
export function isoOf(date: string, time: string): string | undefined {
  if (date === '' || time === '') return undefined;
  const value = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

/** El inverso: ISO → `{ date: 'yyyy-mm-dd', time: 'HH:mm' }` en hora local. */
export function partsOf(iso: string | undefined): { date: string; time: string } {
  if (iso === undefined) return { date: '', time: '' };
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: '', time: '' };
  const two = (n: number): string => String(n).padStart(2, '0');
  return {
    date: `${value.getFullYear()}-${two(value.getMonth() + 1)}-${two(value.getDate())}`,
    time: `${two(value.getHours())}:${two(value.getMinutes())}`,
  };
}

/**
 * **El formulario de la pregunta** del simulador, de «Mis accesos» (tres campos: qué, dónde, cuándo) y de «Mi equipo».
 *
 * Valida lo que solo la forma puede validar (acción obligatoria, formato del paciente, fecha con hora); todo lo demás lo
 * decide la API. No guarda nada: emite `asked` y quien lo usa llama a `explain`.
 */
@Component({
  selector: 'app-explain-question',
  imports: [AppButton, FormField, Input, Select],
  templateUrl: './explain-question.html',
  styleUrl: './explain-question.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplainQuestion {
  readonly actions = input.required<readonly SelectOption<string>[]>();
  readonly doctors = input<readonly SelectOption<string>[]>([]);
  readonly services = input<readonly SelectOption<string>[]>([]);
  readonly spaces = input<readonly SelectOption<string>[]>([]);
  /** Pregunta por un paciente concreto (identificador). */
  readonly showPatient = input(false);
  /** Pregunta por una cita (su fecha y hora). */
  readonly showAppointment = input(false);
  readonly doctorLabel = input('¿En la agenda de quién?');
  readonly whenLabel = input('¿Cuándo?');
  readonly submitLabel = input('Explicar');
  readonly busy = input(false);
  readonly prefix = input('pregunta');
  /** Valores con los que arranca el formulario (por ejemplo desde un enlace). Cambiarlo vuelve a llenar los campos. */
  readonly initial = input<QuestionValue | null>(null);

  readonly asked = output<QuestionValue>();
  /** Se pulsó el botón (aunque falte algo): quien lo usa puede mostrar lo que le falta a lo suyo. */
  readonly attempted = output<void>();
  /** El usuario tocó un campo: el resultado que se ve ya no responde a lo que hay escrito. */
  readonly edited = output<void>();

  protected readonly action = signal<string | null>(null);
  protected readonly doctor = signal<string | null>(null);
  protected readonly service = signal<string | null>(null);
  protected readonly space = signal<string | null>(null);
  protected readonly patient = signal('');
  protected readonly date = signal('');
  protected readonly time = signal('');
  protected readonly appointmentDate = signal('');
  protected readonly appointmentTime = signal('');
  protected readonly tried = signal(false);

  protected readonly doctorOptions = computed(() => [
    { value: NONE, label: 'Cualquiera' },
    ...this.doctors(),
  ]);
  protected readonly serviceOptions = computed(() => [
    { value: NONE, label: 'Cualquiera' },
    ...this.services(),
  ]);
  protected readonly spaceOptions = computed(() => [
    { value: NONE, label: 'Cualquiera' },
    ...this.spaces(),
  ]);

  protected readonly actionError = computed(() =>
    this.tried() && this.action() === null ? 'Elija qué quiso hacer.' : '',
  );
  protected readonly patientError = computed(() =>
    this.patient().trim() !== '' && !UUID.test(this.patient().trim())
      ? 'El identificador del paciente no tiene el formato esperado.'
      : '',
  );
  protected readonly whenError = computed(() => this.halfFilled(this.date(), this.time()));
  protected readonly appointmentError = computed(() =>
    this.halfFilled(this.appointmentDate(), this.appointmentTime()),
  );

  constructor() {
    effect(() => {
      const initial = this.initial();
      if (initial === null) return;
      this.action.set(initial.action);
      this.doctor.set(initial.practitionerRoleAssignmentId ?? null);
      this.service.set(initial.healthcareServiceId ?? null);
      this.space.set(initial.careSpaceId ?? null);
      this.patient.set(initial.patientProfileId ?? '');
      const at = partsOf(initial.at);
      this.date.set(at.date);
      this.time.set(at.time);
      const start = partsOf(initial.appointmentStartAt);
      this.appointmentDate.set(start.date);
      this.appointmentTime.set(start.time);
    });
  }

  private halfFilled(date: string, time: string): string {
    if (date === '' && time === '') return '';
    if (date === '' || time === '') return 'Indique la fecha y también la hora.';
    return isoOf(date, time) === undefined ? 'La fecha o la hora no son válidas.' : '';
  }

  protected set<T>(target: { set(value: T): void }, value: T): void {
    target.set(value);
    this.edited.emit();
  }

  protected submit(): void {
    this.tried.set(true);
    this.attempted.emit();
    const action = this.action();
    if (action === null || this.busy()) return;
    if (this.patientError() !== '' || this.whenError() !== '' || this.appointmentError() !== '')
      return;
    const at = isoOf(this.date(), this.time());
    const start = isoOf(this.appointmentDate(), this.appointmentTime());
    const ids = (value: string | null): string | undefined =>
      value === null || value === NONE ? undefined : value;
    this.asked.emit({
      action,
      ...(ids(this.doctor()) === undefined
        ? {}
        : { practitionerRoleAssignmentId: ids(this.doctor())! }),
      ...(ids(this.service()) === undefined ? {} : { healthcareServiceId: ids(this.service())! }),
      ...(ids(this.space()) === undefined ? {} : { careSpaceId: ids(this.space())! }),
      ...(this.showPatient() && this.patient().trim() !== ''
        ? { patientProfileId: this.patient().trim() }
        : {}),
      ...(at === undefined ? {} : { at }),
      ...(this.showAppointment() && start !== undefined ? { appointmentStartAt: start } : {}),
    });
  }
}
