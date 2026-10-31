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
import type { TurnoverCleaning, TurnoverStep } from '../../../core/data-access/operating-rooms/operating-rooms.types';
import { ProceduresClient } from '../../../core/data-access/procedures/procedures.client';
import type { RoomEvent } from '../../../core/data-access/procedures/procedures.types';
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
 *
 * ## Lo que la API todavía no informa
 *
 * `events` **ausente** significa que el detalle no trae los tiempos (pedido a
 * A-F4): no se inventa una lista vacía ni se deriva de ella el orden. Se dice
 * en pantalla, sólo se atenúa lo registrado en esta vista, y la API decide el
 * orden (409/422). Las fases OMS sí se conocen (vienen del check-list leído).
 * Sin `turnover` informado, el recambio se avisa y se opera en la cola de
 * limpieza de F2: la orden exige `If-Match` y sin su versión no se manda.
 *
 * Quién registra lo decide la API (403 → S5 en el aviso); la botonera no se
 * esconde por rol.
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
  /** Los tiempos registrados; `undefined` = la API no los informa. */
  readonly events = input<readonly RoomEvent[] | undefined>(undefined);
  /** Qué fases del check-list están completas (leídas de la API). */
  readonly phases = input<Readonly<Record<ChecklistPhaseCode, boolean>>>({ SIGN_IN: false, TIME_OUT: false, SIGN_OUT: false });
  /** La orden de recambio (F2); `null` = no hay; `undefined` = la API no la informa. */
  readonly turnover = input<TurnoverCleaning | null | undefined>(undefined);
  readonly changed = output<void>();

  protected readonly timeOf = timeOf;
  protected readonly sending = signal<RoomEventCode | null>(null);
  protected readonly failure = signal<ViewState<never> | null>(null);

  /** Lo registrado desde esta vista (cuando la API no informa los tiempos). */
  private readonly recordedHere = signal<readonly RoomEvent[]>([]);
  /** La orden de recambio que informó la salida de sala en esta vista. */
  protected readonly openedOrderId = signal<string | null>(null);
  protected readonly eventsReported = computed(() => this.events() !== undefined);

  protected readonly buttons = computed<readonly EventButton[]>(() => {
    const known = this.events();
    const recorded = (known ?? this.recordedHere()).map((e) => e.eventCode);
    return ROOM_EVENT_ORDER.map((code) => {
      const phase = REQUIRED_PHASE[code];
      // Sin los tiempos de la API no se deriva el orden: sólo lo hecho aquí y las fases OMS.
      const blockedReason =
        known !== undefined
          ? roomEventBlockedReason(code, recorded, this.phases())
          : recorded.includes(code)
            ? 'Ya se registró desde esta pantalla.'
            : phase !== undefined && !this.phases()[phase]
              ? roomEventBlockedReason(code, ROOM_EVENT_ORDER.slice(0, ROOM_EVENT_ORDER.indexOf(code)), this.phases())
              : null;
      return { code, label: ROOM_EVENT_LABELS[code], blockedReason, gate: phase === undefined ? null : phase };
    });
  });

  protected readonly timeline = computed(() => {
    const list = [...(this.events() ?? this.recordedHere())].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    return list.map((e, i) => ({
      ...e,
      label: ROOM_EVENT_LABELS[e.eventCode as RoomEventCode] ?? TURNOVER_EVENT_LABELS[e.eventCode] ?? e.eventCode,
      sincePrevious: i === 0 ? null : durationOf(Math.round((Date.parse(e.occurredAt) - Date.parse(list[i - 1]!.occurredAt)) / 60_000)),
    }));
  });

  /** El próximo paso del recambio y su rótulo, o `null` si la sala ya está lista. */
  protected readonly turnoverNext = computed<{ readonly step: TurnoverStep; readonly label: string } | null>(() => {
    const status = this.turnover()?.statusCode;
    if (status === 'CLN_PENDING') return { step: 'start', label: 'Iniciar limpieza' };
    if (status === 'CLN_IN_PROGRESS') return { step: 'finish', label: 'Terminar limpieza' };
    if (status === 'CLN_DONE') return { step: 'inspect', label: 'Inspeccionar: sala lista' };
    return null;
  });

  /**
   * ¿La API dice que el actor puede dar el próximo paso? Sólo atenúa: con
   * `allowedTransitions` ausente se ofrece y decide la API (403 → S5).
   */
  protected readonly turnoverAllowed = computed(() => {
    const next = this.turnoverNext();
    const allowed = this.turnover()?.allowedTransitions;
    return next !== null && (allowed === undefined || allowed.includes(next.step));
  });

  protected readonly turnoverLabel = computed(() => {
    const labels: Readonly<Record<string, string>> = { CLN_PENDING: 'Sucia: espera limpieza', CLN_IN_PROGRESS: 'En limpieza', CLN_DONE: 'Limpia: espera inspección', CLN_INSPECTED: 'Lista para el próximo caso' };
    const status = this.turnover()?.statusCode;
    return status === undefined ? '' : (labels[status] ?? status);
  });

  protected advanceTurnover(): void {
    const t = this.turnover();
    const next = this.turnoverNext();
    if (t === null || t === undefined || next === null || this.sending() !== null) return;
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
    const occurredAt = new Date().toISOString();
    this.procedures.recordRoomEvent(this.caseId(), code, occurredAt).subscribe({
      next: (result) => {
        this.sending.set(null);
        this.recordedHere.update((list) => [...list, { id: result.utilizationEventId, eventCode: code, occurredAt, recordedByUserId: null }]);
        if (result.cleaningOrderId) this.openedOrderId.set(result.cleaningOrderId);
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.sending.set(null);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }
}
