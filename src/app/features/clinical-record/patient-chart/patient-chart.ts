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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, map, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ClinicalClient } from '../../../core/data-access/clinical/clinical.client';
import type {
  ClinicalSummary,
  PatientChart as ExpedienteDePaciente,
} from '../../../core/data-access/clinical/clinical.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { OwnPractitionerProfile } from '../../../core/data-access/profiles/profiles.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ConceptSelect } from '../../../shared/components/molecules/concept-select/concept-select';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { downloadVisitPdf } from '../../../shared/utils/clinical-pdf/clinical-pdf';
import { contextoDeLaSesion } from '../../../shared/utils/clinical-pdf/firma-de-la-sesion';
import {
  atencionDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { AttachmentDialog } from '../../../shared/components/organisms/attachment-dialog/attachment-dialog';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { CLINICAL_RECORD_ROUTE, encounterWorkspaceRoute } from '../clinical-record.routes';
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
    AttachmentDialog,
    Badge,
    ConceptSelect,
    ContentDialog,
    DataTable,
    DatePipe,
    Link,
    PdfExportButton,
    PageHeader,
    RouterLink,
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

  /** A dónde vuelve «Volver a la consulta». */
  protected readonly rutaDeLaAtencion = computed(() => encounterWorkspaceRoute(this.profileId()));

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
      // El diagnóstico sí vuelve de la lectura (`indicationConditionId`) y es
      // lo que hace verificable el vínculo después de recargar. El encuentro
      // se guarda en el alta y **no** vuelve en el resumen: el DTO de lectura
      // de recetas no lo declara, así que acá se dice eso y no se adivina.
      vinculos: [
        { rotulo: 'Diagnóstico', valor: this.describirDiagnostico(fila.indicationConditionId) },
        {
          rotulo: 'Encuentro',
          valor: 'Se registra con la receta; el resumen clínico todavía no lo devuelve.',
        },
      ],
    })),
  );

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
      detalle: this.label(fila.intentConceptId),
      // `CarePlan` no trae encuentro ni condición en la lectura de `chart`, y
      // tampoco hay alta: el plan de cuidados es hoy sólo de lectura.
      vinculos: [
        {
          rotulo: 'Vínculos clínicos',
          valor: 'El plan de cuidados no guarda encuentro ni diagnóstico.',
        },
      ],
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
    return codigos.length === 0 ? 'Sin diagnósticos documentados en este encuentro' : codigos.join(', ');
  }

  /** Una fecha corta, sin depender del `DatePipe` de la plantilla. */
  private fechaCorta(fecha: Date | undefined): string {
    if (fecha === undefined) {
      return '';
    }
    return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      fecha,
    );
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

  /* -- La banda de contexto ------------------------------------------------
     Lo que hay que saber ANTES de abrir una pestaña. Antes esto no existía y la
     pantalla abría en «Diagnósticos (2)»: para enterarse de que la persona es
     alérgica a algo había que acordarse de ir a mirar. */

  /**
   * Las alergias, arriba y a la vista, no en la segunda pestaña.
   *
   * Es el único bloque del expediente que cambia una conducta **antes** de
   * leerlo: recetar sin haberlas visto es el error que esta banda existe para
   * evitar. No se filtra por criticidad —la criticidad llega como concepto y
   * deducirla del texto sería adivinar—: se muestran todas, que son pocas.
   */
  protected readonly alergiasDestacadas = this.alergias;

  /** Las cifras del expediente, para dimensionarlo sin abrir pestaña por pestaña. */
  protected readonly cifras = computed(() => [
    { clave: 'diagnosticos', rotulo: 'Diagnósticos', valor: this.diagnosticos().length },
    { clave: 'medicacion', rotulo: 'Medicación', valor: this.medicacion().length },
    { clave: 'encuentros', rotulo: 'Encuentros', valor: this.encuentros().length },
    { clave: 'observaciones', rotulo: 'Observaciones', valor: this.observaciones().length },
  ]);

  /**
   * Cuándo fue la última vez que se la atendió.
   *
   * De los encuentros, que es donde consta. `null` mientras no haya ninguno con
   * fecha: inventar «sin atención previa» a partir de un bloque vacío diría algo
   * que el expediente no dice.
   */
  protected readonly ultimaAtencion = computed<Date | null>(() => {
    const fechas = this.encuentros()
      .map((fila) => fila.cuando)
      .filter((fecha): fecha is Date => fecha !== null);
    return fechas.length === 0
      ? null
      : fechas.reduce((mayor, fecha) => (fecha > mayor ? fecha : mayor));
  });

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

  /** El destino elegido para esa fila, o `null` si no se eligió ninguno. */
  protected destinoEstadoDe(conditionId: string): string | null {
    return this.destinosDeEstado()[conditionId] ?? null;
  }

  protected elegirDestinoEstado(conditionId: string, destino: string | null): void {
    this.destinosDeEstado.update((actual) => ({ ...actual, [conditionId]: destino }));
  }

  /* -- ALV-033: adjuntar un archivo a un diagnóstico ya registrado --------
     El alta ofrece adjuntar apenas se registra (`app-diagnosis-block`), pero
     eso sólo alcanza al diagnóstico recién creado. Esta fila cubre el resto
     de la historia: cualquier diagnóstico ya listado puede recibir un
     adjunto, no sólo el último. */

  /** La condición a la que se le está ofreciendo adjuntar un archivo, o `null`. */
  protected readonly adjuntandoArchivoA = signal<string | null>(null);

  /** El vínculo pasa por `clinical`, no por el genérico de `common` — mismo criterio que `diagnosis-block`. */
  protected readonly enlazarAdjuntoAlDiagnostico = (fileId: string, conditionId: string) =>
    this.clinical.attachFileToCondition(conditionId, fileId);

  /**
   * Abre el modal de adjuntos de ese diagnóstico.
   *
   * Antes esto alternaba un formulario **dentro de la fila** —`alternarAdjuntos`,
   * con su botón que cambiaba a «Cerrar adjuntos»— y la tabla se abría en dos
   * para hacerle sitio. La corrección del 10/09/2026 lo saca de ahí: la fila
   * vuelve a ser de lectura y adjuntar pasa a `app-attachment-dialog`.
   */
  protected abrirAdjuntos(conditionId: string): void {
    this.adjuntandoArchivoA.set(conditionId);
  }

  protected cerrarAdjuntos(): void {
    this.adjuntandoArchivoA.set(null);
  }

  /**
   * El contexto que hereda el lote de adjuntos: paciente, encuentro y
   * diagnóstico del registro padre.
   *
   * Se **muestra** y no se pide: el vínculo lo da `attachFileToCondition`, que
   * cuelga el archivo del diagnóstico, y el diagnóstico ya tiene su encuentro.
   * Volver a elegirlos en el modal sería pedir dos veces lo que el padre ya
   * resolvió, con la posibilidad de que la segunda respuesta no coincida.
   */
  protected readonly contextoDeLosAdjuntos = computed<readonly VinculoClinico[]>(() => {
    const conditionId = this.adjuntandoArchivoA();
    if (conditionId === null) {
      return [];
    }
    const condicion = (this.datos()?.resumen.conditions ?? []).find(
      (fila) => fila.id === conditionId,
    );
    return [
      { rotulo: 'Paciente', valor: this.contextoDelPaciente() },
      { rotulo: 'Diagnóstico', valor: this.describirDiagnostico(conditionId) },
      { rotulo: 'Encuentro', valor: this.describirEncuentro(condicion?.encounterId) },
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

  /** El fallo del cambio de estado, en palabras — mismo criterio que el resto de la app. */
  private mensajeDeErrorDeEstado(error: unknown): string {
    const state = errorToViewState<null>(error);
    if (state.status === 'forbidden') {
      return state.message ?? 'Tu rol no permite cambiar el estado clínico.';
    }
    if (state.status === 'not-found') {
      return 'La condición ya no existe. Recargá la pantalla.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || 'Esa transición no es válida.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return 'Ocurrió un error inesperado.';
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
