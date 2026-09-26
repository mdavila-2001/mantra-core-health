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
import { mensajeDeFalloDeEscritura } from '../../mensaje-de-escritura';
import { DuplicateStudyWarningDialog } from './duplicate-study-warning-dialog/duplicate-study-warning-dialog';

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
 * Laboratorio o imagenología.
 *
 * Es lo único que separa una orden de este circuito de una derivación, y es lo
 * que la lectura de `diagnostics` usa para filtrar. Opcional en el DTO, pero el
 * formulario lo pide: una orden sin categoría no vuelve a aparecer en este
 * bloque, y ofrecer un pedido que después no se ve es exactamente lo que este
 * carril vino a arreglar.
 */
export const TARGET_CATEGORIA = 'clinical.service_requests.category_concept_id';

/** La prioridad. Opcional en el DTO: sin binding, se omite y ya. */
export const TARGET_PRIORIDAD = 'clinical.service_requests.priority_concept_id';

/**
 * Las categorías en castellano, por código estable.
 *
 * El catálogo trae su `display` en inglés técnico porque es terminología, no
 * copy de producto, y mapear por **código** —no por uuid— es lo que permite
 * traducir sin atarse a un identificador que un re-seed puede mover.
 */
const ETIQUETAS_DE_CATEGORIA: Readonly<Record<string, string>> = {
  SR_LAB: 'Laboratorio',
  SR_IMAGING: 'Imagenología',
};

/** Las prioridades en castellano. Mismo criterio que {@link ETIQUETAS_DE_CATEGORIA}. */
const ETIQUETAS_DE_PRIORIDAD: Readonly<Record<string, string>> = {
  SR_ROUTINE: 'De rutina',
};

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/** Tope de filas del histórico. Alcanza para la ficha; el detalle vive en su sección. */
const TOPE = 25;

/**
 * Antiduplicación de estudios (v4.2.17, T-26): la ventana que aplicó el
 * detector cuando el 422 de la carrera check→alta no la informa de vuelta.
 * Es el mismo default que fija `DuplicateStudyDetector` del lado del
 * servidor — sólo se usa acá para reconstruir el diálogo, nunca para decidir.
 */
const DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS = 30;

/** Una orden del histórico, ya sin uuid y con su estado resuelto. */
export interface EstudioEnFicha {
  readonly id: string;
  /** Qué se pidió, en palabras. Nunca el uuid del concepto. */
  readonly estudio: string;
  /** Laboratorio o imagenología. */
  readonly categoria: string;
  readonly estado: string;
  readonly pedidoEl: Date;
  /** Si ya hay un informe liberado que cuelgue de esta orden. */
  readonly conResultado: boolean;
  /**
   * Antiduplicación de estudios (v4.2.17): `'reused'` si la orden nació
   * satisfecha por un informe previo (no se llegó a pedir de nuevo),
   * `'repeated'` si se repitió con justificación clínica, o `null` en
   * cualquier otro caso. Gobierna qué línea reemplaza a «Sin resultado
   * todavía» / «Resultado listo» en el histórico.
   */
  readonly duplicado: 'reused' | 'repeated' | null;
  /** La fecha del informe previo. Sólo presente cuando `duplicado === 'reused'`. */
  readonly informePrevioDel: Date | null;
}

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
 * ## La categoría se pide aunque el contrato la deje opcional
 *
 * Porque es lo que hace que la orden vuelva a aparecer acá: la lectura de
 * `diagnostics` filtra por laboratorio o imagenología. Una orden sin categoría
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
  imports: [Alert, Card, ConceptSelect, DatePipe, DuplicateStudyWarningDialog, FormActions, FormField],
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

  protected readonly targetEstudio = TARGET_ESTUDIO;
  protected readonly targetCategoria = TARGET_CATEGORIA;
  protected readonly targetPrioridad = TARGET_PRIORIDAD;
  protected readonly etiquetasDeCategoria = ETIQUETAS_DE_CATEGORIA;
  protected readonly etiquetasDePrioridad = ETIQUETAS_DE_PRIORIDAD;

  /**
   * La organización bajo cuya custodia queda la orden.
   *
   * `custodianTenantId` es obligatorio en el DTO y no se deduce del paciente: es
   * quién responde por el pedido, y eso lo eligió la sesión.
   */
  protected readonly organizacion = this.auth.activeTenantId;

  /* -- El formulario ------------------------------------------------------- */

  protected readonly estudio = signal<string | null>(null);
  protected readonly categoria = signal<string | null>(null);
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
      this.hayEncuentro() &&
      !this.sinOrganizacion() &&
      this.estudio() !== null &&
      this.categoria() !== null &&
      !this.pidiendo() &&
      !this.checkingDuplicate(),
  );

  /** El fallo de la escritura, en palabras. */
  protected readonly errorDelPedido = computed<string | null>(() => {
    const state = this.registro();
    if (state.status === 'validation') {
      return state.issues.map((issue) => issue.message).join(' ') || null;
    }
    return mensajeDeFalloDeEscritura(state, { accion: 'pedir estudios', sinPermiso: 'Tu rol no permite pedir estudios.' });
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
      return 'Tu rol no permite ver los estudios de esta persona.';
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
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
    readonly previousDiagnosticReportId: string;
    readonly reusePreviousReport?: true;
    readonly duplicateOverrideReason?: string;
  }): void {
    const patientProfileId = this.patientProfileId();
    const custodianTenantId = this.organizacion();
    const codeConceptId = this.estudio();
    const categoryConceptId = this.categoria();
    const encounterId = this.encounterId();

    if (
      custodianTenantId === null ||
      codeConceptId === null ||
      categoryConceptId === null ||
      encounterId === null ||
      encounterId === '' ||
      this.pidiendo()
    ) {
      return;
    }

    const prioridad = this.prioridad();

    this.pidiendo.set(true);
    this.registro.set(loading());

    const cuerpo: NewDiagnosticOrder = {
      custodianTenantId,
      patientProfileId,
      codeConceptId,
      categoryConceptId,
      encounterId,
      // Los opcionales sin elegir se **omiten**: el backend valida con
      // `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
      ...(prioridad === null ? {} : { priorityConceptId: prioridad }),
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
            'Justo ahora apareció un estudio igual reciente. Revisá la alerta antes de seguir.',
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
    if (previousDiagnosticReportId === undefined) {
      return;
    }
    this.submitOrder({ previousDiagnosticReportId, reusePreviousReport: true });
  }

  /** El diálogo de antiduplicación pidió repetir el estudio, con justificación. */
  protected confirmRepeat(duplicateOverrideReason: string): void {
    const previousDiagnosticReportId = this.duplicateCheck()?.previousStudy?.reportId;
    if (previousDiagnosticReportId === undefined) {
      return;
    }
    this.submitOrder({ previousDiagnosticReportId, duplicateOverrideReason });
  }

  /** Se cerró el diálogo de antiduplicación sin decidir: no se pide nada. */
  protected closeDuplicateDialog(): void {
    this.duplicateCheck.set(null);
  }

  /** Vacía el formulario tras un pedido. El siguiente arranca limpio. */
  private limpiar(): void {
    this.estudio.set(null);
    this.categoria.set(null);
    this.prioridad.set(null);
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
    const duplicado =
      orden.previousDiagnosticReportId === undefined
        ? null
        : orden.duplicateOverrideReason === undefined
          ? 'reused'
          : 'repeated';

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

/**
 * Los conceptos que el histórico necesita traducir.
 *
 * Se juntan de los dos bloques en una sola lista porque `readConceptLabels` ya
 * deduplica y trocea: dos llamadas separadas pedirían dos veces los códigos que
 * la orden y su informe comparten.
 */
function conceptosDe(circuito: PatientDiagnostics): readonly string[] {
  const ids: string[] = [];
  for (const orden of circuito.orders) {
    ids.push(orden.codeConceptId, orden.statusConceptId);
    if (orden.categoryConceptId !== undefined) {
      ids.push(orden.categoryConceptId);
    }
  }
  for (const informe of circuito.reports) {
    ids.push(informe.codeConceptId, informe.lifecycleStatusConceptId);
  }
  return ids;
}

/**
 * El toast de éxito, según qué decisión de antiduplicación se mandó (o
 * ninguna). Devuelve `[mensaje, título]`, el orden que espera
 * `ToastService.success`.
 */
function mensajeDeAlta(decision: {
  readonly reusePreviousReport?: true;
  readonly duplicateOverrideReason?: string;
}): readonly [string, string] {
  if (decision.reusePreviousReport === true) {
    return [
      'Quedó registrado como cubierto por el informe previo. No se pide un estudio nuevo.',
      'Antiduplicación',
    ];
  }
  if (decision.duplicateOverrideReason !== undefined) {
    return ['Queda pedido con tu justificación; la aseguradora la va a ver.', 'Estudio solicitado'];
  }
  return ['Queda pedido y vas a verlo acá abajo con su resultado.', 'Estudio solicitado'];
}
