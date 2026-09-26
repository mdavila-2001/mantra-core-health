import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  ElementRef,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type {
  CarePlan,
  ClinicalSummary,
  PatientChart as ExpedienteDePaciente,
} from '../../../core/data-access/clinical/clinical.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPractitionerProfile } from '../../../core/data-access/profiles/profiles.types';
import type { OwnerType } from '../../../core/data-access/files/files.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Menu } from '../../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../../shared/components/molecules/menu/menu-item/menu-item';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { MenuTrigger } from '../../../shared/components/molecules/menu/menu-trigger/menu-trigger';
import { AttachmentDialog } from '../../../shared/components/organisms/attachment-dialog/attachment-dialog';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import {
  downloadPrescriptionPdf,
  downloadVisitPdf,
} from '../../../shared/utils/clinical-pdf/clinical-pdf';
import { contextoDeLaSesion } from '../../../shared/utils/clinical-pdf/firma-de-la-sesion';
import {
  atencionDesdeResumen,
  recetaDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { mensajeDeFalloDeEscritura } from '../mensaje-de-escritura';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record.routes';
import { AllergyBlock } from './allergy-block/allergy-block';
import { CarePlanBlock } from './care-plan-block/care-plan-block';
import type { DiagnosticoDelPlan } from './care-plan-block/care-plan-block';
import { DiagnosisBlock } from './diagnosis-block/diagnosis-block';
import type { CitaDelPaciente } from './diagnosis-block/diagnosis-block';
import { DocumentBlock } from './document-block/document-block';
import { DRAFT_BLOCK } from './draft-block';
import { FreeNoteBlock } from './free-note-block/free-note-block';
import { MedicationBlock } from './medication-block/medication-block';
import type { DiagnosticoEnFicha, RecetaEnFicha } from './medication-block/medication-block';
import { ObservationBlock } from './observation-block/observation-block';
import { PdfExportButton } from '../../../shared/components/molecules/pdf-export-button/pdf-export-button';

/** Tope por bloque. La API aplica 50 si no se pide otro. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Nombre legible de cada bloque, para el aviso de recorte. */
const NOMBRE_DE_BLOQUE: Readonly<Record<string, string>> = {
  conditions: 'diagnósticos',
  allergies: 'alergias',
  medicationRequests: 'medicación',
  observations: 'observaciones',
  encounters: 'encuentros',
  careEpisodes: 'internaciones',
  notes: 'notas',
  carePlans: 'planes de cuidados',
  documents: 'documentos',
};

/**
 * Patch v4.0.8: el campo de estado clínico que gobierna la transición
 * (`POST /clinical/conditions/:id/change-status`). Mismo target que usa el
 * catálogo del alta en `diagnosis-block`, así que comparten la única petición
 * memoizada por `SystemContextClient` — abrir la acción en varias filas a la
 * vez no dispara una consulta por fila.
 */
const TARGET_ESTADO_CLINICO = 'clinical.conditions.clinical_status_concept_id';

/** Los estados clínicos en castellano. Mismo criterio que `diagnosis-block`. */
const ETIQUETAS_DE_ESTADO_CLINICO: Readonly<Record<string, string>> = {
  COND_ACTIVE: 'Activa',
  COND_RECURRENCE: 'Recurrencia',
  COND_RELAPSE: 'Recaída',
  COND_INACTIVE: 'Inactiva',
  COND_REMISSION: 'En remisión',
  COND_RESOLVED: 'Resuelta',
};

/**
 * El alta que ofrece una pestaña del expediente.
 *
 * `rotulo` va en el botón, `titulo` en el encabezado del modal: no son lo mismo
 * —«Nueva observación» contra «Registrar una observación»— y repetir el primero
 * arriba del formulario deja el modal diciendo dos veces lo que ya dijo el
 * botón que lo abrió.
 */
export interface AltaDelExpediente {
  readonly rotulo: string;
  readonly titulo: string;
  /** El `data-testid` del botón. Estable: las pruebas de navegador lo usan. */
  readonly testId: string;
}

/**
 * Qué se puede **crear** desde cada pestaña del expediente.
 *
 * ## Por qué son siete y antes eran dos
 *
 * Porque el expediente ofrecía crear un diagnóstico y una alergia, y las otras
 * seis pestañas eran de sólo lectura aunque el contrato de las siete estuviera
 * publicado. Quien venía a cargar la presión que acababa de tomar, o a asentar
 * el laboratorio que la persona trajo en la mano, no tenía dónde: la única
 * puerta era abrir una atención, que es un acto clínico distinto —abre
 * encuentro— y que no siempre corresponde.
 *
 * ## El expediente sigue siendo lectura
 *
 * Registrar acá **no es atender**: no abre encuentro, no cierra nada y el
 * registro se ata a una cita ya existente o a ninguna. Es la misma regla con la
 * que entró el alta de diagnóstico, extendida a las que faltaban.
 *
 * «Encuentros» queda deliberadamente fuera: abrir una consulta desde el
 * expediente es exactamente el atajo que la pantalla dejó de ofrecer —atender
 * nace de «Mis citas», donde está el turno que lo justifica—.
 */
const ALTAS_DEL_EXPEDIENTE: Readonly<Record<string, AltaDelExpediente>> = {
  diagnosticos: {
    rotulo: 'Nuevo diagnóstico',
    titulo: 'Nuevo diagnóstico',
    testId: 'expediente-nuevo-diagnostico',
  },
  alergias: {
    rotulo: 'Nueva alergia',
    titulo: 'Nueva alergia',
    testId: 'expediente-nueva-alergia',
  },
  medicacion: {
    rotulo: 'Nueva receta',
    titulo: 'Prescribir medicación',
    testId: 'expediente-nueva-receta',
  },
  observaciones: {
    rotulo: 'Nueva observación',
    titulo: 'Registrar una observación',
    testId: 'expediente-nueva-observacion',
  },
  notas: {
    rotulo: 'Nueva nota',
    titulo: 'Escribir una nota clínica',
    testId: 'expediente-nueva-nota',
  },
  planes: {
    rotulo: 'Nuevo plan',
    titulo: 'Abrir un plan de cuidados',
    testId: 'expediente-nuevo-plan',
  },
  documentos: {
    rotulo: 'Nuevo documento',
    titulo: 'Registrar un documento',
    testId: 'expediente-nuevo-documento',
  },
};

/** Una fila de cualquiera de las tablas del expediente, ya sin uuid. */
export interface FilaClinica {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly estado: string;
  readonly cuando: Date | null;
  readonly detalle: string;

  /**
   * Los vínculos clínicos del registro, en pares rótulo/valor y ya en palabras.
   *
   * ## Por qué están en la fila y se muestran en el modal
   *
   * La corrección del 10/09/2026 pide que un registro dependiente deje ver con
   * qué encuentro y con qué diagnóstico está relacionado. En la tabla no
   * entran: cuatro columnas más volverían ilegible un resumen que ya lleva
   * cuatro. Así que viajan con la fila y se leen en el detalle, que es lo que
   * el propio pedido admite —«el listado puede usar referencias compactas»—.
   *
   * ## Y por qué a veces el valor dice que no hay vínculo
   *
   * Porque el contrato no guarda lo mismo en todos los bloques, y presentar una
   * asociación fabricada sería peor que decirlo. Ver
   * {@link PatientChart.vinculosDe}: cada bloque declara lo que el backend
   * devuelve de verdad, y donde no hay campo, lo dice.
   */
  readonly vinculos: readonly VinculoClinico[];

  /**
   * El diagnóstico que motiva la fila — sólo la medicación lo llena hoy.
   *
   * «Siempre que se haga una receta médica debe de poderse poner un diagnóstico
   * o porqué de la receta», y para que sirva de algo tiene que **verse** en la
   * tabla, no sólo en el detalle. Puede ser el nombre de una condición
   * registrada o el motivo escrito a mano.
   */
  readonly diagnostico?: string;

  /**
   * La consulta a la que pertenece la fila, en palabras.
   *
   * Es lo que agrupa las líneas de una misma receta: en este modelo **cada
   * `medication_request` es una línea**, y lo que las junta es el encuentro y
   * su fecha. Un «número de receta» compartido no existe en el modelo — ver la
   * nota de P24.
   */
  readonly cita?: string;
}

/** Un vínculo clínico, ya resuelto a palabras. */
export interface VinculoClinico {
  readonly rotulo: string;
  readonly valor: string;
}

/** Lo que la pantalla necesita de las dos lecturas, ya unido. */
interface Expediente {
  readonly resumen: ClinicalSummary;
  readonly chart: ExpedienteDePaciente;
}

/**
 * **Expediente clínico** de una persona — `clinical` (M08) + `chart` (M15).
 *
 * ## Dos lecturas, una pantalla
 *
 * `GET /clinical/patients/:id/summary` trae lo estructurado —diagnósticos,
 * alergias, medicación, observaciones, encuentros— y
 * `GET /charts/patients/:id/chart` lo narrativo —notas, planes, documentos—.
 * La separación es de escritura: quien atiende no piensa en dos módulos.
 *
 * Van en `forkJoin` y **la pantalla exige las dos**: media historia clínica es
 * peor que ninguna, porque no se distingue de una historia completa que no
 * tiene alergias registradas.
 *
 * ## El nombre del paciente es opcional a propósito
 *
 * Ninguna de las dos lecturas lo trae, y `GET /profiles/patients/:id` pide
 * `SECURITY_ADMIN` — un rol que quien atiende no tiene. Se intenta y, si
 * responde `403`, el encabezado dice «Expediente clínico» y sigue. Tumbar el
 * expediente porque no se pudo poner un nombre en el título sería cambiar un
 * problema cosmético por uno clínico.
 *
 * ## Lo que quedó recortado se dice
 *
 * `truncated` nombra los bloques cortados por el tope. Un expediente al que le
 * faltan notas sin avisar es un expediente que miente, y en clínica esa mentira
 * se lee como «no hay antecedentes».
 *
 * ## Es de lectura: lo que se escribe vive en «Atención»
 *
 * Hasta acá la pantalla hacía las dos cosas —la tarjeta del encuentro pegada al
 * costado de las tablas y, debajo, los bloques de registro—, y se estorbaban:
 * la historia cedía una columna de 24rem a un formulario de una sola pregunta,
 * y quien venía a consultar un antecedente se llevaba encima un odontograma que
 * no iba a tocar. Todo eso se mudó a `EncounterWorkspace`, a un botón de
 * distancia en la cabecera.
 *
 * Queda una sola escritura, y no por olvido: **el estado clínico de un
 * diagnóstico** (patch v4.0.8) se cambia desde su propia fila, porque es una
 * corrección de lo que la tabla está mostrando y no un registro de la consulta
 * de hoy. Y con ella el adjunto de esa condición (ALV-033), por lo mismo.
 *
 * ## Las dos descargas
 *
 * El expediente entero en PDF —el botón de la cabecera— y la historia clínica
 * **de una atención**, desde la fila de su encuentro. Las dos se arman de
 * `datos()`, que es lo mismo que se está mostrando: no se vuelve a pedir nada
 * ni se lee la pantalla.
 */
@Component({
  selector: 'app-patient-chart',
  imports: [
    Alert,
    AppButton,
    AllergyBlock,
    AttachmentDialog,
    Badge,
    CarePlanBlock,
    ConceptSelect,
    ContentDialog,
    DiagnosisBlock,
    DataTable,
    DatePipe,
    DocumentBlock,
    FreeNoteBlock,
    MedicationBlock,
    Menu,
    MenuItem,
    MenuTrigger,
    NavIcon,
    ObservationBlock,
    PdfExportButton,
    PageHeader,
    Tab,
    Tabs,
    TutorialTarget,
    ViewStateHost,
  ],
  templateUrl: './patient-chart.html',
  styleUrl: './patient-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientChart {
  /**
   * El bloque que se exporta a PDF.
   *
   * Se toma por referencia y no dejando que el botón busque su contenedor,
   * porque el botón vive en la cabecera de la página: su contenedor sería la
   * cabecera, y el PDF saldría con el título y nada más.
   */
  protected readonly raizPdf = viewChild<ElementRef<HTMLElement>>('raizPdf');

  /** El elemento exportable, o `null` mientras el expediente no se pintó. */
  protected raizExportable(): HTMLElement | null {
    return this.raizPdf()?.nativeElement ?? null;
  }

  private readonly clinical = inject(ClinicalClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  private readonly celdaPrincipal =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaPrincipal');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaEstado');
  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaCuando');
  private readonly celdaDocumento =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaDocumento');
  /** Patch v4.0.8: sólo la usa el bloque `diagnosticos`, ver {@link columnasPara}. */
  private readonly celdaAcciones =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaAcciones');
  /** El botón que abre el detalle en modal. La lleva **todo** bloque. */
  private readonly celdaVer =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaVer');
  /** El botón de adjuntos de los bloques que no tienen menú propio. */
  private readonly celdaAdjuntos =
    viewChild.required<TemplateRef<{ $implicit: FilaClinica }>>('celdaAdjuntos');

  /**
   * El perfil que se está mirando, leído del segmento `:profileId`.
   *
   * De la ruta activa y no como `input()` porque la aplicación no habilita
   * `withComponentInputBinding()`: activarlo acá cambiaría cómo se enlazan las
   * entradas de todas las pantallas.
   */
  private readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  /** El mismo perfil, para los bloques hijos que escriben contra él. */
  protected readonly pacienteDeLaFicha = this.profileId;

  protected readonly expediente = signal<ViewState<Expediente>>(loading());

  /** Nombre del paciente si se pudo leer; vacío si el padrón está prohibido. */
  private readonly nombre = signal('');

  /**
   * El perfil profesional de **quien está mirando**, para firmar el papel.
   *
   * Es de la sesión y no del expediente: no se relee al pasar de un paciente a
   * otro. `null` mientras no se sabe —y también cuando la cuenta no ejerce, que
   * es un caso normal y no un error.
   */
  private readonly perfilPropio = signal<OwnPractitionerProfile | null>(null);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed(() => dataOf(this.expediente()));

  protected readonly titulo = computed(() =>
    this.nombre() === '' ? 'Expediente clínico' : this.nombre(),
  );

  protected readonly subtitulo = computed(() =>
    this.nombre() === ''
      ? 'Historia clínica y expediente de la persona atendida.'
      : 'Historia clínica y expediente.',
  );

  /**
   * La atención que ya está abierta con esta persona, si la hay.
   *
   * El expediente **dejó de ser un origen de la atención**: atender nace sólo
   * de «Mis citas», que es donde está el turno que la justifica. Entrar a
   * atender desde acá salteaba ese paso y dejaba consultas sin cita detrás.
   *
   * Lo que sí corresponde es la continuación: quien está atendiendo, se vino a
   * consultar un antecedente y quiere volver, tiene por dónde. Un encuentro
   * está abierto mientras no tenga `endAt` — el mismo criterio que la columna
   * «En curso» de la tabla de encuentros.
   */
  protected readonly atencionEnCurso = computed(() =>
    (this.datos()?.resumen.encounters ?? []).some((fila) => fila.endAt === undefined),
  );

  /**
   * La ruta de navegación, con el paciente como último escalón.
   *
   * El anteúltimo pasa a ser enlace: desde un expediente, volver a elegir otra
   * persona es la salida más pedida.
   */
  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: CLINICAL_RECORD_ROUTE },
      { label: this.titulo() },
    ];
  });

  /* -- Los bloques, ya traducidos ----------------------------------------- */

  protected readonly diagnosticos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.conditions ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.onsetAt ?? fila.createdAt,
      detalle: fila.resolvedAt === undefined ? '' : 'Resuelto',
      vinculos: [{ rotulo: 'Encuentro', valor: this.describirEncuentro(fila.encounterId) }],
    })),
  );

  protected readonly alergias = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.allergies ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.substanceConceptId),
      secundario: this.label(fila.categoryConceptId),
      estado: this.label(fila.clinicalStatusConceptId),
      cuando: fila.createdAt,
      // La criticidad es el dato que decide una conducta: va en el detalle, no
      // escondida en una columna que se pliega en móvil.
      detalle: this.label(fila.criticalityConceptId),
      // `AllergyIntolerance` no tiene `encounterId` ni referencia a condición:
      // ni en la escritura (`NewAllergyIntolerance`) ni en la lectura. Decirlo
      // es lo honesto; poner una etiqueta de encuentro acá sería inventarla.
      vinculos: [
        {
          rotulo: 'Vínculos clínicos',
          valor: 'El registro de alergias no guarda encuentro ni diagnóstico.',
        },
      ],
    })),
  );

  protected readonly medicacion = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.medicationConceptId),
      secundario: [fila.doseText, fila.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(fila.statusConceptId),
      cuando: fila.validFrom ?? fila.createdAt,
      detalle: fila.validTo === undefined ? '' : 'Con fin previsto',
      diagnostico: this.motivoDeLaReceta(fila),
      cita: this.citaDeLaFila(fila.encounterId, fila.validFrom ?? fila.createdAt),
      // El diagnóstico sí vuelve de la lectura (`indicationConditionId`) y es
      // lo que hace verificable el vínculo después de recargar. El encuentro
      // **también** vuelve: `MedicationRequest.encounterId` quedó declarado al
      // integrar la rama de adjuntos múltiples, así que acá se resuelve en vez
      // de decir que el resumen no lo devuelve.
      vinculos: [
        { rotulo: 'Diagnóstico', valor: this.describirDiagnostico(fila.indicationConditionId) },
        { rotulo: 'Encuentro', valor: this.describirEncuentro(fila.encounterId) },
      ],
    })),
  );

  /**
   * Para qué es la receta: el diagnóstico registrado, o el motivo escrito.
   *
   * El concepto gana sobre el texto libre, igual que en el alta: el texto sólo
   * tenía sentido para quien no encontró un diagnóstico registrado.
   */
  private motivoDeLaReceta(receta: {
    readonly indicationConditionId?: string;
    readonly indicationText?: string;
  }): string {
    if (receta.indicationConditionId !== undefined) {
      const condicion = (this.datos()?.resumen.conditions ?? []).find(
        (dx) => dx.id === receta.indicationConditionId,
      );
      // Sin la condición a la vista —recortada por el tope de la lectura— se
      // dice que la hay en vez de callarlo: «sin diagnóstico» sería falso.
      return condicion === undefined
        ? 'Diagnóstico de la historia'
        : this.label(condicion.codeConceptId);
    }
    return receta.indicationText ?? '';
  }

  /** La consulta de una fila, o su fecha si no cuelga de ninguna. */
  private citaDeLaFila(encounterId: string | undefined, fecha: Date | null | undefined): string {
    if (encounterId !== undefined) {
      const encuentro = (this.datos()?.resumen.encounters ?? []).find((e) => e.id === encounterId);
      if (encuentro !== undefined) {
        return this.etiquetaDeCita(encuentro);
      }
    }
    return fecha === undefined || fecha === null ? '' : this.fechaCorta(fecha);
  }

  protected readonly observaciones = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.observations ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.codeConceptId),
      secundario: this.valorDe(fila),
      estado: this.label(fila.statusConceptId),
      cuando: fila.effectiveStartAt ?? null,
      detalle: this.label(fila.interpretationConceptId),
      vinculos: [{ rotulo: 'Encuentro', valor: this.describirEncuentro(fila.encounterId) }],
    })),
  );

  protected readonly encuentros = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.resumen.encounters ?? []).map((fila) => ({
      id: fila.id,
      principal: this.label(fila.classConceptId),
      secundario: fila.reasonText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.startAt ?? null,
      detalle: fila.endAt === undefined ? 'En curso' : 'Cerrado',
      // Los diagnósticos del encuentro, derivados de los que declaran ese
      // `encounterId`. Es la relación real y en el sentido correcto: el
      // encuentro es el contexto y el diagnóstico cuelga de él, no al revés.
      vinculos: [
        { rotulo: 'Diagnósticos del encuentro', valor: this.diagnosticosDelEncuentro(fila.id) },
      ],
    })),
  );

  protected readonly notas = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.notes ?? []).map((fila) => ({
      id: fila.noteId,
      principal: fila.chiefComplaintText ?? this.label(fila.noteTypeConceptId),
      secundario: fila.assessmentText ?? fila.subjectiveText ?? '',
      estado: this.label(fila.lifecycleStatusConceptId),
      cuando: fila.signedAt ?? fila.createdAt,
      // Derivado por el backend: no hace falta resolver terminología para saber
      // si la persona lo ve en su portal, y es un dato que cambia qué se escribe.
      detalle: fila.releasedToPatient ? 'Visible para la persona' : '',
      vinculos: [{ rotulo: 'Encuentro', valor: this.describirEncuentro(fila.encounterId) }],
    })),
  );

  protected readonly planes = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.carePlans ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.goalText ?? 'Plan sin objetivo escrito',
      secundario: `${fila.activities.length} actividad${fila.activities.length === 1 ? '' : 'es'}`,
      estado: this.label(fila.statusConceptId),
      cuando: fila.startDate ?? fila.createdAt,
      detalle: this.motivoDelPlan(fila),
      // `CarePlan` no trae encuentro en la lectura de `chart`.
      vinculos: [{ rotulo: 'Motivo', valor: this.motivoDelPlan(fila) }],
    })),
  );

  protected readonly documentos = computed<readonly FilaClinica[]>(() =>
    (this.datos()?.chart.documents ?? []).map((fila) => ({
      id: fila.id,
      principal: fila.title ?? 'Documento sin título',
      secundario: fila.authorText ?? '',
      estado: this.label(fila.statusConceptId),
      cuando: fila.documentDate ?? fila.createdAt,
      detalle: fila.isExternal === true ? 'Externo' : '',
      vinculos: [
        {
          rotulo: 'Vínculos clínicos',
          valor: 'El documento del expediente no guarda encuentro ni diagnóstico.',
        },
      ],
    })),
  );

  /**
   * Los ocho bloques con su rótulo, para dibujar las pestañas de una pasada.
   *
   * Cada uno trae **sus** columnas y no las de todos: `detalle` significa una
   * cosa distinta en cada bloque —la criticidad de una alergia, si un encuentro
   * sigue abierto— y en varios no significa nada. Una columna «Detalle» vacía de
   * punta a punta no es un dato que falta: es una columna que sobra, y se come
   * el ancho que la tabla necesita para lo que sí trae.
   */
  protected readonly bloques = computed(() =>
    [
      { clave: 'diagnosticos', titulo: 'Diagnósticos', filas: this.diagnosticos() },
      { clave: 'alergias', titulo: 'Alergias', filas: this.alergias() },
      { clave: 'medicacion', titulo: 'Medicación', filas: this.medicacion() },
      { clave: 'observaciones', titulo: 'Observaciones', filas: this.observaciones() },
      { clave: 'encuentros', titulo: 'Encuentros', filas: this.encuentros() },
      { clave: 'notas', titulo: 'Notas', filas: this.notas() },
      { clave: 'planes', titulo: 'Planes de cuidados', filas: this.planes() },
      { clave: 'documentos', titulo: 'Documentos', filas: this.documentos() },
    ].map((bloque) => ({
      ...bloque,
      columnas: this.columnasPara(bloque.filas, bloque.clave),
    })),
  );

  /* -- El alta de diagnóstico y de alergia desde el expediente -------------
     «Primero debería poder crear un diagnóstico nuevo sobre el expediente del
     paciente» — pedido del cliente que trae la rama de adjuntos múltiples. El
     expediente sigue siendo lectura: registrar un diagnóstico no es atender —no
     abre encuentro, no cierra nada— y por eso el alta va en modal y el bloque
     es EL MISMO de «Atención», con el encuentro relajado. */

  /**
   * Si esta sesión puede escribir en la historia.
   *
   * El frontend **no autoriza** —eso lo hace la API— pero tampoco ofrece lo que
   * va a terminar en un 403: quien mira un expediente sin rol clínico no tiene
   * por qué ver un botón que no le va a funcionar.
   */
  protected readonly puedeEscribir = computed(
    () =>
      this.auth.activeTenantId() !== null &&
      this.auth.roles().some((rol) => rol === 'PRACTITIONER' || rol === 'CLINICIAN'),
  );

  /**
   * La bajada del modal, **con el nombre y nunca con el identificador**.
   *
   * `profileId()` es el uuid del perfil, y ponerlo acá dejaba «Se registra en la
   * historia de c2aa6dda-67d6-…» delante de quien atiende. El médico no tiene
   * por qué ver un identificador nunca.
   */
  protected readonly descripcionDelAlta = computed(() =>
    this.nombre() === ''
      ? 'Se registra en la historia de esta persona.'
      : `Se registra en la historia de ${this.nombre()}.`,
  );

  /**
   * El bloque cuyo modal de alta está abierto, o `null`.
   *
   * Una señal para las siete y no una por bloque: sólo puede haber un modal a
   * la vez —el `<dialog>` nativo se lleva el foco y el fondo— y siete banderas
   * booleanas admitirían estados que la pantalla no puede mostrar.
   */
  protected readonly altaAbierta = signal<string | null>(null);

  /**
   * El bloque de alta montado ahora mismo, sea cual sea. Sin `.required`: la
   * plantilla lo consulta en el mismo pase en el que `@switch` lo crea, igual
   * que `attachment-dialog.ts` hace con su `uploader` — un `viewChild.required`
   * ahí revienta antes de que el bloque exista.
   */
  private readonly bloqueDelAlta = viewChild(DRAFT_BLOCK);

  /** El `<dialog>` del alta, para cerrarlo tras confirmar el descarte. */
  private readonly dialogoDelAlta = viewChild<ContentDialog>('dialogoDelAlta');

  /**
   * Si el alta se puede cerrar sola: no hay bloque montado (recién se abrió) o
   * el montado no tiene nada escrito.
   */
  protected readonly altaSinCambios = computed(
    () => !(this.bloqueDelAlta()?.tieneCambiosPendientes() ?? false),
  );

  /**
   * Intento de cerrar el alta con algo sin registrar.
   *
   * Mismo patrón que `attachment-dialog.alIntentarCerrar()`: se pregunta, y si
   * se confirma se cierra por `close()` — nunca `altaAbierta.set(null)` a
   * secas, que saltearía la restauración de foco del organismo.
   */
  protected async pedirDescarteDelAlta(): Promise<void> {
    const descartar = await this.dialogs.confirm({
      title: '¿Descartar lo escrito?',
      message: 'Todavía no se registró. Si cerrás, lo que cargaste en este formulario se pierde.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir escribiendo',
      destructive: true,
    });
    if (descartar) {
      this.dialogoDelAlta()?.close();
    }
  }

  /** El alta de un bloque, o `null` si ese bloque no tiene una. */
  protected altaDe(clave: string): AltaDelExpediente | undefined {
    return ALTAS_DEL_EXPEDIENTE[clave];
  }

  /** Si la pestaña tiene que dibujar su botón de alta. */
  protected ofreceAlta(clave: string): boolean {
    return this.puedeEscribir() && this.altaDe(clave) !== undefined;
  }

  protected abrirAlta(clave: string): void {
    this.altaAbierta.set(clave);
  }

  protected cerrarAlta(): void {
    this.altaAbierta.set(null);
  }

  /** El encabezado del modal abierto. Nunca «Nuevo registro» a secas. */
  protected readonly tituloDelAlta = computed(
    () => ALTAS_DEL_EXPEDIENTE[this.altaAbierta() ?? '']?.titulo ?? '',
  );

  /**
   * Registrado lo que fuera, se cierra el modal y se relee la historia.
   *
   * Uno solo para las siete altas: lo que cambia es la pestaña, y lo que hay
   * que hacer después es lo mismo en todas —el expediente vuelve a leer y la
   * fila aparece porque el servidor la tiene, no porque la pintáramos—.
   */
  protected altaRegistrada(): void {
    this.altaAbierta.set(null);
    this.recargar();
  }

  /* -- Lo que los bloques de alta necesitan del expediente ------------------
     Baja hecho y traducido, no se vuelve a pedir: es la misma lista que pintan
     las pestañas, y dos lecturas de la misma lista pueden discrepar. */

  /** Las recetas de la persona, en la forma que `MedicationBlock` consume. */
  protected readonly recetasEnFicha = computed<readonly RecetaEnFicha[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((receta) => ({
      id: receta.id,
      medicamento: this.label(receta.medicationConceptId),
      indicacion: [receta.doseText, receta.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(receta.statusConceptId),
      firmada: receta.signedAt !== undefined,
      emitida: receta.issuedAt !== undefined,
    })),
  );

  /**
   * Los diagnósticos como opciones de «¿para qué es esta receta?».
   *
   * **Todos**, no sólo los activos: renovar el tratamiento de una condición ya
   * resuelta es un acto clínico legítimo. Lo que sí lleva la etiqueta es el
   * estado, para que elegir una resuelta sea una decisión y no un descuido.
   */
  protected readonly diagnosticosParaReceta = computed<readonly DiagnosticoEnFicha[]>(() =>
    (this.datos()?.resumen.conditions ?? []).map((dx) => {
      const principal = this.label(dx.codeConceptId);
      return {
        id: dx.id,
        etiqueta: dx.resolvedAt === undefined ? principal : `${principal} · Resuelto`,
      };
    }),
  );

  /**
   * El motivo del plan: el diagnóstico del que cuelga, o lo que se escribió a
   * mano cuando no había uno. Siempre hay uno de los dos en lo que se abre
   * desde acá; los planes viejos de la semilla pueden no tener ninguno.
   */
  private motivoDelPlan(fila: CarePlan): string {
    const dx = this.diagnosticosParaElPlan().find((d) => d.id === fila.conditionId);
    if (dx !== undefined) {
      return dx.etiqueta;
    }
    return fila.reasonText ?? 'Sin motivo registrado';
  }

  /** Los mismos diagnósticos, para colgar de uno el plan de cuidados. */
  protected readonly diagnosticosParaElPlan = computed<readonly DiagnosticoDelPlan[]>(() =>
    this.diagnosticosParaReceta(),
  );

  /**
   * Los `medicationConceptId` ya registrados, para el chequeo de interacciones.
   *
   * Toda la medicación y no sólo la vigente: advertir de más sobre algo que ya
   * no se toma es un error mucho más chico que no advertir sobre algo que sí.
   */
  protected readonly medicacionActivaConceptIds = computed<readonly string[]>(() =>
    Array.from(
      new Set((this.datos()?.resumen.medicationRequests ?? []).map((r) => r.medicationConceptId)),
    ),
  );

  /**
   * Las citas del paciente, para «¿en qué cita se detectó?».
   *
   * **Todas**, no sólo las abiertas: el cliente pidió poder atarlo a «una cita
   * ya existente y/o finalizada», y el caso corriente es justamente registrar
   * después lo que se vio en una consulta que ya cerró. De la más reciente a la
   * más vieja, que es el orden en que se busca una.
   */
  protected readonly citasParaElDiagnostico = computed<readonly CitaDelPaciente[]>(() =>
    [...(this.datos()?.resumen.encounters ?? [])]
      .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
      .map((encuentro) => ({
        id: encuentro.id,
        etiqueta: this.etiquetaDeCita(encuentro),
        enCurso: encuentro.endAt === undefined,
      })),
  );

  /** «9 sept 2026, 08:00 · Chequeo anual». Sin uuid y sin jerga. */
  private etiquetaDeCita(encuentro: {
    readonly startAt?: Date;
    readonly reasonText?: string;
    readonly classConceptId?: string;
  }): string {
    const cuando =
      encuentro.startAt === undefined
        ? 'Sin fecha'
        : encuentro.startAt.toLocaleString('es-BO', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    const motivo = encuentro.reasonText ?? this.label(encuentro.classConceptId);
    return motivo === '' || motivo === SIN_DATO ? cuando : `${cuando} · ${motivo}`;
  }

  /* -- Los vínculos clínicos, resueltos a palabras -------------------------
     Lo que la corrección del 10/09/2026 pide ver de cada registro: con qué
     encuentro y con qué diagnóstico está relacionado. Se resuelve contra lo que
     el expediente **ya leyó** —el mismo resumen que pinta las tablas— y no con
     una petición por fila: dos lecturas de la misma lista pueden discrepar. */

  /**
   * El encuentro en palabras, o la ausencia dicha en voz alta.
   *
   * Un registro viejo sin `encounterId` es un caso legítimo —el campo es
   * opcional en el contrato desde siempre— y se presenta como lo que es. No se
   * le asigna el encuentro más reciente ni el primero de la lista: eso sería
   * fabricar la asociación que esta pantalla existe para mostrar.
   */
  protected describirEncuentro(encounterId: string | undefined): string {
    if (encounterId === undefined || encounterId === '') {
      return 'Sin encuentro registrado';
    }
    const encuentro = (this.datos()?.resumen.encounters ?? []).find(
      (fila) => fila.id === encounterId,
    );
    if (encuentro === undefined) {
      // Puede haber quedado fuera del tope de 50 del bloque: existe, pero no
      // está en esta lectura. Decir «sin encuentro» sería falso.
      return 'Encuentro no incluido en esta lectura';
    }
    const clase = this.label(encuentro.classConceptId);
    const cuando = this.fechaCorta(encuentro.startAt);
    return [clase, cuando].filter((parte) => parte !== '').join(' · ');
  }

  /**
   * El diagnóstico en palabras: el `indicationConditionId` de la receta.
   *
   * Se resuelve contra los diagnósticos del propio expediente porque es un
   * `clinical.conditions.id` y no un concepto de terminología.
   */
  protected describirDiagnostico(conditionId: string | undefined): string {
    if (conditionId === undefined || conditionId === '') {
      return 'Sin diagnóstico asociado';
    }
    const condicion = (this.datos()?.resumen.conditions ?? []).find(
      (fila) => fila.id === conditionId,
    );
    return condicion === undefined
      ? 'Diagnóstico no incluido en esta lectura'
      : this.label(condicion.codeConceptId);
  }

  /** Los diagnósticos documentados en un encuentro, o la ausencia. */
  protected diagnosticosDelEncuentro(encounterId: string): string {
    const codigos = (this.datos()?.resumen.conditions ?? [])
      .filter((fila) => fila.encounterId === encounterId)
      .map((fila) => this.label(fila.codeConceptId));
    return codigos.length === 0
      ? 'Sin diagnósticos documentados en este encuentro'
      : codigos.join(', ');
  }

  /** Una fecha corta, sin depender del `DatePipe` de la plantilla. */
  private fechaCorta(fecha: Date | undefined): string {
    if (fecha === undefined) {
      return '';
    }
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(fecha);
  }

  /* -- El detalle de una fila, en modal ------------------------------------
     Nunca dentro del listado: la regla principal de la corrección del
     10/09/2026. La tabla queda de lectura y de acá no sale ningún formulario
     debajo de la fila. */

  /** La fila abierta en el modal de detalle, o `null`. */
  protected readonly filaEnDetalle = signal<{
    readonly fila: FilaClinica;
    readonly bloque: string;
  } | null>(null);

  /**
   * Abre el detalle de una fila.
   *
   * El bloque se deduce de dónde está la fila y no se pasa por parámetro: la
   * plantilla de celda es **una** para las ocho tablas —el organismo la recibe
   * por `ColumnDef.cell` y sólo le entrega la fila—, así que la alternativa era
   * ocho plantillas iguales con una cadena distinta.
   */
  protected verDetalle(fila: FilaClinica): void {
    const bloque = this.bloques().find((candidato) =>
      candidato.filas.some((otra) => otra.id === fila.id),
    );
    this.filaEnDetalle.set({ fila, bloque: bloque?.clave ?? '' });
  }

  protected cerrarDetalle(): void {
    this.filaEnDetalle.set(null);
  }

  /** El título del modal: específico del bloque, nunca «Detalle» a secas. */
  protected readonly tituloDelDetalle = computed(() => {
    const abierta = this.filaEnDetalle();
    if (abierta === null) {
      return '';
    }
    const titulos: Readonly<Record<string, string>> = {
      diagnosticos: 'Detalle del diagnóstico',
      alergias: 'Detalle de la alergia',
      medicacion: 'Detalle de la receta',
      observaciones: 'Detalle de la observación',
      encuentros: 'Detalle del encuentro',
      notas: 'Detalle de la nota clínica',
      planes: 'Detalle del plan de cuidados',
      documentos: 'Detalle del documento',
    };
    return titulos[abierta.bloque] ?? 'Detalle del registro';
  });

  /**
   * La identificación mínima del paciente, arriba del detalle.
   *
   * El nombre cuando se pudo leer y el identificador cuando no —el padrón pide
   * `SECURITY_ADMIN` y quien atiende no lo tiene—. No se repite la ficha entera:
   * el detalle es de un registro, no de la persona.
   */
  protected readonly contextoDelPaciente = computed(() =>
    this.nombre() === '' ? `Paciente ${this.profileId()}` : this.nombre(),
  );

  /* -- El aviso de apertura ------------------------------------------------
     Lo que hay que saber ANTES de abrir una pestaña. Vivía en una banda fija
     arriba de la página, y una banda que está siempre se deja de leer: ocupaba
     media pantalla en cada visita y empujaba las pestañas abajo del pliegue.
     Un modal tampoco: un cuadro que hay que cerrar con un clic para poder
     seguir es la misma interrupción con otra forma. Ahora se dice una vez, por
     toast, al abrir el expediente (2026-09-25). El toast es sólo texto: el
     link «Volver a la consulta» que el modal tenía no tiene dónde ir en un
     toast y se sacó — quien tiene una consulta en curso lo sabe por el aviso,
     y navega por su cuenta. */

  /**
   * Las alergias, de frente al entrar, no en la segunda pestaña.
   *
   * Es el único bloque del expediente que cambia una conducta **antes** de
   * leerlo: recetar sin haberlas visto es el error que este aviso existe para
   * evitar. No se filtra por criticidad —la criticidad llega como concepto y
   * deducirla del texto sería adivinar—: se muestran todas, que son pocas.
   */
  protected readonly alergiasDestacadas = this.alergias;

  /** Ya se avisó una vez en esta visita del expediente: no se repite. */
  private readonly avisosMostrados = signal(false);

  /** Junta alergias y consulta en curso en, como mucho, dos toasts. */
  private avisarAlAbrir(alergias: readonly FilaClinica[], enCurso: boolean): void {
    this.avisosMostrados.set(true);
    if (alergias.length > 0) {
      this.toasts.warning(
        alergias
          .map((alergia) => (alergia.detalle === '' ? alergia.principal : `${alergia.principal} (${alergia.detalle})`))
          .join(' · '),
        'Alergias',
      );
    }
    if (enCurso) {
      this.toasts.info('Tenés una consulta en curso con esta persona.', 'Consulta en curso');
    }
  }

  /**
   * Aviso de recorte, en palabras.
   *
   * Se juntan los dos `truncated` porque para quien lee es un solo expediente:
   * que el corte venga de `clinical` o de `chart` es una división del backend
   * que no le cambia nada.
   */
  protected readonly recorte = computed(() => {
    const datos = this.datos();
    if (datos === null) {
      return '';
    }
    const bloques = [...datos.resumen.truncated, ...datos.chart.truncated].map(
      (clave) => NOMBRE_DE_BLOQUE[clave] ?? clave,
    );
    return bloques.length === 0 ? '' : bloques.join(', ');
  });

  protected readonly tope = TOPE;

  /* -- Patch v4.0.8: cambiar el estado clínico de un diagnóstico ----------- */

  protected readonly targetEstadoClinico = TARGET_ESTADO_CLINICO;
  protected readonly etiquetasDeEstadoClinico = ETIQUETAS_DE_ESTADO_CLINICO;

  /**
   * El estado destino elegido para cada fila, por `conditionId`.
   *
   * Un registro por fila —no una señal compartida— porque el expediente puede
   * tener varios diagnósticos listados a la vez y elegir el destino de uno no
   * debe pisar lo que se venía eligiendo en otro.
   */
  private readonly destinosDeEstado = signal<Readonly<Record<string, string | null>>>({});

  /** La condición cuyo cambio de estado está en vuelo, o `null`. */
  protected readonly cambiandoEstado = signal<string | null>(null);

  /**
   * La condición cuyo modal de cambio de estado está abierto, o `null`.
   *
   * El selector y su «Aplicar» vivían **dentro de la celda** de cada fila: la
   * celda crecía al desplegarse y el alto de la tabla dependía de si alguien
   * había tocado el menú. Cualquier cambio sobre un registro existente que
   * pida datos va en modal; la fila sólo tiene su menú.
   */
  protected readonly cambiandoEstadoDe = signal<FilaClinica | null>(null);

  /** El `<dialog>` del cambio de estado, para cerrarlo tras confirmar el descarte. */
  private readonly dialogoDeEstado = viewChild<ContentDialog>('dialogoDeEstado');

  /** Si el modal puede cerrarse solo: no hay destino elegido sin aplicar. */
  protected readonly estadoSinCambios = computed(() => {
    const fila = this.cambiandoEstadoDe();
    return fila === null || this.destinoEstadoDe(fila.id) === null;
  });

  /** Intento de cerrar con un destino elegido y no aplicado. */
  protected async pedirDescarteDelEstado(): Promise<void> {
    const descartar = await this.dialogs.confirm({
      title: '¿Descartar el cambio de estado?',
      message: 'Elegiste un estado y no lo aplicaste. Si cerrás, el diagnóstico queda como está.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir editando',
      destructive: true,
    });
    if (descartar) {
      this.dialogoDeEstado()?.close();
    }
  }

  protected abrirCambioDeEstado(fila: FilaClinica): void {
    this.cambiandoEstadoDe.set(fila);
  }

  protected cerrarCambioDeEstado(): void {
    const fila = this.cambiandoEstadoDe();
    if (fila !== null) {
      // Lo elegido y no aplicado no sobrevive al cierre: si el modal se
      // reabriera con un destino puesto de la vez anterior, «Aplicar» mandaría
      // un cambio que quien lo toca no acaba de elegir.
      this.elegirDestinoEstado(fila.id, null);
    }
    this.cambiandoEstadoDe.set(null);
  }

  /** El destino elegido para esa fila, o `null` si no se eligió ninguno. */
  protected destinoEstadoDe(conditionId: string): string | null {
    return this.destinosDeEstado()[conditionId] ?? null;
  }

  protected elegirDestinoEstado(conditionId: string, destino: string | null): void {
    this.destinosDeEstado.update((actual) => ({ ...actual, [conditionId]: destino }));
  }

  /* -- ALV-033: adjuntar archivos a un registro ya existente ---------------
     El alta ofrece adjuntar apenas se registra (`app-diagnosis-block`), pero
     eso sólo alcanza al registro recién creado. Esta columna cubre el resto de
     la historia: cualquier fila ya listada puede recibir adjuntos, no sólo la
     última. Y no sólo los diagnósticos: «en todos los formularios debe poderse
     poner un adjunto… incluso en la medicación» — pedido del cliente que trae
     la rama de adjuntos múltiples. */

  /**
   * A qué registro se le están adjuntando archivos, o `null`.
   *
   * **En modal y no dentro de la fila.** El desplegable inline hacía crecer la
   * celda y deformaba la tabla entera; es lo que la regla de la casa evita
   * pidiendo modal para toda edición que pida datos.
   *
   * Lleva el bloque además del id porque de él dependen la ruta del vínculo y
   * el tipo de dueño: el mismo modal sirve a los cuatro.
   */
  protected readonly adjuntandoA = signal<{
    readonly id: string;
    readonly bloque: string;
    readonly titulo: string;
  } | null>(null);

  /**
   * El vínculo pasa por `clinical` y no por el genérico de `common`.
   *
   * El de `common` no exige rol ni verifica que el dueño exista —sirve a
   * cualquier contexto—, y esto es dato clínico. Cada bloque liga por su propia
   * ruta; los encuentros todavía no tienen una y caen al genérico.
   */
  protected readonly enlazarAdjunto = (fileId: string, ownerId: string) => {
    const bloque = this.adjuntandoA()?.bloque;
    if (bloque === 'medicacion') {
      return this.clinical.attachFileToMedicationRequest(ownerId, fileId);
    }
    if (bloque === 'alergias') {
      return this.clinical.attachFileToAllergy(ownerId, fileId);
    }
    return this.clinical.attachFileToCondition(ownerId, fileId);
  };

  /** El tipo de dueño del vínculo, según el bloque de la fila. */
  protected readonly duenoDelAdjunto = computed<OwnerType>(() => {
    switch (this.adjuntandoA()?.bloque) {
      case 'medicacion':
        return 'MEDICATION_REQUEST';
      case 'alergias':
        return 'ALLERGY_INTOLERANCE';
      case 'encuentros':
        return 'ENCOUNTER';
      default:
        return 'CONDITION';
    }
  });

  /** Los encuentros no tienen ruta propia en `clinical`: van por el genérico. */
  protected readonly enlaceDelAdjunto = computed(() =>
    this.adjuntandoA()?.bloque === 'encuentros' ? null : this.enlazarAdjunto,
  );

  /** El encabezado del modal, dicho con el bloque de la fila. */
  protected readonly tituloDeLosAdjuntos = computed(() => {
    const titulos: Readonly<Record<string, string>> = {
      diagnosticos: 'Adjuntar archivos al diagnóstico',
      medicacion: 'Adjuntar archivos a la receta',
      alergias: 'Adjuntar archivos a la alergia',
      encuentros: 'Adjuntar archivos al encuentro',
    };
    return titulos[this.adjuntandoA()?.bloque ?? ''] ?? 'Adjuntar archivos';
  });

  /**
   * De qué bloque es una fila.
   *
   * La celda de adjuntos es **una sola** plantilla para los cuatro bloques, y
   * `ColumnDef.cell` no le pasa la clave: se deduce del identificador, que ya
   * está indexado por bloque.
   */
  protected bloqueDeLaFila(fila: FilaClinica): string {
    return (
      this.bloques().find((bloque) => bloque.filas.some((otra) => otra.id === fila.id))?.clave ??
      'diagnosticos'
    );
  }

  /**
   * Abre el modal de adjuntos de esa fila.
   *
   * Antes esto alternaba un formulario **dentro de la fila** —`alternarAdjuntos`,
   * con su botón que cambiaba a «Cerrar adjuntos»— y la tabla se abría en dos
   * para hacerle sitio. Ahora la fila sólo abre el modal.
   */
  protected abrirAdjuntos(fila: FilaClinica, bloque: string): void {
    this.adjuntandoA.set({ id: fila.id, bloque, titulo: fila.principal });
  }

  protected cerrarAdjuntos(): void {
    this.adjuntandoA.set(null);
  }

  /**
   * El contexto que hereda el lote de adjuntos: paciente y los vínculos que el
   * registro padre ya resolvió.
   *
   * Se **muestra** y no se pide: el vínculo lo da la ruta de `clinical`, que
   * cuelga el archivo del registro, y el registro ya tiene su encuentro y su
   * diagnóstico. Volver a elegirlos en el modal sería pedir dos veces lo que el
   * padre ya resolvió, con la posibilidad de que la segunda respuesta no
   * coincida.
   */
  protected readonly contextoDeLosAdjuntos = computed<readonly VinculoClinico[]>(() => {
    const destino = this.adjuntandoA();
    if (destino === null) {
      return [];
    }
    const fila = this.bloques()
      .find((bloque) => bloque.clave === destino.bloque)
      ?.filas.find((otra) => otra.id === destino.id);
    return [
      { rotulo: 'Paciente', valor: this.contextoDelPaciente() },
      { rotulo: 'Registro', valor: destino.titulo },
      ...(fila?.vinculos ?? []),
    ];
  });

  /**
   * Las columnas de un bloque concreto.
   *
   * `Detalle` sólo se dibuja si alguna fila la llena. Es la diferencia entre una
   * columna vacía —que se lee como un dato que no cargó— y una columna que ese
   * bloque no tiene.
   */
  private columnasPara(
    filas: readonly FilaClinica[],
    clave?: string,
  ): readonly ColumnDef<FilaClinica>[] {
    const hayDetalle = filas.some((fila) => fila.detalle !== '' && fila.detalle !== SIN_DATO);
    return [
      { key: 'principal', header: 'Registro', priority: 1, cell: this.celdaPrincipal() },
      { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
      { key: 'cuando', header: 'Fecha', priority: 2, cell: this.celdaCuando() },
      ...(hayDetalle
        ? [{ key: 'detalle', header: 'Detalle', priority: 3 } satisfies ColumnDef<FilaClinica>]
        : []),
      // Sólo el bloque de encuentros lleva descarga (corrección #16): una
      // atención es lo que se puede entregar como documento. Un diagnóstico
      // suelto no es un papel que nadie pida.
      ...(clave === 'encuentros'
        ? [
            {
              key: 'documento',
              header: 'Documento',
              priority: 1,
              cell: this.celdaDocumento(),
            } satisfies ColumnDef<FilaClinica>,
          ]
        : []),
      // La medicación dice para qué es y de qué consulta viene. Las dos sólo
      // se dibujan si alguna fila las llena: una columna vacía se lee como un
      // dato que no cargó, no como una columna que ese bloque no tiene.
      ...(clave === 'medicacion' && filas.some((fila) => (fila.diagnostico ?? '') !== '')
        ? [
            {
              key: 'diagnostico',
              header: 'Diagnóstico',
              priority: 2,
            } satisfies ColumnDef<FilaClinica>,
          ]
        : []),
      ...(clave === 'medicacion' && filas.some((fila) => (fila.cita ?? '') !== '')
        ? [{ key: 'cita', header: 'Receta de', priority: 3 } satisfies ColumnDef<FilaClinica>]
        : []),
      // Patch v4.0.8: sólo `diagnosticos` transiciona de estado. Antes del
      // patch ninguna fila clínica tenía una acción de escritura propia —el
      // registro nacía activo y ahí se quedaba para siempre—.
      ...(clave === 'diagnosticos'
        ? [
            {
              key: 'acciones',
              header: 'Cambiar estado',
              priority: 2,
              cell: this.celdaAcciones(),
            } satisfies ColumnDef<FilaClinica>,
          ]
        : []),
      // El detalle, en todos los bloques y siempre en modal. Con `priority: 1`
      // porque en teléfono es la única forma de leer lo que la tabla plegó: una
      // acción de apertura que se pliega deja la fila sin salida.
      // El rótulo es «Ver» y no «Detalle»: varios bloques ya traen una columna
      // «Detalle» con un dato —la criticidad de una alergia, si un encuentro
      // sigue abierto—, y dos columnas con el mismo nombre en la misma tabla
      // no se distinguen. Lo mostró la captura del navegador.
      {
        key: 'ver',
        header: 'Ver',
        priority: 1,
        cell: this.celdaVer(),
      } satisfies ColumnDef<FilaClinica>,
      // «En todos los formularios debe poderse poner un adjunto… incluso en la
      // medicación» — pedido del cliente. Los bloques que guardan dato clínico
      // de una persona; los narrativos (notas, planes, documentos) tienen su
      // propio camino y quedan fuera de esta tanda. `diagnosticos` no la lleva
      // porque ya adjunta desde su menú de acciones, y dos botones que abren el
      // mismo modal en la misma fila es la clase de duda que sobra.
      ...(this.puedeEscribir() && ['medicacion', 'alergias', 'encuentros'].includes(clave ?? '')
        ? [
            {
              key: 'adjuntos',
              header: 'Archivos',
              priority: 3,
              cell: this.celdaAdjuntos(),
            } satisfies ColumnDef<FilaClinica>,
          ]
        : []),
    ];
  }

  protected readonly porFila = (fila: FilaClinica): string => fila.id;

  /** El estado del bloque: hay filas, o el vacío con su explicación propia. */
  protected estadoDe(
    filas: readonly FilaClinica[],
    titulo: string,
  ): ViewState<readonly FilaClinica[]> {
    if (filas.length > 0) {
      return ready(filas);
    }
    // El vacío de un bloque clínico **no** ofrece cargar nada: esta pantalla es
    // de lectura y quien la mira puede no tener permiso de escritura. La salida
    // honesta es volver a elegir persona.
    return empty(
      { label: 'Elegir otra persona', route: CLINICAL_RECORD_ROUTE },
      `Sin ${titulo.toLowerCase()} registrados para esta persona.`,
    );
  }

  constructor() {
    // Ir de un expediente a otro reutiliza el componente: sin escuchar el
    // parámetro, el segundo seguiría mostrando los datos del primero.
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });

    // Quién firma se resuelve una sola vez, cuando la sesión dice que hay
    // perfil profesional. Depende de la sesión y **no** del expediente: la
    // matrícula de quien atiende no cambia porque se abra la ficha de otra
    // persona, y releerla por paciente sería una petición por navegación.
    effect(() => {
      const perfilId = this.auth.practitionerProfileId();
      untracked(() => this.resolverPerfilPropio(perfilId));
    });

    // El aviso de apertura: alergias y consulta en curso, por toast, una sola
    // vez por visita. Ver el comentario de `avisosMostrados` arriba.
    effect(() => {
      const alergias = this.alergiasDestacadas();
      const enCurso = this.atencionEnCurso();
      if (this.avisosMostrados() || (alergias.length === 0 && !enCurso)) {
        return;
      }
      untracked(() => this.avisarAlAbrir(alergias, enCurso));
    });
  }

  /**
   * Lee el perfil profesional propio, del que sale la matrícula del papel.
   *
   * Falla en silencio, igual que en el bloque de formularios: una cuenta sin
   * perfil profesional —administración, recepción— responde `404`, y eso es un
   * caso normal que no cabe contarle a nadie. Sin perfil no hay matrícula y el
   * documento simplemente no imprime esa línea.
   */
  private resolverPerfilPropio(perfilId: string | null): void {
    if (perfilId === null) {
      this.perfilPropio.set(null);
      return;
    }
    if (this.perfilPropio()?.profileId === perfilId) {
      return;
    }
    this.profiles.getOwnPractitionerProfile().subscribe({
      next: (perfil) => this.perfilPropio.set(perfil),
      error: () => this.perfilPropio.set(null),
    });
  }

  protected recargar(): void {
    this.cargar();
  }

  /**
   * Patch v4.0.8: transiciona el estado clínico de un diagnóstico ya
   * registrado (`POST /clinical/conditions/:id/change-status`).
   *
   * Con motivo obligatorio y confirmación —`confirmWithReason`, la misma
   * pieza que ya usa el resto de la aplicación para exigirlo— porque es un
   * dato regulado: la auditoría clínica necesita saber no sólo que cambió,
   * sino por qué.
   *
   * ## El `422` es la máquina de estados, no un fallo
   *
   * El backend rechaza una transición que no es válida desde el estado actual
   * —o resolver una condición crónica— con `PRECONDITION_FAILED`. No es un
   * error de la interfaz: es la regla de negocio contándolo, y el toast la
   * muestra tal cual la explica el servidor.
   */
  protected async cambiarEstadoClinico(fila: FilaClinica): Promise<void> {
    // El modal se cierra en el camino feliz, dentro de `finalizar`: si algo
    // falla, el mensaje tiene que verse donde se tomó la decisión.
    const destino = this.destinoEstadoDe(fila.id);
    if (destino === null || this.cambiandoEstado() !== null) {
      return;
    }

    const etiquetaDestino = this.etiquetasDeEstadoClinico[destino] ?? 'ese estado';
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: '¿Cambiar el estado clínico?',
        message: `«${fila.principal}» pasa a "${etiquetaDestino}". El motivo queda en la historia clínica.`,
        confirmLabel: 'Cambiar estado',
      },
      {
        label: 'Motivo del cambio',
        hint: 'Explicá brevemente por qué deja de contar con el estado anterior.',
      },
    );
    if (motivo === null) {
      return;
    }

    this.cambiandoEstado.set(fila.id);

    this.clinical
      .changeConditionStatus(fila.id, { newClinicalStatusConceptId: destino, reasonText: motivo })
      .subscribe({
        next: () => {
          this.cambiandoEstado.set(null);
          this.elegirDestinoEstado(fila.id, null);
          this.cambiandoEstadoDe.set(null);
          this.toasts.success(
            `Ahora figura como "${etiquetaDestino}".`,
            'Estado clínico actualizado',
          );
          this.cargar();
        },
        error: (error: unknown) => {
          this.cambiandoEstado.set(null);
          this.toasts.error(this.mensajeDeErrorDeEstado(error), 'No se pudo cambiar el estado');
        },
      });
  }

  /**
   * El fallo del cambio de estado, en palabras — mismo criterio que el resto
   * de la app, y ahora por el mismo camino.
   *
   * La validación se resuelve acá porque acá significa algo concreto: el `422`
   * es la máquina de estados del backend rechazando una transición, no un campo
   * mal llenado. El resto —permiso, ausencia, conexión, fallo inesperado— lo
   * pone `mensajeDeFalloDeEscritura`, que es donde vive esa cola una sola vez.
   */
  private mensajeDeErrorDeEstado(error: unknown): string {
    const state = errorToViewState<null>(error);
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || 'Esa transición no es válida.';
    }
    return (
      mensajeDeFalloDeEscritura(state, {
        accion: 'cambiar el estado clínico',
        sinPermiso: 'Tu rol no permite cambiar el estado clínico.',
        yaNoExiste: 'La condición ya no existe. Recargá la pantalla.',
      }) ?? 'Ocurrió un error inesperado.'
    );
  }

  /* -- Los documentos que se llevan en papel (corrección #16) --------------
     Dos PDF, deliberadamente simples, generados desde los datos que la API ya
     devolvió. No se piden de nuevo ni se arman leyendo la pantalla: se arman
     de `datos()`, que es lo mismo que se está mostrando. */

  /**
   * Descarga la historia clínica **de esa atención**.
   *
   * No es el expediente completo: es lo que pasó en esa consulta —motivo,
   * diagnósticos, medicación y observaciones registrados durante ella—, que es
   * lo que la corrección #16 pide poder entregar. Los registros se filtran por
   * `encounterId`; los que el contrato no ata a un encuentro quedan fuera en vez
   * de colarse en la atención equivocada.
   */
  protected descargarAtencion(fila: FilaClinica): void {
    const datos = this.datos();
    const encuentro = (datos?.resumen.encounters ?? []).find((item) => item.id === fila.id);
    if (datos === undefined || datos === null || encuentro === undefined) {
      return;
    }

    downloadVisitPdf(
      atencionDesdeResumen(encuentro, datos.resumen, this.contextoDelDocumento(), (id) =>
        this.label(id),
      ),
    );
    this.toasts.success('La atención se descargó como PDF.', 'Historia clínica');
  }

  /**
   * Descarga **una receta** en papel, desde el bloque de medicación.
   *
   * Mismo camino que en «Atención» y con la misma firma: la regla de quién
   * firma vive en `firma-de-la-sesion`, una sola vez, para que el mismo acto
   * clínico no salga firmado distinto según desde qué pantalla se imprima.
   */
  protected descargarReceta(receta: RecetaEnFicha): void {
    const guardada = (this.datos()?.resumen.medicationRequests ?? []).find(
      (fila) => fila.id === receta.id,
    );
    if (guardada === undefined) {
      return;
    }

    downloadPrescriptionPdf(
      recetaDesdeResumen(guardada, this.contextoDelDocumento(), (id) => this.label(id)),
    );
    this.toasts.success('La receta se descargó como PDF.', 'Receta');
  }

  /**
   * Quién es quién en el papel. La regla vive en `firma-de-la-sesion`, una sola
   * vez: la atención firma la receta y el expediente la historia de la visita,
   * y el mismo acto clínico no puede salir firmado distinto en cada papel.
   */
  private contextoDelDocumento(): ContextoDelDocumento {
    return contextoDeLaSesion({
      paciente: this.nombre(),
      practitionerProfileId: this.auth.practitionerProfileId(),
      displayName: this.auth.displayName(),
      perfilPropio: this.perfilPropio(),
      tenantId: this.auth.activeTenantId(),
      tenantName: (id) => this.auth.tenantName(id),
    });
  }

  /* -- Lectura ------------------------------------------------------------- */

  private cargar(): void {
    const profileId = this.profileId();
    this.expediente.set(loading());
    this.etiquetas.set(new Map());
    this.nombre.set('');

    if (profileId === '') {
      // S6 y no un error: sin identificador no hay recurso que buscar, y decir
      // «no encontrado» no filtra nada porque no se preguntó por nadie.
      this.expediente.set(notFound({ label: 'Elegir una persona', route: CLINICAL_RECORD_ROUTE }));
      return;
    }

    // El nombre va por su lado a propósito: es cosmético y su permiso es otro.
    // Atarlo al `forkJoin` del expediente haría que un 403 del padrón se llevara
    // puesta la historia clínica.
    this.profiles
      .getPatient(profileId)
      .pipe(catchError(() => of(null)))
      .subscribe((paciente) => {
        if (paciente !== null) {
          this.nombre.set(paciente.displayName ?? `Paciente ${paciente.patientCode}`);
        }
      });

    forkJoin({
      resumen: this.clinical.getSummary(profileId, TOPE),
      chart: this.clinical.getChart(profileId, TOPE),
    })
      .pipe(
        switchMap((datos) =>
          forkJoin({
            datos: of(datos),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(datos))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
          }),
        ),
      )
      .subscribe({
        next: ({ datos, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.expediente.set(ready(datos));
        },
        error: (error: unknown) => this.expediente.set(errorToViewState<Expediente>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * El valor de una observación.
   *
   * Cinco caminos excluyentes, en el orden en que el contrato los declara. Se
   * elige el primero presente en vez de concatenar: una observación no tiene dos
   * valores, y mostrar dos casillas sugeriría que sí.
   */
  private valorDe(observacion: {
    readonly quantityValue?: string;
    readonly quantityUnitConceptId?: string;
    readonly valueDecimal?: string;
    readonly valueText?: string;
    readonly valueBoolean?: boolean;
    readonly valueConceptId?: string;
  }): string {
    if (observacion.quantityValue !== undefined) {
      const unidad = this.label(observacion.quantityUnitConceptId);
      return unidad === SIN_DATO
        ? observacion.quantityValue
        : `${observacion.quantityValue} ${unidad}`;
    }
    if (observacion.valueDecimal !== undefined) {
      return observacion.valueDecimal;
    }
    if (observacion.valueText !== undefined) {
      return observacion.valueText;
    }
    if (observacion.valueBoolean !== undefined) {
      return observacion.valueBoolean ? 'Sí' : 'No';
    }
    if (observacion.valueConceptId !== undefined) {
      return this.label(observacion.valueConceptId);
    }
    return SIN_DATO;
  }
}

/**
 * Los identificadores de concepto del expediente, sin los ausentes.
 *
 * Listados a mano —y no recorriendo las claves que terminen en `ConceptId`— por
 * lo mismo que en la ficha de paciente: una clave nueva del contrato debe
 * obligar a decidir si se muestra, no colarse en la petición sin que nadie la
 * haya puesto en pantalla.
 */
function conceptosDe({ resumen, chart }: Expediente): readonly string[] {
  return [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      fila.categoryConceptId,
      fila.clinicalStatusConceptId,
      fila.severityConceptId,
    ]),
    ...resumen.allergies.flatMap((fila) => [
      fila.substanceConceptId,
      fila.categoryConceptId,
      fila.criticalityConceptId,
      fila.clinicalStatusConceptId,
    ]),
    ...resumen.medicationRequests.flatMap((fila) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.observations.flatMap((fila) => [
      fila.codeConceptId,
      fila.statusConceptId,
      fila.interpretationConceptId,
      fila.valueConceptId,
      fila.quantityUnitConceptId,
    ]),
    ...resumen.encounters.flatMap((fila) => [fila.statusConceptId, fila.classConceptId]),
    ...chart.notes.flatMap((fila) => [fila.noteTypeConceptId, fila.lifecycleStatusConceptId]),
    ...chart.carePlans.flatMap((fila) => [fila.statusConceptId, fila.intentConceptId]),
    ...chart.documents.flatMap((fila) => [fila.categoryConceptId, fila.statusConceptId]),
  ].filter((id): id is string => id !== undefined);
}
