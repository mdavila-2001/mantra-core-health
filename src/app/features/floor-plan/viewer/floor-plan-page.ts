import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { buildCardModel } from '../../../core/floor-plan/card-model';
import type { CanvasHover, FrameRequest, PlanLayerId, RevealRequest, ViewInfo } from '../../../core/floor-plan/canvas.types';
import { bboxInflate, type BBox, type Point } from '../../../core/floor-plan/geometry';
import { COLOR_MODE_LABEL, COLOR_MODES, STATE_MODES, ageLabel, type ColorMode } from '../../../core/floor-plan/state-visuals';
import type { PlanSearchHit } from '../../../core/data-access/floor-plan/floor-plan.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { PlanLegend } from '../../../shared/components/molecules/plan-legend/plan-legend';
import { PlanSpaceCard } from '../../../shared/components/molecules/plan-space-card/plan-space-card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { FloorPlanCanvas } from '../../../shared/components/organisms/floor-plan-canvas/floor-plan-canvas';
import { DEFAULT_LAYERS, PLAN_LAYERS } from '../../../core/floor-plan/canvas.types';
import { FloorPlanMinimap } from '../../../shared/components/organisms/floor-plan-minimap/floor-plan-minimap';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { FloorPlanStore } from './floor-plan.store';
import { PlanSelectionPanel } from './plan-selection-panel';
import { PlanSpaceList } from './plan-space-list';

const LAYERS_KEY = 'mantra-core-health.floor-plan.layers';
type PlanView = 'plan' | 'list';

function readLayers(): ReadonlySet<PlanLayerId> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LAYERS_KEY);
    if (!raw) return DEFAULT_LAYERS;
    const known = new Set(PLAN_LAYERS.map((l) => l.id as string));
    const ids = (JSON.parse(raw) as string[]).filter((id) => known.has(id)) as PlanLayerId[];
    return ids.length > 0 ? new Set(ids) : DEFAULT_LAYERS;
  } catch {
    return DEFAULT_LAYERS;
  }
}

/**
 * Visor del plano de planta (CONTRATO-PLANO §5.2): un lienzo SVG por piso, zona
 * o campus, con tarjeta de detalle al pasar el puntero, teclado y toque.
 *
 * La URL manda: `?site=&plan=&space=&focus=&unit=&color=&view=`. Cada cambio de
 * foco, color, lienzo o selección navega con `replaceUrl`, de modo que el
 * enlace copiado reproduce lo que se ve.
 */
@Component({
  selector: 'app-floor-plan-page',
  imports: [
    AppButton, Alert, Checkbox, FloorPlanCanvas, FloorPlanMinimap, PageHeader, PlanLegend, PlanSelectionPanel,
    PlanSpaceCard, PlanSpaceList, SearchField, SegmentedControl, Select, ViewStateHost,
  ],
  providers: [FloorPlanStore],
  templateUrl: './floor-plan-page.html',
  styleUrl: './floor-plan-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'floor-plan-page' },
})
export class FloorPlanPage {
  protected readonly store = inject(FloorPlanStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly canvas = viewChild(FloorPlanCanvas);

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /* ---- estado de la vista ------------------------------------------------------- */
  protected readonly layers = signal<ReadonlySet<PlanLayerId>>(readLayers());
  protected readonly hiddenValues = signal<ReadonlySet<string>>(new Set());
  protected readonly hover = signal<CanvasHover | null>(null);
  protected readonly view = signal<ViewInfo | null>(null);
  protected readonly frame = signal<FrameRequest | null>(null);
  protected readonly reveal = signal<RevealRequest | null>(null);
  protected readonly highlightId = signal<string | null>(null);
  protected readonly narrow = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly toolsOpen = signal(false);
  protected readonly minimapOpen = signal(true);
  protected readonly searchText = signal('');
  protected readonly layerList = PLAN_LAYERS;
  private nonce = 0;
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLoadKey = '';
  private pendingReveal: string | null = null;

  protected readonly planView = computed<PlanView>(() => (this.query().get('view') === 'list' ? 'list' : 'plan'));
  protected readonly viewOptions = [
    { value: 'plan' as const, label: 'Plano' },
    { value: 'list' as const, label: 'Lista' },
  ];

  protected readonly colorOptions = computed<SelectOption<ColorMode>[]>(() =>
    COLOR_MODES.filter((m) => this.store.canSeeState() || !STATE_MODES.includes(m)).map((value) => ({ value, label: COLOR_MODE_LABEL[value] })),
  );
  protected readonly zoneSelectOptions = computed<SelectOption<string>[]>(() => [{ value: '', label: 'Todo el lienzo' }, ...this.store.zoneOptions()]);
  protected readonly unitSelectOptions = computed<SelectOption<string>[]>(() => [{ value: '', label: 'Todas las unidades' }, ...this.store.unitOptions()]);

  protected readonly legendNote = computed(() => {
    if (this.store.colorBy() === 'none') return 'Sin coloreado: el plano muestra solo la estructura.';
    if (STATE_MODES.includes(this.store.colorBy()) && !this.store.canSeeState()) return 'El estado operativo no está disponible para su rol.';
    if (this.store.legend().length === 0 && !this.store.fullLoaded()) return 'Cargando la ficha de los espacios…';
    return null;
  });

  protected readonly cardModel = computed(() => {
    const hover = this.hover();
    if (!hover) return null;
    const space = this.store.spaceById().get(hover.spaceId);
    if (!space) return null;
    return this.modelFor(space.id);
  });

  protected readonly selectedModel = computed(() => {
    const id = this.store.selectedId();
    return id && this.store.spaceById().has(id) ? this.modelFor(id) : null;
  });

  protected readonly selectedChildren = computed(() => {
    const id = this.store.selectedId();
    return id ? this.store.spaces().filter((s) => s.parentId === id && s.inScope) : [];
  });

  protected readonly spaceSize = computed(() => {
    const hover = this.hover();
    return hover ? (this.canvas()?.screenSizeOf(hover.spaceId) ?? null) : null;
  });

  protected readonly staleText = computed(() => {
    const asOf = this.store.asOf();
    if (!asOf) return 'Todavía no hay estado operativo.';
    return ageLabel(asOf, this.store.nowMs());
  });

  protected readonly tabsLabel = computed(() => (this.store.focusSpaceId() || this.store.unitId() ? 'Pisos con el foco elegido' : 'Pisos y zonas'));

  constructor() {
    this.store.start();
    afterNextRender(() => {
      if (!this.isBrowser) return;
      const media = window.matchMedia('(max-width: 767.98px)');
      const update = (): void => this.narrow.set(media.matches);
      update();
      media.addEventListener('change', update);
      const onVisible = (): void => {
        if (document.visibilityState === 'visible') void this.store.pollState();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
      this.destroyRef.onDestroy(() => {
        media.removeEventListener('change', update);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', onVisible);
      });
    });

    // La URL manda: se aplica y, si cambió algo que pide datos nuevos, se vuelve a cargar.
    effect(() => {
      const q = this.query();
      untracked(() => {
        const store = this.store;
        store.siteId.set(q.get('site') ?? store.siteId());
        store.planId.set(q.get('plan') || null);
        store.focusSpaceId.set(q.get('focus') || null);
        store.unitId.set(q.get('unit') || null);
        const color = q.get('color') as ColorMode | null;
        store.colorBy.set(color && COLOR_MODES.includes(color) ? color : store.colorBy());
        store.selectedId.set(q.get('space'));
        const key = [store.siteId(), store.planId(), store.focusSpaceId(), store.unitId()].join('|');
        if (key !== this.lastLoadKey) {
          this.lastLoadKey = key;
          this.pendingReveal = q.get('space');
          this.hover.set(null);
          this.hiddenValues.set(new Set());
          void (store.planId() === null || store.plans().length === 0 ? store.bootstrap() : store.load());
        }
      });
    });

    // Al terminar de cargar: enmarcar el foco o centrar el espacio pedido.
    effect(() => {
      const layout = this.store.layout();
      if (!layout) return;
      untracked(() => {
        if (layout.focus && (this.store.focusSpaceId() || this.store.unitId())) {
          this.frame.set({ bbox: bboxInflate(layout.focus.bbox as BBox, 1.5), nonce: ++this.nonce });
        }
        const target = this.pendingReveal;
        if (target && layout.spaces.some((s) => s.spaceId === target)) {
          this.pendingReveal = null;
          this.revealSpace(target);
        }
      });
    });

    // El nombre del paciente se pide solo tras 350 ms de permanencia.
    effect(() => {
      const id = this.hover()?.spaceId ?? this.store.selectedId();
      untracked(() => this.store.scheduleDetailFor(id));
    });

    effect(() => {
      const ids = [...this.layers()];
      untracked(() => {
        try {
          localStorage.setItem(LAYERS_KEY, JSON.stringify(ids));
        } catch {
          /* la preferencia es una comodidad: sin almacenamiento, la pantalla funciona igual */
        }
      });
    });
  }

  private modelFor(id: string) {
    const space = this.store.spaceById().get(id)!;
    const state = this.store.states()[id];
    return buildCardModel({
      space,
      state,
      rollup: this.store.state()?.rollups[id],
      asOf: this.store.asOf(),
      now: this.store.nowMs(),
      canSeeState: this.store.canSeeState(),
      canSeePatient: this.store.viewer()?.canSeePatient ?? false,
      patientName: this.store.patientNameOf(id),
    });
  }

  /* ---- navegación por URL ---------------------------------------------------------- */

  protected setQuery(params: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected goToPlan(planId: string): void {
    this.setQuery({ plan: planId, space: null });
  }

  protected onColor(mode: ColorMode | null): void {
    if (mode) {
      this.hiddenValues.set(new Set());
      this.setQuery({ color: mode });
    }
  }

  protected onFocusZone(value: string | null): void {
    this.setQuery({ focus: value || null, unit: null });
  }

  protected onUnit(value: string | null): void {
    this.setQuery({ unit: value || null, focus: null });
  }

  protected onView(value: PlanView): void {
    this.setQuery({ view: value === 'list' ? 'list' : null });
  }

  protected stepFloor(step: 1 | -1): void {
    const tabs = this.store.tabs();
    const index = tabs.findIndex((t) => t.id === this.store.planId());
    const next = tabs[index + step];
    if (next) this.goToPlan(next.id);
  }

  /* ---- interacción ------------------------------------------------------------------ */

  protected onPick(id: string | null): void {
    this.setQuery({ space: id });
    if (id === null) this.hover.set(null);
  }

  protected onHover(hover: CanvasHover | null): void {
    this.hover.set(hover);
    // Con toque en pantalla chica la tarjeta es una hoja anclada abajo (≤ 40 % del alto): sube el plano lo justo para no taparlo.
    if (hover && hover.source === 'touch' && this.narrow() && this.isBrowser) {
      const limit = window.innerHeight * 0.6 - 8;
      const bottom = hover.anchor.top + hover.anchor.height;
      if (bottom > limit) this.canvas()?.panByPixels(0, limit - bottom);
    }
  }

  protected closeCard(): void {
    this.canvas()?.closeCard();
    this.hover.set(null);
  }

  protected openFile(id: string | null): void {
    if (!id) return;
    void this.router.navigate(['/administration/medical-organization/spaces', id]);
  }

  protected toggleLayer(id: PlanLayerId, on: boolean): void {
    const next = new Set(this.layers());
    if (on) next.add(id);
    else next.delete(id);
    this.layers.set(next);
  }

  protected toggleLegend(key: string): void {
    const next = new Set(this.hiddenValues());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.hiddenValues.set(next);
  }

  protected isLayerOn(id: PlanLayerId): boolean {
    return this.layers().has(id);
  }

  protected onMinimap(point: Point): void {
    this.canvas()?.setCenter(point);
  }

  protected focusSearch(): void {
    this.hostElement.nativeElement.querySelector<HTMLInputElement>('app-search-field input')?.focus();
  }

  protected showList(): void {
    this.onView('list');
  }

  /* ---- búsqueda -------------------------------------------------------------------- */

  protected onSearch(text: string): void {
    this.searchText.set(text);
    void this.store.search(text);
  }

  protected chooseHit(hit: PlanSearchHit): void {
    this.store.searchResults.set([]);
    this.searchText.set('');
    if (!hit.placed || !hit.floorPlanId) {
      this.setQuery({ space: hit.spaceId });
      return;
    }
    if (hit.floorPlanId !== this.store.planId()) {
      this.pendingReveal = hit.spaceId;
      this.setQuery({ plan: hit.floorPlanId, space: hit.spaceId, focus: null, unit: null });
      return;
    }
    this.setQuery({ space: hit.spaceId });
    this.revealSpace(hit.spaceId);
  }

  private revealSpace(id: string): void {
    this.reveal.set({ spaceId: id, nonce: ++this.nonce });
    this.highlightId.set(id);
    if (this.highlightTimer !== null) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightId.set(null), 1600);
  }

  protected onView2(info: ViewInfo): void {
    this.view.set(info);
  }

  protected retry(): void {
    void this.store.bootstrap();
  }

  protected editLink(): string[] {
    return ['/administration/medical-organization/plan/edit'];
  }

  protected edit(): void {
    void this.router.navigate(this.editLink(), { queryParams: { plan: this.store.planId(), site: this.store.siteId() } });
  }

  protected readonly selectableAll = (): boolean => true;
}
