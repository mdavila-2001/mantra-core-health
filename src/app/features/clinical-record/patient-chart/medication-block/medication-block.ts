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
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import {
  listaDeTextos,
  valorDeTexto,
} from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AttachmentUploader } from '../../../../shared/components/organisms/attachment-uploader/attachment-uploader';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Menu } from '../../../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../../../shared/components/molecules/menu/menu-item/menu-item';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { MenuTrigger } from '../../../../shared/components/molecules/menu/menu-trigger/menu-trigger';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';

/**
 * La columna que gobierna el medicamento.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica, y es
 * lo que hace que el día que el binding se declare esta pantalla funcione sin
 * tocar una línea.
 */
export const TARGET_MEDICAMENTO = 'clinical.medication_requests.medication_concept_id';

/**
 * El valor con el que el selector dice «lo escribo yo».
 *
 * No es un identificador de nada: es la marca que destraba el campo de texto.
 * Empieza y termina con guiones bajos para que no pueda confundirse jamás con
 * un uuid de condición.
 */
const OTRO_MOTIVO = '__otro_motivo__';

/** La vía de administración. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_VIA = 'clinical.medication_requests.route_concept_id';

/**
 * Las vías en castellano, por código estable.
 *
 * El catálogo trae su `display` en inglés técnico porque es terminología, no
 * copy de producto, y mapear por **código** —no por uuid— es lo que permite
 * traducir sin atarse a un identificador que un re-seed puede mover.
 */
const ETIQUETAS_DE_VIA: Readonly<Record<string, string>> = {
  ROUTE_ORAL: 'Oral',
  ROUTE_IV: 'Intravenosa',
  ROUTE_IM: 'Intramuscular',
  ROUTE_SC: 'Subcutánea',
  ROUTE_TOP: 'Tópica',
  ROUTE_INH: 'Inhalatoria',
};

/** Largo máximo de los dos textos libres. El backend no los acota; la legibilidad sí. */
const TOPE_DEL_TEXTO = 200;

/** Resultados que devuelve la búsqueda de medicamentos. */
const TOPE_DE_LA_BUSQUEDA = 20;

/**
 * Las propiedades del vademécum que la receta ofrece como listas.
 *
 * Son códigos del catálogo, no invención de esta pantalla: los publica el
 * sistema de codificación en la ficha del concepto. Un medicamento que no las
 * declare —los del enum básico, por ejemplo— cae al campo de dosis en texto.
 */
const PROPIEDAD_PRESENTACIONES = 'dose_forms';
const PROPIEDAD_CONCENTRACIONES = 'strengths';
const PROPIEDAD_FRECUENCIA_POR_DEFECTO = 'default_frequency';

/**
 * Un diagnóstico de la persona, ya traducido, para elegirlo como indicación.
 *
 * Baja del expediente hecho —`id` y palabras— por lo mismo que las recetas: acá
 * no hay mapa de etiquetas ni petición de terminología que valga la pena
 * duplicar, y la lista ya está cargada del otro lado.
 */
export interface DiagnosticoEnFicha {
  /** El `clinical.conditions.id`, que es lo que viaja como indicación. */
  readonly id: string;
  /** El diagnóstico en palabras. Nunca el uuid del concepto. */
  readonly etiqueta: string;
}

/** Una receta del expediente, ya sin uuid y con su ciclo resuelto. */
export interface RecetaEnFicha {
  readonly id: string;
  /** El medicamento en palabras. Nunca el uuid del concepto. */
  readonly medicamento: string;
  /** Dosis y frecuencia, tal como se escribieron. */
  readonly indicacion: string;
  readonly estado: string;
  readonly firmada: boolean;
  readonly emitida: boolean;
}

/**
 * **Medicación** del expediente: prescribir, firmar y emitir — V08-01.
 *
 * ## Por qué es un componente y no más líneas en el expediente
 *
 * Porque la receta tiene su propio ciclo —borrador, firma, emisión— con tres
 * llamadas, un formulario y un camino de error que no se parece a ningún otro
 * de la pantalla. Metido en `PatientChart` habría duplicado el estado de
 * escritura del encuentro y mezclado dos avisos que compiten por el mismo
 * rincón. Aparte, además, deja la plantilla del expediente casi intacta, que
 * es lo que permite que otro carril agregue sus bloques sin pelearse por el
 * mismo archivo.
 *
 * ## Vive dentro del encuentro abierto
 *
 * El recorrido de quien atiende es check-in → ficha → recetar ahí mismo. Sin
 * encuentro en curso el bloque no ofrece el formulario: `encounterId` es
 * opcional en el contrato, pero una receta suelta —sin la consulta que la
 * motivó— es un dato que después nadie sabe explicar.
 *
 * ## El medicamento se busca en el catálogo, no se despliega
 *
 * `medicationConceptId` es obligatorio y sale del catálogo de terminología. Se
 * elige con un buscador y no con un desplegable porque un vademécum no es una
 * lista corta para desplegar entera, y porque un desplegable sólo puede ofrecer
 * la expansión de **un** conjunto de valores: los medicamentos viven en varios
 * sistemas de codificación y el que interesa es el que la organización haya
 * publicado. Sigue sin haber texto libre —lo que se guarda es el `conceptId` de
 * lo elegido—, que es la garantía que importa.
 *
 * ## El catálogo puede completar la dosis sin reemplazarla
 *
 * Al elegir se lee la ficha del concepto: si publica `dose_forms` y `strengths`
 * —como hace el vademécum—, presentación y concentración se pueden elegir para
 * completar el texto. La dosis siempre queda visible y editable: el texto que
 * confirma quien prescribe es el único que viaja en `doseText`.
 *
 * ## El binding del catálogo se verifica antes de ofrecer nada
 *
 * El bloque comprueba que la columna del medicamento tenga su enumeración
 * declarada antes de mostrar el formulario. Se conserva tal cual estaba: es la
 * señal de que el catálogo clínico está publicado en esta instalación, y sin él
 * las vías y unidades tampoco tendrían opciones que ofrecer.
 *
 * ## El `422` de emitir sin firmar es un paso que falta, no un error
 *
 * Con la política de firma D-05 vigente, emitir una receta sin firmar responde
 * `422 PRECONDITION_FAILED` (la `PreconditionFailedException` del proyecto es
 * 422, **no** 412). Se muestra como aviso de precondición y con la salida al
 * lado —el botón de firmar—, no como un error rojo: el sistema no falló, falta
 * un acto que quien receta tiene que hacer.
 *
 * ## La indicación diagnóstica es opcional y sale de la ficha
 *
 * `indicationConditionId` (Patch v4.1.6) dice **para qué es** la receta. Los
 * diagnósticos bajan por input desde el expediente —ya cargados y traducidos—
 * en vez de pedirse otra vez: son los mismos que la pestaña de diagnósticos
 * pinta, y dos lecturas de la misma lista pueden discrepar. Es opcional de
 * verdad: una receta sintomática o profiláctica no tiene diagnóstico detrás y
 * se guarda igual, así que la opción vacía existe y es la de arranque.
 *
 * ## Después de cada acción se relee
 *
 * Nada de mutar la lista en memoria. Las tres escrituras devuelven el estado
 * nuevo, pero la lista sale de `GET /clinical/patients/:id/summary`, y el
 * bloque avisa al expediente para que vuelva a leer. Una receta que aparece
 * porque la pintamos nosotros y no porque el servidor la tenga es exactamente
 * la clase de mentira que el expediente no puede permitirse.
 */
@Component({
  selector: 'app-medication-block',
  imports: [
    Alert,
    AppButton,
    AppInput,
    Card,
    AttachmentUploader,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    Menu,
    MenuItem,
    NavIcon,
    MenuTrigger,
    ReferenceCombobox,
    Select,
    StatusSeal,
    Textarea,
  ],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => MedicationBlock) }],
  templateUrl: './medication-block.html',
  styleUrl: './medication-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationBlock implements DraftBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
  readonly encounterId = input<string | null>(null);

  /** Las recetas de la persona, ya traducidas por el expediente. */
  readonly recetas = input.required<readonly RecetaEnFicha[]>();

  /**
   * Los diagnósticos de la persona, para elegir la indicación (Patch v4.1.6).
   *
   * Bajan traducidos del expediente —que ya los leyó para su pestaña— y no se
   * vuelven a pedir: son la misma lista, y dos lecturas de la misma lista
   * pueden discrepar. Por defecto vacío: sin diagnósticos registrados el
   * selector no se ofrece, y la receta se guarda igual porque el campo es
   * opcional en el contrato.
   */
  readonly diagnosticos = input<readonly DiagnosticoEnFicha[]>([]);

  /**
   * Las citas del paciente, para elegir de qué consulta es la receta.
   *
   * Mismo criterio que el bloque de diagnóstico: el contrato acepta
   * `encounterId` desde siempre y lo que faltaba era ofrecerlo. Vacío es un
   * estado legítimo —se entra al expediente sin pasar por la agenda— y entonces
   * el campo no se dibuja: un desplegable de una sola opción vacía es una
   * pregunta que no existe.
   */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /**
   * Si el bloque exige un encuentro **abierto** para dejar prescribir.
   *
   * `true` en «Atención», que es donde el encuentro es el contexto y donde
   * sigue valiendo la regla de siempre: una receta suelta, sin la consulta que
   * la motivó, es un dato que después nadie sabe explicar.
   *
   * `false` en el expediente, y no es la misma cosa con la guardia baja: ahí la
   * receta se ata a una cita **elegida** de las que la persona ya tiene —
   * incluidas las finalizadas—, que es el caso que el cliente pidió por nombre.
   * Lo que se relaja es «el encuentro tiene que estar abierto ahora», no «la
   * receta tiene consulta detrás».
   */
  readonly exigeEncuentro = input(true);

  /**
   * Los `medicationConceptId` de la medicación ya registrada, sin traducir.
   *
   * Es lo que {@link recetar} manda junto con el nuevo medicamento a
   * `POST /cds/check-interactions`: el motor compara sustancias, no texto, así
   * que necesita el uuid del concepto y no el `medicamento` en palabras que
   * usa {@link recetas}. Por defecto vacío — sin medicación previa no hay
   * contra qué comparar, y el chequeo se salta.
   */
  readonly medicacionActivaConceptIds = input<readonly string[]>([]);

  /**
   * Algo se escribió y el expediente tiene que releerse.
   *
   * Un solo aviso para las tres escrituras: lo que cambia es siempre el mismo
   * bloque, y quien lo recibe hace lo mismo en los tres casos.
   */
  readonly cambio = output<void>();

  /**
   * Se pidió la receta en papel (corrección #16).
   *
   * El bloque **no arma el documento**: avisa cuál se pidió y el expediente lo
   * construye desde los datos que la API devolvió. Acá las recetas llegan ya
   * traducidas y sin fechas, así que armarlo desde este lado obligaría a
   * duplicar el modelo o a leer la pantalla — y un PDF que sale de leer la
   * pantalla dice lo que la pantalla muestra, no lo que está registrado.
   */
  readonly descargar = output<RecetaEnFicha>();

  protected readonly topeDelTexto = TOPE_DEL_TEXTO;
  protected readonly targetMedicamento = TARGET_MEDICAMENTO;
  protected readonly targetVia = TARGET_VIA;
  protected readonly etiquetasDeVia = ETIQUETAS_DE_VIA;

  /** Atajos existentes, sin una pauta seleccionada por defecto. */
  protected readonly opcionesFrecuenciaRapida: readonly SelectOption<string>[] = [
    { value: 'Cada 8 horas', label: 'Cada 8 horas' },
    { value: 'Cada 12 horas', label: 'Cada 12 horas' },
    { value: 'Cada 24 horas (1 vez al día)', label: 'Cada 24 horas (1 vez al día)' },
    { value: 'Cada 6 horas', label: 'Cada 6 horas' },
    { value: 'En ayunas', label: 'En ayunas' },
    { value: 'Antes de dormir', label: 'Antes de dormir' },
    { value: 'Según necesidad (SOS)', label: 'Según necesidad (SOS)' },
  ];

  /** Opciones de duración rápida del tratamiento. */
  protected readonly opcionesDuracionRapida: readonly SelectOption<number | 'continuo'>[] = [
    { value: 3, label: '3 días' },
    { value: 5, label: '5 días' },
    { value: 7, label: '7 días' },
    { value: 10, label: '10 días' },
    { value: 14, label: '14 días' },
    { value: 30, label: '30 días' },
    { value: 'continuo', label: 'Crónico / Continuo' },
  ];

  /**
   * La organización bajo la que se receta.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente:
   * es quién responde por el registro, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly medicamento = signal<string | null>(null);
  protected readonly dosis = signal('');
  protected readonly frecuencia = signal('');
  /** El concepto cuya ficha escribió la sugerencia vigente, nunca texto manual. */
  private readonly frecuenciaSugeridaPara = signal<string | null>(null);
  /** El control numérico devuelve texto: se convierte al enviar, no al teclear. */
  protected readonly cantidad = signal<string | number | null>('');
  protected readonly via = signal<string | null>(null);

  /* -- Vigencia y duración estructurada ------------------------------------- */

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);
  protected readonly duracionDias = signal<number | null>(null);
  protected readonly esCronico = signal(false);
  protected readonly duracionRapidaElegida = signal<number | 'continuo' | null>(null);

  /** Indicaciones al paciente. Viajan como `patientInstructionsText` (v4.1.3). */
  protected readonly indicacionesPaciente = signal<string>('');

  /**
   * El diagnóstico que motiva la receta, o `null` — «para qué es» (v4.1.6).
   *
   * `null` es un valor legítimo y el de arranque, no un formulario a medio
   * llenar: hay recetas sintomáticas y profilácticas, y obligar a elegir una
   * condición para ellas empujaría a poner cualquiera.
   */
  protected readonly indicacion = signal<string | null>(null);

  /**
   * Las opciones del selector de indicación: los diagnósticos de la historia,
   * la vacía, y la salida para escribir uno propio.
   *
   * La salida la pidió el cliente por su caso: «puede existir el caso que sólo
   * se fue a hacer recetar y no necesitaría diagnóstico existente previo, sobre
   * todo casos psiquiátricos».
   */
  protected readonly opcionesDeIndicacion = computed<readonly SelectOption<string | null>[]>(
    () => [
      { value: null, label: 'Sin diagnóstico asociado' },
      ...this.diagnosticos().map((dx) => ({ value: dx.id, label: dx.etiqueta })),
      { value: OTRO_MOTIVO, label: 'Otro motivo — escribirlo' },
    ],
  );

  /** El motivo escrito a mano cuando no se eligió un diagnóstico. */
  protected readonly motivoLibre = signal('');

  /* -- Adjuntos de la receta ------------------------------------------------ */

  /**
   * La receta recién prescrita, para ofrecerle adjuntos.
   *
   * «En todos los formularios debe de poderse poner un adjunto… **incluso en la
   * medicación**, para referencias o relaciones», textual del cliente. Sólo
   * puede ofrecerse después de guardar: el vínculo necesita el identificador.
   */
  protected readonly recetaRecienCreada = signal<string | null>(null);

  /** El vínculo pasa por `clinical`, no por el genérico de `common`. */
  protected readonly enlazarAdjuntoALaReceta = (fileId: string, requestId: string) =>
    this.clinical.attachFileToMedicationRequest(requestId, fileId);

  protected cerrarAdjuntosDeLaReceta(): void {
    this.recetaRecienCreada.set(null);
  }

  /** Si no hay diagnóstico asociado, el motivo puede escribirse libremente. */
  protected readonly motivoEsLibre = computed(
    () => this.indicacion() === null || this.indicacion() === OTRO_MOTIVO,
  );

  /**
   * Guarda la indicación elegida, y limpia el texto al elegir un diagnóstico.
   *
   * Mismo criterio que la ocupación del alta: un motivo a mano que ya no
   * describe nada no debe viajar.
   */
  protected elegirIndicacion(valor: string | null): void {
    this.indicacion.set(valor);
    if (valor !== null && valor !== OTRO_MOTIVO) this.motivoLibre.set('');
  }

  /**
   * La última cantidad que sugirió la pauta. Distinguirla de una tecleada a
   * mano es lo que permite recalcularla al cambiar de chip sin pisar jamás lo
   * que quien receta escribió.
   */
  private ultimaCantidadSugerida: string | null = null;

  /* -- Buscar el medicamento en el catálogo -------------------------------- */

  /** Resultados de la última búsqueda. Los provee este componente, no el combobox. */
  protected readonly opcionesDeMedicamento = signal<readonly ReferenceOption[]>([]);
  protected readonly buscandoMedicamento = signal(false);

  /** La opción elegida, para que el buscador conserve el rótulo tras elegir. */
  protected readonly medicamentoElegido = signal<ReferenceOption | null>(null);

  /**
   * Presentaciones y concentraciones que declara el medicamento elegido.
   *
   * Vacías mientras no haya ficha, o cuando el concepto no las publica. Es lo
   * que decide si la posología se elige o se escribe: ver {@link hayPosologia}.
   */
  protected readonly presentaciones = signal<readonly SelectOption<string>[]>([]);
  protected readonly concentraciones = signal<readonly SelectOption<string>[]>([]);
  protected readonly presentacion = signal<string | null>(null);
  protected readonly concentracion = signal<string | null>(null);

  /**
   * Si el medicamento elegido trae listas para armar la posología.
   *
   * Cuando las trae, el campo de dosis en texto **se reemplaza** por los dos
   * desplegables: ofrecer las dos cosas invitaría a escribir una dosis que
   * contradiga la elegida, y sólo una de las dos puede viajar en `doseText`.
   */
  protected readonly hayPosologia = computed(
    () => this.presentaciones().length > 0 || this.concentraciones().length > 0,
  );

  /**
   * Si el catálogo del medicamento está disponible.
   *
   * `null` mientras se pregunta. Es el paso 0 hecho en código y no una vez a
   * mano: el día que el binding se declare, esta pantalla empieza a funcionar
   * sin desplegar nada nuevo.
   */
  protected readonly catalogoListo = signal<boolean | null>(null);

  /**
   * El vademécum contra el que se prescribe, entero y en memoria.
   *
   * Son unas decenas de opciones que ya se piden al abrir la pantalla, así
   * que buscar sobre ellas es instantáneo y no cuesta una petición por tecla.
   */
  private readonly catalogoDeMedicamentos = signal<readonly DynamicEnumOption[]>([]);

  protected readonly registrando = signal(false);

  /** La receta sobre la que hay una acción en vuelo, o `null`. */
  protected readonly accionEnCurso = signal<string | null>(null);

  /**
   * El resultado de la última escritura.
   *
   * Uno solo para las tres: sólo puede haber una en vuelo, y dos avisos
   * simultáneos sobre el mismo bloque compiten entre sí.
   */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /**
   * La receta que se intentó emitir sin firmar, si el `422` vino de ahí.
   *
   * Se guarda para poder decir **cuál** necesita firma y ofrecer el botón al
   * lado: «esta receta necesita firma» sin señalar cuál es un aviso que obliga
   * a adivinar.
   */
  private readonly recetaSinFirma = signal<RecetaEnFicha | null>(null);

  /**
   * Si el último fallo vino de prescribir y no del ciclo de una receta ya
   * cargada.
   *
   * Existe porque `PRECONDITION_FAILED` cubre **dos cosas distintas**: emitir
   * sin firma o sobre algo que ya no es borrador —el ciclo—, y la indicación
   * diagnóstica que no es de esta persona —el alta, v4.1.6—. El código es el
   * mismo y el mensaje del servidor es lo único que las separa, así que de este
   * lado se recuerda de dónde salió en vez de leer el texto.
   */
  private readonly falloAlPrescribir = signal(false);

  /** La cita elegida, o `null` por «sin cita asociada». */
  protected readonly citaElegida = signal<string | null>(null);

  /**
   * Contrato de `DraftBlock`. Deliberadamente **sin `validFrom`**: el propio
   * bloque lo completa solo (`limpiar()` lo siembra con la fecha de hoy y la
   * elección rápida de duración también lo toca) — un formulario recién
   * limpiado leería como "pendiente" por una columna que nadie tocó. Sin
   * `medicamento`/`buscandoMedicamento`/catálogos/`registrando`/`registro`:
   * son lo que el bloque cargó o está pidiendo, no lo que la persona escribió.
   */
  readonly tieneCambiosPendientes = computed(
    () =>
      this.medicamento() !== null ||
      this.dosis().trim() !== '' ||
      this.frecuencia().trim() !== '' ||
      String(this.cantidad() ?? '').trim() !== '' ||
      this.via() !== null ||
      this.validTo() !== null ||
      this.duracionDias() !== null ||
      this.esCronico() ||
      this.duracionRapidaElegida() !== null ||
      this.indicacionesPaciente().trim() !== '' ||
      this.indicacion() !== null ||
      this.motivoLibre().trim() !== '' ||
      this.medicamentoElegido() !== null ||
      this.presentacion() !== null ||
      this.concentracion() !== null ||
      this.citaElegida() !== null,
  );

  /** Las opciones del selector de cita, con la vacía primero. */
  protected readonly opcionesDeCita = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Sin cita asociada' },
    ...this.citas().map((cita) => ({
      value: cita.id,
      label: cita.enCurso ? `${cita.etiqueta} · en curso` : cita.etiqueta,
    })),
  ]);

  /**
   * El encuentro que viaja en la receta.
   *
   * La cita elegida manda; si nadie eligió, el encuentro en curso que el
   * anfitrión pasó por `encounterId`. Así «Atención» sigue comportándose igual
   * sin que nadie elija nada.
   */
  protected readonly encuentroDeLaReceta = computed<string | null>(
    () => this.citaElegida() ?? this.encounterId(),
  );

  /** Si el bloque puede prescribir sin encuentro abierto. */
  protected readonly sinExigirEncuentro = computed(() => !this.exigeEncuentro());

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * Si el formulario puede enviarse.
   *
   * Las cuatro condiciones son del contrato, no de prudencia: encuentro en
   * curso (decisión de esta pantalla), organización activa y medicamento
   * elegido (obligatorios del DTO), y nada en vuelo.
   */
  protected readonly puedeRecetar = computed(
    () =>
      (this.hayEncuentro() || this.sinExigirEncuentro()) &&
      !this.sinOrganizacion() &&
      this.medicamento() !== null &&
      !this.registrando(),
  );

  /**
   * El aviso de precondición, en palabras.
   *
   * Separado del error de verdad porque **no es un error**: el `422` de emitir
   * sin firmar describe un paso que falta y tiene salida inmediata. Pintarlo en
   * rojo enseñaría a quien receta que el sistema se rompe cuando en realidad lo
   * está protegiendo.
   */
  protected readonly avisoDePrecondicion = computed<string | null>(() => {
    const receta = this.recetaSinFirma();
    if (receta === null) {
      return null;
    }
    return `«${receta.medicamento}» necesita tu firma antes de emitirse.`;
  });

  /**
   * El fallo de la escritura, en palabras.
   *
   * Mismo criterio que el encuentro: `errorToViewState` trae el
   * `PRECONDITION_FAILED` como una validación **con su código**, que es lo que
   * permite reconocerlo sin leer el mensaje. La diferencia es que acá hay dos
   * precondiciones distintas —falta la firma, o la receta ya no es un borrador—
   * y sólo la primera tiene salida desde esta pantalla.
   */
  protected readonly errorDeLaReceta = computed<string | null>(() => {
    // La precondición de firma ya se contó como aviso: repetirla en rojo sería
    // decir dos veces lo mismo con dos tonos que se contradicen.
    if (this.recetaSinFirma() !== null) {
      return null;
    }

    const state = this.registro();
    if (state.status === 'validation') {
      if (state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')) {
        // Al prescribir, la única precondición que el alta puede romper es la
        // indicación diagnóstica: el servidor comprueba que la condición sea de
        // esta persona (v4.1.6). Se cuenta con el mensaje del servidor, que
        // nombra el problema mejor que cualquier reformulación de acá.
        if (this.falloAlPrescribir()) {
          return (
            state.issues.map((issue) => issue.message).join(' ') ||
            'El diagnóstico elegido no corresponde a esta persona. Elegí otro o dejá la receta sin diagnóstico.'
          );
        }
        return 'Esa receta ya no está en borrador: alguien la emitió o la invalidó antes. Recargá el expediente.';
      }
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return mensajeDeFalloDeEscritura(state, {
      accion: 'recetar',
      sinPermiso: 'Tu rol no permite recetar.',
      yaNoExiste: 'La receta ya no existe. Recargá el expediente.',
    });
  });

  /** El sello de una receta según dónde esté del ciclo. */
  protected selloDe(receta: RecetaEnFicha): 'pending' | 'in-review' | 'approved' {
    if (receta.emitida) {
      return 'approved';
    }
    return receta.firmada ? 'in-review' : 'pending';
  }

  constructor() {
    // El catálogo se pregunta una sola vez: el cliente memoiza por target, así
    // que esta llamada y la del selector son la misma petición.
    this.systemContext.dynamicEnum(TARGET_MEDICAMENTO).subscribe({
      next: (enumeracion) => {
        this.catalogoDeMedicamentos.set(enumeracion.options);
        this.catalogoListo.set(enumeracion.options.length > 0);
      },
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });
  }

  /* -- Elegir el medicamento ----------------------------------------------- */

  /**
   * Busca dentro del **vademécum**, no en toda la terminología.
   *
   * Antes preguntaba a `searchConcepts` sin acotar, y devolvía cualquier
   * concepto que casara: el mismo medicamento repetido tres veces —una por el
   * vademécum en inglés, otra por el catálogo de prescripción y otra por el
   * glosario del paciente— y hasta cosas que no son medicamentos, como los
   * permisos del sistema. Con «paracetamol» el médico veía tres filas idénticas
   * y ninguna forma de saber cuál elegir.
   *
   * Ahora filtra el catálogo que la pantalla ya cargó, que es exactamente el
   * conjunto contra el que el backend valida la receta: lo que se ofrece y lo
   * que se acepta pasan a ser lo mismo. Sin petición por tecla, y sin atar la
   * pantalla al uuid de una versión del sistema de códigos.
   */
  protected buscarMedicamento(texto: string): void {
    const buscado = normalizar(texto);
    const catalogo = this.catalogoDeMedicamentos();

    // Sin texto se ofrece el catálogo entero: abrir el desplegable y no ver nada
    // hasta escribir esconde lo que hay.
    const coincide =
      buscado === ''
        ? catalogo
        : catalogo.filter(
            (opcion) =>
              normalizar(opcion.display).includes(buscado) ||
              normalizar(opcion.code).includes(buscado),
          );

    this.opcionesDeMedicamento.set(
      coincide.slice(0, TOPE_DE_LA_BUSQUEDA).map(comoOpcionDeMedicamento),
    );
    this.buscandoMedicamento.set(false);
  }

  /**
   * Al elegir, lee la ficha del concepto y ofrece su posología.
   *
   * La búsqueda alcanza para elegir pero no trae las propiedades; son dos
   * lecturas porque traerlas para cada resultado de un autocompletar sería peso
   * que la lista no usa.
   */
  protected onMedicamentoElegido(opcion: ReferenceOption | null): void {
    this.medicamentoElegido.set(opcion);
    this.limpiarPosologia();

    // Una sugerencia pertenece al medicamento que la publicó. Al cambiar de
    // selección se descarta; el texto manual no marca este origen y se conserva.
    if (this.frecuenciaSugeridaPara() !== null) {
      this.frecuencia.set('');
      this.frecuenciaSugeridaPara.set(null);
    }

    if (opcion === null) {
      return;
    }

    this.terminology.readConceptDetail(opcion.value).subscribe({
      next: (ficha) => {
        if (this.medicamentoElegido()?.value !== opcion.value) {
          return;
        }
        this.presentaciones.set(
          aOpciones(listaDeTextos(ficha.properties, PROPIEDAD_PRESENTACIONES)),
        );
        this.concentraciones.set(
          aOpciones(listaDeTextos(ficha.properties, PROPIEDAD_CONCENTRACIONES)),
        );
        const frecuenciaPorDefecto = valorDeTexto(
          ficha.properties,
          PROPIEDAD_FRECUENCIA_POR_DEFECTO,
        );
        if (this.frecuencia().trim() === '' && frecuenciaPorDefecto !== undefined) {
          this.frecuencia.set(frecuenciaPorDefecto);
          this.frecuenciaSugeridaPara.set(opcion.value);
        }
      },
      // Un medicamento sin ficha legible sigue siendo prescribible: se cae al
      // campo de dosis en texto, que es como funcionaba esta pantalla entera
      // antes de que el catálogo publicara presentaciones.
      error: () => this.limpiarPosologia(),
    });
  }

  /** Deja la posología sin listas ni elección. */
  private limpiarPosologia(): void {
    this.presentaciones.set([]);
    this.concentraciones.set([]);
    this.presentacion.set(null);
    this.concentracion.set(null);
  }

  /** El texto de dosis confirmado por quien prescribe, o vacío si no lo indicó. */
  private posologia(): string {
    return this.dosis().trim();
  }

  /** Un valor del catálogo completa el texto, que luego sigue siendo editable. */
  protected elegirConcentracion(valor: string | null): void {
    this.concentracion.set(valor);
    this.completarDosisDesdeCatalogo();
  }

  /** Un valor del catálogo completa el texto, que luego sigue siendo editable. */
  protected elegirPresentacion(valor: string | null): void {
    this.presentacion.set(valor);
    this.completarDosisDesdeCatalogo();
  }

  private completarDosisDesdeCatalogo(): void {
    const partes = [this.concentracion(), this.presentacion()].filter(
      (parte): parte is string => parte !== null && parte !== '',
    );
    if (partes.length > 0) {
      this.dosis.set(partes.join(' · '));
    }
  }

  /**
   * Fija la duración del tratamiento y deriva la fecha de fin de vigencia.
   *
   * `null` significa tratamiento crónico/continuo: sin fecha de fin, y el chip
   * lo refleja vía {@link esCronico}.
   */
  protected fijarDuracion(dias: number | null): void {
    this.duracionDias.set(dias);
    this.duracionRapidaElegida.set(dias ?? 'continuo');
    if (dias === null) {
      this.esCronico.set(true);
      this.validTo.set(null);
    } else {
      this.esCronico.set(false);
      const inicio = this.validFrom() ?? new Date();
      if (this.validFrom() === null) {
        this.validFrom.set(inicio);
      }
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + dias);
      this.validTo.set(fin);
    }
    this.sugerirCantidad();
  }

  /** Fija una pauta rápida de frecuencia y recalcula la cantidad sugerida. */
  protected fijarFrecuenciaRapida(pauta: string): void {
    this.frecuenciaSugeridaPara.set(null);
    this.frecuencia.set(pauta);
    this.sugerirCantidad();
  }

  /** Una edición del médico reemplaza cualquier sugerencia del catálogo. */
  protected fijarFrecuenciaManual(valor: string | number | null): void {
    this.frecuenciaSugeridaPara.set(null);
    this.frecuencia.set(valor === null ? '' : String(valor));
  }

  protected elegirDuracionRapida(valor: number | 'continuo' | null): void {
    if (valor === null) {
      this.duracionRapidaElegida.set(null);
      return;
    }
    this.fijarDuracion(valor === 'continuo' ? null : valor);
  }

  /**
   * Sugiere la cantidad a dispensar cuando la pauta la determina: con
   * frecuencia «Cada N horas» y duración en días, son `24/N` tomas diarias por
   * los días del tratamiento. Nunca pisa una cantidad tecleada a mano —solo el
   * campo vacío o la sugerencia anterior—: es un ahorro de tecleo, no una
   * regla, y la cantidad la decide quien receta.
   */
  private sugerirCantidad(): void {
    const horas = horasDeFrecuencia(this.frecuencia());
    const dias = this.duracionDias();
    if (horas === null || dias === null) {
      return;
    }
    const sugerida = String(Math.ceil((24 / horas) * dias));
    const actual = String(this.cantidad() ?? '').trim();
    if (actual === '' || actual === this.ultimaCantidadSugerida) {
      this.cantidad.set(sugerida);
      this.ultimaCantidadSugerida = sugerida;
    }
  }

  /* -- Las tres escrituras ------------------------------------------------- */

  /**
   * Prescribe la medicación (UC-08-10) — la receta queda en borrador.
   *
   * Sin confirmación previa por sí sola: un borrador no compromete a nadie y
   * se firma o se descarta después. El diálogo se reserva para emitir, que sí
   * es sin vuelta — **salvo que el chequeo de interacciones encuentre algo**,
   * en cuyo caso sí se confirma, porque ahí lo que se pide no es prudencia
   * genérica sino que quien prescribe mire una alerta concreta antes de
   * seguir.
   */
  protected async recetar(): Promise<void> {
    const patientProfileId = this.patientProfileId();
    const custodianTenantId = this.organizacion();
    const medicationConceptId = this.medicamento();
    // La cita elegida manda sobre el encuentro del anfitrión, y **puede no
    // haber ninguna**: en el expediente el contrato declara `encounterId`
    // opcional y la receta se ata a una consulta ya cerrada, o a ninguna.
    const encounterId = this.encuentroDeLaReceta();

    if (custodianTenantId === null || medicationConceptId === null || this.registrando()) {
      return;
    }
    // En «Atención» el encuentro sigue siendo obligatorio: ahí es el contexto.
    if (this.exigeEncuentro() && encounterId === null) {
      return;
    }

    if (
      !(await this.sinInteraccionesOConfirmadas(patientProfileId, medicationConceptId, encounterId))
    ) {
      return;
    }

    // La posología y las indicaciones viajan SEPARADAS a propósito: `doseText`
    // lo lee farmacia para dispensar, y las indicaciones al paciente tienen su
    // columna propia desde v4.1.3. Concatenarlas fue el interino que v4.1.3
    // vino a retirar.
    const dosis = this.posologia();
    const indicaciones = this.indicacionesPaciente().trim();
    const frecuencia = this.frecuencia().trim();
    const cantidad = cantidadDe(this.cantidad());
    const via = this.via();
    const validFrom = this.validFrom() ?? undefined;
    const validTo = this.validTo() ?? undefined;
    const indicacion = this.indicacion();

    this.registrando.set(true);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);
    this.falloAlPrescribir.set(false);

    this.clinical
      .createMedicationRequest({
        custodianTenantId,
        patientProfileId,
        medicationConceptId,
        ...(encounterId === null ? {} : { encounterId }),
        // Los opcionales vacíos se **omiten**: una dosis en blanco es una
        // indicación registrada que no dice nada, y se lee peor que su ausencia.
        ...(dosis === '' ? {} : { doseText: dosis }),
        ...(frecuencia === '' ? {} : { frequencyText: frecuencia }),
        ...(cantidad === null ? {} : { quantityDecimal: cantidad }),
        ...(via === null ? {} : { routeConceptId: via }),
        ...(validFrom === undefined ? {} : { validFrom }),
        ...(validTo === undefined ? {} : { validTo }),
        ...(indicaciones === '' ? {} : { patientInstructionsText: indicaciones }),
        // Para qué es la receta (v4.1.6). Se omite cuando no se eligió: una
        // prescripción sintomática o profiláctica no tiene diagnóstico detrás.
        // Con «Otro motivo» viaja el texto y NO la condición: son excluyentes,
        // y `__otro_motivo__` no es el id de nada.
        ...(indicacion === null || indicacion === OTRO_MOTIVO
          ? {}
          : { indicationConditionId: indicacion }),
        ...(this.motivoEsLibre() && this.motivoLibre().trim() !== ''
          ? { indicationText: this.motivoLibre().trim() }
          : {}),
      })
      .subscribe({
        next: (creada) => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
          // Adjuntar exige que la receta ya exista, así que el panel sólo puede
          // ofrecerse acá. No se cierra solo: elegir los archivos lleva su
          // tiempo, y cerrarlo por cuenta propia perdería la referencia.
          this.recetaRecienCreada.set(creada.id);
          this.toasts.success('Queda en borrador hasta que la firmes.', 'Receta creada');
          this.cambio.emit();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          // El 422 del alta sólo puede venir de la indicación: es la única
          // precondición que este cuerpo puede romper. Se marca para que el
          // aviso apunte al campo y no a «algo salió mal».
          this.falloAlPrescribir.set(indicacion !== null);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /**
   * Firma la receta (D-05).
   *
   * Sin confirmación: firmar es aditivo y no cierra nada —una receta firmada
   * todavía puede no emitirse—. Lo que sí hace es habilitar la emisión, que es
   * el paso que se confirma.
   */
  protected firmar(receta: RecetaEnFicha): void {
    if (this.accionEnCurso() !== null) {
      return;
    }

    this.accionEnCurso.set(receta.id);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);

    this.clinical.signMedicationRequest(receta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Ya puede emitirse.', 'Receta firmada');
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.accionEnCurso.set(null);
        this.registro.set(errorToViewState<null>(error));
      },
    });
  }

  /**
   * Emite la receta y la vuelve inmutable.
   *
   * Con confirmación, y no por prudencia genérica: una receta emitida no se
   * edita —toda corrección pasa por invalidar o reemplazar— y es la que sale
   * del consultorio. Es el mismo criterio con el que se confirma el cierre de
   * un encuentro.
   */
  protected async emitir(receta: RecetaEnFicha): Promise<void> {
    if (this.accionEnCurso() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: '¿Emitir la receta?',
      message: `Se emite «${receta.medicamento}». Una receta emitida no se puede editar: para corregirla hay que invalidarla o reemplazarla.`,
      confirmLabel: 'Emitir receta',
    });
    if (!confirmado) {
      return;
    }

    this.accionEnCurso.set(receta.id);
    this.registro.set(loading());
    this.recetaSinFirma.set(null);

    this.clinical.issueMedicationRequest(receta.id).subscribe({
      next: () => {
        this.accionEnCurso.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Queda sellada y no se puede editar.', 'Receta emitida');
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.accionEnCurso.set(null);
        const state = errorToViewState<null>(error);
        this.registro.set(state);
        // La precondición se distingue por su código, y **cuál** de las dos es
        // se sabe de este lado: si la receta no estaba firmada, lo que falta es
        // la firma. Si lo estaba, el estado que muestra la pantalla quedó viejo.
        if (
          !receta.firmada &&
          state.status === 'validation' &&
          state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')
        ) {
          this.recetaSinFirma.set(receta);
        }
      },
    });
  }

  /**
   * Corre el chequeo de interacciones y, si encuentra algo, lo confirma antes
   * de dejar seguir. Devuelve `true` cuando no hay nada que confirmar —sin
   * medicación previa, sin interacción encontrada, o el chequeo mismo no pudo
   * correr— o cuando quien prescribe decidió seguir igual.
   *
   * ## Por qué falla abierto
   *
   * Si `POST /cds/check-interactions` no responde, bloquear una receta que
   * por lo demás es válida por una falla de una alerta *aparte* sería peor
   * que prescribir sin ella: hoy la ausencia total de este chequeo es el
   * estado normal, y una caída puntual no puede ser más restrictiva que eso.
   *
   * ## Por qué el tope de dos sustancias
   *
   * El contrato exige al menos dos (`ArrayMinSize(2)`): una interacción es
   * entre sustancias, y con una sola —sin medicación previa registrada, o
   * prescribiendo lo mismo que ya está activo— no hay nada que comparar.
   */
  private async sinInteraccionesOConfirmadas(
    patientProfileId: string,
    medicationConceptId: string,
    encounterId: string | null,
  ): Promise<boolean> {
    const sustancias = Array.from(
      new Set([...this.medicacionActivaConceptIds(), medicationConceptId]),
    );
    if (sustancias.length < 2) {
      return true;
    }

    let chequeo;
    try {
      chequeo = await firstValueFrom(
        this.clinical.checkInteractions({
          patientProfileId,
          substanceConceptIds: sustancias,
          // Sin encuentro se omite y no viaja en `null`: el DTO lo declara
          // opcional y el motor compara sustancias, no consultas.
          ...(encounterId === null ? {} : { encounterId }),
        }),
      );
    } catch {
      return true;
    }

    if (chequeo.count === 0) {
      return true;
    }

    return this.dialogs.confirm({
      title:
        chequeo.count === 1
          ? 'Se detectó una interacción'
          : `Se detectaron ${chequeo.count} interacciones`,
      message:
        'El motor de decisión clínica encontró interacción entre este medicamento y la medicación activa de la persona. Revisala antes de seguir.',
      confirmLabel: 'Prescribir de todas formas',
    });
  }

  /** Vacía el formulario tras un alta. El siguiente medicamento arranca limpio. */
  private limpiar(): void {
    this.medicamento.set(null);
    this.medicamentoElegido.set(null);
    this.opcionesDeMedicamento.set([]);
    this.limpiarPosologia();
    this.dosis.set('');
    this.frecuencia.set('');
    this.frecuenciaSugeridaPara.set(null);
    this.cantidad.set('');
    this.via.set(null);
    this.validFrom.set(new Date());
    this.validTo.set(null);
    this.duracionDias.set(null);
    this.esCronico.set(false);
    this.duracionRapidaElegida.set(null);
    this.motivoLibre.set('');
    this.indicacionesPaciente.set('');
    // El diagnóstico elegido pertenece a esta receta; la siguiente arranca limpia.
    this.indicacion.set(null);
    this.citaElegida.set(null);
    this.ultimaCantidadSugerida = null;
  }
}

/** Textos del catálogo como opciones de un desplegable, tal como vienen. */
function aOpciones(textos: readonly string[]): readonly SelectOption<string>[] {
  return textos.map((texto) => ({ value: texto, label: texto }));
}

/**
 * Un concepto del catálogo como opción del buscador. El código —el ATC, en el
 * vademécum— desambigua dos denominaciones parecidas, que en un catálogo de
 * medicamentos es lo habitual.
 */
/**
 * Texto comparable: sin mayúsculas y sin tildes.
 *
 * Un médico escribe «losartan» y el catálogo dice «Losartán»; sin quitar la
 * tilde no se encuentran, y exigir el acento al teclear es exigir de más.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function comoOpcionDeMedicamento(concepto: {
  readonly conceptId: string;
  readonly display: string;
  readonly code: string;
}): ReferenceOption {
  return { value: concepto.conceptId, label: concepto.display, hint: concepto.code };
}

/** Las horas de una pauta «Cada N horas», o `null` si la pauta no las fija. */
function horasDeFrecuencia(pauta: string): number | null {
  const partes = /^cada (\d+) horas/i.exec(pauta.trim());
  return partes === null ? null : Number(partes[1]);
}

/**
 * La cantidad como número, o nada.
 *
 * El control numérico devuelve el texto tal cual se tecleó, y `Number('')` es
 * `0`: sin este filtro una receta sin cantidad viajaría con «cantidad cero»,
 * que en una indicación médica no es lo mismo que no haberla escrito.
 */
function cantidadDe(valor: string | number | null): number | null {
  if (valor === null || valor === '') {
    return null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}
