import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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
  viewChild,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import {
  DiagnosticsClient,
  previousStudyFromErrorDetails,
} from '../../../../core/data-access/diagnostics/diagnostics.client';
import type {
  DiagnosticOrder,
  DiagnosticReport,
  DuplicateStudyCheckResult,
  NewDiagnosticOrder,
  PatientDiagnostics,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import { SystemContextClient } from '../../../../core/data-access/system-context/system-context.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ConceptSelect } from '../../../../shared/components/molecules/concept-select/concept-select';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { FormActions } from '../../../../shared/components/organisms/form-actions/form-actions';
import { writeFailureMessage } from '../../write-message';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { consentTargetState } from '../informed-consent/consent-target';
import { InformedConsentBadge } from '../informed-consent/informed-consent-badge';
import { InformedConsentDialog } from '../informed-consent/informed-consent-dialog';
import { DuplicateStudyWarningDialog } from './duplicate-study-warning-dialog/duplicate-study-warning-dialog';
import { FormResponsePicker } from '../form-response-picker/form-response-picker';
import {
  DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS,
  PRIORITY_LABELS,
  conceptosDe,
  duplicadoDe,
  mensajeDeAlta,
} from './analysis-order-block.helpers';
import { createPerformerOrderState } from './performer-selector/performer-order-state';
import { PerformerSelector } from './performer-selector/performer-selector';
import { CollectionPointSelect } from './collection-point-select/collection-point-select';
import { createStudyCategoryState } from './study-category';
import type { EstudioEnFicha } from './analysis-order-block.helpers';

export type { EstudioEnFicha } from './analysis-order-block.helpers';

/**
 * La columna que gobierna qué se pide.
 *
 * El selector resuelve sus opciones por **binding de columna**, no por un value
 * set elegido acá: `esquema.tabla.columna` es lo que el catálogo publica, y es
 * lo que hace que el día que el binding se declare esta pantalla funcione sin
 * tocar una línea. Mismo criterio que la receta y el diagnóstico de al lado.
 */
export const TARGET_ESTUDIO = 'clinical.service_requests.code_concept_id';

/**
 * La categoría de la orden. No se elige: sale del estudio (`study-category.ts`).
 * Opcional en el DTO, pero siempre viaja: una orden sin categoría no vuelve a
 * aparecer en este bloque.
 */
export const TARGET_CATEGORIA = 'clinical.service_requests.category_concept_id';

/** La prioridad. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_PRIORIDAD = 'clinical.service_requests.priority_concept_id';

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/** Tope de filas del histórico. Alcanza para la ficha; el detalle vive en su sección. */
const TOPE = 25;

/**
 * **Laboratorio e imagenología** del expediente: pedir el estudio y ver qué
 * volvió — punto 10 del reclamo.
 *
 * ## Por qué pide y muestra, a diferencia del diagnóstico
 *
 * Porque acá la espera **es** el dato. Un diagnóstico se registra y ya está; un
 * estudio se pide hoy y el resultado llega mañana, y la pregunta que quien
 * atiende hace no es «¿qué pedí?» sino «¿ya está?». Un formulario que sólo pide
 * dejaría esa pregunta sin pantalla que la conteste, que es exactamente el
 * estado del que parte este carril: el backend tenía veinte endpoints de
 * diagnóstico y ninguna lectura por paciente.
 *
 * ## Lee lo suyo, no lo pide prestado
 *
 * La receta baja hecha desde el expediente porque el expediente ya la leía. El
 * circuito diagnóstico no sale de `GET /clinical/patients/:id/summary`: es otra
 * lectura y otro módulo. Que el bloque la haga suya deja la plantilla del
 * expediente casi intacta —un import y una entrada— que es lo que permite que
 * varios carriles agreguen bloques el mismo día sin pelearse por el archivo.
 *
 * ## El alta es de `clinical`, y no es un rodeo
 *
 * Una orden diagnóstica es una orden de servicio con categoría, y sus
 * invariantes viven en `POST /clinical/service-requests`. Un endpoint de alta
 * propio en `diagnostics` habría sido una segunda puerta a la misma tabla.
 *
 * ## La categoría viaja aunque el contrato la deje opcional
 *
 * Porque es lo que hace que la orden vuelva a aparecer acá: la lectura de
 * `diagnostics` filtra por categoría. No se pide: sale del estudio, que ya
 * dice si es laboratorio, imagen o procedimiento. Una orden sin categoría
 * se guarda bien y desaparece de esta pantalla, y un pedido que no se puede
 * volver a encontrar es el defecto que este bloque vino a cerrar.
 *
 * ## Vive dentro del encuentro abierto
 *
 * `encounterId` es opcional en el contrato, pero el recorrido de quien atiende
 * es check-in → ficha → pedir ahí mismo. Un estudio suelto —sin la consulta que
 * lo motivó— es un dato que después nadie sabe explicar. Mismo criterio que la
 * receta y el diagnóstico.
 *
 * El **histórico**, en cambio, se ve siempre: mirar qué se pidió antes no
 * requiere estar atendiendo.
 */
@Component({
  selector: 'app-analysis-order-block',
  imports: [
    FormResponsePicker,
    Alert,
    AppButton,
    Card,
    ConceptSelect,
    DatePipe,
    DuplicateStudyWarningDialog,
    FormActions,
    FormField,
    PerformerSelector,
    InformedConsentBadge,
    InformedConsentDialog,
    CollectionPointSelect,
  ],
  templateUrl: './analysis-order-block.html',
  styleUrl: './analysis-order-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisOrderBlock {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** C0: el host relee el encuentro solo después de un alta confirmada. */
  readonly cambio = output<void>();

  /**
   * El encuentro en curso, o `null` si no hay ninguno abierto.
   *
   * Lo sabe el expediente —lo deriva de `endAt`, no del estado— y baja hecho:
   * el bloque no vuelve a preguntarlo para que no puedan discrepar.
   */
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

  /**
   * La nota firmada con filas «campo: valor» de la que sale, si se eligió ésa
   * en vez de una respuesta de `forms` (A3). Desde el 28/10/2026 el «Formulario
   * libre — campo y valor» ya no se elige en el formulario médico: quedan las
   * notas libres registradas antes y las de los campos adicionales de la ficha.
   * Viaja como `basedOnNoteIds` (P40): la API la ata a la nota y verifica que
   * sea del mismo encuentro.
   */
  protected readonly notaDelFormularioLibre = signal<string | null>(null);

  protected readonly faltaRespuesta = computed(
    () =>
      (this.exigeRespuesta() &&
        this.respuestaDelFormulario() === null &&
        this.notaDelFormularioLibre() === null) ||
      // Sin formulario se pide, pero el encuentro abierto sigue siendo necesario.
      (this.ofreceRespuesta() && this.encounterId() === null),
  );

  /* -- Consentimiento informado dirigido a cada orden (CPE art. 44) ------- */

  protected readonly consent = consentTargetState<EstudioEnFicha>(
    () => this.patientProfileId(),
    (study) => [study?.encounterId, this.encounterId()],
  );

  protected readonly targetEstudio = TARGET_ESTUDIO;
  protected readonly targetPrioridad = TARGET_PRIORIDAD;
  protected readonly etiquetasDePrioridad = PRIORITY_LABELS;

  /**
   * La organización bajo cuya custodia queda la orden.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente: es
   * quién responde por el pedido, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly estudio = signal<string | null>(null);
  /** El tipo de la orden, deducido del estudio elegido. */
  protected readonly tipo = createStudyCategoryState({
    study: this.estudio,
    studyTarget: TARGET_ESTUDIO,
    categoryTarget: TARGET_CATEGORIA,
  });
  protected readonly prioridad = signal<string | null>(null);

  /**
   * Si el catálogo de estudios está disponible.
   *
   * `null` mientras se pregunta. Es el paso 0 hecho en código y no una vez a
   * mano: el día que el binding se declare, esta pantalla empieza a funcionar
   * sin desplegar nada nuevo.
   */
  protected readonly catalogoListo = signal<boolean | null>(null);

  protected readonly pidiendo = signal(false);

  /** Quién realiza el procedimiento: sólo en órdenes de procedimiento. */
  /** F5b: el punto de toma sugerido (sólo en sedes que tienen puntos). */
  private readonly collectionPoint = viewChild(CollectionPointSelect);

  protected readonly performer = createPerformerOrderState({
    category: this.tipo.conceptId,
    study: this.estudio,
    categoryTarget: TARGET_CATEGORIA,
  });

  /** El resultado de la última escritura. */
  protected readonly registro = signal<ViewState<null>>(ready(null));

  /* -- Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2) ------------ */

  /**
   * El chequeo previo está en vuelo.
   *
   * No alimenta `[pending]` de `FormActions`: ese estado ya gobierna el foco
   * de las tres pantallas que lo usan, y esta espera es más corta y previa —
   * mezclarla ahí correría el foco antes de que el diálogo, si aparece, pueda
   * capturarlo. Se anuncia aparte, con su propio `role="status"`.
   */
  protected readonly checkingDuplicate = signal(false);

  /**
   * El resultado del chequeo cuando encontró un duplicado: monta el diálogo.
   * `null` significa «sin diálogo abierto», nunca «sin duplicado» — eso lo
   * dice `isDuplicate` adentro del propio resultado.
   */
  protected readonly duplicateCheck = signal<DuplicateStudyCheckResult | null>(null);

  /* -- El histórico -------------------------------------------------------- */

  protected readonly circuito = signal<ViewState<PatientDiagnostics>>(loading());

  /** Las etiquetas de los conceptos que el histórico muestra. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly cargando = computed(() => this.circuito().status === 'loading');

  /**
   * Las órdenes del histórico, ya traducidas.
   *
   * Se cruzan con los informes acá y no en el servidor porque el vínculo ya
   * viaja en la respuesta (`serviceRequestId`) y cruzarlo es una pasada sobre
   * dos listas cortas. Pedirle al backend un tercer bloque precalculado sería
   * modelar la pantalla del lado del servidor.
   */
  protected readonly estudios = computed<readonly EstudioEnFicha[]>(() => {
    const state = this.circuito();
    if (state.status !== 'ready') {
      return [];
    }

    const conResultado = new Set(
      state.data.reports
        .filter((informe) => this.estaLiberado(informe))
        .map((informe) => informe.serviceRequestId)
        .filter((id): id is string => id !== undefined),
    );

    // Sólo hace falta para el texto «Satisfecha por el informe del {fecha}»:
    // el informe previo del paciente casi siempre está en esta misma lectura.
    const informesPorId = new Map(state.data.reports.map((informe) => [informe.id, informe]));

    return state.data.orders.map((orden) => this.aFila(orden, conResultado, informesPorId));
  });

  /**
   * Los informes que no cuelgan de ninguna orden de este circuito.
   *
   * Existen: un resultado puede cargarse sin que la orden se haya registrado en
   * el sistema —papel que llega de un laboratorio externo— y esconderlo porque
   * no tiene orden sería perder el dato clínico para preservar la prolijidad del
   * modelo.
   */
  protected readonly informesSueltos = computed<readonly DiagnosticReport[]>(() => {
    const state = this.circuito();
    if (state.status !== 'ready') {
      return [];
    }
    const conOrden = new Set(state.data.orders.map((orden) => orden.id));
    return state.data.reports.filter(
      (informe) =>
        informe.serviceRequestId === undefined || !conOrden.has(informe.serviceRequestId),
    );
  });

  /** Si algún bloque quedó recortado por el tope. */
  protected readonly recortado = computed(() => {
    const state = this.circuito();
    return state.status === 'ready' && state.data.truncated.length > 0;
  });

  protected readonly hayEncuentro = computed(() => {
    const id = this.encounterId();
    return id !== null && id !== '';
  });

  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * Si el formulario puede enviarse.
   *
   * Las cinco condiciones son del contrato o de esta pantalla, ninguna de
   * prudencia: encuentro en curso y categoría elegida (decisiones de acá, las
   * dos explicadas arriba), organización activa y estudio elegido (obligatorios
   * del DTO), y nada en vuelo —ni el chequeo de duplicidad ni el alta misma—.
   */
  protected readonly puedePedir = computed(
    () =>
      !this.faltaRespuesta() &&
      this.hayEncuentro() &&
      !this.sinOrganizacion() &&
      this.estudio() !== null &&
      this.tipo.fields() !== null &&
      !this.pidiendo() &&
      !this.checkingDuplicate() &&
      this.performer.canSubmit(),
  );

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelPedido = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return writeFailureMessage(state, { accion: 'pedir estudios', sinPermiso: 'Su rol no permite pedir estudios.' });
  });

  /**
   * El fallo de la lectura, en palabras.
   *
   * Separado del de la escritura porque son dos cosas distintas y sólo una
   * bloquea: si el histórico no se puede leer, pedir un estudio sigue estando
   * bien; si el pedido falla, el histórico sigue siendo válido.
   */
  protected readonly errorDelHistorico = computed<string | null>(() => {
    const state = this.circuito();
    if (state.status === 'forbidden') {
      return 'Su rol no permite ver los estudios de esta persona.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    }
    if (state.status === 'error') {
      return `${state.message || 'No pudimos leer los estudios.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    // El catálogo se pregunta una sola vez: el cliente memoiza por target, así
    // que esta llamada y la del selector son la misma petición.
    this.systemContext.dynamicEnum(TARGET_ESTUDIO).subscribe({
      next: (enumeracion) => this.catalogoListo.set(enumeracion.options.length > 0),
      // Sin binding declarado la API responde 404. No es un fallo transitorio
      // que convenga reintentar: es un dato que falta en el catálogo.
      error: () => this.catalogoListo.set(false),
    });

    effect(() => {
      const paciente = this.patientProfileId();
      untracked(() => this.cargar(paciente));
    });
  }

  /** La etiqueta de un concepto, o el guion si el catálogo no la tiene. */
  protected etiquetaDe(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  protected recargar(): void {
    this.cargar(this.patientProfileId());
  }

  /**
   * Pide el estudio (UC-08-05).
   *
   * Sin confirmación previa: pedir un laboratorio no sella ni cierra nada, y el
   * paso que sí requiere cuidado —la lectura del resultado— es de otro rol y de
   * otro momento.
   *
   * Lo que sí antepone es la antiduplicación (v4.2.17, T-26): antes de
   * escribir nada se pregunta si el paciente ya se hizo este mismo estudio
   * hace poco. Sin duplicado, se manda directo. Con duplicado, se abre el
   * diálogo y el pedido espera la decisión. Si la PREGUNTA misma falla —no si
   * el pedido falla— no se manda nada: fail closed, el riesgo de un duplicado
   * silencioso pesa más que la molestia de reintentar.
   */
  protected pedir(): void {
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

  /**
   * Escribe la orden.
   *
   * Sin `decision` es el camino directo —sin duplicado—; con ella es lo que
   * decidió el diálogo de antiduplicación. Nunca `reusePreviousReport` y
   * `duplicateOverrideReason` a la vez: eso lo separan {@link confirmReuse} y
   * {@link confirmRepeat}, que arman la decisión cada uno por su lado.
   */
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
      // Los opcionales sin elegir se **omiten**: el backend valida con
      // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
      ...(prioridad === null ? {} : { priorityConceptId: prioridad }),
      ...performerFields,
      ...(this.collectionPoint()?.fields() ?? {}),
      ...decision,
    };

    this.diagnostics.requestStudy(cuerpo).subscribe({
      next: () => {
        this.pidiendo.set(false);
        this.registro.set(ready(null));
        this.duplicateCheck.set(null);
        this.limpiar();
        this.toasts.success(...mensajeDeAlta(decision ?? {}));
        // Se relee en vez de agregar la fila a mano: un estudio que aparece
        // porque lo pintamos nosotros y no porque el servidor lo tenga es
        // exactamente la clase de mentira que el expediente no puede permitirse.
        this.cargar(patientProfileId);
        this.cambio.emit();
      },
      error: (error: unknown) => {
        this.pidiendo.set(false);
        this.handleSubmitError(error);
      },
    });
  }

  /**
   * La carrera entre el chequeo y el alta: alguien liberó el informe justo
   * entre medio, y el alta —que vuelve a correr el mismo detector antes de
   * escribir— rechaza con el mismo `DUPLICATE_STUDY_DETECTED` que hubiera
   * dado el chequeo. Reabre el diálogo con el estudio que vino en el propio
   * error, en vez de mandar a pedir el estudio otra vez desde cero.
   */
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
            // El alta no manda su ventana de vuelta: el default del backend
            // es el único que puede haber corrido para producir este 422.
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

  /** El diálogo de antiduplicación pidió reutilizar el informe previo. */
  protected confirmReuse(): void {
    const previousDiagnosticReportId = this.duplicateCheck()?.previousStudy?.reportId;
    if (previousDiagnosticReportId == null) {
      return;
    }
    this.submitOrder({ previousDiagnosticReportId, reusePreviousReport: true });
  }

  /** El diálogo de antiduplicación pidió repetir el estudio, con justificación. */
  protected confirmRepeat(duplicateOverrideReason: string): void {
    const previo = this.duplicateCheck()?.previousStudy;
    if (previo === undefined) {
      return;
    }
    // Repetir sobre una orden activa sin informe: no hay informe que enlazar,
    // sólo la justificación.
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
    this.performer.reset();
    this.collectionPoint()?.reset();
  }

  /**
   * Un informe cuenta como resultado sólo si tiene versión **liberada**.
   *
   * `currentVersionId` dice que hay algo redactado; `currentReleasedVersionId`
   * dice que alguien lo validó y lo liberó. Tratar el primero como resultado
   * mostraría un borrador como diagnóstico.
   */
  private estaLiberado(informe: DiagnosticReport): boolean {
    return informe.currentReleasedVersionId !== undefined;
  }

  /** Una orden traducida a la fila que la ficha muestra. */
  private aFila(
    orden: DiagnosticOrder,
    conResultado: ReadonlySet<string>,
    informesPorId: ReadonlyMap<string, DiagnosticReport>,
  ): EstudioEnFicha {
    const duplicado = duplicadoDe(orden);

    return {
      id: orden.id,
      estudio: this.etiquetaDe(orden.codeConceptId),
      categoria: this.etiquetaDe(orden.categoryConceptId),
      estado: this.etiquetaDe(orden.statusConceptId),
      pedidoEl: orden.createdAt,
      conResultado: conResultado.has(orden.id),
      duplicado,
      informePrevioDel:
        duplicado === 'reused' && orden.previousDiagnosticReportId !== undefined
          ? (informesPorId.get(orden.previousDiagnosticReportId)?.createdAt ?? null)
          : null,
      justificacion: orden.duplicateOverrideReason ?? null,
      puntoDeToma: orden.suggestedCareSpace ? `${orden.suggestedCareSpace.code} · ${orden.suggestedCareSpace.name}` : null,
      ...(orden.encounterId === undefined ? {} : { encounterId: orden.encounterId }),
    };
  }

  private cargar(patientProfileId: string): void {
    if (patientProfileId === '') {
      return;
    }

    this.circuito.set(loading());

    this.diagnostics
      .getPatientDiagnostics(patientProfileId, TOPE)
      .pipe(
        switchMap((circuito) =>
          forkJoin({
            circuito: of(circuito),
            // Las etiquetas no son el dato: si la terminología falla, el
            // histórico se muestra igual con guiones. Perder los nombres es
            // molesto; perder la lista entera porque el catálogo no respondió
            // sería peor.
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(circuito))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ circuito, etiquetas }) => {
          this.etiquetas.set(etiquetas);
          this.circuito.set(ready(circuito));
        },
        error: (error: unknown) =>
          this.circuito.set(errorToViewState<PatientDiagnostics>(error)),
      });
  }
}
