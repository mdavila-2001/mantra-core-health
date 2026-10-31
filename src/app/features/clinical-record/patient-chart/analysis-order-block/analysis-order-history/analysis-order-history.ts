import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { DiagnosticsClient } from '../../../../../core/data-access/diagnostics/diagnostics.client';
import type {
  DiagnosticOrder,
  DiagnosticReport,
  PatientDiagnostics,
} from '../../../../../core/data-access/diagnostics/diagnostics.types';
import { TerminologyClient } from '../../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { consentTargetState } from '../../informed-consent/consent-target';
import { InformedConsentBadge } from '../../informed-consent/informed-consent-badge';
import { InformedConsentDialog } from '../../informed-consent/informed-consent-dialog';
import { conceptosDe, detalleDeLaOrden, duplicadoDe } from '../analysis-order-block.helpers';
import type { EstudioEnFicha } from '../analysis-order-block.helpers';

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/** Tope de filas del histórico. Alcanza para la ficha; el detalle vive en su sección. */
const TOPE = 25;

/**
 * El **histórico** de estudios pedidos de una persona: qué se pidió, con qué
 * detalle (componentes, región y lado) y si ya volvió el resultado.
 *
 * Se extrajo de `app-analysis-order-block` (H4.A.M1) sin cambiar su
 * comportamiento: lee lo suyo (`GET /diagnostics/patients/:id/orders`), cruza
 * órdenes con informes liberados, deja a la vista los informes sin orden y
 * ata el consentimiento informado dirigido a cada orden. Se ve siempre, con
 * encuentro o sin él: mirar qué se pidió antes no requiere estar atendiendo.
 *
 * Quien pide lo relee con {@link recargar} tras un alta confirmada: un estudio
 * que aparece porque lo pintamos nosotros y no porque el servidor lo tenga es
 * la clase de mentira que el expediente no puede permitirse.
 */
@Component({
  selector: 'app-analysis-order-history',
  imports: [Alert, AppButton, DatePipe, InformedConsentBadge, InformedConsentDialog],
  templateUrl: './analysis-order-history.html',
  styleUrl: './analysis-order-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalysisOrderHistory {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);

  /** La persona de la ficha. */
  readonly patientProfileId = input.required<string>();

  /** El encuentro en curso, si hay: ata el consentimiento cuando la orden no trae el suyo. */
  readonly encounterId = input<string | null>(null);

  protected readonly consent = consentTargetState<EstudioEnFicha>(
    () => this.patientProfileId(),
    (study) => [study?.encounterId, this.encounterId()],
  );

  protected readonly circuito = signal<ViewState<PatientDiagnostics>>(loading());

  /** Las etiquetas de los conceptos que el histórico muestra. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly cargando = computed(() => this.circuito().status === 'loading');

  /**
   * Las órdenes del histórico, ya traducidas.
   *
   * Se cruzan con los informes acá y no en el servidor porque el vínculo ya
   * viaja en la respuesta (`serviceRequestId`) y cruzarlo es una pasada sobre
   * dos listas cortas.
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

  /** Vuelve a leer el circuito de la persona. */
  recargar(): void {
    this.cargar(this.patientProfileId());
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
      detalle: detalleDeLaOrden(orden),
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
