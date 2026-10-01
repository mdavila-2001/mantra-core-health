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
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { NewObservationPerformer } from '../../../../core/data-access/clinical/clinical.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
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
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { mensajeDeEscritura } from '../../mensaje-de-escritura';

/** Qué se midió. Es lo único obligatorio del formulario, y lo dice el DTO. */
export const TARGET_MEDICION = 'clinical.observations.code_concept_id';

/** La unidad del valor. `mmHg`, `kg`, `%` — no las unidades de dosis. */
export const TARGET_UNIDAD = 'clinical.observations.quantity_unit_concept_id';

/** De dónde sale la medición: signos vitales, laboratorio, examen físico. */
export const TARGET_CATEGORIA_OBSERVACION = 'clinical.observations.category_concept_id';

/** Cómo se lee el valor. Es lo que convierte un número en un hallazgo. */
export const TARGET_INTERPRETACION = 'clinical.observations.interpretation_concept_id';

/**
 * De qué clase es quien la tomó.
 *
 * No se pregunta: se resuelve del catálogo y se preselecciona el profesional.
 * Ver {@link ObservationBlock.ejecutante}.
 */
export const TARGET_TIPO_DE_EJECUTANTE =
  'clinical.observation_performers.performer_type_concept_id';

/** El código del ejecutante que esta pantalla representa: quien atiende. */
const CODIGO_EJECUTANTE_PROFESIONAL = 'OBSP-PRACTITIONER';

/**
 * **Registrar una observación** en el expediente — UC-08-03.
 *
 * ```html
 * <app-observation-block [patientProfileId]="id" [citas]="citas()" (cambio)="recargar()" />
 * ```
 *
 * ## Por qué existe
 *
 * Mismo caso que la alergia antes de que existiera su bloque: el contrato
 * estaba entero —`POST /clinical/observations` con sus valores, componentes y
 * rangos— y **ninguna pantalla lo usaba**. La presión que el médico acaba de
 * tomar sólo podía llegar a la historia si la había cargado el seed.
 *
 * ## Un valor, no dos
 *
 * El contrato declara seis familias de valor **excluyentes**. El formulario
 * ofrece dos —número con unidad, o texto— y manda una sola: una observación no
 * tiene dos valores, y dos casillas llenas sugerirían que sí. Con número, la
 * unidad se elige del catálogo; sin él, la medición es cualitativa («ruidos
 * cardíacos rítmicos») y no lleva ninguna.
 *
 * ## El ejecutante no se pregunta
 *
 * Quién la tomó lo sabe la sesión —es el perfil profesional de quien está
 * escribiendo— y de qué clase es sale del catálogo. Preguntarlo sería pedirle a
 * quien mide que declare lo que la pantalla ya sabe. Cuando el catálogo **no**
 * publica esa columna, el ejecutante se omite en vez de viajar con un uuid
 * inventado: ver la nota de `NewObservation`.
 *
 * ## Es de registro, no de corrección
 *
 * Enmendar una observación ya cargada (UC-08-04) es otra operación, con su
 * bloqueo optimista y su motivo. Acá sólo se crea.
 */
@Component({
  selector: 'app-observation-block',
  imports: [
    Alert,
    AppInput,
    Card,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    Select,
    Textarea,
  ],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => ObservationBlock) }],
  templateUrl: './observation-block.html',
  styleUrl: './observation-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservationBlock implements DraftBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, cuando el bloque vive dentro de la atención. */
  readonly encounterId = input<string | null>(null);

  /** Las citas de la persona, para atar la medición a la consulta donde se tomó. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** La medición quedó registrada y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly targetMedicion = TARGET_MEDICION;
  protected readonly targetUnidad = TARGET_UNIDAD;
  protected readonly targetCategoria = TARGET_CATEGORIA_OBSERVACION;
  protected readonly targetInterpretacion = TARGET_INTERPRETACION;

  /**
   * La organización bajo cuya custodia queda la medición.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente:
   * es quién responde por el registro, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /* -- El formulario ------------------------------------------------------- */

  protected readonly medicion = signal<string | null>(null);
  protected readonly categoria = signal<string | null>(null);
  protected readonly interpretacion = signal<string | null>(null);
  protected readonly unidad = signal<string | null>(null);
  protected readonly valorNumerico = signal<string | number | null>('');
  protected readonly valorEnPalabras = signal('');
  protected readonly tomadaEl = signal<Date | null>(null);
  protected readonly citaElegida = signal<string | null>(null);

  /** Contrato de `DraftBlock` — si hay algo escrito que se perdería sin registrar. */
  readonly tieneCambiosPendientes = computed(
    () =>
      this.medicion() !== null ||
      this.categoria() !== null ||
      this.interpretacion() !== null ||
      this.unidad() !== null ||
      String(this.valorNumerico() ?? '').trim() !== '' ||
      this.valorEnPalabras().trim() !== '' ||
      this.tomadaEl() !== null ||
      this.citaElegida() !== null,
  );

  protected readonly registrando = signal(false);
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /** Las opciones del selector de cita, con la vacía primero. */
  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  /**
   * El número, ya como número, o `null` si lo escrito no lo es.
   *
   * Se parsea acá y no en el envío para que el formulario pueda decir que la
   * unidad sólo tiene sentido con un número al lado.
   */
  protected readonly numero = computed<number | null>(() => {
    const crudo = String(this.valorNumerico() ?? '').trim().replace(',', '.');
    if (crudo === '') {
      return null;
    }
    const valor = Number(crudo);
    return Number.isFinite(valor) ? valor : null;
  });

  /** Si lo escrito en el campo numérico no es un número. */
  protected readonly numeroInvalido = computed(
    () => String(this.valorNumerico() ?? '').trim() !== '' && this.numero() === null,
  );

  /**
   * Si el formulario puede enviarse.
   *
   * La medición y la organización son del contrato. El valor lo pide la
   * pantalla: una observación registrada sin decir cuánto dio es una fila que
   * después nadie sabe leer, y el contrato la aceptaría igual.
   */
  protected readonly puedeRegistrar = computed(
    () =>
      !this.sinOrganizacion() &&
      this.medicion() !== null &&
      !this.numeroInvalido() &&
      (this.numero() !== null || this.valorEnPalabras().trim() !== '') &&
      !this.registrando(),
  );

  /**
   * El fallo, en palabras y para los cinco estados en los que una escritura
   * puede terminar mal. La regla vive en `mensajeDeEscritura`, una sola vez:
   * cada bloque con su propia versión dejaba fuera `offline`, y una petición
   * que no llega desbloqueaba el formulario sin decir nada.
   */
  protected readonly errorDeLaObservacion = computed<string | null>(() =>
    mensajeDeEscritura(this.registro(), { accion: 'registrar la observación' }),
  );

  /**
   * El tipo de ejecutante publicado por el catálogo, o `null` si no hay.
   *
   * Se resuelve al montar y no al enviar: si el catálogo no lo declara, el
   * formulario sigue funcionando y la observación viaja sin ejecutante. Un
   * fallo de esta lectura es lo mismo que la ausencia — no tumba el alta.
   */
  private readonly tipoDeEjecutante = signal<string | null>(null);

  constructor() {
    this.systemContext.dynamicEnum(TARGET_TIPO_DE_EJECUTANTE).subscribe({
      next: (enumeracion) => {
        const profesional =
          enumeracion.options.find((opcion) => opcion.code === CODIGO_EJECUTANTE_PROFESIONAL) ??
          enumeracion.options.find((opcion) => opcion.isDefault) ??
          enumeracion.options[0];
        this.tipoDeEjecutante.set(profesional?.conceptId ?? null);
      },
      error: () => this.tipoDeEjecutante.set(null),
    });
  }

  /**
   * Quién tomó la medición, si se la puede nombrar entera.
   *
   * Hacen falta las dos mitades: el perfil de quien atiende y la clase de
   * ejecutante que publica el catálogo. Sin alguna de las dos se devuelve
   * `undefined` y la observación se registra sin autor, que es lo honesto — ver
   * la nota de `NewObservation`.
   */
  private ejecutante(): readonly NewObservationPerformer[] | undefined {
    const performerTypeConceptId = this.tipoDeEjecutante();
    const performerId = this.auth.practitionerProfileId();
    if (performerTypeConceptId === null || performerId === null) {
      return undefined;
    }
    return [{ performerTypeConceptId, performerId }];
  }

  protected registrar(): void {
    const custodianTenantId = this.organizacion();
    const codeConceptId = this.medicion();
    if (custodianTenantId === null || codeConceptId === null || this.registrando()) {
      return;
    }

    const numero = this.numero();
    const texto = this.valorEnPalabras().trim();
    const unidad = this.unidad();
    const categoria = this.categoria();
    const interpretacion = this.interpretacion();
    const tomadaEl = this.tomadaEl();
    const encuentro = this.citaElegida() ?? this.encounterId();
    const performers = this.ejecutante();

    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .createObservation({
        custodianTenantId,
        patientProfileId: this.patientProfileId(),
        codeConceptId,
        // Las seis familias de valor del contrato son excluyentes: gana el
        // número si lo hay, y el texto sólo cuando la medición es cualitativa.
        ...(numero === null
          ? { valueText: texto }
          : {
              quantityValue: numero,
              ...(unidad === null ? {} : { quantityUnitConceptId: unidad }),
            }),
        // Los opcionales sin elegir se **omiten**: el backend valida con
        // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
        ...(categoria === null ? {} : { categoryConceptId: categoria }),
        ...(interpretacion === null ? {} : { interpretationConceptId: interpretacion }),
        ...(tomadaEl === null ? {} : { effectiveStartAt: tomadaEl }),
        ...(encuentro === null ? {} : { encounterId: encuentro }),
        ...(performers === undefined ? {} : { performers }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          this.toasts.success(
            'Queda en la pestaña «Observaciones» del expediente.',
            'Medición registrada',
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
    this.medicion.set(null);
    this.categoria.set(null);
    this.interpretacion.set(null);
    this.unidad.set(null);
    this.valorNumerico.set('');
    this.valorEnPalabras.set('');
    this.tomadaEl.set(null);
    this.citaElegida.set(null);
  }
}
