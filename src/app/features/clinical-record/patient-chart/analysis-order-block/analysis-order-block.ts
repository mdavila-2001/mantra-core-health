import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  DiagnosticsClient,
  previousStudyFromErrorDetails,
} from '../../../../core/data-access/diagnostics/diagnostics.client';
import type {
  DuplicateStudyCheckResult,
  NewDiagnosticOrder,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { writeFailureMessage } from '../../write-message';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { FormResponsePicker } from '../form-response-picker/form-response-picker';
import { AnalysisOrderHistory } from './analysis-order-history/analysis-order-history';
import {
  DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS,
  PRIORITY_LABELS,
  mensajeDeAlta,
} from './analysis-order-block.helpers';
import { DuplicateStudyWarningDialog } from './duplicate-study-warning-dialog/duplicate-study-warning-dialog';
import { ImagingStudyPicker } from './imaging-study-picker/imaging-study-picker';
import {
  initialSelection,
  selectionIssues,
  serializeImaging,
  type ImagingRequestLine,
  type ImagingSelection,
} from './imaging-study-picker/imaging-study-picker.logic';
import { LabAnalysisPicker } from './lab-analysis-picker/lab-analysis-picker';
import {
  defaultComponentIds,
  serializeSelection,
  summarize,
  type LabSelection,
} from './lab-analysis-picker/lab-analysis-picker.logic';
import { PerformerSelector } from './performer-selector/performer-selector';
import { createPerformerOrderState } from './performer-selector/performer-order-state';
import { STUDY_FAMILY_LABELS, createStudyCategoryState } from './study-category';
import {
  STUDY_TYPE_OPTIONS,
  labRequisitionItem,
  toLabAnalysis,
  type StudyType,
} from './study-order-adapter';
import { StudyOrderCatalog } from './study-order-catalog';
import { createStudyPerformer } from './study-order-performer';
import { RequisitionFlow, type RequisitionLine } from './study-order-requisition';

export type { EstudioEnFicha } from './analysis-order-block.helpers';

/**
 * La columna que gobierna qué se pide.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica.
 */
export const TARGET_ESTUDIO = 'clinical.service_requests.code_concept_id';

/**
 * La categoría de la orden. No se elige: sale del estudio (`study-category.ts`).
 * Siempre viaja: una orden sin categoría no vuelve a aparecer en el histórico.
 */
export const TARGET_CATEGORIA = 'clinical.service_requests.category_concept_id';

/** La prioridad. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_PRIORIDAD = 'clinical.service_requests.priority_concept_id';

/**
 * **Laboratorio e imagenología** del expediente: pedir el estudio y ver qué
 * volvió — punto 10 del reclamo.
 *
 * ## Pide y muestra
 *
 * Acá la espera **es** el dato: la pregunta de quien atiende no es «¿qué pedí?»
 * sino «¿ya está?». El histórico vive en `app-analysis-order-history`.
 *
 * ## El alta es de `clinical`
 *
 * Una orden diagnóstica es una orden de servicio con categoría; sus invariantes
 * viven en `POST /clinical/service-requests` y `/clinical/requisitions`.
 *
 * ## La categoría viaja siempre
 *
 * Es lo que hace que la orden vuelva a aparecer en el histórico (la lectura de
 * `diagnostics` filtra por categoría). No se pide: sale del estudio.
 *
 * ## Vive dentro del encuentro abierto
 *
 * Un estudio suelto, sin la consulta que lo motivó, es un dato que nadie sabe
 * explicar. Mismo criterio que la receta y el diagnóstico.
 *
 * El **histórico**, en cambio, se ve siempre: mirar qué se pidió antes no
 * requiere estar atendiendo.
 *
 * ## Tipo, catálogo y requisición (H4.A, 31/10/2026)
 *
 * El médico elige el tipo —Laboratorio · Imagenología · Otros— y el tipo
 * **filtra** el catálogo (`GET /clinical/study-catalog`); la categoría que
 * viaja sale de la familia que el catálogo da al estudio, no de la pestaña, así
 * que un hemograma no se puede pedir como imagen. Laboratorio e imagen arman
 * UNA requisición con un renglón por estudio (componentes marcados, región,
 * lado, contraste); «Otros» conserva el alta de un estudio.
 */

@Component({
  selector: 'app-analysis-order-block',
  imports: [
    FormResponsePicker,
    Alert,
    AnalysisOrderHistory,
    AppButton,
    Card,
    ConceptSelect,
    DuplicateStudyWarningDialog,
    FormActions,
    FormField,
    ImagingStudyPicker,
    LabAnalysisPicker,
    PerformerSelector,
    SegmentedControl,
    Select,
  ],
  providers: [StudyOrderCatalog, { provide: DRAFT_BLOCK, useExisting: forwardRef(() => AnalysisOrderBlock) }],
  templateUrl: './analysis-order-block.html',
  styleUrl: './analysis-order-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisOrderBlock implements DraftBlock {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  protected readonly catalog = inject(StudyOrderCatalog);

  readonly patientProfileId = input.required<string>();

  /** C0: el host relee el encuentro solo después de un alta confirmada. */
  readonly cambio = output<void>();

  /** El encuentro en curso, o `null` si no hay ninguno abierto (lo deriva el expediente). */
  readonly encounterId = input<string | null>(null);

  /** En la cita, lo que se emite cuelga sí o sí de una respuesta del formulario médico. */
  readonly exigeRespuesta = input(false);

  /** Ofrece la respuesta sin exigirla (30/10/2026): se emite sin formulario, no sin encuentro. */
  readonly ofreceRespuesta = input(false);

  /** La respuesta del formulario médico elegida; por defecto, la más reciente. */
  protected readonly respuestaDelFormulario = signal<string | null>(null);

  /** La nota firmada de la que sale (A3); viaja como `basedOnNoteIds`. */
  protected readonly notaDelFormularioLibre = signal<string | null>(null);

  protected readonly faltaRespuesta = computed(
    () =>
      (this.exigeRespuesta() &&
        this.respuestaDelFormulario() === null &&
        this.notaDelFormularioLibre() === null) ||
      // Sin formulario se pide, pero el encuentro abierto sigue siendo necesario.
      (this.ofreceRespuesta() && this.encounterId() === null),
  );

  protected readonly targetEstudio = TARGET_ESTUDIO;
  protected readonly targetPrioridad = TARGET_PRIORIDAD;
  protected readonly etiquetasDePrioridad = PRIORITY_LABELS;
  protected readonly opcionesDeTipo = STUDY_TYPE_OPTIONS;

  /** La organización bajo cuya custodia queda la orden. */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  /** El tipo de pedido: filtra el catálogo, no decide la categoría. */
  protected readonly tipoOrden = signal<StudyType>('LAB');
  /** El estudio de «Otros». */
  protected readonly estudio = signal<string | null>(null);
  /** La categoría de «Otros», deducida del estudio. */
  protected readonly tipo = createStudyCategoryState({
    study: this.estudio,
    studyTarget: TARGET_ESTUDIO,
    categoryTarget: TARGET_CATEGORIA,
  });
  protected readonly prioridad = signal<string | null>(null);
  protected readonly labSelection = signal<LabSelection>(new Map());
  protected readonly imagingSelection = signal<ImagingSelection | null>(null);
  private readonly history = viewChild(AnalysisOrderHistory);

  /** Si el catálogo de «Otros» está disponible. `null` mientras se pregunta. */
  protected readonly catalogoListo = signal<boolean | null>(null);
  protected readonly pidiendo = signal(false);

  /** Quién realiza el procedimiento de «Otros». */
  protected readonly performer = createPerformerOrderState({
    category: this.tipo.conceptId,
    study: this.estudio,
    categoryTarget: TARGET_CATEGORIA,
  });

  /** El resultado de la última escritura de «Otros». */
  protected readonly registro = signal<ViewState<null>>(ready(null));
  protected readonly checkingDuplicate = signal(false);
  /** El duplicado de «Otros» que espera decisión. `null` = sin diálogo abierto. */
  protected readonly duplicateCheck = signal<DuplicateStudyCheckResult | null>(null);

  /** La requisición de laboratorio o imagen (D10: antiduplicación por renglón). */
  protected readonly flow = new RequisitionFlow(this.diagnostics, () => this.altaConfirmada());

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /* -- Laboratorio --------------------------------------------------------- */

  private readonly labLines = computed(() => serializeSelection(this.catalog.labAnalyses(), this.labSelection()));
  protected readonly panelesSinComponentes = computed(() => {
    const ids = new Set(summarize(this.catalog.labAnalyses(), this.labSelection()).incompleteAnalysisIds);
    return this.catalog.labAnalyses().filter((a) => ids.has(a.conceptId)).map((a) => a.label);
  });
  /** Los análisis elegidos cuyo detalle (componentes, muestra) todavía no se leyó. */
  protected readonly detallesPendientes = computed(() => {
    const ids = this.tipoOrden() === 'LAB' ? [...this.labSelection().keys()] : [];
    return ids.filter((id) => !this.catalog.details().has(id));
  });
  protected readonly detallesConError = computed(() =>
    this.detallesPendientes().filter((id) => this.catalog.detailStatus().get(id) === 'error'),
  );
  protected readonly imagenCargando = computed(() => {
    const id = this.imagingSelection()?.studyConceptId;
    return id !== undefined && !this.catalog.details().has(id) && this.catalog.detailStatus().get(id) !== 'error';
  });
  protected readonly imagenConError = computed(() => {
    const id = this.imagingSelection()?.studyConceptId;
    return id !== undefined && this.catalog.detailStatus().get(id) === 'error';
  });

  /* -- Ejecutor de laboratorio e imagen (D9) -------------------------------- */

  protected readonly estudioDelEjecutor = computed<string | null>(() => {
    if (this.tipoOrden() === 'LAB') return this.labLines()[0]?.analysisConceptId ?? null;
    return this.tipoOrden() === 'IMAGING' ? (this.imagingSelection()?.studyConceptId ?? null) : null;
  });
  protected readonly ejecutor = createStudyPerformer(this.estudioDelEjecutor);

  protected readonly opcionesDeOtros = computed<readonly SelectOption<string>[]>(() =>
    this.catalog.otherItems().map((i) => ({ value: i.conceptId, label: i.display, description: STUDY_FAMILY_LABELS[i.family] })),
  );

  /** Contrato de `DraftBlock`: hay una selección que se perdería al cerrar el modal. */
  readonly tieneCambiosPendientes = computed(
    () => this.labSelection().size > 0 || this.imagingSelection() !== null || this.estudio() !== null,
  );

  /** Lo que el selector de imagen serializaría: `null` mientras la selección no sea válida. */
  private readonly imagingRequest = computed<ImagingRequestLine | null>(() => {
    const seleccion = this.imagingSelection();
    const vista = this.catalog.imaging();
    const estudio = seleccion === null ? undefined : vista.studies.find((s) => s.conceptId === seleccion.studyConceptId);
    if (seleccion === null || estudio === undefined) return null;
    if (selectionIssues(seleccion, estudio, { regions: vista.regions, contrastOptions: vista.contrastOptions }).length > 0) return null;
    return serializeImaging(seleccion, vista);
  });

  /** El renglón de imagen, o `null` mientras no sea válido. */
  private imagingLine(): RequisitionLine | null {
    const request = this.imagingRequest();
    const study = request === null ? undefined : this.catalog.imagingItems().find((i) => i.conceptId === request.studyConceptId);
    if (request === null || study === undefined) return null;
    const { bodySiteConceptId, lateralityConceptId } = request.imaging;
    return {
      label: study.display,
      item: { codeConceptId: study.conceptId, category: 'IMAGING', imaging: request.imaging },
      duplicateKey: {
        ...(bodySiteConceptId === undefined ? {} : { bodySiteConceptId }),
        ...(lateralityConceptId === undefined ? {} : { lateralityConceptId }),
      },
    };
  }

  private labRequisitionLines(): readonly RequisitionLine[] {
    return this.labLines().flatMap((line) => {
      const study = this.catalog.labItems().find((i) => i.conceptId === line.analysisConceptId);
      return study === undefined
        ? []
        : [
            {
              label: study.display,
              item: labRequisitionItem(line, study),
              duplicateKey: line.componentConceptIds.length === 0 ? {} : { componentConceptIds: line.componentConceptIds },
            },
          ];
    });
  }

  protected readonly puedePedir = computed(() => {
    const comun =
      !this.faltaRespuesta() && this.hayEncuentro() && !this.sinOrganizacion() && !this.pidiendo() && !this.flow.busy();
    switch (this.tipoOrden()) {
      case 'LAB':
        return (
          comun &&
          this.labLines().length > 0 &&
          this.detallesPendientes().length === 0 &&
          this.panelesSinComponentes().length === 0 &&
          this.ejecutor.canSubmit()
        );
      case 'IMAGING':
        return comun && this.imagingRequest() !== null && !this.imagenCargando() && this.ejecutor.canSubmit();
      default:
        return (
          comun &&
          this.estudio() !== null &&
          this.tipo.fields() !== null &&
          !this.checkingDuplicate() &&
          this.performer.canSubmit()
        );
    }
  });

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelPedido = computed<string | null>(() => {
    const state = this.tipoOrden() === 'OTHER' ? this.registro() : this.flow.error();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return writeFailureMessage(state, { accion: 'pedir estudios', sinPermiso: 'Su rol no permite pedir estudios.' });
  });

  constructor() {
    // El catálogo de «Otros» se pregunta una sola vez: el cliente memoiza por target.
    this.systemContext.dynamicEnum(TARGET_ESTUDIO).subscribe({
      next: (enumeracion) => this.catalogoListo.set(enumeracion.options.length > 0),
      error: () => this.catalogoListo.set(false),
    });

    // El tipo filtra el catálogo: se lee la familia al mostrarse el formulario.
    effect(() => {
      const visible = this.hayEncuentro() && !this.sinOrganizacion();
      const tipo = this.tipoOrden();
      if (visible) untracked(() => this.catalog.ensure(tipo));
    });

    // Al marcar un análisis se trae su detalle (componentes, muestra) y se completa lo marcado.
    effect(() => {
      const ids = [...this.labSelection().keys()];
      untracked(() => {
        for (const id of ids) this.traerAnalisis(id);
      });
    });
    // Al elegir un estudio de imagen se trae su detalle (región, lado, contraste).
    effect(() => {
      const id = this.imagingSelection()?.studyConceptId;
      if (id !== undefined) untracked(() => this.traerEstudio(id));
    });
  }

  protected elegirTipo(tipo: StudyType): void {
    this.tipoOrden.set(tipo);
    this.flow.reset();
    this.registro.set(ready(null));
  }

  protected reintentarCatalogo(tipo: StudyType): void {
    this.catalog.ensure(tipo, true);
  }

  protected reintentarDetalles(): void {
    for (const id of this.detallesConError()) this.traerAnalisis(id);
    const imagen = this.imagingSelection()?.studyConceptId;
    if (imagen !== undefined) this.traerEstudio(imagen);
  }

  private traerAnalisis(id: string): void {
    if (this.catalog.details().has(id) || this.catalog.detailStatus().get(id) !== undefined) return;
    this.catalog.fetchDetail(id, (detail) => this.completarAnalisis(id, detail));
  }

  private traerEstudio(id: string): void {
    if (this.catalog.details().has(id) || this.catalog.detailStatus().get(id) !== undefined) return;
    this.catalog.fetchDetail(id, () => this.completarEstudio(id));
  }

  /** Con el detalle en mano, un panel recién marcado trae sus componentes por defecto (D3). */
  private completarAnalisis(id: string, detail: Parameters<typeof toLabAnalysis>[1]): void {
    const item = this.catalog.labItems().find((i) => i.conceptId === id);
    if (item === undefined) return;
    const option = toLabAnalysis(item, detail);
    this.labSelection.update((seleccion) => {
      const actual = seleccion.get(id);
      if (actual === undefined) return seleccion;
      return new Map(seleccion).set(id, {
        components: actual.components.size === 0 ? defaultComponentIds(option) : actual.components,
        specimenConceptId: actual.specimenConceptId ?? option.specimen?.conceptId ?? null,
      });
    });
  }

  /** Con el detalle en mano, la selección arranca en la región y el contraste del estudio. */
  private completarEstudio(id: string): void {
    if (this.imagingSelection()?.studyConceptId !== id) return;
    const vista = this.catalog.imaging();
    const estudio = vista.studies.find((s) => s.conceptId === id);
    if (estudio !== undefined) this.imagingSelection.set(initialSelection(estudio, vista.contrastOptions));
  }

  /** Pide: «Otros» con el alta de un estudio; laboratorio e imagen con una requisición. */
  protected pedir(): void {
    if (this.tipoOrden() === 'OTHER') {
      this.pedirOtro();
      return;
    }
    const base = this.baseDeRequisicion();
    const lineas = this.tipoOrden() === 'LAB' ? this.labRequisitionLines() : [this.imagingLine()].filter((l) => l !== null);
    if (base === null || lineas.length === 0 || !this.puedePedir()) return;
    this.flow.start(base, lineas);
  }

  private baseDeRequisicion() {
    const custodianTenantId = this.organizacion();
    const encounterId = this.encounterId();
    const ejecutor = this.ejecutor.fields();
    if (custodianTenantId === null || encounterId === null || encounterId === '' || ejecutor === null) return null;
    const prioridad = this.prioridad();
    return {
      custodianTenantId,
      patientProfileId: this.patientProfileId(),
      encounterId,
      ...(this.respuestaDelFormulario() === null ? {} : { formInstanceId: this.respuestaDelFormulario() ?? '' }),
      ...(this.notaDelFormularioLibre() === null ? {} : { basedOnNoteIds: [this.notaDelFormularioLibre() ?? ''] }),
      ...(prioridad === null ? {} : { priorityConceptId: prioridad }),
      ...ejecutor,
    };
  }

  /** La requisición quedó creada: se limpia, se relee el histórico y se avisa al host. */
  private altaConfirmada(): void {
    const total = this.tipoOrden() === 'LAB' ? this.labLines().length : 1;
    this.limpiar();
    this.toasts.success(
      total === 1 ? 'Queda pedido y va a verlo acá abajo con su resultado.' : `Quedan pedidos ${total} estudios; los verá acá abajo.`,
      total === 1 ? 'Estudio solicitado' : 'Estudios solicitados',
    );
    // Se relee en vez de agregar la fila a mano: sólo se muestra lo que el servidor confirmó.
    this.history()?.recargar();
    this.cambio.emit();
  }

  /* -- «Otros»: un estudio, con su antiduplicación (v4.2.17, T-26) ---------- */

  /**
   * Antes de escribir se pregunta si el paciente ya se hizo este estudio hace
   * poco. Si la PREGUNTA falla no se manda nada (fail closed).
   */
  private pedirOtro(): void {
    const patientProfileId = this.patientProfileId();
    const codeConceptId = this.estudio();
    const encounterId = this.encounterId();

    if (codeConceptId === null || encounterId === null || encounterId === '' || !this.puedePedir()) {
      return;
    }

    this.checkingDuplicate.set(true);
    this.registro.set(loading());

    this.diagnostics.checkDuplicateStudy({ patientProfileId, codeConceptId, encounterId }).subscribe({
      next: (resultado) => {
        this.checkingDuplicate.set(false);
        if (resultado.isDuplicate) {
          this.registro.set(ready(null));
          this.duplicateCheck.set(resultado);
          return;
        }
        this.submitOrder();
      },
      error: (error: unknown) => {
        this.checkingDuplicate.set(false);
        this.registro.set(errorToViewState<null>(error));
      },
    });
  }

  /** Escribe la orden de «Otros»; sin `decision` es el camino directo. */
  private submitOrder(decision?: {
    readonly previousDiagnosticReportId?: string;
    readonly reusePreviousReport?: true;
    readonly duplicateOverrideReason?: string;
  }): void {
    const patientProfileId = this.patientProfileId();
    const custodianTenantId = this.organizacion();
    const codeConceptId = this.estudio();
    const categoria = this.tipo.fields();
    const encounterId = this.encounterId();

    if (
      custodianTenantId === null ||
      codeConceptId === null ||
      categoria === null ||
      encounterId === null ||
      encounterId === '' ||
      this.pidiendo()
    ) {
      return;
    }

    const prioridad = this.prioridad();
    // Una recomendación a medias (sin sede) no se manda: la API la rechazaría con 422.
    const performerFields = this.performer.fields();
    if (performerFields === null) {
      return;
    }

    this.pidiendo.set(true);
    this.registro.set(loading());

    const cuerpo: NewDiagnosticOrder = {
      custodianTenantId,
      patientProfileId,
      codeConceptId,
      ...categoria,
      encounterId,
      ...(this.respuestaDelFormulario() === null
        ? {}
        : { formInstanceId: this.respuestaDelFormulario() ?? '' }),
      ...(this.notaDelFormularioLibre() === null
        ? {}
        : { basedOnNoteIds: [this.notaDelFormularioLibre() ?? ''] }),
      // Los opcionales sin elegir se **omiten**: el backend valida con `forbidNonWhitelisted`.
      ...(prioridad === null ? {} : { priorityConceptId: prioridad }),
      ...performerFields,
      ...decision,
    };

    this.diagnostics.requestStudy(cuerpo).subscribe({
      next: () => {
        this.pidiendo.set(false);
        this.registro.set(ready(null));
        this.duplicateCheck.set(null);
        this.limpiar();
        this.toasts.success(...mensajeDeAlta(decision ?? {}));
        this.history()?.recargar();
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.pidiendo.set(false);
        this.handleSubmitError(error);
      },
    });
  }

  /** La carrera entre el chequeo y el alta reabre el diálogo con el estudio del propio 422. */
  private handleSubmitError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const body = readApiError(error);
      if (body?.code === 'PRECONDITION_FAILED' && body.details?.['reason'] === 'DUPLICATE_STUDY_DETECTED') {
        const previousStudy = previousStudyFromErrorDetails(body.details);
        if (previousStudy !== null) {
          this.registro.set(ready(null));
          this.duplicateCheck.set({
            isDuplicate: true,
            previousStudy,
            requiresJustification: true,
            pendingReport: false,
            windowDays: DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS,
          });
          this.toasts.info(
            'Justo ahora apareció un estudio igual reciente. Revise la alerta antes de seguir.',
            'Duplicado detectado',
          );
          return;
        }
      }
    }
    this.registro.set(errorToViewState<null>(error));
  }

  /** El diálogo de antiduplicación de «Otros» pidió reutilizar el informe previo. */
  protected confirmReuse(): void {
    const previousDiagnosticReportId = this.duplicateCheck()?.previousStudy?.reportId;
    if (previousDiagnosticReportId == null) {
      return;
    }
    this.submitOrder({ previousDiagnosticReportId, reusePreviousReport: true });
  }

  /** El diálogo de antiduplicación de «Otros» pidió repetir el estudio, con justificación. */
  protected confirmRepeat(duplicateOverrideReason: string): void {
    const previo = this.duplicateCheck()?.previousStudy;
    if (previo === undefined) {
      return;
    }
    // Repetir sobre una orden activa sin informe: no hay informe que enlazar, sólo la justificación.
    this.submitOrder({
      ...(previo.reportId == null ? {} : { previousDiagnosticReportId: previo.reportId }),
      duplicateOverrideReason,
    });
  }

  /** Se cerró el diálogo de antiduplicación sin decidir: no se pide nada. */
  protected closeDuplicateDialog(): void {
    this.duplicateCheck.set(null);
  }

  /** Vacía el formulario tras un pedido. El siguiente arranca limpio. */
  private limpiar(): void {
    this.estudio.set(null);
    this.prioridad.set(null);
    this.labSelection.set(new Map());
    this.imagingSelection.set(null);
    this.performer.reset();
    this.ejecutor.reset();
    this.flow.reset();
  }
}
