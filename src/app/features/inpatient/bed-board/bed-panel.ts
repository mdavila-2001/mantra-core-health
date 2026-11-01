import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, startWith, switchMap, type Observable } from 'rxjs';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { BlockKindCode, CareSpaceStatusEvent, OperationalState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { opsLabel, V2_LABEL } from '../../../core/data-access/infrastructure-ops/ops-labels';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../shared/components/molecules/fact-list/fact-list.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { DEFAULT_TIME_ZONE, patientLong, relativeAge, shortDateTime } from '../inpatient-presentation';
import { BlockDialog } from './block-dialog';
import { IsolationDialog } from './isolation-dialog';

interface PanelLoad {
  readonly id: string;
  readonly state: ViewState<OperationalState>;
  readonly history: ViewState<readonly CareSpaceStatusEvent[]>;
}

/**
 * **Panel de una cama** (F2.4): estado por eje, bloqueos, orden de limpieza
 * abierta, historial A20 y las acciones operativas. Deja un hueco
 * `[adtActions]` que llena F3.
 *
 * ## Una cama a la vez (H1)
 *
 * Al cambiar de cama, el pedido de la anterior se **cancela** (`switchMap`) y
 * las acciones quedan deshabilitadas hasta que el estado leído sea el de la
 * cama elegida (`state.id === cellId()`): nunca se bloquea o se marca sucia la
 * cama anterior con el `opsVersion` de otra.
 *
 * Toda acción relee el estado y avisa al tablero (`changed`): lo que se ve
 * después es lo que respondió la API. Qué botón se ofrece sale de dos cosas:
 * la acción que la API le da a la persona sobre esta cama (`actions`) y el
 * estado de la cama (no se desbloquea una cama disponible).
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
  readonly timeZone = input(DEFAULT_TIME_ZONE);
  readonly changed = output<void>();

  private readonly reloads = signal(0);
  private readonly loaded = signal<PanelLoad | null>(null);
  protected readonly failure = signal<ViewState<never> | null>(null);
  protected readonly dialog = signal<{ kind: 'block'; block: BlockKindCode } | { kind: 'isolation' } | null>(null);
  protected readonly working = signal(false);
  protected readonly v2Label = V2_LABEL;
  protected readonly label = opsLabel;
  protected readonly ago = relativeAge;
  protected readonly when = (iso: string | null) => shortDateTime(iso, this.timeZone());

  /** Lo cargado vale sólo si es de la cama elegida. */
  private readonly current = computed(() => {
    const l = this.loaded();
    return l !== null && l.id === this.cellId() ? l : null;
  });
  protected readonly state = computed<ViewState<OperationalState>>(() => this.current()?.state ?? loading());
  protected readonly history = computed<ViewState<readonly CareSpaceStatusEvent[]>>(() => this.current()?.history ?? loading());
  protected readonly cell = computed<OperationalState | null>(() => {
    const s = this.state();
    return s.status === 'ready' && s.data.id === this.cellId() ? s.data : null;
  });
  /** H1: sin el estado de **esta** cama no hay acciones. */
  protected readonly actionable = computed(() => this.cell() !== null && !this.working());
  protected readonly can = (a: string) => (this.cell()?.actions as readonly string[] | undefined)?.includes(a) ?? false;
  protected readonly operates = computed(() =>
    ['f2.availability.clinical', 'f2.availability.admin', 'f2.availability.maintenance', 'f2.hygiene.mark-dirty', 'f2.hygiene.mark-contaminated', 'f2.isolation.set'].some((a) => this.can(a)),
  );
  /** Marcar sucia sólo tiene sentido sobre una cama limpia y sin orden abierta. */
  protected readonly canMarkDirty = computed(() => {
    const c = this.cell();
    return c !== null && this.can('f2.hygiene.mark-dirty') && c.openCleaningOrder === null && (c.hygiene.code === 'HYG_CLEAN' || c.hygiene.code === 'HYG_INSPECTED');
  });

  protected readonly facts = computed<readonly Hecho[]>(() => {
    const c = this.cell();
    if (c === null) return [];
    const motivo = c.openBlocks.find((b) => b.reasonText)?.reasonText ?? (c.availability.reasonCode === null ? null : opsLabel(c.availability.reasonCode));
    return [
      { etiqueta: 'Resumen (HL7 v2-0116)', valor: `${c.v2Code} · ${V2_LABEL[c.v2Code]}` },
      { etiqueta: 'Ubicación', valor: [...c.path.map((x) => x.name), c.name].join(' › ') },
      { etiqueta: 'Ciclo de vida', valor: opsLabel(c.lifecycle), tono: c.lifecycle === 'ACTIVE' ? 'ok' : 'aviso' },
      { etiqueta: 'Disponibilidad', valor: opsLabel(c.availability.code), tono: c.availability.code === 'SPACE_OP_AVAILABLE' ? 'ok' : 'aviso' },
      { etiqueta: 'Motivo', valor: c.availability.code === 'SPACE_OP_AVAILABLE' ? null : motivo },
      { etiqueta: 'Hasta', valor: this.when(c.availability.expectedUntil) },
      { etiqueta: 'Higiene', valor: `${opsLabel(c.hygiene.code)}${c.hygiene.terminalRequired ? ' · limpieza terminal pendiente' : ''}`, tono: c.hygiene.code === 'HYG_INSPECTED' ? 'ok' : 'aviso' },
      { etiqueta: 'Aislamiento', valor: c.isolation.code === 'ISO_NONE' ? 'Sin aislamiento' : `${opsLabel(c.isolation.code)}${c.isolation.organism ? ` · ${c.isolation.organism}` : ''}` },
      { etiqueta: 'Ocupación', valor: `${opsLabel(c.occupancy.code)}${c.occupancy.since ? ` desde ${this.when(c.occupancy.since)}` : ''}` },
      { etiqueta: 'Paciente', valor: patientLong(c.occupancy.patient) },
      { etiqueta: 'Asignable', valor: c.assignable ? 'Sí' : 'No', tono: c.assignable ? 'ok' : 'neutro' },
      { etiqueta: 'Último cambio', valor: relativeAge(c.lastEventAt) },
    ];
  });

  protected readonly historyState = computed<ViewState<readonly CareSpaceStatusEvent[]>>(() => {
    const h = this.history();
    return h.status === 'ready' && h.data.length === 0 ? empty({ label: 'Cada cambio de eje aparece acá' }, 'Todavía no hay cambios registrados para esta cama.') : h;
  });
  protected readonly events = computed(() => {
    const h = this.history();
    return h.status === 'ready' ? h.data : [];
  });

  constructor() {
    toObservable(computed(() => ({ id: this.cellId(), n: this.reloads() })))
      .pipe(
        switchMap(({ id }) =>
          forkJoin({
            state: this.client.getOperationalState(id).pipe(
              map((s) => ready(s) as ViewState<OperationalState>),
              catchError((e: unknown) => of(errorToViewState<OperationalState>(e))),
            ),
            history: this.client.listStatusEvents(id).pipe(
              map((p) => ready(p.items) as ViewState<readonly CareSpaceStatusEvent[]>),
              catchError((e: unknown) => of(errorToViewState<readonly CareSpaceStatusEvent[]>(e))),
            ),
          }).pipe(
            map((r): PanelLoad => ({ id, ...r })),
            startWith<PanelLoad>({ id, state: loading(), history: loading() }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((r) => this.loaded.set(r));
  }

  protected reload(): void {
    this.failure.set(null);
    this.reloads.update((n) => n + 1);
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
    if (c === null) return;
    const id = c.id;
    const enMantenimiento = c.availability.code === 'SPACE_OP_MAINTENANCE';
    // El fin de mantenimiento termina **el bloqueo de mantenimiento**, no el primero que venga.
    const bloque = enMantenimiento ? c.openBlocks.find((b) => b.kindCode === 'BLOCK_MAINTENANCE') : undefined;
    const nota = await this.dialogs.confirmWithReason(
      { title: label, message: `La cama ${c.code} vuelve a estar disponible. Si era mantenimiento, queda sucia hasta que la limpien.`, confirmLabel: label },
      { label: 'Nota', hint: 'Queda en el historial.', minLength: 3, maxLength: 300 },
    );
    if (nota === null || this.cell()?.id !== id) return;
    const call: Observable<unknown> =
      bloque !== undefined
        ? this.client.endBlock(bloque.id, nota)
        : this.client.changeAvailability(c.id, c.opsVersion, { action: c.availability.code === 'SPACE_OP_CLOSED' ? 'reopen' : 'unblock', reasonText: nota });
    this.run(call);
  }

  protected async markHygiene(action: 'mark-dirty' | 'mark-contaminated'): Promise<void> {
    const c = this.cell();
    if (c === null) return;
    const id = c.id;
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
    if (reason === null || this.cell()?.id !== id) return;
    this.run(this.client.changeHygiene(c.id, c.opsVersion, { action, reasonText: reason }));
  }

  private run(call: Observable<unknown>): void {
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
}
