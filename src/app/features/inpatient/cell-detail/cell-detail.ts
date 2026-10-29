import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { type Observable } from 'rxjs';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState, readOpsError } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import {
  AVAILABILITY_LABEL,
  BLOCK_KIND_LABEL,
  CLEANING_PRIORITY_LABEL,
  CLEANING_STATUS_LABEL,
  CLEANING_TRIGGER_LABEL,
  CLEANING_TYPE_LABEL,
  HYGIENE_LABEL,
  isHygieneOnly,
  ISOLATION_LABEL,
  isOverdue,
  minutesSince,
  OCCUPANCY_LABEL,
  offerCellActions,
  reasonLabel,
  shortDateTime,
  type CellActionCode,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  BlockReason,
  CareSpaceBlock,
  OperationalState,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { BedStatusBadge, lookOfHygiene, lookOfV2 } from '../../../shared/components/molecules/bed-tile/bed-status';
import { OpsIssueAlert } from '../ops-issue-alert/ops-issue-alert';
import { BlockDialog, type BlockMode } from '../block-dialog/block-dialog';
import { IsolationDialog } from '../isolation-dialog/isolation-dialog';
import { StatusHistory } from '../status-history/status-history';

type Dialog = { readonly kind: 'block'; readonly mode: BlockMode } | { readonly kind: 'isolation' };

/**
 * **El estado operativo de una cama o local** y lo que se puede hacer con él:
 * los ejes (disponibilidad, higiene, aislamiento y la ocupación derivada), los
 * bloqueos vigentes con su motivo y «hasta», la orden de limpieza abierta, las
 * acciones y el historial de estados.
 *
 * Lo comparten el panel lateral del tablero y la pestaña «Operación» de la
 * ficha del espacio. Para la ficha de **internación** (F3) deja un hueco
 * `[adtActions]` junto a las acciones: ahí se proyectan ingresar, trasladar y
 * dar de alta; esta franja no pone nada.
 *
 * ## Quién puede qué
 *
 * Las acciones que se ofrecen salen de `viewer.actions` (lo que el servidor dice
 * que quien mira puede hacer) y del estado de la cama; **solo reflejan**. Cada
 * mutación la decide la API: un 403 se muestra como S5, un 412
 * (`OPS_VERSION_MISMATCH`) vuelve a leer el estado y avisa, un rechazo de
 * negocio (S4) queda a la vista junto a las acciones.
 *
 * Limpieza (`HOUSEKEEPING*`) ve solo el eje de higiene: sin bloqueos, sin
 * aislamiento, sin ocupación, sin paciente.
 */
@Component({
  selector: 'app-cell-detail',
  imports: [Alert, AppButton, Badge, BedStatusBadge, BlockDialog, OpsIssueAlert, IsolationDialog, RouterLink, StatusHistory],
  templateUrl: './cell-detail.html',
  styleUrl: './cell-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellDetail {
  readonly state = input.required<OperationalState>();
  readonly reasons = input<readonly BlockReason[]>([]);
  readonly now = input<Date>(new Date());
  /** En la ficha el historial va abierto; en el panel del tablero, plegado. */
  readonly historyOpen = input(false);

  /** El estado nuevo, ya releído de la API tras una mutación. */
  readonly stateChange = output<OperationalState>();
  /** Algo cambió: el tablero debe volver a pedirse. */
  readonly changed = output<void>();

  private readonly client = inject(InfrastructureOpsClient);
  private readonly dialogs = inject(DialogService);

  protected readonly dialog = signal<Dialog | null>(null);
  protected readonly pending = signal(false);
  protected readonly actionError = signal<ViewState<unknown> | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly historyVersion = signal(0);

  protected readonly cell = computed(() => this.state());
  protected readonly viewer = computed(() => this.state().viewer);
  protected readonly hygieneOnly = computed(() => isHygieneOnly(this.viewer()));
  protected readonly offers = computed(() => offerCellActions(this.cell(), this.viewer()));
  protected readonly canSeeHistory = computed(() => this.viewer()?.actions.includes('see-history') === true);

  protected readonly look = computed(() =>
    this.hygieneOnly()
      ? lookOfHygiene(this.cell().hygiene.code, this.cell().hygiene.code === 'HYG_CLEAN')
      : lookOfV2(this.cell().v2Code),
  );
  protected readonly pathText = computed(() => this.cell().path.map((p) => p.name).join(' › '));
  protected readonly blocks = computed(() => (this.hygieneOnly() ? [] : this.state().openBlocks));
  protected readonly order = computed(() => this.state().openCleaningOrder);

  /** Por qué la cama no se puede asignar ahora, en una frase. `null` si se puede. */
  protected readonly notAssignable = computed<string | null>(() => {
    const c = this.cell();
    if (c.assignable) return null;
    if (c.lifecycle.code !== 'SPACE_ACTIVE') return `El espacio está ${c.lifecycle.display.toLowerCase()}.`;
    if (c.availability.code !== 'SPACE_OP_AVAILABLE') return `${AVAILABILITY_LABEL[c.availability.code]}.`;
    if (c.occupancy.code !== 'OCC_FREE') return `${OCCUPANCY_LABEL[c.occupancy.code]}.`;
    if (c.hygiene.terminalRequired) return 'Exige limpieza terminal e inspección de supervisión.';
    if (c.hygiene.code === 'HYG_CLEAN') return 'Limpia, falta la inspección.';
    return `Higiene: ${HYGIENE_LABEL[c.hygiene.code].toLowerCase()}.`;
  });

  protected readonly availabilityLabel = AVAILABILITY_LABEL;
  protected readonly hygieneLabel = HYGIENE_LABEL;
  protected readonly isolationLabel = ISOLATION_LABEL;
  protected readonly occupancyLabel = OCCUPANCY_LABEL;
  protected readonly blockKindLabel = BLOCK_KIND_LABEL;
  protected readonly typeLabel = CLEANING_TYPE_LABEL;
  protected readonly statusLabel = CLEANING_STATUS_LABEL;
  protected readonly priorityLabel = CLEANING_PRIORITY_LABEL;
  protected readonly triggerLabel = CLEANING_TRIGGER_LABEL;
  protected readonly shortDateTime = shortDateTime;
  protected readonly minutesSince = minutesSince;
  protected readonly overdue = (block: CareSpaceBlock): boolean => isOverdue(block.expectedEndAt, this.now());
  protected readonly reasonText = (code: string | null): string => reasonLabel(code, this.reasons());
  /** «Mantenimiento · Mantenimiento preventivo» repite: si el motivo ya nombra el tipo, el tipo va solo. */
  protected readonly showReason = (b: CareSpaceBlock): boolean =>
    !this.reasonText(b.reasonCode).toLowerCase().includes(BLOCK_KIND_LABEL[b.kind].toLowerCase());

  protected act(code: CellActionCode): void {
    this.actionError.set(null);
    this.notice.set(null);
    switch (code) {
      case 'block-clinical':
        this.dialog.set({ kind: 'block', mode: 'clinical' });
        break;
      case 'block-admin':
        this.dialog.set({ kind: 'block', mode: 'administrative' });
        break;
      case 'start-maintenance':
        this.dialog.set({ kind: 'block', mode: 'maintenance' });
        break;
      case 'close':
        this.dialog.set({ kind: 'block', mode: 'closure' });
        break;
      case 'isolate':
        this.dialog.set({ kind: 'isolation' });
        break;
      case 'unblock':
      case 'reopen':
        void this.release(code);
        break;
      case 'end-maintenance':
        void this.endMaintenance();
        break;
      case 'mark-dirty':
      case 'mark-contaminated':
        void this.markHygiene(code);
        break;
      case 'lift-isolation':
        void this.liftIsolation();
        break;
    }
  }

  protected afterDialog(message: string): void {
    this.dialog.set(null);
    this.notice.set(message);
    this.refresh();
  }

  private openBlock(): CareSpaceBlock | undefined {
    return this.state().openBlocks[0];
  }

  private async release(code: 'unblock' | 'reopen'): Promise<void> {
    const c = this.cell();
    const block = this.openBlock();
    const ok = await this.dialogs.confirm({
      title: `${code === 'unblock' ? 'Desbloquear' : 'Reabrir'} ${c.code}`,
      message:
        code === 'unblock'
          ? 'La cama vuelve a estar disponible. El bloqueo queda cerrado en el historial con su hora y quién lo levantó.'
          : 'El espacio vuelve a estar disponible. El cierre queda cerrado en el historial.',
      confirmLabel: code === 'unblock' ? 'Desbloquear' : 'Reabrir',
    });
    if (!ok) return;
    this.run(
      this.client.changeAvailability(c.id, c.opsVersion, {
        action: code,
        kindCode: block?.kind ?? (code === 'reopen' ? 'BLOCK_CLOSURE' : 'BLOCK_CLINICAL'),
        reasonCode: block?.reasonCode ?? c.availability.reasonCode ?? '',
      }),
      `${c.code} volvió a estar disponible.`,
    );
  }

  private async endMaintenance(): Promise<void> {
    const c = this.cell();
    const block = this.state().openBlocks.find((b) => b.kind === 'BLOCK_MAINTENANCE') ?? this.openBlock();
    if (block === undefined) return;
    const note = await this.dialogs.confirmWithReason(
      {
        title: `Terminar el mantenimiento de ${c.code}`,
        message: 'Al terminar, la cama pasa a sucia y se crea una orden de limpieza: no vuelve a uso sin limpiarse e inspeccionarse.',
        confirmLabel: 'Terminar mantenimiento',
      },
      { label: 'Qué se hizo', hint: 'Queda en el historial del bloqueo.' },
    );
    if (note === null) return;
    this.run(this.client.endBlock(block.id, note), `Mantenimiento terminado: ${c.code} quedó sucia, con orden de limpieza.`);
  }

  private async markHygiene(code: 'mark-dirty' | 'mark-contaminated'): Promise<void> {
    const c = this.cell();
    const dirty = code === 'mark-dirty';
    const reason = await this.dialogs.confirmWithReason(
      {
        title: `${dirty ? 'Marcar sucia' : 'Marcar contaminada'} · ${c.code}`,
        message: dirty
          ? 'Se crea una orden de limpieza y la cama deja de poder asignarse hasta que se limpie e inspeccione.'
          : 'Exige limpieza terminal e inspección de supervisión. Si ya había una orden abierta, pasa a terminal.',
        confirmLabel: dirty ? 'Marcar sucia' : 'Marcar contaminada',
        destructive: !dirty,
      },
      { label: 'Qué pasó', hint: 'Queda en el historial.' },
    );
    if (reason === null) return;
    this.run(
      this.client.changeHygiene(c.id, c.opsVersion, { action: code, reasonText: reason }),
      dirty ? `${c.code} quedó sucia, con orden de limpieza.` : `${c.code} quedó contaminada: exige limpieza terminal.`,
    );
  }

  private async liftIsolation(): Promise<void> {
    const c = this.cell();
    const reason = await this.dialogs.confirmWithReason(
      {
        title: `Levantar el aislamiento de ${c.code}`,
        message: 'La cama exige limpieza terminal e inspección de supervisión antes de volver a asignarse; las camas hermanas bloqueadas por cohorte se liberan.',
        confirmLabel: 'Levantar aislamiento',
      },
      { label: 'Motivo', hint: 'Queda en el historial.' },
    );
    if (reason === null) return;
    this.run(
      this.client.changeIsolation(c.id, c.opsVersion, { isolationCode: 'ISO_NONE', reasonText: reason }),
      `Aislamiento levantado: ${c.code} exige limpieza terminal.`,
    );
  }

  private run(call: Observable<unknown>, message: string): void {
    this.pending.set(true);
    call.subscribe({
      next: () => {
        this.pending.set(false);
        this.notice.set(message);
        this.refresh();
      },
      error: (error: unknown) => {
        this.pending.set(false);
        this.actionError.set(opsErrorToViewState<unknown>(error));
        // Otra persona movió la cama: se muestra lo vigente, no lo que se creía.
        if (readOpsError(error)?.reason === 'OPS_VERSION_MISMATCH') this.refresh();
      },
    });
  }

  private refresh(): void {
    this.client.getOperationalState(this.cell().id).subscribe({
      next: (fresh) => {
        this.stateChange.emit(fresh);
        this.changed.emit();
        this.historyVersion.update((v) => v + 1);
      },
      error: (error: unknown) => this.actionError.set(opsErrorToViewState<unknown>(error)),
    });
  }
}
