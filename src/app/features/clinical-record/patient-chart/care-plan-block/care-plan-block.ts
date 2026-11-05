import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartCarePlansClient } from '../../../../core/data-access/chart-care-plans/chart-care-plans.client';
import type { NewCarePlanActivity } from '../../../../core/data-access/chart-care-plans/chart-care-plans.types';
import { simulatorAvailable } from '../../../../core/data-access/simulator-only';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import {
  CarePlanRoute,
  type EstadoDelPlan,
  type PasoDelPlan,
} from '../care-plan-route/care-plan-route';
import { FormResponsePicker } from '../form-response-picker/form-response-picker';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { writeMessage } from '../../write-message';

/** Un diagnóstico del expediente, para colgar el plan de él. */
export interface DiagnosticoDelPlan {
  readonly id: string;
  readonly etiqueta: string;
}

/** Una actividad a medio cargar, tal como la sostiene el formulario. */
interface ActividadEnCurso {
  readonly clave: number;
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
 * ## El motivo también se pide, y acepta dos formas
 *
 * Un plan tiene que decir **por qué** se abre. Si la persona ya tiene el
 * problema registrado, el plan cuelga de ese diagnóstico; si el plan nace
 * antes de que haya diagnóstico —que es lo normal en un control—, el motivo
 * se escribe a mano. Uno de los dos, siempre: eso es lo que el formulario
 * exige.
 *
 * El motivo escrito viaja en `reasonText`, que **todavía no existe en la API
 * real** y por ahora sólo entiende la maqueta.
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
    CarePlanRoute,
    FormResponsePicker,
    Alert,
    AppButton,
    Card,
    AppInput,
    DatePicker,
    NavIcon,
    FormActions,
    FormField,
    Select,
    Textarea,
  ],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => CarePlanBlock) }],
  templateUrl: './care-plan-block.html',
  styleUrl: './care-plan-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarePlanBlock implements DraftBlock {
  private readonly carePlans = inject(ChartCarePlansClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, cuando el bloque vive dentro de la atención. */
  readonly encounterId = input<string | null>(null);

  /**
   * En la cita, lo que se emite cuelga sí o sí de una respuesta del formulario
   * médico: sin ella el botón no se habilita. En el expediente no se exige.
   */
  readonly exigeRespuesta = input(false);

  /** Ofrece la respuesta sin exigirla (30/10/2026): se emite sin formulario, no sin encuentro. */
  readonly ofreceRespuesta = input(false);

  /** La respuesta del formulario médico elegida; por defecto, la más reciente. */
  protected readonly respuestaDelFormulario = signal<string | null>(null);

  protected readonly faltaRespuesta = computed(
    () =>
      (this.exigeRespuesta() && this.respuestaDelFormulario() === null) ||
      // Sin formulario se emite, pero el encuentro abierto sigue siendo necesario.
      (this.ofreceRespuesta() && this.encounterId() === null),
  );

  /**
   * Los diagnósticos de la persona, ya traducidos por el expediente.
   *
   * Bajan hechos y no se vuelven a pedir: son la misma lista que pinta la
   * pestaña de diagnósticos, y dos lecturas de la misma lista pueden discrepar.
   */
  readonly diagnosticos = input<readonly DiagnosticoDelPlan[]>([]);

  /** El plan quedó abierto y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  /* -- El formulario ------------------------------------------------------- */

  protected readonly meta = signal('');
  /** El motivo escrito a mano, cuando no cuelga de un diagnóstico ya registrado. */
  protected readonly motivo = signal('');
  protected readonly desde = signal<Date | null>(null);
  protected readonly hasta = signal<Date | null>(null);
  protected readonly diagnosticoElegido = signal<string | null>(null);

  /**
   * Los pasos del plan. Arranca con uno: un plan se escribe con al menos una
   * cosa que hacer, y una lista vacía obligaría a buscar el botón de agregar
   * antes de poder escribir nada.
   */
  protected readonly actividades = signal<readonly ActividadEnCurso[]>([
    { clave: 0, detalle: '', cuando: null },
  ]);

  /** Contrato de `DraftBlock`. La fila inicial vacía no cuenta sola. */
  readonly tieneCambiosPendientes = computed(
    () =>
      this.meta().trim() !== '' ||
      this.motivo().trim() !== '' ||
      this.desde() !== null ||
      this.hasta() !== null ||
      this.diagnosticoElegido() !== null ||
      this.actividades().some((a) => a.detalle.trim() !== '' || a.cuando !== null),
  );

  private siguienteClave = 1;

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /** Si la persona tiene diagnósticos de los que el plan pueda colgar. */
  protected readonly hayDiagnosticos = computed(() => this.diagnosticos().length > 0);

  protected readonly opcionesDeDiagnostico = computed<readonly SelectOption<string | null>[]>(
    () => [
      { value: null, label: 'Escribir el motivo a mano' },
      ...this.diagnosticos().map((dx) => ({ value: dx.id, label: dx.etiqueta })),
    ],
  );

  protected agregarActividad(): void {
    this.actividades.update((actuales) => [
      ...actuales,
      { clave: this.siguienteClave++, detalle: '', cuando: null },
    ]);
  }

  protected quitarActividad(clave: number): void {
    this.actividades.update((actuales) => actuales.filter((a) => a.clave !== clave));
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

  /**
   * Hay motivo cuando el plan cuelga de un diagnóstico ya registrado **o**
   * cuando está escrito a mano. Uno de los dos, siempre: un plan de cuidados
   * sin decir por qué se abre no se puede evaluar ni cerrar.
   */
  protected readonly hayMotivo = computed(
    () => this.diagnosticoElegido() !== null || this.motivo().trim() !== '',
  );

  /* -- La hoja de ruta ------------------------------------------------------ */

  /**
   * Los pasos que dicen algo. Es la regla de qué viaja al servidor y de qué se
   * dibuja en la ruta, y vive una sola vez: una fila vacía no es un paso sin
   * fecha, es nada.
   */
  protected readonly actividadesEscritas = computed<readonly PasoDelPlan[]>(() =>
    this.actividades().filter((a) => a.detalle.trim() !== ''),
  );

  /**
   * Qué tramo de la ruta está resuelto. Los obligatorios cierran con su dato;
   * la vigencia y los pasos, que son opcionales, cuando tienen algo.
   */
  protected readonly tramos = computed(() => ({
    origen: !this.faltaRespuesta(),
    objetivo: this.meta().trim() !== '',
    motivo: this.hayMotivo(),
    vigencia: (this.desde() !== null || this.hasta() !== null) && !this.vigenciaInvalida(),
    pasos: this.actividadesEscritas().length > 0,
  }));

  /**
   * El tramo «Origen» se ve resuelto cuando hay con qué: si es obligatorio,
   * cuando no falta; si es opcional, sólo con una respuesta elegida.
   */
  protected readonly origenListo = computed(() =>
    this.exigeRespuesta() ? this.tramos().origen : this.respuestaDelFormulario() !== null,
  );

  /** Lo que falta para poder abrir el plan, contado: cuántos obligatorios quedan. */
  protected readonly obligatoriosPendientes = computed(() => {
    const t = this.tramos();
    return [t.origen, t.objetivo, t.motivo].filter((ok) => !ok).length;
  });

  /**
   * Lo que dice la insignia de la ruta. Sigue la misma regla que habilita el
   * botón —sin el «registrando», que es del envío y no del plan—: una vigencia
   * invertida también bloquea, y «Lista para abrir» con el botón apagado sería
   * una promesa falsa.
   */
  protected readonly estadoDelPlan = computed<EstadoDelPlan>(() => {
    const cuantos = this.obligatoriosPendientes();
    if (cuantos > 0) return { tipo: 'faltan', cuantos };
    return this.vigenciaInvalida() ? { tipo: 'vigencia' } : { tipo: 'listo' };
  });

  /** La etiqueta del diagnóstico elegido, para la vista de ruta. */
  protected readonly motivoEnPalabras = computed<string>(() => {
    const id = this.diagnosticoElegido();
    if (id !== null) {
      return this.diagnosticos().find((dx) => dx.id === id)?.etiqueta ?? '';
    }
    return this.motivo().trim();
  });

  /** La meta y el motivo son lo que esta pantalla exige; el contrato sólo pide el paciente. */
  protected readonly puedeRegistrar = computed(
    () =>
      !this.faltaRespuesta() &&
      this.meta().trim() !== '' &&
      this.hayMotivo() &&
      !this.vigenciaInvalida() &&
      !this.registrando(),
  );

  /**
   * El fallo, en palabras y para los cinco estados en los que una escritura
   * puede terminar mal. La regla vive en `mensajeDeEscritura`, una sola vez:
   * cada bloque con su propia versión dejaba fuera `offline`, y una petición
   * que no llega desbloqueaba el formulario sin decir nada.
   */
  protected readonly errorDelPlan = computed<string | null>(() =>
    writeMessage(this.registro(), { accion: 'abrir el plan' }),
  );

  protected registrar(): void {
    const goalText = this.meta().trim();
    if (goalText === '' || !this.hayMotivo() || this.vigenciaInvalida() || this.registrando()) {
      return;
    }

    // Sólo los pasos que dicen algo: el detalle es lo que hace útil a una
    // actividad, y una fila vacía no es un paso sin fecha, es nada.
    const activities: NewCarePlanActivity[] = this.actividadesEscritas().map((a) => ({
      detailText: a.detalle.trim(),
      ...(a.cuando === null ? {} : { scheduledAt: a.cuando }),
    }));

    const desde = this.desde();
    const hasta = this.hasta();
    const encuentro = this.encounterId();
    const diagnostico = this.diagnosticoElegido();
    // El motivo escrito sólo viaja cuando no hay diagnóstico elegido: el
    // diagnóstico ya **es** el motivo, y mandar los dos duplicaría el dato.
    const motivo = diagnostico === null ? this.motivo().trim() : '';
    const autor = this.auth.practitionerProfileId();
    // `reasonText` es extensión de la maqueta: contra la API real no viaja.
    const motivoSinGuardar = motivo !== '' && !simulatorAvailable();

    this.registrando.set(true);
    this.registro.set(loading());

    this.carePlans
      .createCarePlan({
        patientProfileId: this.patientProfileId(),
        goalText,
        // Los opcionales sin elegir se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
        ...(desde === null ? {} : { startDate: desde }),
        ...(hasta === null ? {} : { endDate: hasta }),
        ...(encuentro === null ? {} : { encounterId: encuentro }),
        ...(this.respuestaDelFormulario() === null
          ? {}
          : { formInstanceId: this.respuestaDelFormulario() ?? '' }),
        ...(diagnostico === null ? {} : { conditionId: diagnostico }),
        ...(motivo === '' ? {} : { reasonText: motivo }),
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
          if (motivoSinGuardar) {
            this.toasts.warning(
              'El motivo escrito todavía no se guarda: el servidor aún no lo recibe. Elija el diagnóstico si quiere que quede registrado.',
            );
          }
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
    this.motivo.set('');
    this.desde.set(null);
    this.hasta.set(null);
    this.diagnosticoElegido.set(null);
    this.actividades.set([{ clave: this.siguienteClave++, detalle: '', cuando: null }]);
  }
}
