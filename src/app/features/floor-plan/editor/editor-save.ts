import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import { readPlanFailure } from '../../../core/data-access/floor-plan/floor-plan.failure';
import type { LayoutItemError, LayoutResponse, LayoutWarning } from '../../../core/data-access/floor-plan/floor-plan.types';
import { clearDraft } from '../../../core/floor-plan/editor-draft';
import { diffPatch, fromViews, patchSize, reapply, type EditState } from '../../../core/floor-plan/editor-model';
import { diffRemote, type RemoteChange } from '../../../core/floor-plan/editor-remote';
import { toSpaceView } from '../../../core/floor-plan/plan-view';
import type { FloorPlanStore } from '../viewer/floor-plan.store';
import type { SaveFailure } from './editor-issues';

const PAGE = 500;

/** Lo que el guardado necesita del almacén del editor. */
export interface EditorSaveHost {
  readonly client: FloorPlanClient;
  readonly plan: FloorPlanStore;
  readonly planId: () => string | null;
  readonly version: () => number | null;
  readonly baseline: () => EditState;
  readonly current: () => EditState;
  readonly setVersion: (version: number) => void;
  /** Vuelve a empezar desde un estado (historial vacío, sin cambios). */
  readonly reset: (state: EditState) => void;
  /** Toma un plano nuevo como base y deja `state` como lo que se está editando (un paso de deshacer). */
  readonly adopt: (base: EditState, state: EditState) => void;
  readonly select: (id: string | null) => void;
}

/**
 * Guardar con `If-Match` y lo que pasa cuando el servidor dice que no
 * (CONTRATO-PLANO §3.4 y §5.3): 422 con un error por elemento, 412 con «Ver
 * cambios» y «Recargar y reaplicar», 403, sin conexión y error inesperado.
 */
export class EditorSaver {
  readonly saving = signal(false);
  readonly failure = signal<SaveFailure | null>(null);
  readonly serverErrors = signal<readonly LayoutItemError[]>([]);
  readonly lastSave = signal<{ version: number; requestId: string; warnings: readonly LayoutWarning[]; at: Date; counts: string } | null>(null);
  readonly remoteChanges = signal<readonly RemoteChange[] | null>(null);
  readonly reapplied = signal<{ applied: number; conflicts: readonly string[] } | null>(null);

  constructor(private readonly host: EditorSaveHost) {}

  /** Cualquier cambio nuevo en el dibujo vuelve a empezar la conversación con el servidor. */
  clearOutcome(): void {
    this.serverErrors.set([]);
    this.failure.set(null);
  }

  clearAll(): void {
    this.clearOutcome();
    this.reapplied.set(null);
    this.remoteChanges.set(null);
  }

  async save(): Promise<void> {
    const planId = this.host.planId();
    const version = this.host.version();
    if (!planId || version === null || this.saving()) return;
    const patch = diffPatch(this.host.baseline(), this.host.current());
    if (patchSize(patch) === 0) return;
    this.saving.set(true);
    this.clearOutcome();
    try {
      const res = await firstValueFrom(this.host.client.patchLayout(planId, patch, version));
      const fresh = await this.fetchFresh(planId);
      this.host.plan.layout.set(fresh);
      this.host.reset(fromViews(this.host.plan.spaces(), fresh.elements));
      this.host.setVersion(res.layoutVersion);
      clearDraft(planId);
      const a = res.applied;
      const elements = a.elementsUpserted + a.elementsRemoved;
      this.lastSave.set({
        version: res.layoutVersion, requestId: res.requestId, warnings: res.warnings, at: new Date(),
        counts: `${a.placed} ubicados, ${a.moved} movidos, ${a.removed} quitados${elements > 0 ? `, ${elements} muros, puertas o ventanas` : ''}`,
      });
      this.reapplied.set(null);
      this.remoteChanges.set(null);
    } catch (error) {
      this.onError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private onError(error: unknown): void {
    const f = readPlanFailure(error);
    if (f.status === 422 && f.errors.length > 0) {
      this.serverErrors.set(f.errors);
      this.failure.set({ kind: 'invalid', requestId: f.requestId });
      const first = f.errors.find((e) => e.kind === 'SPACE');
      if (first) this.host.select(first.id);
    } else if (f.status === 412) {
      this.failure.set({ kind: 'conflict', currentVersion: f.currentVersion, summary: f.changedSummary, requestId: f.requestId });
    } else if (f.status === 403) {
      this.failure.set({ kind: 'forbidden', requestId: f.requestId });
    } else if (f.status === 0) {
      this.failure.set({ kind: 'offline' });
    } else {
      this.failure.set({ kind: 'error', message: f.message ?? 'No pudimos guardar el plano.', requestId: f.requestId });
    }
  }

  /** El plano tal como está ahora en el servidor (silueta, todas las páginas). */
  private async fetchFresh(planId: string): Promise<LayoutResponse> {
    let cursor: string | null = null;
    let first: LayoutResponse | null = null;
    const spaces: LayoutResponse['spaces'][number][] = [];
    do {
      const page: LayoutResponse = await firstValueFrom(this.host.client.getLayout(planId, { detail: 'lite', limit: PAGE, cursor }));
      first ??= page;
      spaces.push(...page.spaces);
      cursor = page.page.nextCursor;
    } while (cursor !== null);
    return { ...first!, spaces, page: { nextCursor: null, total: spaces.length } };
  }

  /** 412 · «Ver cambios»: qué movió la otra persona, y cuáles toqué yo también. */
  async showRemoteChanges(): Promise<void> {
    const planId = this.host.planId();
    if (!planId) return;
    try {
      const fresh = await this.fetchFresh(planId);
      const incoming = fromViews(fresh.spaces.map(toSpaceView), fresh.elements);
      this.remoteChanges.set(diffRemote(this.host.baseline(), this.host.current(), incoming));
    } catch (error) {
      this.onError(error);
    }
  }

  /** 412 · «Recargar y reaplicar mis cambios»: lo que no choca se reaplica. */
  async reloadAndReapply(): Promise<void> {
    const planId = this.host.planId();
    if (!planId) return;
    this.saving.set(true);
    try {
      const oldBase = this.host.baseline();
      const mine = this.host.current();
      const fresh = await this.fetchFresh(planId);
      this.host.plan.layout.set(fresh);
      const newBase = fromViews(this.host.plan.spaces(), fresh.elements);
      const result = reapply(oldBase, mine, newBase);
      this.host.adopt(newBase, result.state);
      this.host.setVersion(fresh.layoutVersion);
      this.failure.set(null);
      this.remoteChanges.set(null);
      this.reapplied.set({ applied: result.applied.length, conflicts: result.conflicts });
    } catch (error) {
      this.onError(error);
    } finally {
      this.saving.set(false);
    }
  }
}
