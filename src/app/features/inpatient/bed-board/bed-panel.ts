import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';

import { V2_LABEL } from '../../../core/data-access/infrastructure-ops/bed-status-v2';
import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type {
  BlockKindCode,
  CareSpaceStatusEvent,
  OperationalState,
} from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { relativeAge, shortDateTime } from '../inpatient-presentation';
import { BlockDialog } from './block-dialog';
import { IsolationDialog } from './isolation-dialog';

/**
 * **Panel de una cama** (F2.4): estado por eje, bloqueos, orden de limpieza
 * abierta, historial A20 y las acciones operativas que la API ofrece para esta
 * celda (`cell.actions`). Deja un hueco `[adtActions]` que llena F3.
 *
 * Toda acción relee el estado y avisa al tablero (`changed`): lo que se ve
 * después es lo que respondió la API.
 */
@Component({
  selector: 'app-bed-panel',
  imports: [AppButton, Badge, BlockDialog, FactList, IsolationDialog, ViewStateHost],
  templateUrl: './bed-panel.html',
  styleUrl: './bed-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BedPanel {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly dialogs = inject(DialogService);

  readonly cellId = input.required<string>();
  readonly changed = output<void>();

  protected readonly state = signal<ViewState<OperationalState>>(loading());
  protected readonly history = signal<ViewState<readonly CareSpaceStatusEvent[]>>(loading());
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly dialog = signal<{ kind: 'block'; block: BlockKindCode } | { kind: 'isolation' } | null>(null);
  protected readonly working = signal(false);
  protected readonly v2Label = V2_LABEL;
  protected readonly when = shortDateTime;
  protected readonly ago = relativeAge;

  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly cell = computed(() => this.data()?.cell ?? null);
  protected readonly can = (a: string) => (this.cell()?.actions as readonly string[] | undefined)?.includes(a) ?? false;

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const c = this.cell();
    if (c === null) return [];
    const p = c.occupancy.patient;
    return [
      { etiqueta: 'Resumen (HL7 v2-0116)', valor: `${c.v2Code} · ${V2_LABEL[c.v2Code]}` },
      { etiqueta: 'Ubicación', valor: c.path.map((x) => x.name).join(' › ') },
      { etiqueta: 'Ciclo de vida', valor: c.lifecycle.display, tono: c.lifecycle.code === 'SPACE_ACTIVE' ? 'ok' : 'aviso' },
      { etiqueta: 'Disponibilidad', valor: c.availability.display, tono: c.availability.code === 'SPACE_OP_AVAILABLE' ? 'ok' : 'aviso' },
      { etiqueta: 'Motivo', valor: c.availability.reasonText },
      { etiqueta: 'Hasta', valor: shortDateTime(c.availability.expectedUntil) },
      { etiqueta: 'Higiene', valor: `${c.hygiene.display}${c.hygiene.terminalRequired ? ' · limpieza terminal pendiente' : ''}`, tono: c.hygiene.code === 'HYG_INSPECTED' ? 'ok' : 'aviso' },
      { etiqueta: 'Aislamiento', valor: c.isolation.code === 'ISO_NONE' ? 'Sin aislamiento' : `${c.isolation.display}${c.isolation.organism ? ` · ${c.isolation.organism}` : ''}` },
      { etiqueta: 'Ocupación', valor: `${c.occupancy.display}${c.occupancy.since ? ` desde ${shortDateTime(c.occupancy.since)}` : ''}` },
      { etiqueta: 'Paciente', valor: p === undefined ? null : `${p.initials} · ${p.sexCode === 'MALE' ? 'masculino' : 'femenino'} · ${p.ageYears} años` },
      { etiqueta: 'Asignable', valor: c.assignable ? 'Sí' : 'No', tono: c.assignable ? 'ok' : 'neutro' },
      { etiqueta: 'Último cambio', valor: relativeAge(c.lastEventAt) },
    ];
  });

  protected readonly historyState = computed<ViewState<readonly CareSpaceStatusEvent[]>>(() => {
    const h = this.history();
    return h.status === 'ready' && h.data.length === 0 ? empty({ label: 'Cada cambio de eje aparece acá' }, 'Todavía no hay cambios registrados para esta cama.') : h;
  });

  constructor() {
    effect(() => {
      const id = this.cellId();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.cellId());
  }

  protected openBlock(block: BlockKindCode): void {
    this.failure.set(null);
    this.dialog.set({ kind: 'block', block });
  }

  protected openIsolation(): void {
    this.failure.set(null);
    this.dialog.set({ kind: 'isolation' });
  }

  protected afterDialog(): void {
    this.dialog.set(null);
    this.reload();
    this.changed.emit();
  }

  /** Desbloquear / reabrir / terminar mantenimiento, con nota. */
  protected async unblock(label: string): Promise<void> {
    const c = this.cell();
    const bloque = this.data()?.openBlocks[0];
    if (c === null) return;
    const nota = await this.dialogs.confirmWithReason(
      { title: label, message: `La cama ${c.code} vuelve a estar disponible. Si era mantenimiento, queda sucia hasta que la limpien.`, confirmLabel: label },
      { label: 'Nota', hint: 'Queda en el historial.', minLength: 3, maxLength: 300 },
    );
    if (nota === null) return;
    const call =
      c.availability.code === 'SPACE_OP_MAINTENANCE' && bloque !== undefined
        ? this.client.endBlock(bloque.id, nota)
        : this.client.changeAvailability(c.id, c.opsVersion, { action: c.availability.code === 'SPACE_OP_CLOSED' ? 'reopen' : 'unblock', reasonText: nota });
    this.run(call);
  }

  protected async markHygiene(action: 'mark-dirty' | 'mark-contaminated'): Promise<void> {
    const c = this.cell();
    if (c === null) return;
    const contaminada = action === 'mark-contaminated';
    const reason = await this.dialogs.confirmWithReason(
      {
        title: contaminada ? 'Marcar contaminada' : 'Marcar sucia',
        message: contaminada ? `La cama ${c.code} pasa a limpieza terminal: no se asigna hasta la inspección de supervisión.` : `Se crea una orden de limpieza para la cama ${c.code}.`,
        confirmLabel: contaminada ? 'Marcar contaminada' : 'Marcar sucia',
        destructive: contaminada,
      },
      { label: 'Motivo', hint: 'Lo ve el equipo de limpieza.', minLength: 3, maxLength: 300 },
    );
    if (reason === null) return;
    this.run(this.client.changeHygiene(c.id, c.opsVersion, { action, reasonText: reason }));
  }

  private run(call: ReturnType<InfrastructureOpsClient['endBlock']>): void {
    this.working.set(true);
    this.failure.set(null);
    call.subscribe({
      next: () => {
        this.working.set(false);
        this.reload();
        this.changed.emit();
      },
      error: (e: unknown) => {
        this.working.set(false);
        this.failure.set(errorToViewState<never>(e));
      },
    });
  }

  private load(id: string): void {
    this.state.set(loading());
    this.history.set(loading());
    forkJoin({
      state: this.client.getOperationalState(id).pipe(
        map((s) => ready(s) as ViewState<OperationalState>),
        catchError((e: unknown) => of(errorToViewState<OperationalState>(e))),
      ),
      history: this.client.listStatusEvents(id).pipe(
        map((p) => ready(p.items) as ViewState<readonly CareSpaceStatusEvent[]>),
        catchError((e: unknown) => of(errorToViewState<readonly CareSpaceStatusEvent[]>(e))),
      ),
    }).subscribe(({ state, history }) => {
      this.state.set(state);
      this.history.set(history);
    });
  }
}
