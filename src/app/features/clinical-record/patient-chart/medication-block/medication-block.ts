import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { WritableSignal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { PrescriptionFavoritesClient } from '../../../../core/data-access/prescription-favorites/prescription-favorites.client';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import { listaDeTextos } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Chip } from '../../../../shared/components/atoms/chip/chip';
import { Input as AppInput } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import type { DynamicEnumOption } from '../../../../core/data-access/system-context/system-context.types';
import { environment } from '../../../../../environments/environment';
import { CASOS_RECETA_DEMO, conceptIdPorCodigo } from '../demo-presets';
import type { CasoRecetaDemo } from '../demo-presets';

/**
 * La columna que gobierna el medicamento.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica, y es
 * lo que hace que el día que el binding se declare esta pantalla funcione sin
 * tocar una línea.
 */
export const TARGET_MEDICAMENTO = 'clinical.medication_requests.medication_concept_id';

/** La vía de administración. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_VIA = 'clinical.medication_requests.route_concept_id';

/** La unidad de la cantidad. Mismo trato que la vía. */
export const TARGET_UNIDAD = 'clinical.medication_requests.unit_concept_id';

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

/** Las unidades en castellano. Mismo criterio que {@link ETIQUETAS_DE_VIA}. */
const ETIQUETAS_DE_UNIDAD: Readonly<Record<string, string>> = {
  UNIT_mg: 'mg',
  UNIT_g: 'g',
  UNIT_mL: 'mL',
  'UNIT_{tablet}': 'Comprimidos',
  'UNIT_{capsule}': 'Cápsulas',
  'UNIT_[drp]': 'Gotas',
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

/**
 * Separador con el que presentación y concentración se componen en `doseText`.
 *
 * El modelo **no tiene columna** para ninguna de las dos: `medication_requests`
 * guarda el medicamento como concepto y la posología como texto (`dose_text`).
 * Componerlas acá es lo que permite que el profesional las elija de una lista en
 * vez de teclearlas, sin inventar esquema. El mismo separador que usa el PDF
 * para unir las partes de la línea del medicamento.
 */
const SEPARADOR_DE_DOSIS = ' · ';

/** Largo máximo del rótulo de un favorito. Es el del DTO (`@MaxLength(120)`). */
const TOPE_DEL_ROTULO = 120;

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

/**
 * Un favorito de prescripción del profesional, en la forma que este bloque usa.
 *
 * Se declara acá —y no se importa del cliente— a propósito: el bloque consume
 * exactamente estas claves, y `quantityDecimal` se acepta como número **o**
 * texto porque la columna es `numeric` y el transporte la devuelve como cadena.
 * {@link cantidadDe} la normaliza en el único punto donde importa.
 */
interface FavoritoDeReceta {
  readonly id: string;
  readonly name: string;
  readonly medicationConceptId: string;
  readonly doseText?: string;
  readonly routeConceptId?: string;
  readonly frequencyText?: string;
  readonly quantityDecimal?: number | string;
  readonly unitConceptId?: string;
  readonly patientInstructionsText?: string;
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
 * ## La posología sale del catálogo cuando el catálogo la declara
 *
 * Al elegir se lee la ficha del concepto: si publica `dose_forms` y `strengths`
 * —como hace el vademécum—, presentación y concentración se **eligen** y viajan
 * compuestas en `doseText`, porque el modelo no tiene una columna para cada
 * una. Si no las declara, la dosis sigue siendo el texto libre de siempre. Es
 * degradación, no dos modos: el formulario nunca ofrece las dos cosas a la vez.
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
 * ## Los favoritos rellenan el formulario; jamás prescriben
 *
 * Aplicar un favorito escribe los campos y **no guarda nada**: quien receta
 * revisa, ajusta y prescribe por el camino de siempre, con su firma y su
 * emisión. Un atajo que creara la receta desde el favorito sería una segunda
 * puerta a la prescripción con la mitad de los controles. Y si el formulario ya
 * tiene datos, aplicar pide confirmación: pisar en silencio lo que alguien
 * escribió es cómo se receta otra cosa sin enterarse.
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
    Badge,
    AppInput,
    Card,
    Chip,
    ConceptSelect,
    DatePicker,
    FormActions,
    FormField,
    ReferenceCombobox,
    Select,
    StatusSeal,
    Textarea,
  ],
  templateUrl: './medication-block.html',
  styleUrl: './medication-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicationBlock {
  private readonly clinical = inject(ClinicalClient);
  private readonly favoritos = inject(PrescriptionFavoritesClient);
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
  protected readonly targetUnidad = TARGET_UNIDAD;
  protected readonly etiquetasDeVia = ETIQUETAS_DE_VIA;
  protected readonly etiquetasDeUnidad = ETIQUETAS_DE_UNIDAD;

  /* -- Casos de demostración ------------------------------------------------ */

  /** La barra existe sólo donde el despliegue la pidió (`PUBLIC_DEMO_PRESETS`). */
  protected readonly demoActiva = environment.demoPresets;
  protected readonly casosDemo = CASOS_RECETA_DEMO;

  /** Opciones de pautas rápidas de dosificación. */
  protected readonly opcionesFrecuenciaRapida: readonly string[] = [
    'Cada 8 horas',
    'Cada 12 horas',
    'Cada 24 horas (1 vez al día)',
    'Cada 6 horas',
    'En ayunas',
    'Antes de dormir',
    'Según necesidad (SOS)',
  ];

  /** Opciones de duración rápida del tratamiento. */
  protected readonly opcionesDuracionRapida: readonly { readonly dias: number | null; readonly label: string }[] = [
    { dias: 3, label: '3 días' },
    { dias: 5, label: '5 días' },
    { dias: 7, label: '7 días' },
    { dias: 10, label: '10 días' },
    { dias: 14, label: '14 días' },
    { dias: 30, label: '30 días' },
    { dias: null, label: 'Crónico / Continuo' },
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
  /** El control numérico devuelve texto: se convierte al enviar, no al teclear. */
  protected readonly cantidad = signal<string | number | null>('');
  protected readonly via = signal<string | null>(null);
  protected readonly unidad = signal<string | null>(null);

  /* -- Vigencia y duración estructurada ------------------------------------- */

  protected readonly validFrom = signal<Date | null>(null);
  protected readonly validTo = signal<Date | null>(null);
  protected readonly duracionDias = signal<number | null>(null);
  protected readonly esCronico = signal(false);

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

  /** Las opciones del selector de indicación, con la vacía primero. */
  protected readonly opcionesDeIndicacion = computed<readonly SelectOption<string | null>[]>(
    () => [
      { value: null, label: 'Sin diagnóstico asociado' },
      ...this.diagnosticos().map((dx) => ({ value: dx.id, label: dx.etiqueta })),
    ],
  );

  /**
   * La última cantidad que sugirió la pauta. Distinguirla de una tecleada a
   * mano es lo que permite recalcularla al cambiar de chip sin pisar jamás lo
   * que quien receta escribió.
   */
  private ultimaCantidadSugerida: string | null = null;

  /**
   * Las opciones de vía y unidad, guardadas para resolver los casos de
   * demostración por **código**. Mismas peticiones que ya hacen los selectores:
   * el cliente memoiza por target.
   */
  private readonly opcionesVia = signal<readonly DynamicEnumOption[]>([]);
  private readonly opcionesUnidad = signal<readonly DynamicEnumOption[]>([]);

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

  /* -- Favoritos de prescripción (v4.1.7) ----------------------------------- */

  /** Los favoritos propios. Lista completa: la API no la pagina. */
  protected readonly favoritosPropios = signal<readonly FavoritoDeReceta[]>([]);

  /**
   * Si la cuenta puede tener favoritos.
   *
   * `false` sólo ante el `403` de una cuenta sin perfil profesional, que **no
   * es un error**: es «esto no aplica». Se apaga la sección entera en vez de
   * mostrar un aviso rojo por una función que esa cuenta nunca va a usar.
   */
  protected readonly favoritosAplican = signal(true);

  /** El favorito elegido en el selector, para poder volver a elegir el mismo. */
  protected readonly favoritoElegido = signal<string | null>(null);

  protected readonly guardandoFavorito = signal(false);

  /**
   * El fallo de guardar un favorito, en palabras.
   *
   * Aparte de {@link errorDeLaReceta} a propósito: guardar un atajo personal no
   * es prescribir, y un aviso que dijera «receta» sobre un rótulo repetido
   * mandaría a buscar el problema donde no está.
   */
  protected readonly errorDelFavorito = signal<string | null>(null);

  /** Los favoritos como opciones del desplegable, en el orden que llegaron. */
  protected readonly opcionesDeFavorito = computed<readonly SelectOption<string>[]>(() =>
    this.favoritosPropios().map((favorito) => ({ value: favorito.id, label: favorito.name })),
  );

  /**
   * Si el selector de favoritos se ofrece.
   *
   * Con la lista vacía no se dibuja: un desplegable sin nada que desplegar se
   * lee como algo roto, y el primer día de cualquier profesional la lista está
   * vacía. Lo que sí queda visible es «Guardar como favorito», que es como se
   * llena.
   */
  protected readonly hayFavoritos = computed(
    () => this.favoritosAplican() && this.favoritosPropios().length > 0,
  );

  /**
   * Si hay algo cargado que aplicar un favorito pisaría.
   *
   * El medicamento cuenta como dato aunque sea lo único elegido: reemplazarlo
   * sin avisar es exactamente cómo se termina prescribiendo otra cosa.
   */
  protected readonly formularioConDatos = computed(
    () =>
      this.medicamento() !== null ||
      this.dosis().trim() !== '' ||
      this.frecuencia().trim() !== '' ||
      String(this.cantidad() ?? '').trim() !== '' ||
      this.via() !== null ||
      this.unidad() !== null ||
      this.concentracion() !== null ||
      this.presentacion() !== null ||
      this.indicacionesPaciente().trim() !== '',
  );

  /** Sin medicamento no hay favorito que guardar: es el único obligatorio. */
  protected readonly puedeGuardarFavorito = computed(
    () => this.favoritosAplican() && this.medicamento() !== null && !this.guardandoFavorito(),
  );

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
      this.hayEncuentro() &&
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
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite recetar.';
    }
    if (state.status === 'not-found') {
      return 'La receta ya no existe. Recargá el expediente.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
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
      next: (enumeracion) => this.catalogoListo.set(enumeracion.options.length > 0),
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });
    this.cargarOpciones(TARGET_VIA, this.opcionesVia);
    this.cargarOpciones(TARGET_UNIDAD, this.opcionesUnidad);
    this.cargarFavoritos();
  }

  /**
   * Trae los favoritos propios, sin ruido si no hay ninguno ni si no aplican.
   *
   * Dos silencios distintos y deliberados: el `403` de una cuenta sin perfil
   * profesional **apaga la sección** —no aplica, y decirlo en rojo sería
   * regañar a alguien por no ser médico—, y cualquier otro fallo deja la lista
   * vacía sin apagar «Guardar como favorito», porque puede ser transitorio y
   * guardar uno nuevo sí tiene sentido.
   */
  private cargarFavoritos(): void {
    this.favoritos.listOwn().subscribe({
      next: (lista) => this.favoritosPropios.set(lista),
      error: (error: unknown) => {
        this.favoritosPropios.set([]);
        if (errorToViewState<null>(error).status === 'forbidden') {
          this.favoritosAplican.set(false);
        }
      },
    });
  }

  /** Guarda las opciones de un catálogo. Sin catálogo, lista vacía y ya. */
  private cargarOpciones(
    target: string,
    destino: WritableSignal<readonly DynamicEnumOption[]>,
  ): void {
    this.systemContext.dynamicEnum(target).subscribe({
      next: (enumeracion) => destino.set(enumeracion.options),
      error: () => destino.set([]),
    });
  }

  /* -- Elegir el medicamento ----------------------------------------------- */

  /**
   * Busca en el catálogo de terminología por texto (UC-03-13).
   *
   * Sin acotar a una versión de sistema de códigos a propósito: el vademécum es
   * una versión más del catálogo y hardcodear su uuid acá ataría la pantalla a
   * un identificador que un re-seed puede mover. Lo que garantiza que se elija
   * algo válido no es el filtro sino el propio buscador, que sólo devuelve
   * conceptos existentes y nunca acepta texto libre.
   */
  protected buscarMedicamento(texto: string): void {
    this.buscandoMedicamento.set(true);
    this.terminology.searchConcepts({ query: texto, limit: TOPE_DE_LA_BUSQUEDA }).subscribe({
      next: (pagina) => {
        this.opcionesDeMedicamento.set(pagina.items.map(comoOpcionDeMedicamento));
        this.buscandoMedicamento.set(false);
      },
      // Sin resultados y sin ruido: el combobox ya dice «sin resultados», y un
      // aviso rojo por una búsqueda que falló mientras se teclea interrumpe algo
      // que la siguiente pulsación puede resolver sola.
      error: () => {
        this.opcionesDeMedicamento.set([]);
        this.buscandoMedicamento.set(false);
      },
    });
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

    if (opcion === null) {
      return;
    }

    this.terminology.readConceptDetail(opcion.value).subscribe({
      next: (ficha) => {
        this.presentaciones.set(
          aOpciones(listaDeTextos(ficha.properties, PROPIEDAD_PRESENTACIONES)),
        );
        this.concentraciones.set(
          aOpciones(listaDeTextos(ficha.properties, PROPIEDAD_CONCENTRACIONES)),
        );
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

  /**
   * La posología que viaja en `doseText`.
   *
   * Compone lo elegido —concentración primero, que es lo que primero se lee en
   * una indicación— o devuelve el texto libre cuando el medicamento no declara
   * listas. Vacío significa «no mandar la clave».
   */
  private posologia(): string {
    if (!this.hayPosologia()) {
      return this.dosis().trim();
    }
    return [this.concentracion(), this.presentacion()]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(SEPARADOR_DE_DOSIS);
  }

  /**
   * Fija la duración del tratamiento y deriva la fecha de fin de vigencia.
   *
   * `null` significa tratamiento crónico/continuo: sin fecha de fin, y el chip
   * lo refleja vía {@link esCronico}.
   */
  protected fijarDuracion(dias: number | null): void {
    this.duracionDias.set(dias);
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
    this.frecuencia.set(pauta);
    this.sugerirCantidad();
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

  /**
   * Precarga el formulario con un caso de demostración.
   *
   * La vía y la unidad se resuelven al `conceptId` del catálogo por código
   * EXACTO; el medicamento se busca en terminología y se selecciona sólo si el
   * resultado coincide con lo pedido. Lo que no resuelve queda sin elegir y se
   * avisa — nunca se cae a «la primera opción de la lista».
   *
   * Pública a propósito: los escenarios combinados del expediente la invocan.
   */
  aplicarCasoDemo(caso: CasoRecetaDemo): void {
    const faltantes: string[] = [];
    const via = conceptIdPorCodigo(this.opcionesVia(), caso.viaCodigo);
    if (via === null) {
      faltantes.push(`vía (${caso.viaCodigo})`);
    }
    const unidad = conceptIdPorCodigo(this.opcionesUnidad(), caso.unidadCodigo);
    if (unidad === null) {
      faltantes.push(`unidad (${caso.unidadCodigo})`);
    }

    this.via.set(via);
    this.unidad.set(unidad);
    this.dosis.set(caso.dosis);
    this.frecuencia.set(caso.frecuencia);
    this.indicacionesPaciente.set(caso.indicaciones);
    this.validFrom.set(new Date());
    this.fijarDuracion(caso.diasTratamiento);
    this.cantidad.set(String(caso.cantidad));

    this.seleccionarMedicamentoDelCaso(caso, faltantes);
  }

  /**
   * Busca el medicamento del caso y lo elige si el catálogo lo tiene.
   *
   * La selección exige que el `display` coincida con lo pedido (exacto, o como
   * prefijo): elegir «el primer resultado» de una búsqueda es cómo se receta
   * otra cosa. El aviso del caso sale recién acá, porque hasta que la búsqueda
   * no responde no se sabe si quedó completo.
   */
  private seleccionarMedicamentoDelCaso(caso: CasoRecetaDemo, faltantes: string[]): void {
    const query = caso.medicamentoQuery;
    this.buscandoMedicamento.set(true);
    this.terminology.searchConcepts({ query, limit: TOPE_DE_LA_BUSQUEDA }).subscribe({
      next: (pagina) => {
        const opciones = pagina.items.map(comoOpcionDeMedicamento);
        this.opcionesDeMedicamento.set(opciones);
        this.buscandoMedicamento.set(false);

        const buscado = query.toLowerCase();
        const elegido =
          opciones.find((opcion) => opcion.label.toLowerCase() === buscado) ??
          opciones.find((opcion) => opcion.label.toLowerCase().startsWith(buscado)) ??
          null;
        if (elegido === null) {
          faltantes.push(`medicamento («${query}»)`);
        } else {
          this.medicamento.set(elegido.value);
          this.onMedicamentoElegido(elegido);
        }
        this.avisarCasoAplicado(caso.label, faltantes);
      },
      error: () => {
        this.opcionesDeMedicamento.set([]);
        this.buscandoMedicamento.set(false);
        faltantes.push(`medicamento («${query}» — la búsqueda no respondió)`);
        this.avisarCasoAplicado(caso.label, faltantes);
      },
    });
  }

  /** Cuenta cómo quedó el caso: completo, o con lo que no resolvió. */
  private avisarCasoAplicado(label: string, faltantes: readonly string[]): void {
    if (faltantes.length > 0) {
      this.toasts.warning(
        `Sin correspondencia en el catálogo: ${faltantes.join(', ')}. Elegilos a mano.`,
        `Caso «${label}» aplicado parcialmente`,
      );
    } else {
      this.toasts.info('Revisá y prescribí cuando quieras.', `Caso «${label}» aplicado`);
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
    const encounterId = this.encounterId();

    if (
      custodianTenantId === null ||
      medicationConceptId === null ||
      encounterId === null ||
      this.registrando()
    ) {
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
    const unidad = this.unidad();
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
        encounterId,
        // Los opcionales vacíos se **omiten**: una dosis en blanco es una
        // indicación registrada que no dice nada, y se lee peor que su ausencia.
        ...(dosis === '' ? {} : { doseText: dosis }),
        ...(frecuencia === '' ? {} : { frequencyText: frecuencia }),
        ...(cantidad === null ? {} : { quantityDecimal: cantidad }),
        ...(via === null ? {} : { routeConceptId: via }),
        ...(unidad === null ? {} : { unitConceptId: unidad }),
        ...(validFrom === undefined ? {} : { validFrom }),
        ...(validTo === undefined ? {} : { validTo }),
        ...(indicaciones === '' ? {} : { patientInstructionsText: indicaciones }),
        // Para qué es la receta (v4.1.6). Se omite cuando no se eligió: una
        // prescripción sintomática o profiláctica no tiene diagnóstico detrás.
        ...(indicacion === null ? {} : { indicationConditionId: indicacion }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.limpiar();
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
   * Vuelca un favorito en el formulario, sin guardar nada.
   *
   * Rellenar no es prescribir: lo que queda cargado se revisa, se ajusta y se
   * receta por el camino de siempre —con su firma y su emisión—. Por eso no
   * toca el diagnóstico: el favorito es la indicación repetida, y para qué es
   * esta receta lo decide esta consulta.
   *
   * Si el formulario ya tiene algo escrito, se pide confirmación: perder lo
   * tipeado por elegir una opción de una lista es exactamente el gesto que
   * nadie espera que borre.
   */
  protected async aplicarFavorito(favoritoId: string | null): Promise<void> {
    this.favoritoElegido.set(favoritoId);
    if (favoritoId === null) {
      return;
    }
    const favorito = this.favoritosPropios().find((item) => item.id === favoritoId);
    if (favorito === undefined) {
      return;
    }

    if (this.formularioConDatos()) {
      const sigue = await this.dialogs.confirm({
        title: '¿Reemplazar lo que cargaste?',
        message: `Se va a sobrescribir el formulario con «${favorito.name}».`,
        confirmLabel: 'Reemplazar',
        cancelLabel: 'Dejar como está',
      });
      if (!sigue) {
        this.favoritoElegido.set(null);
        return;
      }
    }

    this.medicamento.set(favorito.medicationConceptId);
    this.dosis.set(favorito.doseText ?? '');
    this.frecuencia.set(favorito.frequencyText ?? '');
    this.cantidad.set(favorito.quantityDecimal ?? '');
    this.via.set(favorito.routeConceptId ?? null);
    this.unidad.set(favorito.unitConceptId ?? null);
    this.indicacionesPaciente.set(favorito.patientInstructionsText ?? '');
    // La posología del favorito es texto: las listas de concentración y
    // presentación se recalculan si el medicamento las declara.
    this.limpiarPosologia();
  }

  /**
   * Guarda lo que hay cargado como un favorito propio, con el rótulo que se pida.
   *
   * El rótulo es con lo que se lo va a reconocer en la lista, así que se pide
   * antes de guardar y no se deriva del medicamento: dos esquemas del mismo
   * fármaco son dos favoritos distintos.
   */
  protected async guardarFavorito(): Promise<void> {
    const medicationConceptId = this.medicamento();
    if (medicationConceptId === null || this.guardandoFavorito()) {
      return;
    }

    const rotulo = await this.dialogs.confirmWithReason(
      {
        title: 'Guardar como favorito',
        message: 'Queda en tu lista personal para reutilizarlo cuando lo necesites.',
        confirmLabel: 'Guardar',
      },
      {
        label: 'Nombre del favorito',
        hint: 'Con este nombre lo vas a encontrar en tu lista',
        placeholder: 'ATB post extracción',
        minLength: 1,
        maxLength: TOPE_DEL_ROTULO,
      },
    );
    if (rotulo === null) {
      return;
    }

    const dosis = this.posologia();
    const frecuencia = this.frecuencia().trim();
    const cantidad = cantidadDe(this.cantidad());
    const via = this.via();
    const unidad = this.unidad();
    const indicaciones = this.indicacionesPaciente().trim();

    this.guardandoFavorito.set(true);
    this.errorDelFavorito.set(null);
    this.favoritos
      .create({
        name: rotulo,
        medicationConceptId,
        ...(dosis === '' ? {} : { doseText: dosis }),
        ...(frecuencia === '' ? {} : { frequencyText: frecuencia }),
        ...(cantidad === null ? {} : { quantityDecimal: cantidad }),
        ...(via === null ? {} : { routeConceptId: via }),
        ...(unidad === null ? {} : { unitConceptId: unidad }),
        ...(indicaciones === '' ? {} : { patientInstructionsText: indicaciones }),
      })
      .subscribe({
        next: (favorito) => {
          this.guardandoFavorito.set(false);
          this.favoritosPropios.set(
            [...this.favoritosPropios(), favorito].sort((uno, otro) =>
              uno.name.localeCompare(otro.name),
            ),
          );
          this.toasts.success('Lo vas a encontrar en «Usar un favorito».', 'Favorito guardado');
        },
        error: (error: unknown) => {
          this.guardandoFavorito.set(false);
          this.errorDelFavorito.set(this.motivoDelFavorito(error));
        },
      });
  }

  /**
   * Traduce el fallo al guardar en algo que diga qué hacer.
   *
   * Los dos casos que el servidor distingue —rótulo repetido y lista llena—
   * tienen salida distinta, y «no se pudo guardar» las esconde a las dos.
   */
  private motivoDelFavorito(error: unknown): string {
    const estado = errorToViewState<null>(error);
    if (estado.status !== 'validation') {
      return 'No se pudo guardar el favorito. Intentá de nuevo.';
    }
    // El rótulo repetido (409 CONFLICT) y la lista llena (422) llegan los dos
    // como validación: los distingue el `code`, y cada uno tiene una salida
    // distinta que «no se pudo guardar» escondería.
    if (estado.issues.some((issue) => issue.code === 'CONFLICT')) {
      return 'Ya tenés un favorito con ese nombre. Probá con otro.';
    }
    const delServidor = estado.issues
      .map((issue) => issue.message)
      .filter((mensaje) => mensaje !== '')
      .join(' ');
    return delServidor === ''
      ? 'No se pudo guardar el favorito. Intentá de nuevo.'
      : delServidor;
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
    encounterId: string,
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
          encounterId,
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
    this.cantidad.set('');
    this.via.set(null);
    this.unidad.set(null);
    this.validFrom.set(new Date());
    this.validTo.set(null);
    this.duracionDias.set(null);
    this.esCronico.set(false);
    this.indicacionesPaciente.set('');
    // El diagnóstico y el favorito elegidos son de ESTA receta: la siguiente
    // arranca sin ellos, aunque sea para el mismo paciente.
    this.indicacion.set(null);
    this.favoritoElegido.set(null);
    this.errorDelFavorito.set(null);
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
