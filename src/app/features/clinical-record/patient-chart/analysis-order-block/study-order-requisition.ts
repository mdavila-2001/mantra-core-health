import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import {
  previousStudyFromErrorDetails,
  type DiagnosticsClient,
} from '../../../../core/data-access/diagnostics/diagnostics.client';
import type {
  DuplicateStudyCheck,
  DuplicateStudyCheckResult,
  NewRequisition,
  RequisitionDuplicateDecision,
  RequisitionItem,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS } from './analysis-order-block.helpers';
import { requisitionFieldError, type RequisitionFieldError } from './study-order-adapter';

/** Un estudio por pedir: el renglón de la requisición y lo que identifica el duplicado (D10). */
export interface RequisitionLine {
  readonly label: string;
  readonly item: RequisitionItem;
  readonly duplicateKey: Pick<DuplicateStudyCheck, 'bodySiteConceptId' | 'lateralityConceptId' | 'componentConceptIds'>;
}

export type RequisitionBase = Omit<NewRequisition, 'items'> & { readonly encounterId: string };

/**
 * El envío de una requisición: antiduplicación por renglón, diálogo uno por
 * uno, alta atómica y errores 422 llevados a su renglón.
 *
 * Es estado puro de señales (sin inyección): lo crea el bloque con el cliente.
 * Doble envío bloqueado: mientras `busy()` no se acepta otro `start`.
 */
export class RequisitionFlow {
  /** El chequeo previo está en vuelo. */
  readonly checking = signal(false);
  /** El alta está en vuelo. */
  readonly sending = signal(false);
  /** El duplicado que espera decisión, con su renglón. */
  readonly duplicate = signal<{ readonly index: number; readonly check: DuplicateStudyCheckResult } | null>(null);
  readonly error = signal<ViewState<null>>(ready(null));
  readonly fieldErrors = signal<readonly RequisitionFieldError[]>([]);

  private base: RequisitionBase | null = null;
  private lines: readonly RequisitionLine[] = [];
  private queue: number[] = [];
  private readonly decisions = new Map<number, RequisitionDuplicateDecision>();

  constructor(
    private readonly diagnostics: DiagnosticsClient,
    private readonly onCreated: () => void,
  ) {}

  busy(): boolean {
    return this.checking() || this.sending();
  }

  /** Pregunta por duplicados de cada renglón y, resuelto, manda la requisición. */
  start(base: RequisitionBase, lines: readonly RequisitionLine[]): void {
    if (this.busy() || lines.length === 0) return;
    this.base = base;
    this.lines = lines;
    this.decisions.clear();
    this.fieldErrors.set([]);
    this.error.set(loading());
    this.checking.set(true);
    forkJoin(
      lines.map((l) =>
        this.diagnostics.checkDuplicateStudy({
          patientProfileId: base.patientProfileId,
          encounterId: base.encounterId,
          codeConceptId: l.item.codeConceptId,
          ...l.duplicateKey,
        }),
      ),
    ).subscribe({
      next: (results) => {
        this.checking.set(false);
        this.error.set(ready(null));
        this.queue = results.flatMap((r, i) => (r.isDuplicate ? [i] : []));
        this.checks = results;
        this.next();
      },
      // Si la PREGUNTA falla no se manda nada: fail closed.
      error: (error: unknown) => {
        this.checking.set(false);
        this.error.set(errorToViewState<null>(error));
      },
    });
  }

  private checks: readonly DuplicateStudyCheckResult[] = [];

  private next(): void {
    const index = this.queue.shift();
    if (index === undefined) {
      this.duplicate.set(null);
      this.submit();
      return;
    }
    this.duplicate.set({ index, check: this.checks[index]! });
  }

  confirmReuse(): void {
    const current = this.duplicate();
    const reportId = current?.check.previousStudy?.reportId;
    if (current === null || reportId == null) return;
    this.decisions.set(current.index, { previousDiagnosticReportId: reportId, reusePreviousReport: true });
    this.next();
  }

  confirmRepeat(duplicateOverrideReason: string): void {
    const current = this.duplicate();
    const previous = current?.check.previousStudy;
    if (current === null || previous === undefined) return;
    // Repetir sobre una orden activa sin informe: no hay informe que enlazar.
    this.decisions.set(current.index, {
      ...(previous.reportId == null ? {} : { previousDiagnosticReportId: previous.reportId }),
      duplicateOverrideReason,
    } as RequisitionDuplicateDecision);
    this.next();
  }

  /** Se cerró el diálogo sin decidir: no se pide nada. */
  cancel(): void {
    this.duplicate.set(null);
    this.queue = [];
  }

  private submit(): void {
    const base = this.base;
    if (base === null || this.sending()) return;
    this.sending.set(true);
    this.error.set(loading());
    const items = this.lines.map((l, i) => {
      const decision = this.decisions.get(i);
      return decision === undefined ? l.item : { ...l.item, duplicateDecision: decision };
    });
    this.diagnostics.createRequisition({ ...base, items }).subscribe({
      next: () => {
        this.sending.set(false);
        this.error.set(ready(null));
        this.onCreated();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.fail(error);
      },
    });
  }

  /** La carrera chequeo→alta reabre el diálogo; un 422 de regla va a su renglón. */
  private fail(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      const body = readApiError(error);
      if (body?.code === 'PRECONDITION_FAILED') {
        const details = body.details as Record<string, unknown> | undefined;
        const index = typeof details?.['itemIndex'] === 'number' ? details['itemIndex'] : null;
        const previousStudy = previousStudyFromErrorDetails(details);
        if (details?.['reason'] === 'DUPLICATE_STUDY_DETECTED' && index !== null && previousStudy !== null) {
          this.error.set(ready(null));
          this.checks = Object.assign([...this.checks], {
            [index]: {
              isDuplicate: true,
              previousStudy,
              requiresJustification: true,
              pendingReport: false,
              windowDays: DEFAULT_DUPLICATE_STUDY_WINDOW_DAYS,
            },
          });
          this.queue = [index];
          this.next();
          return;
        }
        if (details?.['reason'] !== undefined) {
          const mapped = requisitionFieldError(details, body.message, this.lines.map((l) => l.label));
          this.fieldErrors.set([mapped]);
          this.error.set(ready(null));
          return;
        }
      }
    }
    this.error.set(errorToViewState<null>(error));
  }

  reset(): void {
    this.decisions.clear();
    this.fieldErrors.set([]);
    this.error.set(ready(null));
    this.duplicate.set(null);
  }
}
