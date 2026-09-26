import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

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
import { dataOf, loading, notFound, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import type { BreadcrumbItem } from '../../../shared/components/molecules/breadcrumb/breadcrumb.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { EncounterTimeline } from '../../../shared/components/organisms/encounter-timeline/encounter-timeline';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { StatusSeal } from '../../../shared/components/organisms/status-seal/status-seal';
import { TutorialTarget } from '../../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { downloadPrescriptionPdf } from '../../../shared/utils/clinical-pdf/clinical-pdf';
import { contextoDeLaSesion } from '../../../shared/utils/clinical-pdf/firma-de-la-sesion';
import {
  recetaDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import {
  BOOKING_QUERY_PARAM,
  CITA_QUERY_PARAM,
  CLINICAL_RECORD_ROUTE,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../clinical-record.routes';
import { mensajeDeFalloDeEscritura } from '../mensaje-de-escritura';
import { loRegistradoEnElEncuentro, type LoRegistrado } from './lo-registrado';
import { AllergyBlock } from '../patient-chart/allergy-block/allergy-block';
import { CarePlanBlock, type DiagnosticoDelPlan } from '../patient-chart/care-plan-block/care-plan-block';
import { DiagnosisBlock, type CitaDelPaciente } from '../patient-chart/diagnosis-block/diagnosis-block';
import { DocumentBlock } from '../patient-chart/document-block/document-block';
import { AnalysisOrderBlock } from '../patient-chart/analysis-order-block/analysis-order-block';
import { FollowUpBlock } from '../patient-chart/follow-up-block/follow-up-block';
import { MedicalNoteBlock } from '../patient-chart/medical-note-block/medical-note-block';
import {
  MedicationBlock,
  type DiagnosticoEnFicha,
  type RecetaEnFicha,
} from '../patient-chart/medication-block/medication-block';
import { PaymentsBlock } from '../patient-chart/payments-block/payments-block';
import { SpecialtyFormBlock } from '../patient-chart/specialty-form-block/specialty-form-block';
import { InformedConsentBlock } from './informed-consent-block/informed-consent-block';
import {
  QUOTATION_NEW_ROUTE,
  QUOTATION_PATIENT_QUERY_PARAM,
} from '../../quotations/quotations.routes';
import { PaymentPlanPanel } from './payment-plan-panel/payment-plan-panel';

/** Tope por bloque. La API aplica 50 si no se pide otro. */
const TOPE = 50;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Largo máximo del motivo de consulta. El backend no lo acota; la legibilidad sí. */
const TOPE_DEL_MOTIVO = 500;

/**
 * Las casillas de la rejilla. Las posibilidades del expediente que se
 * registran atendiendo —una por pestaña de la historia que admite alta— más la
 * que sólo tiene sentido con la persona delante: el formulario clínico de la
 * especialidad.
 *
 * Dos que estaban dejaron de estar (pedido del propietario, 25/09/2026):
 * «Medición» no existe más —un signo vital es una fila de la nota médica, no
 * un registro aparte— e «Internación» sale de la consulta por ahora; el bloque
 * sigue vivo en el expediente, que es donde se abre y se cierra un episodio.
 *
 * Y una casilla que no registra nada, «Pagos»: la respuesta a «¿esto ya está
 * pagado?», que se necesita en la consulta misma cuando quien atiende también
 * ejecuta el tratamiento.
 */
export type CasillaDeConsulta =
  | 'diagnosticos'
  | 'alergias'
  | 'medicacion'
  | 'notas'
  | 'ordenes'
  | 'reconsulta'
  | 'planes'
  | 'documentos'
  | 'formulario'
  | 'pagos';

/** Lo que dice cada casilla antes de abrirse. */
export interface CasillaVisible {
  readonly clave: CasillaDeConsulta;
  readonly titulo: string;
  readonly descripcion: string;
  /** El encabezado del modal. No repite el título de la casilla. */
  readonly tituloDelModal: string;
  /** Cuántos registros de ese tipo ya tiene la persona, o `null` si no se cuenta. */
  readonly cantidad: number | null;
  /** El trazo del icono, en un `viewBox` de 24. */
  readonly icono: string;
  /** El `data-testid` de la casilla. Estable: las pruebas de navegador lo usan. */
  readonly testId: string;
}

/** Un encuentro abierto, listo para ofrecer su cierre. */
export interface EncuentroEnCurso {
  readonly id: string;
  readonly clase: string;
  readonly motivo: string;
  readonly desde: Date | null;
  /** Versión leída del resumen: el cierre la devuelve como `expectedRowVersion`. */
  readonly version: number | undefined;
}

/** Lo que la pantalla necesita de las dos lecturas, ya unido. */
interface Consulta {
  readonly resumen: ClinicalSummary;
  readonly chart: ExpedienteDePaciente;
}

interface DefinicionDeCasilla {
  readonly titulo: string;
  readonly descripcion: string;
  readonly tituloDelModal: string;
  readonly icono: string;
  readonly testId: string;
}

/**
 * Contrato C0 de las casillas, ya sin Medición ni Internación. El orden
 * visible se declara abajo en ORDEN_DE_CASILLAS y comienza por Nota médica,
 * Orden de análisis y Diagnóstico.
 */
const CASILLAS: Readonly<Record<CasillaDeConsulta, DefinicionDeCasilla>> = {
  diagnosticos: {
    titulo: 'Diagnóstico',
    descripcion: 'Una condición nueva, con su estado clínico y su categoría.',
    tituloDelModal: 'Nuevo diagnóstico',
    icono: 'M9 3h6l1 3h3v15H5V6h3l1-3Zm3 6v6m-3-3h6',
    testId: 'consulta-casilla-diagnosticos',
  },
  alergias: {
    titulo: 'Alergia',
    descripcion: 'Una sustancia que no tolera, con su criticidad.',
    tituloDelModal: 'Nueva alergia',
    icono: 'M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5',
    testId: 'consulta-casilla-alergias',
  },
  medicacion: {
    titulo: 'Receta',
    descripcion: 'Prescribir, firmar y emitir medicación.',
    tituloDelModal: 'Prescribir medicación',
    icono: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 8h6M9 15h4',
    testId: 'consulta-casilla-medicacion',
  },
  notas: {
    titulo: 'Nota médica',
    descripcion: 'El registro clínico de este encuentro.',
    tituloDelModal: 'Escribir una nota médica',
    icono: 'M6 3h9l5 5v13H6V3Zm9 0v5h5M9 13h6M9 17h6',
    testId: 'consulta-casilla-notas',
  },
  ordenes: {
    titulo: 'Orden de análisis',
    descripcion: 'Un estudio solicitado durante la consulta.',
    tituloDelModal: 'Pedir un análisis',
    icono: 'M9 3h6v5l4 10a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3l4-10V3Zm-2 12h10',
    testId: 'consulta-casilla-ordenes',
  },
  reconsulta: {
    titulo: 'Reconsulta',
    descripcion: 'La próxima cita, con fecha acordada.',
    tituloDelModal: 'Agendar la reconsulta',
    icono: 'M4 5h16v16H4V5Zm4-2v4m8-4v4M4 10h16m-8 3v5m-2-2 2 2 2-2',
    testId: 'consulta-casilla-reconsulta',
  },
  planes: {
    titulo: 'Plan de cuidados',
    descripcion: 'Un objetivo y las actividades para alcanzarlo.',
    tituloDelModal: 'Abrir un plan de cuidados',
    icono: 'M4 6h16M4 12h10M4 18h7m6-1 2 2 4-4',
    testId: 'consulta-casilla-planes',
  },
  documentos: {
    titulo: 'Documento',
    descripcion: 'Un estudio, un informe o un papel que la persona trajo.',
    tituloDelModal: 'Registrar un documento',
    icono: 'M16.5 8.5 9.7 15.3a2.1 2.1 0 0 0 3 3l6.8-6.8a4.2 4.2 0 0 0-5.9-6L6.8 12.3a6.2 6.2 0 0 0 8.8 8.8l5.4-5.4',
    testId: 'consulta-casilla-documentos',
  },
  formulario: {
    titulo: 'Formulario clínico',
    descripcion: 'La ficha de la especialidad, el odontograma o un procedimiento.',
    tituloDelModal: 'Llenar un formulario clínico',
    icono: 'M4 4h16v16H4V4Zm4 5h8M8 12h8M8 15h5',
    testId: 'consulta-casilla-formulario',
  },
  pagos: {
    titulo: 'Pagos',
    descripcion: 'Lo que ya pagó: comprobantes, fechas e importes.',
    tituloDelModal: 'Pagos de la persona',
    icono: 'M3 7h18v10H3V7Zm0 4h18M7 15h3',
    testId: 'consulta-casilla-pagos',
  },
};

const ORDEN_DE_CASILLAS: readonly CasillaDeConsulta[] = [
  'notas',
  'ordenes',
  'diagnosticos',
  'reconsulta',
  'medicacion',
  'alergias',
  'planes',
  'documentos',
  'formulario',
  'pagos',
];

/**
 * **Consulta** — lo que se registra mientras se atiende a una persona.
 *
 * ## Una rejilla, no un formulario
 *
 * Reemplaza a la pantalla de atención anterior, que abría con un formulario
 * de una pregunta y escondía el resto detrás de tres pestañas. Acá lo que se
 * puede registrar está a la vista en diez casillas. Cada una abre su bloque
 * en un modal. Nota médica es la tabla de filas campo/valor de C1; órdenes y
 * reconsulta reutilizan sus bloques funcionales. Pagos consulta lo que ya
 * está cobrado.
 *
 * ## El encuentro sigue mandando
 *
 * Arriba, a lo ancho: es el registro de que se atendió a esta persona y lo que
 * ata todo lo demás. Se abre al entrar —con el motivo que trae la agenda— y se
 * cierra al terminar. Las casillas registran contra el encuentro en curso
 * cuando lo hay, y contra una cita ya existente cuando no.
 *
 * ## Lee lo que escribe
 *
 * Las dos lecturas del expediente —`summary` y `chart`— porque las casillas
 * dicen cuántos registros de cada tipo hay, y contar sólo la mitad diría un
 * número falso. Cada alta relee: la casilla muestra lo que el servidor tiene,
 * no lo que se acaba de pintar.
 */
@Component({
  selector: 'app-consultation',
  imports: [
    AnalysisOrderBlock,
    Alert,
    AllergyBlock,
    AppButton,
    AppButtonLink,
    CarePlanBlock,
    ContentDialog,
    DatePipe,
    DiagnosisBlock,
    DocumentBlock,
    EncounterTimeline,
    FormField,
    FollowUpBlock,
    MedicalNoteBlock,
    MedicationBlock,
    PaymentsBlock,
    PageHeader,
    PaymentPlanPanel,
    RouterLink,
    SpecialtyFormBlock,
    InformedConsentBlock,
    StatusSeal,
    Textarea,
    TutorialTarget,
    ViewStateHost,
  ],
  templateUrl: './consultation.html',
  styleUrl: './consultation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Consultation {
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly clinical = inject(ClinicalClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /**
   * El perfil que se está atendiendo, leído del segmento `:profileId`.
   *
   * De la ruta activa y no como `input()` porque la aplicación no habilita
   * `withComponentInputBinding()`, igual que en el expediente.
   */
  private readonly profileId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('profileId') ?? '')),
    { initialValue: '' },
  );

  /** El mismo perfil, para los bloques hijos que escriben contra él. */
  protected readonly pacienteDeLaFicha = this.profileId;

  /**
   * El motivo de la cita desde la que se llegó. Es una **semilla**: una vez
   * sembrado, el campo es de quien escribe.
   */
  private readonly motivoDeLaCita = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(MOTIVO_QUERY_PARAM) ?? '')),
    { initialValue: '' },
  );

  /**
   * La cita clínica del turno desde el que se llegó, si lo trae. No es
   * editable: ata el encuentro a su turno, y su ausencia es corriente.
   */
  protected readonly citaDeOrigen = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CITA_QUERY_PARAM))),
    { initialValue: null },
  );

  /** Reserva de origen: nunca reutilizar el appointmentId del check-in. */
  protected readonly originBookingId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(BOOKING_QUERY_PARAM))),
    { initialValue: null },
  );

  protected readonly consulta = signal<ViewState<Consulta>>(loading());

  /** Nombre del paciente si se pudo leer; vacío si el padrón está prohibido. */
  private readonly nombre = signal('');

  /** El perfil profesional de quien atiende, para firmar el papel. */
  private readonly perfilPropio = signal<OwnPractitionerProfile | null>(null);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  private readonly datos = computed(() => dataOf(this.consulta()));

  protected readonly titulo = computed(() => (this.nombre() === '' ? 'Consulta' : this.nombre()));

  protected readonly subtitulo = computed(() =>
    this.nombre() === ''
      ? 'Lo que se registra durante la consulta.'
      : 'Lo que se registra durante esta consulta.',
  );

  /** Ofrecerle un plan de pago a esta persona: el alta de cotización, con ella ya elegida. */
  protected readonly rutaDelPlanDePago = QUOTATION_NEW_ROUTE;

  protected readonly pacienteDelPlanDePago = computed(() => ({
    [QUOTATION_PATIENT_QUERY_PARAM]: this.profileId(),
  }));

  /** El expediente de la misma persona: la lectura está a un clic. */
  protected readonly rutaDelExpediente = computed(() => patientChartRoute(this.profileId()));

  protected readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const base = this.navigation.breadcrumbs();
    const ultimo = base.at(-1);
    if (ultimo === undefined) {
      return [];
    }
    return [
      ...base.slice(0, -1),
      { label: ultimo.label, routerLink: CLINICAL_RECORD_ROUTE },
      { label: this.titulo(), routerLink: this.rutaDelExpediente() },
      { label: 'Consulta' },
    ];
  });

  /* -- El encuentro --------------------------------------------------------- */

  protected readonly topeDelMotivo = TOPE_DEL_MOTIVO;

  /** La organización bajo la que se registra: custodia del encuentro. */
  protected readonly organizacion = this.auth.activeTenantId;

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /** El motivo de consulta del encuentro a abrir. */
  protected readonly motivo = signal('');

  /** El resultado de la última escritura sobre el encuentro. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  protected readonly registrando = signal(false);

  /** El encuentro en curso que se está cerrando, o `null`. */
  protected readonly cerrando = signal<string | null>(null);

  protected readonly errorDelRegistro = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      if (state.issues.some((issue) => issue.code === 'PRECONDITION_FAILED')) {
        return 'Ese encuentro ya no está en curso: alguien lo cerró antes. Recargá la consulta.';
      }
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return mensajeDeFalloDeEscritura(state, {
      accion: 'registrar encuentros',
      sinPermiso: 'Tu rol no permite registrar encuentros.',
      yaNoExiste: 'El encuentro ya no existe. Recargá la consulta.',
    });
  });

  /** Los encuentros abiertos. «Abierto» se deriva de `endAt`, no del estado. */
  protected readonly encuentrosEnCurso = computed<readonly EncuentroEnCurso[]>(() =>
    (this.datos()?.resumen.encounters ?? [])
      .filter((encuentro) => encuentro.endAt === undefined)
      .map((encuentro) => ({
        id: encuentro.id,
        clase: this.label(encuentro.classConceptId),
        motivo: encuentro.reasonText ?? 'Sin motivo registrado',
        desde: encuentro.startAt ?? null,
        version: encuentro.rowVersion,
      })),
  );

  /** Cuántos encuentros tiene la persona, abiertos o no. */
  protected readonly totalDeEncuentros = computed(
    () => (this.datos()?.resumen.encounters ?? []).length,
  );

  protected readonly puedeRegistrar = computed(
    () => this.datos() !== null && !this.sinOrganizacion(),
  );

  /** El encuentro sobre el que se registra: el primero de los abiertos, o `null`. */
  protected readonly encuentroActual = computed<string | null>(
    () => this.encuentrosEnCurso()[0]?.id ?? null,
  );

  /* -- C8 · «Lo registrado en este encuentro» ------------------------------- */

  /**
   * La línea del encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Sale de lo que la consulta **ya leyó** —el resumen y el expediente—: es
   * la misma pantalla que acaba de registrar la nota o el diagnóstico, y
   * releerlos para dibujarlos sería pedir dos veces lo mismo. Por eso también
   * se actualiza sola: cada alta llama a `cargar()`, y la línea es un
   * `computed` de esos datos.
   *
   * `null` cuando no hay encuentro abierto es deliberado: sin atención en
   * curso no hay «este encuentro» del que hablar, y la sección no se dibuja.
   */
  protected readonly loRegistrado = computed<LoRegistrado | null>(() => {
    const datos = this.datos();
    const encuentro = this.encuentroActual();
    if (datos === undefined || datos === null || encuentro === null) {
      return null;
    }
    return loRegistradoEnElEncuentro(
      encuentro,
      datos.resumen,
      datos.chart.notes,
      (id) => this.label(id),
      (id) => this.codigo(id),
    );
  });

  /* -- La rejilla ----------------------------------------------------------- */

  /**
   * Las diez casillas con su cantidad. La cantidad sale de lo ya leído y no
   * de una petición por casilla: dos lecturas de la misma lista pueden
   * discrepar.
   */
  protected readonly casillas = computed<readonly CasillaVisible[]>(() => {
    const datos = this.datos();
    const cantidades: Readonly<Record<CasillaDeConsulta, number | null>> = {
      diagnosticos: datos?.resumen.conditions.length ?? 0,
      alergias: datos?.resumen.allergies.length ?? 0,
      medicacion: datos?.resumen.medicationRequests.length ?? 0,
      notas: datos?.chart.notes.length ?? 0,
      ordenes: null,
      reconsulta: null,
      planes: datos?.chart.carePlans.length ?? 0,
      documentos: datos?.chart.documents.length ?? 0,
      // El formulario no deja una fila propia en la historia: lo que guarda
      // termina en diagnósticos, procedimientos o laboratorio.
      formulario: null,
      // Los pagos no están en las dos lecturas del expediente —son de la caja,
      // no de la historia— y pedirlos acá sería una tercera petición cuyo
      // número podría discrepar del que muestra el propio bloque al abrirse.
      pagos: null,
    };
    return ORDEN_DE_CASILLAS.map((clave) => ({
      clave,
      ...CASILLAS[clave],
      cantidad: cantidades[clave],
    }));
  });

  /**
   * La casilla cuyo modal está abierto, o `null`. Una señal para las diez:
   * sólo puede haber un modal a la vez.
   */
  protected readonly casillaAbierta = signal<CasillaDeConsulta | null>(null);

  protected abrir(clave: CasillaDeConsulta): void {
    this.casillaAbierta.set(clave);
  }

  /** Mantiene Tab dentro de la consulta, incluso cuando el stub solo ofrece Cerrar. */
  protected keepModalFocus(event: Event): void {
    if (!(event instanceof KeyboardEvent) || !(event.currentTarget instanceof HTMLElement)) return;
    const dialog = event.currentTarget.querySelector('dialog');
    if (dialog === null) return;
    if (event.target instanceof Element && event.target.closest('dialog') !== dialog) return;
    const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((control) => control.getClientRects().length > 0 && control.tabIndex >= 0);
    const first = controls.at(0);
    const last = controls.at(-1);
    const boundary = event.shiftKey ? first : last;
    const destination = event.shiftKey ? last : first;
    if (destination !== undefined && event.target === boundary) {
      event.preventDefault();
      destination.focus();
    }
  }

  protected cerrarCasilla(): void {
    this.casillaAbierta.set(null);
    // Retirar el dialog cerrado antes de que otro clic pueda reutilizarlo.
    this.changeDetector.detectChanges();
  }

  protected readonly tituloDelModal = computed(() => {
    const clave = this.casillaAbierta();
    return clave === null ? '' : CASILLAS[clave].tituloDelModal;
  });

  /**
   * La bajada del modal, con el nombre y nunca con el identificador. Dice
   * además contra qué encuentro se registra, que es lo que distingue un
   * registro trazable de una marca de tiempo suelta.
   */
  protected readonly descripcionDelModal = computed(() => {
    const quien = this.nombre() === '' ? 'esta persona' : this.nombre();
    // Pagos no escribe nada, así que prometer que «se registra» sería mentir
    // en la única línea que explica qué va a pasar al confirmar.
    if (this.casillaAbierta() === 'pagos') {
      return `Lo que ${quien} ya pagó, tal como quedó asentado en la caja de la práctica.`;
    }
    return this.encuentroActual() === null
      ? `Se registra en la historia de ${quien}.`
      : `Se registra en el encuentro en curso de ${quien}.`;
  });

  /** Registrado lo que fuera, se cierra el modal y se relee la consulta. */
  protected altaRegistrada(): void {
    this.casillaAbierta.set(null);
    this.cargar();
  }

  /* -- Lo que los bloques necesitan de la consulta ------------------------- */

  protected readonly recetas = computed<readonly RecetaEnFicha[]>(() =>
    (this.datos()?.resumen.medicationRequests ?? []).map((receta) => ({
      id: receta.id,
      medicamento: this.label(receta.medicationConceptId),
      indicacion: [receta.doseText, receta.frequencyText].filter(Boolean).join(' · '),
      estado: this.label(receta.statusConceptId),
      firmada: receta.signedAt !== undefined,
      emitida: receta.issuedAt !== undefined,
    })),
  );

  /** Todos los diagnósticos, con «Resuelto» en la etiqueta cuando corresponde. */
  protected readonly diagnosticosParaReceta = computed<readonly DiagnosticoEnFicha[]>(() =>
    (this.datos()?.resumen.conditions ?? []).map((dx) => {
      const principal = this.label(dx.codeConceptId);
      return {
        id: dx.id,
        etiqueta: dx.resolvedAt === undefined ? principal : `${principal} · Resuelto`,
      };
    }),
  );

  protected readonly diagnosticosParaElPlan = computed<readonly DiagnosticoDelPlan[]>(
    () => this.diagnosticosParaReceta(),
  );

  protected readonly medicacionActivaConceptIds = computed<readonly string[]>(() =>
    Array.from(
      new Set((this.datos()?.resumen.medicationRequests ?? []).map((r) => r.medicationConceptId)),
    ),
  );

  /** Las citas de la persona, de la más reciente a la más vieja. */
  protected readonly citas = computed<readonly CitaDelPaciente[]>(() =>
    [...(this.datos()?.resumen.encounters ?? [])]
      .sort((a, b) => (b.startAt?.getTime() ?? 0) - (a.startAt?.getTime() ?? 0))
      .map((encuentro) => ({
        id: encuentro.id,
        etiqueta: this.etiquetaDeCita(encuentro),
        enCurso: encuentro.endAt === undefined,
      })),
  );

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

  constructor() {
    effect(() => {
      this.profileId();
      untracked(() => this.cargar());
    });

    // El motivo que trae la agenda se siembra al entrar y al cambiar de
    // persona: el motivo de la cita de alguien no debe sobrevivir a la
    // navegación hacia la consulta de otro.
    effect(() => {
      this.profileId();
      const dePar = this.motivoDeLaCita();
      untracked(() => this.motivo.set(dePar));
    });

    effect(() => {
      const perfilId = this.auth.practitionerProfileId();
      untracked(() => this.resolverPerfilPropio(perfilId));
    });
  }

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

  /* -- Escritura sobre el encuentro ----------------------------------------- */

  /** Abre el encuentro (UC-08-02). Sin confirmación: no es irreversible. */
  protected registrarEncuentro(): void {
    const patientProfileId = this.profileId();
    const tenantId = this.organizacion();
    if (patientProfileId === '' || tenantId === null || this.registrando()) {
      return;
    }

    const motivo = this.motivo().trim();
    const cita = this.citaDeOrigen();
    const profesional = this.auth.practitionerProfileId();
    this.registrando.set(true);
    this.registro.set(loading());

    this.clinical
      .checkInEncounter({
        patientProfileId,
        tenantId,
        ...(motivo === '' ? {} : { reasonText: motivo }),
        ...(cita === null || cita === '' ? {} : { appointmentId: cita }),
        ...(profesional === null ? {} : { primaryPractitionerId: profesional }),
      })
      .subscribe({
        next: () => {
          this.registrando.set(false);
          this.registro.set(ready(null));
          this.motivo.set('');
          this.toasts.success('Queda en curso hasta que lo cierres.', 'Encuentro abierto');
          this.cargar();
        },
        error: (error: unknown) => {
          this.registrando.set(false);
          this.registro.set(errorToViewState<null>(error));
        },
      });
  }

  /** Cierra un encuentro en curso (UC-08-14). Con confirmación: no se reabre. */
  protected async cerrarEncuentro(encuentro: EncuentroEnCurso): Promise<void> {
    if (this.cerrando() !== null) {
      return;
    }

    const confirmado = await this.dialogs.confirm({
      title: '¿Cerrar el encuentro?',
      message: `Se cierra «${encuentro.motivo}» y sus participantes y ubicaciones activos. Un encuentro cerrado no se puede volver a abrir.`,
      confirmLabel: 'Cerrar encuentro',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }

    this.cerrando.set(encuentro.id);
    this.registro.set(loading());

    this.clinical.closeEncounter(encuentro.id, encuentro.version).subscribe({
      next: () => {
        this.cerrando.set(null);
        this.registro.set(ready(null));
        this.toasts.success('Queda registrado con su hora de fin.', 'Encuentro cerrado');
        this.cargar();
      },
      error: (error: unknown) => {
        this.cerrando.set(null);
        // BR-14/CL-16: 409 = otra sesión modificó la atención. Se avisa y se
        // relee (`cargar` limpia el estado), para que el próximo cierre lleve
        // la versión vigente en vez de repetir el mismo choque.
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.toasts.error(
            'Otra sesión modificó esta atención. Recargamos los datos: revisala y volvé a cerrarla.',
            'No se cerró la atención',
          );
          this.cargar();
          return;
        }
        this.registro.set(errorToViewState<null>(error));
      },
    });
  }

  /** Descarga la receta en PDF; sin emitir, se declara copia de trabajo. */
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

  /* -- Lectura -------------------------------------------------------------- */

  private cargar(): void {
    const profileId = this.profileId();
    this.consulta.set(loading());
    this.etiquetas.set(new Map());
    this.nombre.set('');
    this.registro.set(ready(null));

    if (profileId === '') {
      this.consulta.set(notFound({ label: 'Elegir una persona', route: CLINICAL_RECORD_ROUTE }));
      return;
    }

    // El nombre va por su lado: es cosmético y su permiso es otro.
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
          this.terminology.readConceptLabels(conceptosDe(datos)).pipe(
            catchError(() => of<ConceptLabels>(new Map())),
            map((etiquetas) => ({ datos, etiquetas })),
          ),
        ),
      )
      .subscribe({
        next: ({ datos, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.consulta.set(ready(datos));
        },
        error: (error: unknown) => this.consulta.set(errorToViewState<Consulta>(error)),
      });
  }

  /** La etiqueta de un concepto, o el texto de ausencia. Nunca el uuid. */
  /**
   * El **código** de catálogo de un concepto, que es por lo que se ramifica.
   *
   * La etiqueta es metadato de presentación y puede cambiar sin aviso; el
   * código no. Es lo que `diagnosisStateOf` necesita para decidir si un
   * diagnóstico está en estudio, activo o cerrado.
   */
  private codigo(conceptId: string | undefined): string | undefined {
    return conceptId === undefined ? undefined : this.etiquetas().get(conceptId)?.code;
  }

  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }
}

/** Los conceptos que esta pantalla traduce: los que muestra, y no más. */
function conceptosDe({ resumen }: Consulta): readonly string[] {
  return [
    ...resumen.conditions.flatMap((fila) => [
      fila.codeConceptId,
      // C8: la línea del encuentro clasifica el diagnóstico por estos dos
      // códigos. Sin pedirlos, `diagnosisStateOf` no tendría con qué
      // ramificar y todo caería en «en estudio».
      fila.verificationStatusConceptId,
      fila.clinicalStatusConceptId,
    ]),
    ...resumen.medicationRequests.flatMap((fila) => [
      fila.medicationConceptId,
      fila.statusConceptId,
    ]),
    ...resumen.encounters.flatMap((fila) => [fila.statusConceptId, fila.classConceptId]),
    // El tipo de episodio (C-23): la ficha lo muestra desde que la internación
    // dejó de ser «En curso» y una fecha. El **estado** no se traduce a
    // propósito: su rótulo de catálogo es «Activo», y la ficha dice «En curso».
    ...resumen.careEpisodes.map((fila) => fila.typeConceptId),
  ].filter((id): id is string => id !== undefined);
}
