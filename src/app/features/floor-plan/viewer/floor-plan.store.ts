import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Subscription } from 'rxjs';

import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import { readPlanFailure } from '../../../core/data-access/floor-plan/floor-plan.failure';
import type {
  FloorPlanMeta,
  FloorPlanSummary,
  LayoutResponse,
  PlanFocusEntry,
  PlanSearchHit,
  PlanStateResponse,
  SpacePlacementDTO,
  ViewerCaps,
} from '../../../core/data-access/floor-plan/floor-plan.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { toElementViews, toSpaceView, type ElementView, type SpaceView } from '../../../core/floor-plan/plan-view';
import {
  FUNCTION_GROUPS,
  PLAN_POLL_MS,
  PLAN_STALE_AFTER_MS,
  categoryVisual,
  functionGroupOf,
  legendCounts,
  legendValues,
  stateVisual,
  type ColorMode,
  type StateVisual,
} from '../../../core/floor-plan/state-visuals';
import { PLAN_PATIENT_FETCH_MS } from '../../../core/floor-plan/hover-intent';
import type { PlanCardResponse } from '../../../core/data-access/floor-plan/floor-plan.types';
import {
  empty,
  forbidden,
  loading,
  notFound,
  offline,
  ready,
  routeAuthPending,
  stale,
  unexpectedError,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

export interface LoadedPlan {
  readonly meta: FloorPlanMeta;
  readonly viewer: ViewerCaps;
}

/** Cuánto vive el nombre de un paciente pedido a `plan-card` (CONTRATO-PLANO §5.6). */
export const PATIENT_CACHE_MS = 30_000;
const LAST_PLAN_KEY = 'mantra-core-health.floor-plan.last';
const FULL_PAGE = 500;

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Datos y reglas de la pantalla del plano (visor y editor). Una instancia por
 * pantalla (`providers` del componente), con señales; la URL es la fuente de
 * verdad de la sede, el lienzo, el foco y el modo de color (`applyQuery`).
 *
 * **La autoridad es la API.** Lo que dicen `viewer` y `inScope` se refleja, no
 * se decide acá; un campo que la API no devuelve (`patient`) no existe para la
 * pantalla.
 */
@Injectable()
export class FloorPlanStore {
  private readonly client = inject(FloorPlanClient);
  private readonly organization = inject(MedicalOrganizationClient);
  private readonly destroyRef = inject(DestroyRef);

  /* ---- entradas de URL -------------------------------------------------------- */
  readonly siteId = signal<string | null>(null);
  readonly planId = signal<string | null>(null);
  readonly focusSpaceId = signal<string | null>(null);
  readonly unitId = signal<string | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly colorBy = signal<ColorMode>('occupancy');

  /* ---- datos ------------------------------------------------------------------ */
  readonly viewState = signal<ViewState<LoadedPlan>>(routeAuthPending());
  readonly plans = signal<readonly FloorPlanSummary[]>([]);
  readonly layout = signal<LayoutResponse | null>(null);
  readonly state = signal<PlanStateResponse | null>(null);
  readonly focusEntries = signal<readonly PlanFocusEntry[]>([]);
  /** Falla del sondeo de estado con datos previos a la vista (S7/S8). */
  readonly pollFailure = signal<'none' | 'offline' | 'error'>('none');
  readonly pollRequestId = signal<string | null>(null);
  /** Reloj de la pantalla: la antigüedad del dato se recalcula con él. */
  readonly nowMs = signal(Date.now());
  readonly layoutChanged = signal(false);
  readonly fullLoaded = signal(false);
  readonly patientNames = signal<ReadonlyMap<string, { name: string; at: number }>>(new Map());

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private loadSeq = 0;
  private patientSub: Subscription | null = null;
  private patientTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.stop());
  }

  /* ---- derivados --------------------------------------------------------------- */
  readonly meta = computed(() => this.layout()?.floorPlan ?? null);
  readonly viewer = computed<ViewerCaps | null>(() => this.layout()?.viewer ?? null);
  readonly canSeeState = computed(() => this.viewer()?.canSeeState ?? false);
  readonly spaces = computed<SpaceView[]>(() => (this.layout()?.spaces ?? []).map(toSpaceView));
  readonly elements = computed<ElementView[]>(() => toElementViews(this.layout()?.elements ?? []));
  readonly spaceById = computed(() => new Map(this.spaces().map((s) => [s.id, s])));
  readonly states = computed(() => this.state()?.spaces ?? {});
  readonly asOf = computed(() => this.state()?.asOf ?? null);
  readonly ageMs = computed(() => (this.asOf() ? this.nowMs() - Date.parse(this.asOf()!) : null));
  readonly isStale = computed(() => {
    const age = this.ageMs();
    return this.canSeeState() && (this.pollFailure() !== 'none' || (age !== null && age > PLAN_STALE_AFTER_MS));
  });
  readonly focusSet = computed<ReadonlySet<string> | null>(() => {
    const layout = this.layout();
    if (!layout || (!this.focusSpaceId() && !this.unitId())) return null;
    return new Set(layout.spaces.filter((s) => s.inFocus === true).map((s) => s.spaceId));
  });

  /** Lienzos para las pestañas: todos, o solo los que tienen algo del foco. */
  readonly tabs = computed(() => {
    const all = [...this.plans()].sort((a, b) => (b.elevationM ?? -Infinity) - (a.elevationM ?? -Infinity));
    const entries = this.focusEntries();
    const restricted = entries.length > 0 ? all.filter((p) => entries.some((e) => e.floorPlanId === p.id)) : all;
    return restricted.map((p) => ({ id: p.id, label: p.name, code: p.code, count: entries.find((e) => e.floorPlanId === p.id)?.spaceIds.length ?? null }));
  });

  readonly unitOptions = computed(() => {
    const seen = new Map<string, string>();
    for (const s of this.spaces()) if (s.card?.ownerUnit) seen.set(s.card.ownerUnit.id, s.card.ownerUnit.name);
    return [...seen.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'));
  });

  readonly zoneOptions = computed(() =>
    this.spaces()
      .filter((s) => s.inScope && s.band === 'zone')
      .map((s) => ({ value: s.id, label: s.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
  );

  /** Visual por espacio para «Unidad clínica» y «Función». */
  readonly categoryVisuals = computed<ReadonlyMap<string, StateVisual>>(() => {
    const mode = this.colorBy();
    const map = new Map<string, StateVisual>();
    if (mode === 'unit') {
      const units = this.unitOptions();
      const visuals = new Map(units.map((u, i) => [u.value, categoryVisual('unit', unitCode(this.spaces(), u.value), u.label, i)] as const));
      for (const s of this.spaces()) {
        const id = s.card?.ownerUnit?.id;
        const v = id ? visuals.get(id) : undefined;
        if (v) map.set(s.id, v);
      }
    } else if (mode === 'function') {
      const visuals = new Map(FUNCTION_GROUPS.map((g, i) => [g.code, categoryVisual('function', g.code, g.label, i)] as const));
      for (const s of this.spaces()) {
        const g = functionGroupOf(s.functionCode);
        const v = g ? visuals.get(g.code) : undefined;
        if (v) map.set(s.id, v);
      }
    }
    return map;
  });

  /** Valores de la leyenda con su recuento; cada eje trae todos sus valores aunque estén en cero. */
  readonly legend = computed(() => {
    const mode = this.colorBy();
    if (mode === 'none') return [];
    if (mode === 'unit' || mode === 'function') {
      const visuals = new Map<string, StateVisual>();
      const counts = new Map<string, number>();
      for (const [spaceId, v] of this.categoryVisuals()) {
        if (this.spaceById().get(spaceId)?.band === 'zone') continue;
        visuals.set(v.key, v);
        counts.set(v.key, (counts.get(v.key) ?? 0) + 1);
      }
      return [...visuals.values()].map((visual) => ({ visual, count: counts.get(visual.key) ?? 0 }));
    }
    if (!this.canSeeState()) return [];
    const leaves = (id: string): boolean => {
      const s = this.spaceById().get(id);
      return !!s && s.band !== 'zone';
    };
    const counts = legendCounts(mode, this.states(), leaves);
    return legendValues(mode).map((visual) => ({ visual, count: counts.get(visual.key) ?? 0 }));
  });

  /* ---- ciclo --------------------------------------------------------------------- */

  /** Arranca el reloj de la pantalla y el sondeo de estado. */
  start(): void {
    if (this.clockTimer === null) this.clockTimer = setInterval(() => this.nowMs.set(Date.now()), 15_000);
  }

  stop(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    if (this.clockTimer !== null) clearInterval(this.clockTimer);
    this.pollTimer = null;
    this.clockTimer = null;
    this.patientSub?.unsubscribe();
    if (this.patientTimer !== null) clearTimeout(this.patientTimer);
  }

  /** Resuelve la sede (si la URL no la trae) y los lienzos; después abre el pedido. */
  async bootstrap(): Promise<void> {
    const seq = ++this.loadSeq;
    this.viewState.set(loading());
    try {
      let site = this.siteId();
      if (site === null) {
        const practices = await firstValueFrom(this.organization.listPractices());
        const first = practices[0];
        if (!first) {
          this.viewState.set(empty({ label: 'Configurar una práctica', route: '/administration/medical-center-setup' }, 'Todavía no hay una organización con sedes donde dibujar un plano.'));
          return;
        }
        const console = await firstValueFrom(this.organization.getConsole(first.id));
        site = console.sites[0]?.id ?? null;
        if (site === null) {
          this.viewState.set(empty({ label: 'Crear una sede', route: '/administration/medical-organization' }, 'La organización todavía no tiene sedes.'));
          return;
        }
        this.siteId.set(site);
      }
      const plans = await firstValueFrom(this.client.listPlans(site));
      if (seq !== this.loadSeq) return;
      this.plans.set(plans);
      if (plans.length === 0) {
        this.viewState.set(
          empty(
            { label: 'Pedir a un administrador de la sede que lo cree' },
            'Esta sede todavía no tiene un lienzo de plano. Quien administra la estructura puede crear el primero.',
          ),
        );
        return;
      }
      if (this.planId() === null || !plans.some((p) => p.id === this.planId())) {
        this.planId.set(this.pickDefaultPlan(plans));
      }
      await this.load();
    } catch (error) {
      if (seq === this.loadSeq) this.viewState.set(this.failureState(error));
    }
  }

  private pickDefaultPlan(plans: readonly FloorPlanSummary[]): string {
    const last = safeStorage()?.getItem(LAST_PLAN_KEY);
    if (last && plans.some((p) => p.id === last)) return last;
    const floors = plans.filter((p) => p.anchor !== null);
    return ([...floors].sort((a, b) => (a.elevationM ?? 0) - (b.elevationM ?? 0))[0] ?? plans[0]!).id;
  }

  /** Carga el layout (silueta primero, ficha completa después) y el estado del lienzo actual. */
  async load(): Promise<void> {
    const planId = this.planId();
    if (planId === null) return;
    const seq = ++this.loadSeq;
    this.fullLoaded.set(false);
    this.layoutChanged.set(false);
    this.viewState.set(loading());
    const focusSpaceId = this.focusSpaceId() ?? undefined;
    const unitId = this.unitId() ?? undefined;
    const query = { focusSpaceId, unitId, unitMode: 'flag' as const };
    try {
      const lite = await firstValueFrom(this.client.getLayout(planId, { ...query, detail: 'lite', limit: FULL_PAGE }));
      if (seq !== this.loadSeq) return;
      this.layout.set(lite);
      this.state.set(null);
      this.pollFailure.set('none');
      this.viewState.set(this.spacesOrEmpty(lite));
      safeStorage()?.setItem(LAST_PLAN_KEY, planId);
      void this.refreshFocusEntries();
      if (lite.viewer.canSeeState) {
        await this.pollState();
        this.startPolling();
      }
      await this.loadFullDetail(planId, query, seq);
    } catch (error) {
      if (seq === this.loadSeq) this.viewState.set(this.failureState(error));
    }
  }

  private spacesOrEmpty(layout: LayoutResponse): ViewState<LoadedPlan> {
    if (layout.page.total === 0 && (this.focusSpaceId() || this.unitId())) {
      return empty({ label: 'Quitar el foco', route: '.', queryParams: { focus: '', unit: '' } }, 'Nada del área o de la unidad elegida está dibujado en este lienzo.');
    }
    if (layout.page.total === 0) {
      return empty(
        layout.viewer.canEditPlan
          ? { label: 'Ubicar espacios', route: 'edit' }
          : { label: 'Pedir a un administrador de la sede que dibuje los espacios' },
        'Este lienzo todavía no tiene espacios dibujados.',
      );
    }
    return ready<LoadedPlan>({ meta: layout.floorPlan, viewer: layout.viewer });
  }

  /** Segunda pasada: la ficha (`card`) de cada espacio, de a páginas. */
  private async loadFullDetail(planId: string, query: Record<string, unknown>, seq: number): Promise<void> {
    let cursor: string | null = null;
    const byId = new Map<string, SpacePlacementDTO>();
    do {
      const page: LayoutResponse = await firstValueFrom(this.client.getLayout(planId, { ...query, detail: 'full', limit: FULL_PAGE, cursor }));
      if (seq !== this.loadSeq) return;
      for (const s of page.spaces) byId.set(s.spaceId, s);
      cursor = page.page.nextCursor;
    } while (cursor !== null);
    const current = this.layout();
    if (!current || seq !== this.loadSeq) return;
    this.layout.set({ ...current, spaces: current.spaces.map((s) => byId.get(s.spaceId) ?? s) });
    this.fullLoaded.set(true);
  }

  private async refreshFocusEntries(): Promise<void> {
    const site = this.siteId();
    if (site === null || (!this.focusSpaceId() && !this.unitId())) {
      this.focusEntries.set([]);
      return;
    }
    try {
      const entries = await firstValueFrom(this.client.getFocus(site, { spaceId: this.focusSpaceId() ?? undefined, unitId: this.unitId() ?? undefined }));
      this.focusEntries.set(entries);
    } catch {
      this.focusEntries.set([]);
    }
  }

  /* ---- sondeo de estado (30 s y al recuperar el foco) ---------------------------- */

  private startPolling(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => void this.pollState(), PLAN_POLL_MS);
  }

  async pollState(): Promise<void> {
    const planId = this.planId();
    if (planId === null || !this.layout()?.viewer.canSeeState) return;
    const seq = this.loadSeq;
    try {
      const state = await firstValueFrom(
        this.client.getState(planId, { focusSpaceId: this.focusSpaceId() ?? undefined, unitId: this.unitId() ?? undefined }),
      );
      if (seq !== this.loadSeq) return;
      this.state.set(state);
      this.nowMs.set(Date.now());
      this.pollFailure.set('none');
      this.pollRequestId.set(null);
      const layout = this.layout();
      if (layout && state.layoutVersion !== layout.layoutVersion) this.layoutChanged.set(true);
    } catch (error) {
      if (seq !== this.loadSeq) return;
      const failure = readPlanFailure(error);
      this.pollRequestId.set(failure.requestId);
      this.pollFailure.set(failure.status === 0 ? 'offline' : 'error');
      if (failure.status === 403 || failure.status === 404) this.viewState.set(this.failureState(error));
      else this.nowMs.set(Date.now());
    }
  }

  /** «Reintentar» del banner S7. */
  retryState(): Promise<void> {
    return this.pollState();
  }

  /* ---- vista final (S1…S9) -------------------------------------------------------- */

  /**
   * El estado de la pantalla entera: S2 mientras carga, S3/S5/S6/S8/S9 según el
   * fallo, y S7 cuando hay datos pero el estado está atrasado (con `asOf`).
   */
  readonly screenState = computed<ViewState<LoadedPlan>>(() => {
    const base = this.viewState();
    if (base.status !== 'ready') return base;
    if (this.isStale() && this.asOf() !== null) return stale(base.data, new Date(this.asOf()!));
    return base;
  });

  private failureState(error: unknown): ViewState<LoadedPlan> {
    if (error instanceof HttpErrorResponse) {
      const failure = readPlanFailure(error);
      if (failure.status === 404) {
        return notFound({ label: 'Volver a los lienzos', route: '/administration/medical-organization/plan' });
      }
      if (failure.status === 403) {
        return forbidden({ message: 'Su rol no puede ver este plano.', nextAction: { label: 'Volver', route: '/administration/medical-organization' }, ...(failure.requestId ? { requestId: failure.requestId } : {}) });
      }
      if (failure.status === 0) return offline(new Date());
      if (failure.status >= 500 || failure.requestId) {
        return unexpectedError(failure.requestId ?? 'sin-id', failure.message ?? 'No pudimos cargar el plano.');
      }
    }
    return errorToViewState<LoadedPlan>(error);
  }

  /* ---- paciente bajo demanda (nombre) ----------------------------------------------- */

  /**
   * Pide el nombre del paciente tras 350 ms de permanencia; se cancela con la
   * baja de la suscripción si el puntero se va antes, y se guarda 30 s. Cada
   * lectura queda auditada por la API: no se pide por adelantado.
   */
  scheduleDetailFor(spaceId: string | null): void {
    if (this.patientTimer !== null) clearTimeout(this.patientTimer);
    this.patientSub?.unsubscribe();
    this.patientSub = null;
    if (spaceId === null || !this.viewer()?.canSeePatient) return;
    const hasInitials = this.state()?.spaces[spaceId]?.occupancy.patient !== undefined;
    if (!hasInitials) return;
    const cached = this.patientNames().get(spaceId);
    if (cached && Date.now() - cached.at < PATIENT_CACHE_MS) return;
    this.patientTimer = setTimeout(() => {
      this.patientSub = this.client.getPlanCard(spaceId).subscribe({
        next: (card: PlanCardResponse) => {
          if (!card.patient) return;
          const next = new Map(this.patientNames());
          next.set(spaceId, { name: card.patient.displayName, at: Date.now() });
          this.patientNames.set(next);
        },
        // 403/404: la tarjeta sigue con lo que ya tiene.
        error: () => undefined,
      });
    }, PLAN_PATIENT_FETCH_MS);
  }

  patientNameOf(spaceId: string): string | null {
    const hit = this.patientNames().get(spaceId);
    return hit && Date.now() - hit.at < PATIENT_CACHE_MS ? hit.name : null;
  }

  /* ---- búsqueda --------------------------------------------------------------------- */

  readonly searchResults = signal<readonly PlanSearchHit[]>([]);
  readonly searching = signal(false);

  async search(query: string): Promise<void> {
    const site = this.siteId();
    if (site === null || query.trim().length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    try {
      this.searchResults.set(await firstValueFrom(this.client.search(site, query.trim(), 8)));
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }
}

function unitCode(spaces: readonly SpaceView[], unitId: string): string {
  return spaces.find((s) => s.card?.ownerUnit?.id === unitId)?.card?.ownerUnit?.code ?? '';
}

export { stateVisual };
