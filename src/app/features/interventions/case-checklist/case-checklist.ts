import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import { CHECKLIST_PHASES, currentPhase, PHASE_LABELS, type ChecklistPhaseCode } from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { ChecklistResponseStatus, SafetyChecklist } from '../../../core/data-access/procedures/procedures.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready, dataOf } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Stepper } from '../../../shared/components/molecules/stepper/stepper';
import type { StepperStep } from '../../../shared/components/molecules/stepper/stepper.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { dateTimeOf } from '../interventions.presentation';

const ANSWERS: readonly SegmentedOption<ChecklistResponseStatus>[] = [
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'NOT_APPLICABLE', label: 'No aplica' },
  { value: 'EXCEPTION', label: 'Excepción', description: 'Excepción: exige escribir el motivo' },
];

const ANSWER_LABELS: Readonly<Record<ChecklistResponseStatus, string>> = { CONFIRMED: 'Confirmado', NOT_APPLICABLE: 'No aplica', EXCEPTION: 'Excepción' };

/** Una respuesta en borrador: estado y motivo. */
interface Draft {
  readonly status: ChecklistResponseStatus | null;
  readonly reason: string;
}

/**
 * **Check-list de cirugía segura de la OMS** — tres fases con `Stepper`.
 *
 * Entrada (7 ítems), Pausa (7) y Salida (5), en orden: la fase siguiente queda
 * bloqueada hasta completar la anterior y una excepción exige motivo. La
 * pantalla lo explica y lo pide antes de enviar; quien decide es la API
 * (`CHECKLIST_PHASE_OUT_OF_ORDER`, `CHECKLIST_EXCEPTION_REASON_REQUIRED`), y
 * su rechazo se muestra tal cual (S4 con el código de la petición).
 *
 * Las respuestas son inmutables: una fase completa se muestra en lectura.
 */
@Component({
  selector: 'app-case-checklist',
  imports: [Alert, AppButton, EmptyState, SegmentedControl, Stepper, Textarea, ViewStateHost],
  templateUrl: './case-checklist.html',
  styleUrl: './case-checklist.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseChecklist {
  private readonly procedures = inject(ProceduresClient);
  private readonly session = inject(SessionStore);

  readonly caseId = input.required<string>();
  /** El check-list del caso, si ya se creó. */
  readonly checklistId = input<string | null>(null);
  /** Si el rol registra en sala (reflejo de la API, no autorización). */
  readonly canRecord = input(false);
  /** Se emite al crear el check-list o completar una fase: la ficha se relee. */
  readonly changed = output<void>();

  protected readonly answers = ANSWERS;
  protected readonly answerLabels = ANSWER_LABELS;
  protected readonly phaseLabels = PHASE_LABELS;
  protected readonly dateTimeOf = dateTimeOf;

  protected readonly state = signal<ViewState<SafetyChecklist>>(loading());
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly sending = signal(false);
  protected readonly drafts = signal<Readonly<Record<string, Draft>>>({});
  protected readonly selectedPhase = signal<ChecklistPhaseCode | null>(null);

  private readonly checklist = computed(() => dataOf(this.state()));

  private readonly completed = computed<Record<ChecklistPhaseCode, boolean>>(() => {
    const k = this.checklist();
    const done = (p: ChecklistPhaseCode) => k?.phases.find((x) => x.phase === p)?.completedAt != null;
    return { SIGN_IN: done('SIGN_IN'), TIME_OUT: done('TIME_OUT'), SIGN_OUT: done('SIGN_OUT') };
  });

  protected readonly current = computed(() => currentPhase(this.completed()));

  /** La fase que se mira: la elegida en el stepper o la vigente. */
  protected readonly shownPhase = computed(() => {
    const k = this.checklist();
    const code = this.selectedPhase() ?? this.current() ?? 'SIGN_OUT';
    return k?.phases.find((p) => p.phase === code) ?? null;
  });

  protected readonly steps = computed<readonly StepperStep[]>(() =>
    CHECKLIST_PHASES.map((phase) => {
      const done = this.completed()[phase];
      const isCurrent = this.current() === phase;
      const previous = CHECKLIST_PHASES[CHECKLIST_PHASES.indexOf(phase) - 1];
      const locked = !done && !isCurrent;
      return {
        label: PHASE_LABELS[phase],
        status: done ? 'complete' : isCurrent ? 'current' : 'upcoming',
        ...(locked && previous !== undefined ? { disabled: true, disabledReason: `Se habilita al completar «${PHASE_LABELS[previous]}».` } : {}),
      };
    }),
  );

  /** ¿Se puede responder la fase que se está mirando? */
  protected readonly editable = computed(() => {
    const shown = this.shownPhase();
    return this.canRecord() && shown !== null && shown.completedAt === null && shown.phase === this.current();
  });

  protected readonly missing = computed(() => {
    const shown = this.shownPhase();
    if (shown === null) return 0;
    const d = this.drafts();
    return shown.items.filter((i) => i.mandatory && (d[i.id]?.status ?? null) === null).length;
  });

  protected readonly missingReason = computed(() => {
    const shown = this.shownPhase();
    const d = this.drafts();
    return shown?.items.some((i) => d[i.id]?.status === 'EXCEPTION' && !d[i.id]?.reason.trim()) ?? false;
  });

  constructor() {
    effect(() => {
      const caseId = this.caseId();
      const id = this.checklistId();
      untracked(() => this.load(caseId, id));
    });
  }

  protected selectStep(index: number): void {
    const phase = CHECKLIST_PHASES[index];
    if (phase === undefined || this.steps()[index]?.disabled) return;
    this.selectedPhase.set(phase);
  }

  protected draftOf(itemId: string): Draft {
    return this.drafts()[itemId] ?? { status: null, reason: '' };
  }

  protected setStatus(itemId: string, status: ChecklistResponseStatus): void {
    this.drafts.update((d) => ({ ...d, [itemId]: { ...this.draftOf(itemId), status } }));
  }

  protected setReason(itemId: string, reason: string): void {
    this.drafts.update((d) => ({ ...d, [itemId]: { ...this.draftOf(itemId), reason } }));
  }

  protected confirmAll(): void {
    const shown = this.shownPhase();
    if (shown === null) return;
    this.drafts.update((d) => ({ ...d, ...Object.fromEntries(shown.items.map((i) => [i.id, { status: 'CONFIRMED' as const, reason: '' }])) }));
  }

  protected create(): void {
    if (this.sending()) return;
    this.sending.set(true);
    this.failure.set(null);
    this.procedures.createChecklist(this.caseId()).subscribe({
      next: (k) => {
        this.sending.set(false);
        this.state.set(ready(k));
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  protected submit(): void {
    const k = this.checklist();
    const shown = this.shownPhase();
    const profile = this.session.practitionerProfileId();
    if (k === null || shown === null || profile === null || this.sending()) return;
    const d = this.drafts();
    this.sending.set(true);
    this.failure.set(null);
    this.procedures
      .submitChecklistPhase(this.caseId(), k.id, {
        phase: shown.phase,
        respondedByProfileId: profile,
        responses: shown.items
          .filter((i) => d[i.id]?.status != null)
          .map((i) => {
            const draft = d[i.id]!;
            return { itemId: i.id, status: draft.status!, ...(draft.status === 'EXCEPTION' ? { exceptionReason: draft.reason.trim() } : {}) };
          }),
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.selectedPhase.set(null);
          this.load(this.caseId(), k.id);
          this.changed.emit();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.failure.set(errorToViewState<never>(error));
        },
      });
  }

  protected hasProfile(): boolean {
    return this.session.practitionerProfileId() !== null;
  }

  private load(caseId: string, checklistId: string | null): void {
    if (checklistId === null) {
      this.state.set(
        empty(
          { label: this.canRecord() ? 'Iniciar el check-list' : 'Volver al resumen' },
          'Esta intervención todavía no tiene check-list de cirugía segura.',
        ),
      );
      return;
    }
    this.state.set(loading());
    this.procedures.getChecklist(caseId, checklistId).subscribe({
      next: (k) => this.state.set(ready(k)),
      error: (error: unknown) => this.state.set(errorToViewState<SafetyChecklist>(error)),
    });
  }
}
