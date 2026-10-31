import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import {
  REQUIRED_PHASE,
  ROOM_EVENT_LABELS,
  TURNOVER_EVENT_LABELS,
  ROOM_EVENT_ORDER,
  roomEventBlockedReason,
  type ChecklistPhaseCode,
  type RoomEventCode,
} from '../../../core/data-access/operating-rooms/operating-rooms.rules';
import { OperatingRoomsClient } from '../../../core/data-access/operating-rooms/operating-rooms.client';
import type { TurnoverStep } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { CaseChecklistSummary, RoomEvent, SurgicalCaseDetail } from '../../../core/data-access/procedures/procedures.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { durationOf, timeOf } from '../interventions.presentation';

/** Un botón de la botonera, con el porqué de su estado. */
interface EventButton {
  readonly code: RoomEventCode;
  readonly label: string;
  readonly blockedReason: string | null;
  readonly gate: string | null;
}

/**
 * **Tiempos de sala** — botonera en orden y línea de tiempo.
 *
 * Entrada a sala → inicio de anestesia → incisión → cierre → salida de sala,
 * en ese orden y con los gates OMS (§F4.3). Un botón deshabilitado dice por
 * qué; la API vuelve a decidir y su 422 (`CHECKLIST_*_REQUIRED`,
 * `ROOM_EVENT_OUT_OF_ORDER`) se muestra tal cual. La hora es la del registro:
 * la API rechaza una hora futura.
 */
@Component({
  selector: 'app-case-room-events',
  imports: [Alert, AppButton, ViewStateHost],
  templateUrl: './case-room-events.html',
  styleUrl: './case-room-events.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseRoomEvents {
  private readonly procedures = inject(ProceduresClient);
  private readonly operatingRooms = inject(OperatingRoomsClient);

  readonly caseId = input.required<string>();
  readonly events = input.required<readonly RoomEvent[]>();
  readonly checklist = input<CaseChecklistSummary | null>(null);
  readonly canRecord = input(false);
  /** La orden de recambio que abrió la salida de sala (F2), si ya la hay. */
  readonly turnover = input<SurgicalCaseDetail['turnoverCleaning']>(null);
  readonly changed = output<void>();

  protected readonly timeOf = timeOf;
  protected readonly sending = signal<RoomEventCode | null>(null);
  protected readonly failure = signal<ViewState<never> | null>(null);

  private readonly completed = computed<Record<ChecklistPhaseCode, boolean>>(() => {
    const k = this.checklist();
    return { SIGN_IN: k?.signIn != null, TIME_OUT: k?.timeOut != null, SIGN_OUT: k?.signOut != null };
  });

  protected readonly buttons = computed<readonly EventButton[]>(() => {
    const recorded = this.events().map((e) => e.eventCode);
    return ROOM_EVENT_ORDER.map((code) => {
      const phase = REQUIRED_PHASE[code];
      return {
        code,
        label: ROOM_EVENT_LABELS[code],
        blockedReason: roomEventBlockedReason(code, recorded, this.completed()),
        gate: phase === undefined ? null : phase,
      };
    });
  });

  protected readonly timeline = computed(() => {
    const list = [...this.events()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return list.map((e, i) => ({
      ...e,
      label: ROOM_EVENT_LABELS[e.eventCode as RoomEventCode] ?? TURNOVER_EVENT_LABELS[e.eventCode] ?? e.eventCode,
      sincePrevious: i === 0 ? null : durationOf(Math.round((Date.parse(e.occurredAt) - Date.parse(list[i - 1]!.occurredAt)) / 60_000)),
    }));
  });

  /** El próximo paso del recambio y su rótulo, o `null` si la sala ya está lista. */
  protected readonly turnoverNext = computed<{ readonly step: TurnoverStep; readonly label: string } | null>(() => {
    const status = this.turnover()?.status;
    if (status === 'CLN_PENDING') return { step: 'start', label: 'Iniciar limpieza' };
    if (status === 'CLN_IN_PROGRESS') return { step: 'finish', label: 'Terminar limpieza' };
    if (status === 'CLN_DONE') return { step: 'inspect', label: 'Inspeccionar: sala lista' };
    return null;
  });

  protected readonly turnoverLabel = computed(() => {
    const labels: Readonly<Record<string, string>> = { CLN_PENDING: 'Sucia: espera limpieza', CLN_IN_PROGRESS: 'En limpieza', CLN_DONE: 'Limpia: espera inspección', CLN_INSPECTED: 'Lista para el próximo caso' };
    const status = this.turnover()?.status;
    return status === undefined ? '' : (labels[status] ?? status);
  });

  protected advanceTurnover(): void {
    const t = this.turnover();
    const next = this.turnoverNext();
    if (t === null || next === null || this.sending() !== null) return;
    this.sending.set('PATIENT_OUT_OF_ROOM');
    this.failure.set(null);
    this.operatingRooms.turnoverStep(t.id, next.step, t.rowVersion).subscribe({
      next: () => {
        this.sending.set(null);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.sending.set(null);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  protected record(code: RoomEventCode): void {
    if (this.sending() !== null) return;
    this.sending.set(code);
    this.failure.set(null);
    this.procedures.recordRoomEvent(this.caseId(), code, new Date().toISOString()).subscribe({
      next: () => {
        this.sending.set(null);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.sending.set(null);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }
}
