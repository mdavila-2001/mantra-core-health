import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartCarePlansClient } from '../../../../core/data-access/chart-care-plans/chart-care-plans.client';
import type { NewCarePlanActivity } from '../../../../core/data-access/chart-care-plans/chart-care-plans.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { mensajeDeEscritura } from '../mensaje-de-escritura';

/** Qué clase de plan es: propuesta, plan u orden. */
export const TARGET_INTENCION = 'chart.care_plans.intent_concept_id';

/** Qué clase de paso es cada actividad. */
export const TARGET_ACTIVIDAD = 'chart.care_plan_activities.activity_concept_id';

/** Un diagnóstico del expediente, para colgar el plan de él. */
export interface DiagnosticoDelPlan {
  readonly id: string;
  readonly etiqueta: string;
}

/** Una actividad a medio cargar, tal como la sostiene el formulario. */
interface ActividadEnCurso {
  readonly clave: number;
  tipo: string | null;
  detalle: string;
  cuando: Date | null;
}

/**
 * **Abrir un plan de cuidados** desde el expediente — UC-15-10.
 *
 * ```html
 * <app-care-plan-block [patientProfileId]="id" [diagnosticos]="dx()" (cambio)="recargar()" />
 * ```
 *
 * ## Por qué existe
 *
 * La pestaña «Planes de cuidados» del expediente sabía listar y nada más. El
 * propio componente lo decía en su comentario —«tampoco hay alta: el plan de
 * cuidados es hoy sólo de lectura»— mientras `POST /charts/care-plans` estaba
 * publicado desde UC-15-10. Esto es esa mitad.
 *
 * ## La meta es lo que se pide, y no es un capricho
 *
 * El contrato sólo exige el paciente. Un plan sin objetivo escrito es un
 * registro que nadie sabe para qué se creó: no se puede evaluar, no se puede
 * cerrar y no dice qué esperar. Así que el formulario pide la meta aunque el
 * servidor la acepte vacía. Es la misma clase de restricción que el bloque de
 * medicación pone sobre el motivo de una receta.
 *
 * ## Las actividades se cargan acá, no después
 *
 * El DTO las acepta en el alta (`activities`) y el backend devuelve cuántas
 * entraron. Dejarlas para un segundo paso habría significado abrir el plan
 * vacío y volver a entrar: un plan sin pasos es una intención, no un plan.
 *
 * Cambiar el estado de una actividad ya cargada (UC-15-11) es otra operación y
 * no vive acá.
 */
@Component({
  selector: 'app-care-plan-block',
  imports: [
    Alert,
    AppButton,
    Card,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    Select,
    Textarea,
  ],
  templateUrl: './care-plan-block.html',
  styleUrl: './care-plan-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarePlanBlock {
  private readonly carePlans = inject(ChartCarePlansClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, cuando el bloque vive dentro de la atención. */
  readonly encounterId = input<string | null>(null);

  /** Las citas de la persona, para atar el plan a la consulta donde se acordó. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /**
   * Los diagnósticos de la persona, ya traducidos por el expediente.
   *
   * Bajan hechos y no se vuelven a pedir: son la misma lista que pinta la
   * pestaña de diagnósticos, y dos lecturas de la misma lista pueden discrepar.
   */
  readonly diagnosticos = input<readonly DiagnosticoDelPlan[]>([]);

  /** El plan quedó abierto y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly targetIntencion = TARGET_INTENCION;
  protected readonly targetActividad = TARGET_ACTIVIDAD;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly meta = signal('');
  protected readonly intencion = signal<string | null>(null);
  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);
  protected readonly citaElegida = signal<string | null>(null);
  protected readonly diagnosticoElegido = signal<string | null>(null);

  /**
   * Los pasos del plan. Arranca con uno: un plan se escribe con al menos una
   * cosa que hacer, y una lista vacía obligaría a buscar el botón de agregar
   * antes de poder escribir nada.
   */
  protected readonly actividades = signal<readonly ActividadEnCurso[]>([
    { clave: 0, tipo: null, detalle: '', cuando: null },
  ]);

  private siguienteClave = 1;

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  protected readonly opcionesDeDiagnostico = computed<readonly SelectOption<string | null>[]>(
    () => [
      { value: null, label: 'Sin diagnóstico asociado' },
      ...this.diagnosticos().map((dx) => ({ value: dx.id, label: dx.etiqueta })),
    ],
  );

  protected agregarActividad(): void {
    this.actividades.update((actuales) => [
      ...actuales,
      { clave: this.siguienteClave++, tipo: null, detalle: '', cuando: null },
    ]);
  }

  protected quitarActividad(clave: number): void {
    this.actividades.update((actuales) => actuales.filter((a) => a.clave !== clave));
  }

  protected fijarTipo(clave: number, valor: string | null): void {
    this.actualizar(clave, (a) => ({ ...a, tipo: valor }));
  }

  protected fijarDetalle(clave: number, valor: string): void {
    this.actualizar(clave, (a) => ({ ...a, detalle: valor }));
  }

  protected fijarCuando(clave: number, valor: Date | null): void {
    this.actualizar(clave, (a) => ({ ...a, cuando: valor }));
  }

  private actualizar(clave: number, cambiar: (a: ActividadEnCurso) => ActividadEnCurso): void {
    this.actividades.update((actuales) =>
      actuales.map((a) => (a.clave === clave ? cambiar(a) : a)),
    );
  }

  /**
   * El fin no puede caer antes del inicio.
   *
   * Se comprueba acá y no sólo en el servidor porque es lo que quien escribe
   * puede corregir mirando el formulario: un `422` después del envío deja la
   * misma pantalla con un mensaje que no señala el campo.
   */
  protected readonly vigenciaInvalida = computed(() => {
    const desde = this.desde();
    const hasta = this.hasta();
    return desde !== null && hasta !== null && hasta < desde;
  });

  /** La meta es lo que esta pantalla exige; el contrato sólo pide el paciente. */
  protected readonly puedeRegistrar = computed(
    () => this.meta().trim() !== '' && !this.vigenciaInvalida() && !this.registrando(),
  );

  /**
   * El fallo, en palabras y para los cinco estados en los que una escritura
   * puede terminar mal. La regla vive en `mensajeDeEscritura`, una sola vez:
   * cada bloque con su propia versión dejaba fuera `offline`, y una petición
   * que no llega desbloqueaba el formulario sin decir nada.
   */
  protected readonly errorDelPlan = computed<string | null>(() =>
    mensajeDeEscritura(this.registro(), 'abrir el plan'),
  );

  protected registrar(): void {
    const goalText = this.meta().trim();
    if (goalText === '' || this.vigenciaInvalida() || this.registrando()) {
      return;
    }

    // Sólo los pasos que dicen algo: el detalle es lo que hace útil a una
    // actividad, y una fila vacía no es un paso sin fecha, es nada.
    const activities: NewCarePlanActivity[] = this.actividades()
      .filter((a) => a.detalle.trim() !== '')
      .map((a) => ({
        detailText: a.detalle.trim(),
        ...(a.tipo === null ? {} : { activityConceptId: a.tipo }),
        ...(a.cuando === null ? {} : { scheduledAt: a.cuando }),
      }));

    const intencion = this.intencion();
    const desde = this.desde();
    const hasta = this.hasta();
    const encuentro = this.citaElegida() ?? this.encounterId();
    const diagnostico = this.diagnosticoElegido();
    const autor = this.auth.practitionerProfileId();

    this.registrando.set(true);
    this.registro.set(loading());

    this.carePlans
      .createCarePlan({
        patientProfileId: this.patientProfileId(),
        goalText,
        // Los opcionales sin elegir se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
        ...(intencion === null ? {} : { intentConceptId: intencion }),
        ...(desde === null ? {} : { startDate: desde }),
        ...(hasta === null ? {} : { endDate: hasta }),
        ...(encuentro === null ? {} : { encounterId: encuentro }),
        ...(diagnostico === null ? {} : { conditionId: diagnostico }),
        ...(autor === null ? {} : { authorProfileId: autor }),
        ...(activities.length === 0 ? {} : { activities }),
      })
      .subscribe({
        next: (abierto) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success(
            abierto.activityCount === 0
              ? 'Queda en la pestaña «Planes de cuidados» del expediente.'
              : `Queda en el expediente con ${abierto.activityCount} actividad${abierto.activityCount === 1 ? '' : 'es'}.`,
            'Plan de cuidados abierto',
          );
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  private limpiar(): void {
    this.meta.set('');
    this.intencion.set(null);
    this.desde.set(null);
    this.hasta.set(null);
    this.citaElegida.set(null);
    this.diagnosticoElegido.set(null);
    this.actividades.set([{ clave: this.siguienteClave++, tipo: null, detalle: '', cuando: null }]);
  }
}
