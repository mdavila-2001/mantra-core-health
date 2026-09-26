import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { catchError, of, switchMap, tap, type Observable } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ChartTemplatesClient } from '../../../../core/data-access/chart-templates/chart-templates.client';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { DiagnosticsClient } from '../../../../core/data-access/diagnostics/diagnostics.client';
import type { RespuestaDeFormulario } from '../../../../core/data-access/triage-ia/diagnosis-ia.types';
import { mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';
import { DiagnosisBlock } from '../diagnosis-block/diagnosis-block';
import { AllergyBlock } from '../allergy-block/allergy-block';
import { AnalysisOrderBlock } from '../analysis-order-block/analysis-order-block';
import {
  FormConclusionBlock,
  type CierreDelFormulario,
} from '../form-conclusion-block/form-conclusion-block';
import { FreeNoteBlock } from '../free-note-block/free-note-block';
import { ProceduresBlock } from '../procedures-block/procedures-block';
import type {
  ChartTemplate,
  ChartTemplateField,
} from '../../../../core/data-access/chart-templates/chart-templates.types';
import { FormsClient } from '../../../../core/data-access/forms/forms.client';
import type {
  FieldValueInput,
  FormInstanceDetail,
} from '../../../../core/data-access/forms/forms.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import type { PractitionerSpecialty } from '../../../../core/data-access/profiles/profiles.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import {
  downloadFormResponsePdf,
  VALOR_ENMASCARADO,
} from '../../../../shared/utils/clinical-pdf/clinical-pdf';
import { textoDeValor } from '../../../../shared/utils/form-values/form-values';
import { Odontogram } from '../odontogram/odontogram';
import { ESTADOS_DENTALES, recuentoCpod } from '../odontogram/odontogram.types';
import type { MapaDental } from '../odontogram/odontogram.types';

/**
 * El valor con el que el selector representa la hoja en blanco.
 *
 * No es el id de ninguna plantilla porque no hay plantilla: es escribir sin
 * campos. Vive en la misma lista a propósito —quien atiende elige «con qué voy a
 * escribir esta consulta» una sola vez, y una de las respuestas es «con
 * nada»—. El prefijo lo hace imposible de confundir con un uuid.
 */
export const PLANTILLA_HOJA_LIBRE = 'hoja-libre';

/**
 * Las tres entradas del selector que **no** son plantillas de `forms`.
 *
 * Diagnosticar, registrar un procedimiento y pedir un estudio son, para quien
 * atiende, lo mismo que completar una ficha: «qué le voy a llenar a esta
 * persona». Que cada una escriba en otra tabla —`clinical.conditions`, el
 * histórico de procedimientos, las órdenes del circuito diagnóstico— es una
 * separación del backend, y no tiene por qué asomar como cuatro secciones
 * hermanas en la pantalla. Viven en esta lista por el mismo motivo por el que
 * ya vivía {@link PLANTILLA_HOJA_LIBRE}: se elige una vez, y una de las
 * respuestas posibles es «ninguna plantilla».
 *
 * El prefijo las hace imposibles de confundir con el uuid de una plantilla.
 */
export const BLOQUE_DIAGNOSTICO = 'bloque-diagnostico';
/** La alergia: mismo criterio que el diagnóstico, otra entidad clínica. */
export const BLOQUE_ALERGIA = 'bloque-alergia';
export const BLOQUE_CIRUGIA = 'bloque-cirugia';
export const BLOQUE_ODONTOLOGIA = 'bloque-odontologia';
export const BLOQUE_LABORATORIO = 'bloque-laboratorio';

/**
 * Las cinco entradas fijas, en el orden en que se ofrecen.
 *
 * Cirugía y odontología van separadas —antes eran una sola opción,
 * «Procedimiento»— porque no comparten ni permiso de servidor ni datos:
 * elegir odontología igual disparaba la lectura quirúrgica, y quien no tenía
 * rol de cirugía se topaba con un aviso de permiso denegado en medio de un
 * formulario que no le pedía nada de eso.
 */
const ENTRADAS_FIJAS: readonly { readonly value: string; readonly label: string }[] = [
  { value: BLOQUE_DIAGNOSTICO, label: 'Diagnóstico — del catálogo CIE-10' },
  { value: PLANTILLA_HOJA_LIBRE, label: 'Hoja en blanco — escribir sin campos' },
  { value: BLOQUE_ALERGIA, label: 'Alergia o intolerancia' },
  { value: BLOQUE_CIRUGIA, label: 'Cirugía' },
  { value: BLOQUE_ODONTOLOGIA, label: 'Odontología' },
  { value: BLOQUE_LABORATORIO, label: 'Laboratorio e imagenología' },
];

/**
 * Las dos respuestas de un campo de sí/no, como botones.
 *
 * Mismo par que el del motor de formularios y el del alta de agenda: son las
 * mismas dos palabras en todo el producto, y con ninguna elegida cuando la
 * pregunta todavía no se contestó.
 */
const SI_NO: readonly SegmentedOption<'si' | 'no' | ''>[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

/** Los tipos de dato que este bloque sabe dibujar como campo de captura. */
type TipoDibujable = 'boolean' | 'integer' | 'decimal' | 'date' | 'text' | 'string';

/**
 * El código del campo que se dibuja como odontograma.
 *
 * Va sin el prefijo del formulario: en la plantilla el código completo es
 * `ODONTO_ODONTOGRAMA_OMS.odontograma_fdi`, porque las definiciones de campo
 * son una tabla global y el prefijo es lo que las hace únicas.
 */
const CODIGO_ODONTOGRAMA = 'odontograma_fdi';

/**
 * El prefijo con el que el catálogo sembrado nombra sus formularios
 * transversales — los que no son de ninguna especialidad: anamnesis general,
 * examen físico, consentimiento informado, epicrisis.
 *
 * Se usa **sólo para descubrir el concepto**, no para clasificar fila por fila.
 * Ver {@link SpecialtyFormBlock.conceptoTransversal}.
 */
const PREFIJO_TRANSVERSAL = 'TRANSV_';

/**
 * La ficha a la que se cae cuando la especialidad de quien atiende todavía no
 * tiene una propia. Es la más general del catálogo: sirve para cualquier
 * consulta.
 */
const CODIGO_ANAMNESIS_GENERAL = 'TRANSV_ANAMNESIS_GENERAL';

/** Una respuesta ya lista para leerse: etiqueta, texto y si está protegida. */
interface RespuestaVisible {
  readonly id: string;
  readonly etiqueta: string;
  /** La respuesta en palabras. Vacía cuando `masked`: el marcador la reemplaza. */
  readonly texto: string;
  readonly masked: boolean;
}

/** Cómo se imprime una fecha en el modo lectura. Local, no ISO: lo lee gente. */
const FORMATO_FECHA = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'long',
  timeStyle: 'short',
});

/** Un cierre sin nada elegido: la ficha se completa sola, como siempre. */
const SIN_CIERRE: CierreDelFormulario = { diagnostico: null, orden: null };

/**
 * Un alta del cierre (D4): qué se registra después de cerrar la ficha y cómo
 * se nombra en los avisos.
 */
interface PasoDelCierre {
  /** «el diagnóstico tentativo», «la orden de análisis». */
  readonly nombre: string;
  readonly titulo: string;
  readonly exito: string;
  readonly ejecutar: () => Observable<unknown>;
}

/**
 * **Formularios clínicos por especialidad**, dentro del encuentro — carril 2,
 * punto 1 del reclamo.
 *
 * ## Qué plantilla se ofrece
 *
 * El objetivo final es «el formulario asignado a la especialidad del
 * encuentro activo», pero hoy el frontend no tiene de dónde leer esa
 * especialidad —el encuentro no la trae y no hay binding declarado para
 * derivarla del profesional que atiende—. Mientras esa pieza no exista, la
 * especialidad sale del perfil de quien atiende, que es la mejor
 * aproximación disponible.
 *
 * El catálogo entero son hoy **43 plantillas** (36 especialidades + las
 * transversales + extras), así que ofrecerlas todas en un desplegable es
 * inusable: quien atiende necesita una o dos. El selector se dibuja con las
 * de **su** especialidad primero y las **transversales** después —anamnesis
 * general, examen físico, consentimiento, epicrisis: sirven para cualquier
 * consulta y por eso nunca se esconden—, y un interruptor «Ver todas las
 * especialidades» devuelve el catálogo completo para el caso raro
 * —interconsulta, segunda especialidad no cargada en el perfil—. El filtrado
 * es sobre lo ya traído: la lista se pide **una sola vez**, sin `specialtyId`,
 * porque acotarla en el backend dejaría al interruptor sin nada que mostrar.
 *
 * ## Cómo se guarda
 *
 * Cada envío abre una instancia de `forms` sobre el encuentro
 * (`POST /forms/instances`), captura los valores tipados
 * (`POST /forms/instances/:id/values`) y la cierra
 * (`POST /forms/instances/:id/close`) — el mismo motor que gobierna el resto
 * de la extensibilidad dinámica. Igual que el diagnóstico y la receta de al
 * lado, vive **dentro del encuentro abierto**: sin uno, no hay dónde
 * adjuntar la instancia.
 *
 * ## Primero se pregunta, después se ofrece
 *
 * Con los GET de `forms` el bloque tiene la memoria que antes no tenía: al
 * conocer el encuentro consulta `GET /forms/instances?encounter=` y, si ya hay
 * una instancia, carga su detalle y se muestra en **modo lectura** — con un
 * marcador explícito para los valores que el backend enmascaró — en vez de
 * ofrecer completarla de nuevo. El `409` del backend queda como red de
 * seguridad ante una carrera, no como la forma normal de enterarse.
 *
 * ## El duplicado no es un error
 *
 * El backend rechaza con `409` una segunda instancia para el mismo encuentro
 * y versión de esquema (`forms.form_instances` es única por recurso +
 * versión). Igual que el diagnóstico repetido: no es un fallo, es la
 * plantilla ya completada para este encuentro.
 *
 * ## La ficha termina en un cierre (D4)
 *
 * Con una plantilla de `forms` elegida, debajo de los campos va el **cierre**
 * (`app-form-conclusion-block`): la IA sugiere diagnósticos tentativos y
 * análisis a partir de lo respondido, y quien atiende elige —opcionalmente—
 * un diagnóstico y una orden. Al completar se encadena, en este orden: cerrar
 * la instancia → registrar el diagnóstico (nace presuntivo, dentro del
 * encuentro, con el nombre de la ficha como nota) → pedir la orden. Cada paso
 * avisa por su cuenta, y **un fallo no deshace el anterior**: la ficha ya
 * quedó guardada, y lo que no se registró se dice con todas las letras para
 * que se haga desde su casilla.
 */
@Component({
  selector: 'app-specialty-form-block',
  imports: [
    Alert,
    AppButton,
    Card,
    DiagnosisBlock,
    AllergyBlock,
    AnalysisOrderBlock,
    FormConclusionBlock,
    FreeNoteBlock,
    Checkbox,
    DatePicker,
    FormActions,
    FormField,
    Input,
    Odontogram,
    ProceduresBlock,
    SegmentedControl,
    Select,
  ],
  templateUrl: './specialty-form-block.html',
  styleUrl: './specialty-form-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecialtyFormBlock {
  protected readonly siNo = SI_NO;

  private readonly chartTemplates = inject(ChartTemplatesClient);
  private readonly forms = inject(FormsClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly clinical = inject(ClinicalClient);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
  readonly encounterId = input<string | null>(null);

  /**
   * De quién es la historia.
   *
   * Lo pide la hoja en blanco, que escribe contra `chart.clinical_note_*` y ahí
   * el paciente es obligatorio. Las fichas por especialidad no lo necesitaban
   * porque cuelgan del encuentro.
   */
  readonly patientProfileId = input.required<string>();

  /** Algo se escribió y el expediente tiene que releerse. */
  readonly cambio = output<void>();

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  /* -- Qué plantillas hay ---------------------------------------------------*/

  protected readonly plantillas = signal<ViewState<readonly ChartTemplate[]>>(loading());
  protected readonly plantillaId = signal<string | null>(null);

  /**
   * La especialidad con la que se presenta quien atiende, como `conceptId`.
   *
   * Sale de su perfil profesional y es el mismo concepto del que cuelgan las
   * plantillas —los dos salen de `VS_MEDICAL_SPECIALTY`—, que es lo que hace
   * posible el match. `null` mientras no se sabe, o si la cuenta no tiene
   * perfil profesional.
   */
  private readonly especialidad = signal<string | null>(null);

  /** El catálogo tal como llegó, o vacío mientras no se sepa. */
  private readonly catalogo = computed<readonly ChartTemplate[]>(() => {
    const state = this.plantillas();
    return state.status === 'ready' ? state.data : [];
  });

  /**
   * El concepto de especialidad bajo el que cuelgan las plantillas
   * transversales, deducido del propio catálogo.
   *
   * **Por qué se deduce y no se codifica:** el concepto es un uuid de
   * `vs_medical_specialty` que se siembra por entorno; escribirlo acá sería un
   * literal mágico que caduca en la próxima base.
   *
   * **Por qué por prefijo y después por concepto:** el catálogo sembrado
   * nombra sus cuatro transversales `TRANSV_*` y las cuelga a todas del mismo
   * concepto (`TRANSVERSAL`, «todas las especialidades»). Con el prefijo se
   * encuentra **una** y de ella se saca el concepto; la pertenencia se decide
   * después por `specialtyConceptId`. El orden importa: clasificar fila por
   * fila con el prefijo dejaría afuera una plantilla que un admin arme sobre
   * esa misma especialidad sin respetar la convención de códigos, y esa
   * plantilla es transversal igual.
   */
  private readonly conceptoTransversal = computed<string | null>(() => {
    const sembrada = this.catalogo().find((plantilla) =>
      plantilla.code.startsWith(PREFIJO_TRANSVERSAL),
    );
    return sembrada?.specialtyConceptId ?? null;
  });

  /** Las fichas de la especialidad de quien atiende. Vacío si no se sabe cuál es. */
  private readonly plantillasPropias = computed<readonly ChartTemplate[]>(() => {
    const especialidad = this.especialidad();
    if (especialidad === null) return [];
    return this.catalogo().filter(
      (plantilla) =>
        plantilla.specialtyConceptId === especialidad &&
        plantilla.specialtyConceptId !== this.conceptoTransversal(),
    );
  });

  /** Las que sirven para cualquier consulta. Nunca se esconden. */
  private readonly plantillasTransversales = computed<readonly ChartTemplate[]>(() => {
    const concepto = this.conceptoTransversal();
    if (concepto === null) return [];
    return this.catalogo().filter((plantilla) => plantilla.specialtyConceptId === concepto);
  });

  /**
   * Lo que se le ofrece a quien atiende: primero lo suyo, después lo
   * transversal.
   *
   * Se cae al catálogo entero en dos casos, los dos por lo mismo —filtrar sin
   * criterio esconde más de lo que ayuda—:
   *
   * 1. **No se sabe la especialidad.** Una cuenta sin perfil profesional
   *    —recepción, administración— o un perfil que no respondió. Dejar sólo
   *    las transversales le escondería las 36 fichas de especialidad sin
   *    saber siquiera si le corresponden.
   * 2. **El filtro no deja nada.** Su especialidad no tiene ficha y el
   *    catálogo tampoco tiene transversales: un desplegable vacío sobre un
   *    catálogo que sí tiene fichas.
   */
  private readonly plantillasSugeridas = computed<readonly ChartTemplate[]>(() => {
    if (this.especialidad() === null) return this.catalogo();

    const sugeridas = [...this.plantillasPropias(), ...this.plantillasTransversales()];
    return sugeridas.length > 0 ? sugeridas : this.catalogo();
  });

  /** Si hay algo escondido, y por lo tanto algo que el interruptor pueda revelar. */
  protected readonly puedeVerTodas = computed(
    () => this.catalogo().length > this.plantillasSugeridas().length,
  );

  /**
   * El interruptor «Ver todas las especialidades». Apagado, manda el filtro.
   *
   * Arranca PRENDIDO a pedido explícito: el filtro por especialidad hacía que
   * la misma cuenta viera listas de tamaño distinto según qué perfil
   * profesional resolviera el backend, y eso se leía como un bug («en la Mac
   * salen más formularios»). Mientras no haya una forma de fijar esto como
   * preferencia real, mostrar todo por defecto es lo predecible.
   */
  protected readonly verTodas = signal(true);

  protected alternarVerTodas(activado: boolean): void {
    this.verTodas.set(activado);
  }

  private readonly plantillasVisibles = computed<readonly ChartTemplate[]>(() => {
    const visibles = this.verTodas() ? this.catalogo() : this.plantillasSugeridas();

    // Lo ya elegido no se escamotea: si alguien eligió una ficha de otra
    // especialidad con el interruptor puesto y después lo apaga, el
    // desplegable seguiría dibujando sus campos debajo mientras muestra el
    // placeholder. Se la deja en la lista hasta que elija otra cosa.
    const elegida = this.plantillaElegida();
    if (elegida !== null && !visibles.includes(elegida)) {
      return [elegida, ...visibles];
    }
    return visibles;
  });

  /**
   * Todo lo que se puede completar en el encuentro, en una sola lista.
   *
   * Las fijas primero —diagnóstico, hoja en blanco, procedimiento y
   * laboratorio— porque son las que sirven en cualquier consulta y enterrarlas
   * al final de cuarenta y cuatro fichas equivale a no tenerlas. Detrás, las
   * plantillas: la de la especialidad de quien atiende y las transversales.
   */
  protected readonly opcionesDePlantilla = computed<readonly SelectOption<string>[]>(() => [
    ...ENTRADAS_FIJAS,
    ...this.plantillasVisibles().map((plantilla) => ({
      value: plantilla.id,
      label: plantilla.name,
    })),
  ]);

  /** Está elegida la hoja en blanco, así que no se dibuja ninguna ficha. */
  protected readonly hojaLibre = computed(() => this.plantillaId() === PLANTILLA_HOJA_LIBRE);

  protected readonly esDiagnostico = computed(() => this.plantillaId() === BLOQUE_DIAGNOSTICO);

  protected readonly esAlergia = computed(() => this.plantillaId() === BLOQUE_ALERGIA);

  protected readonly esCirugia = computed(() => this.plantillaId() === BLOQUE_CIRUGIA);

  protected readonly esOdontologia = computed(() => this.plantillaId() === BLOQUE_ODONTOLOGIA);

  protected readonly esLaboratorio = computed(() => this.plantillaId() === BLOQUE_LABORATORIO);

  /**
   * Lo elegido es uno de los tres bloques que escriben por su cuenta.
   *
   * Se dibujan **antes** de la cadena de estados del motor de `forms` y no
   * dentro: diagnosticar no depende de que el catálogo de plantillas haya
   * cargado, ni de que este encuentro ya tenga una ficha respondida. Meterlos
   * bajo esa cadena habría dejado el diagnóstico inalcanzable justo después de
   * completar una ficha, que es cuando el modo lectura tapa el selector.
   */
  protected readonly bloquePropio = computed(
    () => this.esDiagnostico() || this.esCirugia() || this.esOdontologia() || this.esLaboratorio(),
  );

  /**
   * No hay ninguna plantilla cargada en el sistema. Es un problema de datos:
   * alguien tiene que sembrar el catálogo o crear una a mano.
   */
  protected readonly catalogoVacio = computed(
    () => this.plantillas().status === 'ready' && this.catalogo().length === 0,
  );

  /** El catálogo todavía viaja. Ni hay qué ofrecer ni hay nada que explicar. */
  protected readonly buscandoPlantillas = computed(() => this.plantillas().status === 'loading');

  /**
   * Por qué no se pudo traer el catálogo.
   *
   * Sin este estado, un `403` o una caída de red dejaban el formulario dibujado
   * y hueco —sin campos, sin selector y sin una palabra—, indistinguible de
   * «tu especialidad no tiene nada que completar». Un fallo de lectura se dice
   * y se ofrece reintentar; nunca se calla.
   */
  protected readonly errorDePlantillas = computed<string | null>(() => {
    const state = this.plantillas();
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite ver las plantillas de formulario.';
    }
    if (state.status === 'not-found') {
      return 'No encontramos el catálogo de plantillas.';
    }
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || 'No pudimos traerlas.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  /**
   * La especialidad de quien atiende todavía no tiene ficha propia **y hay
   * fichas generales para ofrecerle en su lugar**. No es un error: se completa
   * una general y se sigue.
   *
   * Las dos condiciones van juntas porque el aviso promete algo concreto. Si el
   * catálogo no tuviera ninguna transversal, {@link plantillasSugeridas} cae al
   * catálogo entero y no hay ninguna ficha general que ofrecer: avisar ahí sería
   * prometer una anamnesis que no existe.
   */
  protected readonly sinFichaPropia = computed(
    () =>
      this.especialidad() !== null &&
      this.plantillasPropias().length === 0 &&
      this.plantillasTransversales().length > 0,
  );

  protected readonly plantillaElegida = computed<ChartTemplate | null>(() => {
    const state = this.plantillas();
    if (state.status !== 'ready') return null;
    return state.data.find((t) => t.id === this.plantillaId()) ?? null;
  });

  /**
   * Si quien atiende ya eligió una plantilla a mano.
   *
   * La preselección por especialidad es una comodidad, no una regla: en cuanto
   * alguien elige, su elección manda y ninguna respuesta que llegue después la
   * pisa.
   */
  private readonly eleccionManual = signal(false);

  protected elegirPlantilla(id: string | null): void {
    this.eleccionManual.set(true);
    this.plantillaId.set(id);
    this.valores.set({});
  }

  constructor() {
    this.cargarPlantillas();
    this.resolverEspecialidad();
    // Cada vez que el expediente informa otro encuentro, se vuelve a preguntar
    // si ya tiene un formulario respondido.
    effect(() => {
      const encounterId = this.encounterId();
      untracked(() => this.consultarRespuesta(encounterId));
    });
  }

  protected recargarPlantillas(): void {
    this.cargarPlantillas();
  }

  private cargarPlantillas(): void {
    this.plantillas.set(loading());
    this.chartTemplates.listTemplates().subscribe({
      next: (lista) => {
        this.plantillas.set(ready(lista));
        this.preseleccionar();
      },
      error: (error: unknown) =>
        this.plantillas.set(errorToViewState<readonly ChartTemplate[]>(error)),
    });
  }

  /**
   * Pregunta con qué especialidad se presenta quien atiende.
   *
   * Falla en silencio a propósito: una cuenta sin perfil profesional —una
   * recepcionista, un administrador— no tiene especialidad y eso no es un
   * error que quepa contarle a nadie. Sin especialidad no hay preselección y
   * el selector sigue estando, que es como funcionaba hasta ahora.
   */
  private resolverEspecialidad(): void {
    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => {
        this.especialidad.set(especialidadVigente(perfil.specialties));
        this.preseleccionar();
      },
      error: () => this.especialidad.set(null),
    });
  }

  /**
   * La ficha general a la que se cae: la anamnesis si está, si no la primera
   * transversal que haya.
   */
  private readonly anamnesisGeneral = computed<ChartTemplate | undefined>(() => {
    const transversales = this.plantillasTransversales();
    return (
      transversales.find((plantilla) => plantilla.code === CODIGO_ANAMNESIS_GENERAL) ??
      transversales[0]
    );
  });

  /**
   * Elige la plantilla de la especialidad de quien atiende.
   *
   * Corre al llegar cada una de las dos respuestas —plantillas y perfil— sin
   * saber cuál llegó primero: la que falte deja la preselección para la otra.
   *
   * Nunca pisa una elección manual ni una plantilla ya fijada: la preselección
   * es una comodidad, no una regla.
   */
  private preseleccionar(): void {
    if (this.eleccionManual() || this.plantillaId() !== null) return;

    const state = this.plantillas();
    if (state.status !== 'ready') return;

    const propia = this.plantillasPropias()[0];
    if (propia !== undefined) {
      this.plantillaId.set(propia.id);
      return;
    }

    // Su especialidad no tiene ficha propia: la anamnesis general sirve para
    // cualquier consulta y es mejor que dejarlo buscándola entre 43 opciones.
    // Sólo cuando la especialidad se conoce: sin perfil profesional no hay a
    // quién caerle y el selector se ofrece entero, como siempre.
    if (this.especialidad() !== null) {
      const general = this.anamnesisGeneral();
      if (general !== undefined) {
        this.plantillaId.set(general.id);
        return;
      }
    }

    // Con una sola en el catálogo no hay nada que elegir.
    if (state.data.length === 1) {
      this.plantillaId.set(state.data[0].id);
    }
  }

  /* -- Lo ya respondido para este encuentro ----------------------------------*/

  /**
   * El formulario respondido del encuentro, si existe.
   *
   * `ready(null)` significa «se preguntó y no hay»: es también el estado
   * inicial, para que la captura no quede bloqueada mientras el efecto todavía
   * no corrió — si la consulta está en vuelo el estado es `loading` y el
   * formulario no se ofrece, así que la ventana de duplicado real la sigue
   * cerrando el `409` del backend.
   */
  protected readonly respondido = signal<ViewState<FormInstanceDetail | null>>(ready(null));

  protected readonly buscandoRespuesta = computed(() => this.respondido().status === 'loading');

  /** El detalle respondido, o `null` si no hay (o todavía no se sabe). */
  protected readonly formularioRespondido = computed<FormInstanceDetail | null>(() => {
    const state = this.respondido();
    return state.status === 'ready' || state.status === 'stale' ? state.data : null;
  });

  /**
   * Si la consulta falló, acá está el porqué. Mientras no se pueda saber si el
   * encuentro ya tiene formulario, la captura no se ofrece: fallar cerrado es
   * lo que evita el duplicado, no la suerte.
   */
  protected readonly errorDeConsulta = computed<string | null>(() => {
    const state = this.respondido();
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite ver formularios clínicos.';
    }
    if (state.status === 'not-found') {
      return 'No encontramos el encuentro de este formulario.';
    }
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || 'No pudimos revisarlo.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected reconsultarRespuesta(): void {
    this.consultarRespuesta(this.encounterId());
  }

  private consultarRespuesta(encounterId: string | null): void {
    if (encounterId === null || encounterId === '') {
      this.respondido.set(ready(null));
      return;
    }
    this.respondido.set(loading());
    this.forms
      .listInstancesByEncounter(encounterId)
      .pipe(
        switchMap((listado) =>
          listado.items.length === 0
            ? of<FormInstanceDetail | null>(null)
            : this.forms.getInstance(listado.items[0].id),
        ),
      )
      .subscribe({
        next: (detalle) => {
          // El encuentro pudo cambiar mientras la respuesta viajaba.
          if (this.encounterId() !== encounterId) return;
          this.respondido.set(ready(detalle));
        },
        error: (error: unknown) => {
          if (this.encounterId() !== encounterId) return;
          this.respondido.set(errorToViewState<FormInstanceDetail | null>(error));
        },
      });
  }

  /* -- Cómo se lee lo respondido ---------------------------------------------*/

  protected readonly marcadorEnmascarado = VALOR_ENMASCARADO;

  /** Todos los campos conocidos por las plantillas, para ponerle nombre a cada valor. */
  private readonly camposConocidos = computed<ReadonlyMap<string, ChartTemplateField>>(() => {
    const state = this.plantillas();
    const campos = new Map<string, ChartTemplateField>();
    if (state.status !== 'ready') return campos;
    for (const plantilla of state.data) {
      for (const campo of plantilla.fields) {
        if (!campos.has(campo.fieldId)) campos.set(campo.fieldId, campo);
      }
    }
    return campos;
  });

  /**
   * La plantilla de la que salió la respuesta, inferida por cobertura de
   * campos: la instancia no declara su plantilla, así que gana la que más
   * `fieldId` de los valores contiene. Con el dato real —una plantilla por
   * especialidad— la inferencia es exacta; si nada matchea, el título cae al
   * genérico.
   */
  protected readonly plantillaDeLaRespuesta = computed<ChartTemplate | null>(() => {
    const detalle = this.formularioRespondido();
    const state = this.plantillas();
    if (detalle === null || state.status !== 'ready') return null;

    const respondidos = new Set(detalle.values.map((valor) => valor.fieldId));
    let mejor: ChartTemplate | null = null;
    let mejorCobertura = 0;
    for (const plantilla of state.data) {
      const cobertura = plantilla.fields.filter((campo) => respondidos.has(campo.fieldId)).length;
      if (cobertura > mejorCobertura) {
        mejor = plantilla;
        mejorCobertura = cobertura;
      }
    }
    return mejor;
  });

  protected readonly tituloDeLaRespuesta = computed(
    () => this.plantillaDeLaRespuesta()?.name ?? 'Formulario clínico',
  );

  /** Cuándo quedó completado, en palabras. El cierre manda; si no, la creación. */
  protected readonly fechaDeRespuesta = computed<string | null>(() => {
    const detalle = this.formularioRespondido();
    if (detalle === null) return null;
    const iso = detalle.closedAt ?? detalle.createdAt;
    const fecha = new Date(iso);
    return Number.isNaN(fecha.getTime()) ? null : FORMATO_FECHA.format(fecha);
  });

  protected readonly respuestasVisibles = computed<readonly RespuestaVisible[]>(() => {
    const detalle = this.formularioRespondido();
    if (detalle === null) return [];
    const campos = this.camposConocidos();
    return [...detalle.values]
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((valor) => {
        const campo = campos.get(valor.fieldId);
        return {
          id: valor.id,
          etiqueta: campo?.name ?? 'Campo del formulario',
          texto: valor.masked
            ? // El marcador lo pone la vista; acá jamás viaja el contenido.
              ''
            : textoDeValor(valor.value, valor.dataType ?? campo?.dataType),
          masked: valor.masked,
        };
      });
  });

  /** Descarga el formulario respondido con el motor PDF compartido. */
  protected descargarPdf(): void {
    const detalle = this.formularioRespondido();
    if (detalle === null) return;
    const cierre = detalle.closedAt === undefined ? undefined : new Date(detalle.closedAt);
    downloadFormResponsePdf({
      id: detalle.id,
      titulo: this.tituloDeLaRespuesta(),
      completadoEl: cierre !== undefined && !Number.isNaN(cierre.getTime()) ? cierre : undefined,
      respuestas: this.respuestasVisibles().map((respuesta) => ({
        etiqueta: respuesta.etiqueta,
        texto: respuesta.texto,
        masked: respuesta.masked,
      })),
    });
  }

  /* -- Los valores del formulario elegido ------------------------------------*/

  /** Los valores capturados, por `fieldId`. Se reinician al cambiar de plantilla. */
  protected readonly valores = signal<Readonly<Record<string, unknown>>>({});

  protected actualizarValor(fieldId: string, valor: unknown): void {
    this.valores.update((actuales) => ({ ...actuales, [fieldId]: valor }));
  }

  /* -- Leer el valor de un campo, tipado para el control que lo dibuja ------ */

  protected valorTexto(fieldId: string): string {
    const valor = this.valores()[fieldId];
    return typeof valor === 'string' ? valor : '';
  }

  protected valorNumero(fieldId: string): number | null {
    const valor = this.valores()[fieldId];
    return typeof valor === 'number' ? valor : null;
  }

  /**
   * El sí/no de un campo, como lo entiende el control de dos botones.
   *
   * `''` es «todavía sin responder», y es por lo que el control existe: una
   * casilla marcada dice «sí» y desmarcada no dice nada, así que en una ficha
   * clínica «contestó que no» y «no se preguntó» se guardaban igual. Lo pidió
   * el propietario para los formularios, y es la misma corrección que ya se
   * hizo en el alta de agenda.
   */
  protected valorSiNo(fieldId: string): 'si' | 'no' | '' {
    const valor = this.valores()[fieldId];
    if (valor === true) return 'si';
    if (valor === false) return 'no';
    return '';
  }

  protected responderSiNo(fieldId: string, valor: 'si' | 'no' | ''): void {
    if (valor === '') return;
    this.actualizarValor(fieldId, valor === 'si');
  }

  protected valorFecha(fieldId: string): Date | null {
    const valor = this.valores()[fieldId];
    return valor instanceof Date ? valor : null;
  }

  /** Cómo dibujar un campo, a partir de su `dataType`. Lo no reconocido cae a texto. */
  protected tipoDibujable(dataType: string): TipoDibujable {
    if (
      dataType === 'boolean' ||
      dataType === 'integer' ||
      dataType === 'decimal' ||
      dataType === 'date'
    ) {
      return dataType;
    }
    return 'string';
  }

  /* -- El odontograma ------------------------------------------------------ */

  /**
   * Si un campo es EL odontograma.
   *
   * Se reconoce por el sufijo de su código y no por el `dataType`: `json` es
   * el tipo de todo lo que no cabe en una columna, y dibujar una boca sobre
   * cualquier objeto sería adivinar. El catálogo del backend sólo admite `json`
   * para los códigos que tienen un control como éste.
   */
  protected esOdontograma(campo: ChartTemplateField): boolean {
    return campo.code.endsWith(`.${CODIGO_ODONTOGRAMA}`);
  }

  /** El mapa de piezas que hay cargado, o vacío. */
  protected mapaDental(fieldId: string): MapaDental {
    const valor = this.valores()[fieldId];
    return esMapa(valor) ? (valor as MapaDental) : {};
  }

  /** La pieza sobre la que está abierto el panel de estados, por campo. */
  protected readonly piezaAbierta = signal<string | null>(null);

  protected readonly estadosDentales = ESTADOS_DENTALES;

  protected abrirPieza(fdi: string): void {
    this.piezaAbierta.set(this.piezaAbierta() === fdi ? null : fdi);
  }

  /**
   * Fija el estado de la pieza abierta, o lo borra si se vuelve a elegir el
   * mismo: es la forma de deshacer sin un botón aparte.
   */
  protected fijarEstado(fieldId: string, codigo: string): void {
    const fdi = this.piezaAbierta();
    if (fdi === null) return;

    const mapa = { ...this.mapaDental(fieldId) };
    if (mapa[fdi] === codigo) {
      delete mapa[fdi];
    } else {
      mapa[fdi] = codigo;
    }

    this.actualizarValor(fieldId, mapa);
    this.piezaAbierta.set(null);
    this.sugerirIndices(mapa);
  }

  /**
   * Rellena los conteos del CPO-D desde el odontograma.
   *
   * Sugiere, no impone: sólo escribe sobre un campo vacío o sobre su propia
   * sugerencia anterior, así que un número tecleado a mano nunca se pisa. Es
   * el mismo trato que la cantidad a dispensar de la receta.
   */
  private sugerirIndices(mapa: MapaDental): void {
    const plantilla = this.plantillaElegida();
    if (plantilla === null) return;

    const recuento = recuentoCpod(mapa);
    const porCodigo: Readonly<Record<string, number>> = {
      dientes_cariados: recuento.cariados,
      dientes_perdidos: recuento.perdidos,
      dientes_obturados: recuento.obturados,
      indice_cpod: recuento.cpod,
    };

    for (const campo of plantilla.fields) {
      const codigo = campo.code.split('.').pop() ?? '';
      const sugerido = porCodigo[codigo];
      if (sugerido === undefined) continue;

      const actual = this.valores()[campo.fieldId];
      const anterior = this.ultimoSugerido.get(campo.fieldId);
      if (!esVacio(actual) && actual !== anterior) continue;

      this.actualizarValor(campo.fieldId, sugerido);
      this.ultimoSugerido.set(campo.fieldId, sugerido);
    }
  }

  /** Lo último que se sugirió por campo, para distinguirlo de lo tecleado. */
  private readonly ultimoSugerido = new Map<string, number>();

  private readonly camposObligatoriosCompletos = computed(() => {
    const plantilla = this.plantillaElegida();
    if (!plantilla) return false;
    const valores = this.valores();
    return plantilla.fields.filter((f) => f.required).every((f) => !esVacio(valores[f.fieldId]));
  });

  protected readonly puedeCompletar = computed(
    () =>
      this.hayEncuentro() &&
      // Con un formulario ya respondido —o sin saberlo todavía— no se ofrece
      // otro: el modo lectura reemplaza a la captura.
      this.formularioRespondido() === null &&
      !this.buscandoRespuesta() &&
      this.plantillaElegida() !== null &&
      this.camposObligatoriosCompletos() &&
      !this.enviando(),
  );

  /* -- El cierre de la ficha (D4) ------------------------------------------ */

  /** Lo último que eligió quien atiende en el bloque de cierre. */
  protected readonly cierre = signal<CierreDelFormulario>(SIN_CIERRE);

  /**
   * Lo que no se pudo registrar después de guardar la ficha, en palabras.
   *
   * Persiste más que el toast a propósito: la ficha ya quedó guardada y el
   * bloque pasa a lectura; lo que faltó tiene que seguir a la vista para que
   * se registre desde su casilla.
   */
  protected readonly fallosDelCierre = signal<readonly string[]>([]);

  /**
   * Las preguntas de la ficha con lo respondido, en palabras, para la IA.
   *
   * Sólo lo respondido, y nunca el odontograma: es un mapa de piezas, no una
   * respuesta que se pueda leer.
   */
  protected readonly respuestasParaLaIa = computed<readonly RespuestaDeFormulario[]>(() => {
    const plantilla = this.plantillaElegida();
    if (plantilla === null) return [];
    const valores = this.valores();
    return plantilla.fields.flatMap((campo) => {
      const valor = valores[campo.fieldId];
      if (esVacio(valor) || esMapa(valor)) return [];
      return [{ question: campo.name, answer: textoDeValor(valor, campo.dataType) }];
    });
  });

  /* -- Completar ---------------------------------------------------------- */

  protected readonly enviando = signal(false);
  protected readonly resultado = signal<ViewState<null>>(ready(null));

  /**
   * El aviso del duplicado — mismo criterio que el diagnóstico: no es un
   * error, es la plantilla ya completada para este encuentro.
   */
  protected readonly avisoDeDuplicado = computed<string | null>(() => {
    const state = this.resultado();
    if (state.status === 'validation' && state.issues.some((issue) => issue.code === 'CONFLICT')) {
      return 'Esta plantilla ya se completó para este encuentro.';
    }
    return null;
  });

  protected readonly errorDeCompletado = computed<string | null>(() => {
    if (this.avisoDeDuplicado() !== null) return null;

    const state = this.resultado();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite completar formularios clínicos.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  protected completar(): void {
    const encounterId = this.encounterId();
    const plantilla = this.plantillaElegida();
    if (encounterId === null || plantilla === null || !this.puedeCompletar()) {
      return;
    }

    const values = this.valoresParaEnviar(plantilla);
    if (values.length === 0) {
      return;
    }

    this.enviando.set(true);
    this.resultado.set(loading());
    this.fallosDelCierre.set([]);
    const pasos = this.pasosDelCierre(plantilla, encounterId);
    // `custodianTenantId` es obligatorio en los dos DTO y no se deduce del
    // paciente: es quién responde por el registro, y eso lo eligió la sesión.
    // Sin organización la ficha se guarda igual; el cierre no, y se dice.
    const impedimento =
      pasos.length > 0 && this.auth.activeTenantId() === null
        ? 'Elegí una organización en el encabezado para registrar el cierre.'
        : null;

    this.forms
      .openInstance({ resourceId: encounterId })
      .pipe(
        switchMap((instancia) =>
          this.forms.captureValues(instancia.id, values).pipe(
            switchMap(() => this.forms.closeInstance(instancia.id)),
            // Se avisa acá y no al final: la ficha ya está guardada aunque lo
            // que sigue falle, y el orden de los avisos es el de los hechos.
            tap(() =>
              this.toasts.success(
                `«${plantilla.name}» quedó guardada en la ficha.`,
                'Formulario completado',
              ),
            ),
          ),
        ),
        // Las altas del cierre corren después de cerrar la ficha; un fallo
        // ahí no la deshace y no llega como error: llega como lista de lo
        // que faltó.
        switchMap(() =>
          impedimento === null
            ? this.ejecutarEnOrden(pasos)
            : of(this.frenados(pasos, impedimento)),
        ),
      )
      .subscribe({
        next: (fallos) => {
          this.enviando.set(false);
          this.resultado.set(ready(null));
          this.valores.set({});
          this.cierre.set(SIN_CIERRE);
          this.fallosDelCierre.set(fallos);
          this.cambio.emit();
          // Lo recién guardado se relee del backend y el bloque pasa a lectura.
          this.consultarRespuesta(encounterId);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.resultado.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Las altas que el cierre pide, en el orden en que se registran: primero el
   * diagnóstico tentativo, después la orden de análisis. Ninguna es
   * obligatoria; sin nada elegido la lista es vacía y la ficha se completa
   * como siempre.
   */
  private pasosDelCierre(plantilla: ChartTemplate, encounterId: string): PasoDelCierre[] {
    const { diagnostico, orden } = this.cierre();
    const patientProfileId = this.patientProfileId();
    // Sin organización ningún paso llega a ejecutarse (ver `completar`).
    const custodianTenantId = this.auth.activeTenantId() ?? '';
    const pasos: PasoDelCierre[] = [];

    if (diagnostico !== null) {
      pasos.push({
        nombre: 'el diagnóstico tentativo',
        titulo: 'Diagnóstico tentativo registrado',
        exito: 'Nace presuntivo: confirmalo o rechazalo en la casilla «Diagnóstico».',
        ejecutar: () =>
          this.clinical.createCondition({
            custodianTenantId,
            patientProfileId,
            codeConceptId: diagnostico,
            encounterId,
            noteText: `Del formulario «${plantilla.name}»`,
          }),
      });
    }
    if (orden !== null) {
      pasos.push({
        nombre: 'la orden de análisis',
        titulo: 'Orden de análisis pedida',
        exito: 'Quedó en la casilla «Orden de análisis» de esta consulta.',
        ejecutar: () =>
          this.diagnostics.requestStudy({
            custodianTenantId,
            patientProfileId,
            codeConceptId: orden.codeConceptId,
            encounterId,
            category: orden.category,
            ...(orden.categoryConceptId === undefined
              ? {}
              : { categoryConceptId: orden.categoryConceptId }),
          }),
      });
    }
    return pasos;
  }

  /** Nada del cierre se intentó, por un motivo que vale para todos los pasos. Avisado una vez. */
  private frenados(pasos: readonly PasoDelCierre[], motivo: string): readonly string[] {
    this.toasts.error(motivo, 'La ficha quedó guardada, pero no todo el cierre');
    return pasos.map((paso) => `No se registró ${paso.nombre}: ${motivo}`);
  }

  /**
   * Corre las altas una detrás de otra y devuelve lo que falló, en palabras.
   *
   * Un paso que falla **frena los siguientes** —pedir una orden cuando el
   * diagnóstico que la motiva no se registró es escribir a medias— pero no
   * deshace nada: lo hecho, hecho está, y cada cosa que faltó se nombra para
   * que se registre desde su casilla. Nunca falla hacia arriba: la ficha ya
   * quedó guardada y eso no se cuenta como error.
   */
  private ejecutarEnOrden(pasos: readonly PasoDelCierre[]): Observable<readonly string[]> {
    const [primero, ...resto] = pasos;
    if (primero === undefined) return of([]);
    return primero.ejecutar().pipe(
      tap(() => this.toasts.success(primero.exito, primero.titulo)),
      switchMap(() => this.ejecutarEnOrden(resto)),
      catchError((error: unknown) => of(this.fallosDesde(primero, resto, error))),
    );
  }

  /** El fallo de un paso y los que no se intentaron por su culpa, ya avisados. */
  private fallosDesde(
    paso: PasoDelCierre,
    siguientes: readonly PasoDelCierre[],
    error: unknown,
  ): readonly string[] {
    const estado = errorToViewState<null>(error);
    const motivo =
      estado.status === 'validation'
        ? estado.issues.map((issue) => issue.message).join(' ')
        : (mensajeDeFalloDeEscritura(estado, { accion: `registrar ${paso.nombre}` }) ?? '');
    const mensaje = `No se registró ${paso.nombre}${motivo === '' ? '.' : `: ${motivo}`}`;
    this.toasts.error(mensaje, 'La ficha quedó guardada, pero no todo el cierre');
    return [
      mensaje,
      ...siguientes.map(
        (siguiente) => `No se registró ${siguiente.nombre}: se frenó por el fallo anterior.`,
      ),
    ];
  }

  private valoresParaEnviar(plantilla: ChartTemplate): FieldValueInput[] {
    const valores = this.valores();
    const entradas: FieldValueInput[] = [];
    for (const [ordinal, campo] of plantilla.fields.entries()) {
      const crudo = valores[campo.fieldId];
      if (esVacio(crudo)) {
        continue;
      }
      entradas.push({
        fieldId: campo.fieldId,
        dataType: campo.dataType,
        value: crudo instanceof Date ? crudo.toISOString() : crudo,
        assignmentId: campo.assignmentId,
        ordinal,
      });
    }
    return entradas;
  }
}

function esVacio(valor: unknown): boolean {
  return (
    valor === undefined ||
    valor === null ||
    valor === '' ||
    // Un odontograma sin ninguna pieza tocada es un mapa vacío: es «no lo
    // llené», no un dato. Sin esto viajaría un `{}` y contaría como respuesta.
    (esMapa(valor) && Object.keys(valor).length === 0)
  );
}

/** Si el valor es un objeto plano —el mapa del odontograma, hoy—. */
function esMapa(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !(valor instanceof Date);
}

/**
 * La especialidad con la que un profesional se presenta.
 *
 * La primaria vigente si la hay; si no, la primera vigente.
 *
 * **Vigente es una ventana, no una bandera** —mismo criterio que la matrícula
 * que firma el papel en el expediente—: sin `validTo` no caduca, y con
 * `validTo` en el futuro sigue ejerciendo. Tratar toda especialidad con fecha
 * de vencimiento como abandonada le escondería su propia ficha justo a quien
 * tiene la certificación en regla —una recertificación real declara hasta
 * cuándo vale—, y lo dejaría completando la anamnesis general. Vencida sí se
 * descarta: no debería decidir qué ficha se le ofrece hoy.
 */
function especialidadVigente(especialidades: readonly PractitionerSpecialty[]): string | null {
  const ahora = Date.now();
  const vigentes = especialidades.filter((especialidad) =>
    dentroDeLaVentana(especialidad.validFrom, especialidad.validTo, ahora),
  );
  const principal = vigentes.find((especialidad) => especialidad.isPrimary);
  return (principal ?? vigentes[0])?.specialtyConceptId ?? null;
}

/**
 * Si una vigencia declarada cubre el instante dado.
 *
 * Los dos extremos son opcionales y la ausencia de cada uno significa «no
 * empieza» y «no termina», que es cómo el contrato declara sus ventanas.
 */
function dentroDeLaVentana(
  desde: Date | undefined,
  hasta: Date | undefined,
  instante: number,
): boolean {
  if (desde !== undefined && desde.getTime() > instante) {
    return false;
  }
  return hasta === undefined || hasta.getTime() > instante;
}
