import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import type { SpaceState } from '../../../../core/data-access/floor-plan/floor-plan.types';
import { GestureTracker } from '../../../../core/floor-plan/gestures';
import { bboxInflate, type BBox, type Point } from '../../../../core/floor-plan/geometry';
import { HoverIntent, reduceTouch, type HoverSource, type TouchState } from '../../../../core/floor-plan/hover-intent';
import { paintOrder, sortedElements, type ElementView, type SpaceView } from '../../../../core/floor-plan/plan-view';
import {
  clampViewport,
  ensureVisible,
  frameBBox,
  panBy,
  screenToWorld,
  viewBoxOf,
  visibleBBox,
  worldToScreen,
  zoomAt,
  zoomPercent,
  ZOOM_STEP,
  type PixelSize,
  type Viewport,
} from '../../../../core/floor-plan/plan-viewport';
import { GridIndex, defaultCellSize } from '../../../../core/floor-plan/spatial-index';
import { nextInDirection, readingOrder, type NavDirection, type NavItem } from '../../../../core/floor-plan/spatial-nav';
import {
  NO_STATE_VISUAL,
  ageLabel,
  ariaLabelFor,
  stateVisual,
  type ColorMode,
  type StateVisual,
} from '../../../../core/floor-plan/state-visuals';
import {
  DEFAULT_LAYERS,
  PLAN_LOD_BEDS_MIN_ZOOM,
  PLAN_LOD_GLYPHS_MIN_ZOOM,
  PLAN_LOD_LABELS_MIN_ZOOM,
  PLAN_MIN_TOUCH_TARGET_PX,
  PLAN_VIRTUALIZE_MIN_NODES,
  type CanvasHover,
  type CanvasOverlay,
  type FrameRequest,
  type PlanLayerId,
  type RevealRequest,
  type ViewInfo,
  type WorldPointerEvent,
} from './floor-plan-canvas.types';
import { AppButton } from '../../atoms/button/button';
import { PlanGlyphDefs } from './plan-glyph-defs';

/** Una fila de la capa de rellenos: el espacio con todo lo que se decide una vez por cambio de datos. */
interface FillRow {
  readonly s: SpaceView;
  readonly visual: StateVisual;
  readonly cls: string;
  readonly interactive: boolean;
  readonly aria: string | null;
  readonly dim: boolean;
  readonly hiddenByLegend: boolean;
  readonly patternUrl: string | null;
  readonly showBorder: boolean;
}

interface LabelRow {
  readonly s: SpaceView;
  readonly visual: StateVisual;
  readonly x: number;
  readonly y: number;
  readonly text: string | null;
  readonly glyph: StateVisual['glyph'];
  readonly mark: string | undefined;
  readonly tone: string;
  readonly zone: boolean;
  readonly halo: boolean;
}

const FILL_PATTERN: Readonly<Record<string, string>> = {
  diagonal: 'url(#plan-pat-diagonal)',
  cross: 'url(#plan-pat-cross)',
  dots: 'url(#plan-pat-dots)',
  hstripes: 'url(#plan-pat-hstripes)',
  grid: 'url(#plan-pat-grid)',
};

/**
 * Lienzo del plano de planta (CONTRATO-PLANO §5.2, §5.5, §5.6 y §5.9).
 *
 * **SVG con el `viewBox` en metros.** Una sola capa de rellenos por espacio
 * hace de blanco de puntería, de nodo enfocable y de pieza de la leyenda; los
 * muros, las aberturas, los glifos y los rótulos van en capas propias encima,
 * sin eventos. Eso respeta el orden de pintado del contrato (rellenos de estado
 * debajo de los muros) sin duplicar nodos interactivos.
 *
 * - **Un solo manejador delegado** de puntero sobre el SVG, acotado por
 *   `requestAnimationFrame`: no hay un listener por espacio.
 * - **Una sola parada de `Tab`** (*roving tabindex*): las flechas recorren los
 *   espacios por vecindad espacial, `Enter` abre la ficha, `Escape` descarta la
 *   tarjeta sin mover el foco.
 * - **Virtualización** desde `PLAN_VIRTUALIZE_MIN_NODES` nodos: se monta solo
 *   lo visible (más el espacio activo, el seleccionado y el resaltado).
 * - **Nivel de detalle** por zoom: rótulos, camas y glifos aparecen al acercar.
 * - La tarjeta de detalle NO se pinta acá: este componente avisa con
 *   `hoverChange` qué espacio y dónde, y quien lo usa la dibuja en una capa
 *   HTML fuera del SVG.
 */
@Component({
  selector: 'app-floor-plan-canvas',
  imports: [AppButton, NgTemplateOutlet, PlanGlyphDefs],
  templateUrl: './floor-plan-canvas.html',
  styleUrl: './floor-plan-canvas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'plan-canvas',
    '[class.plan-canvas--edit]': 'interactionMode() === "edit"',
    '[class.plan-canvas--touch]': 'touchSeen()',
    '[class.plan-canvas--grabbing]': 'dragging()',
    '[class.plan-canvas--hand]': 'handTool()',
  },
})
export class FloorPlanCanvas {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  /* ---- entradas ------------------------------------------------------------ */
  readonly planName = input.required<string>();
  readonly widthM = input.required<number>();
  readonly heightM = input.required<number>();
  readonly gridSizeM = input(0.5);
  readonly northBearingDeg = input(0);
  readonly spaces = input.required<readonly SpaceView[]>();
  readonly elements = input<readonly ElementView[]>([]);
  readonly states = input<Readonly<Record<string, SpaceState>>>({});
  readonly canSeeState = input(true);
  readonly asOf = input<string | null>(null);
  /** Reloj de la pantalla (ms): la antigüedad del `aria-label` se calcula con él. */
  readonly nowMs = input<number>(0);
  readonly colorBy = input<ColorMode>('occupancy');
  /** Visual por espacio para «Unidad clínica» y «Función». */
  readonly categoryVisuals = input<ReadonlyMap<string, StateVisual>>(new Map());
  readonly layers = input<ReadonlySet<PlanLayerId>>(DEFAULT_LAYERS);
  /** Claves de leyenda ocultas (la leyenda es un filtro). */
  readonly hiddenValues = input<ReadonlySet<string>>(new Set());
  readonly selectedId = input<string | null>(null);
  /** Anillo de 1,5 s al centrar un resultado de búsqueda. */
  readonly highlightId = input<string | null>(null);
  /** Subárbol enfocado: lo demás se atenúa. */
  readonly focusIds = input<ReadonlySet<string> | null>(null);
  /** Modo elegir cama: `false` atenúa el espacio y lo vuelve no seleccionable. */
  readonly selectable = input<(id: string) => boolean>(() => true);
  readonly frame = input<FrameRequest | null>(null);
  readonly reveal = input<RevealRequest | null>(null);
  readonly interactionMode = input<'view' | 'edit'>('view');
  readonly handTool = input(false);
  readonly overlay = input<CanvasOverlay | null>(null);
  /** Espacio cuya tarjeta está abierta y el id del elemento de la tarjeta (`aria-describedby`). */
  readonly cardTargetId = input<string | null>(null);
  readonly cardDomId = input<string>('plan-card');

  /* ---- salidas ------------------------------------------------------------- */
  readonly hoverChange = output<CanvasHover | null>();
  /** Clic, toque o `Enter`: abrir la ficha completa. */
  readonly open = output<string>();
  /** Clic simple sobre un espacio (o `null` sobre el fondo): seleccionar. */
  readonly pick = output<string | null>();
  readonly activeChange = output<string | null>();
  readonly viewChange = output<ViewInfo>();
  readonly searchRequested = output<void>();
  readonly floorStep = output<1 | -1>();
  readonly worldPointer = output<WorldPointerEvent>();

  /* ---- estado interno ------------------------------------------------------- */
  private readonly size = signal<PixelSize>({ width: 800, height: 500 });
  protected readonly view = signal<Viewport>({ cx: 32, cy: 13, scale: 10 });
  protected readonly activeId = signal<string | null>(null);
  protected readonly hoveredId = signal<string | null>(null);
  protected readonly focusVisible = signal(false);
  protected readonly touchSeen = signal(false);
  protected readonly dragging = signal(false);
  protected readonly liveText = signal('');
  private touchState: TouchState = { openId: null };
  private readonly gestures = new GestureTracker();
  private resizeObserver: ResizeObserver | null = null;
  private pendingHover: { target: string | null; x: number; y: number } | null = null;
  private hoverFrame = 0;
  private lastPointer: { x: number; y: number } | null = null;
  private fitted = false;
  private lastLive = '';
  private lastFrameNonce = -1;
  private lastRevealNonce = -1;
  private wheelListener: ((event: WheelEvent) => void) | null = null;
  private editDragging = false;

  private readonly intent = new HoverIntent((id, source) => this.onIntent(id, source));

  /* ---- derivados ------------------------------------------------------------ */
  protected readonly viewBox = computed(() => viewBoxOf(this.view(), this.size()));
  protected readonly unit = computed(() => String(Math.round((1 / this.view().scale) * 100000) / 100000));
  protected readonly patternScale = computed(() => `scale(${1 / this.view().scale})`);
  protected readonly zoom = computed(() => zoomPercent(this.view().scale));
  /** Cubos de escala (cuartos de octava): lo que depende del zoom no se recalcula en cada fotograma. */
  private readonly scaleBucket = computed(() => Math.round(Math.log2(this.view().scale) * 4));
  private readonly lod = computed(() => {
    const z = zoomPercent(2 ** (this.scaleBucket() / 4));
    return { labels: z >= PLAN_LOD_LABELS_MIN_ZOOM, glyphs: z >= PLAN_LOD_GLYPHS_MIN_ZOOM, beds: z >= PLAN_LOD_BEDS_MIN_ZOOM, scale: 2 ** (this.scaleBucket() / 4) };
  });

  private readonly ordered = computed(() => paintOrder(this.spaces()));
  private readonly byId = computed(() => new Map(this.spaces().map((s) => [s.id, s])));
  private readonly virtualized = computed(() => this.spaces().length >= PLAN_VIRTUALIZE_MIN_NODES);
  private readonly index = computed(() => {
    const index = new GridIndex(this.widthM(), this.heightM(), defaultCellSize(this.widthM(), this.heightM()));
    for (const s of this.spaces()) index.insert(s.id, s.bbox);
    return index;
  });

  /** Ids que se montan cuando se virtualiza: la ventana visible más lo que el usuario está tocando. */
  private readonly mountedIds = computed<ReadonlySet<string> | null>(() => {
    if (!this.virtualized()) return null;
    const { scale } = this.view();
    const box = bboxInflate(visibleBBox(this.view(), this.size()), 96 / scale);
    const ids = new Set(this.index().query(box));
    for (const keep of [this.activeId(), this.selectedId(), this.highlightId(), this.hoveredId()]) if (keep) ids.add(keep);
    return ids;
  });

  private readonly visual = (s: SpaceView): StateVisual => {
    const mode = this.colorBy();
    if (mode === 'none') return NO_STATE_VISUAL;
    if (mode === 'unit' || mode === 'function') return this.categoryVisuals().get(s.id) ?? NO_STATE_VISUAL;
    if (!this.canSeeState() || s.band === 'zone') return NO_STATE_VISUAL;
    return stateVisual(mode, this.states()[s.id]);
  };

  protected readonly fillRows = computed<FillRow[]>(() => {
    const layers = this.layers();
    const lod = this.lod();
    const mounted = this.mountedIds();
    const hidden = this.hiddenValues();
    const focus = this.focusIds();
    const selectable = this.selectable();
    const asOf = this.asOf() ?? undefined;
    const now = this.nowMs() || Date.now();
    const states = this.states();
    const rows: FillRow[] = [];
    for (const s of this.ordered()) {
      if (mounted && !mounted.has(s.id)) continue;
      if (s.band === 'zone' && !layers.has('zones')) continue;
      if (s.band === 'room' && !layers.has('rooms')) continue;
      if (s.band === 'bed' && (!layers.has('beds') || !lod.beds)) continue;
      const visual = this.visual(s);
      const interactive = s.inScope && s.band !== 'zone';
      const stateless = !this.canSeeState() && this.colorBy() !== 'none' && this.colorBy() !== 'unit' && this.colorBy() !== 'function';
      const tone = !s.inScope ? 'silhouette' : visual.tone;
      const classes = ['sp', `sp--${s.band}`, `tone-${tone}`];
      if (visual.strong) classes.push('is-strong');
      if (visual.quiet) classes.push('is-quiet');
      if (visual.border === 'dashed-thick') classes.push('b-dashed');
      if (visual.border === 'dotted') classes.push('b-dotted');
      if (visual.pattern === 'solid-strong') classes.push('p-strong');
      if (!s.inScope) classes.push('is-silhouette');
      if (s.locked) classes.push('is-locked');
      if (stateless) classes.push('is-stateless');
      const dimByFocus = focus !== null && !focus.has(s.id);
      const dimByPick = !selectable(s.id);
      const hiddenByLegend = visual.key !== NO_STATE_VISUAL.key && hidden.has(visual.key);
      rows.push({
        s,
        visual,
        cls: classes.join(' '),
        interactive,
        aria: interactive
          ? ariaLabelFor({ name: s.name, functionDisplay: s.card?.functionDisplay, inScope: s.inScope }, this.canSeeState() ? states[s.id] : undefined, asOf, now)
          : null,
        dim: dimByFocus || dimByPick,
        hiddenByLegend,
        patternUrl: s.inScope ? (FILL_PATTERN[visual.pattern] ?? null) : null,
        showBorder: visual.border === 'dashed-thick',
      });
    }
    return rows;
  });

  protected readonly labelRows = computed<LabelRow[]>(() => {
    const layers = this.layers();
    const lod = this.lod();
    if (!lod.glyphs && !lod.labels) return [];
    const mounted = this.mountedIds();
    const scale = lod.scale;
    const rows: LabelRow[] = [];
    const showLabels = layers.has('labels') && lod.labels;
    const showGlyphs = layers.has('state') && lod.glyphs;
    for (const s of this.ordered()) {
      if (!s.inScope) continue;
      if (mounted && !mounted.has(s.id)) continue;
      if (s.band === 'zone' && !layers.has('zones')) continue;
      if (s.band === 'room' && !layers.has('rooms')) continue;
      if (s.band === 'bed' && (!layers.has('beds') || !lod.beds)) continue;
      const widthPx = (s.bbox[2] - s.bbox[0]) * scale;
      const heightPx = (s.bbox[3] - s.bbox[1]) * scale;
      const visual = this.visual(s);
      const fitsGlyph = widthPx >= 18 && heightPx >= 18;
      const fitsText = widthPx >= 54 && heightPx >= 30;
      const glyph = showGlyphs && fitsGlyph && s.band !== 'zone' ? visual.glyph : null;
      const mark = showGlyphs && fitsGlyph && s.band !== 'zone' ? visual.mark : undefined;
      let text: string | null = null;
      if (showLabels && s.band === 'zone') text = widthPx >= 80 ? s.name : null;
      else if (showLabels && s.band === 'room' && fitsText) text = shortName(s.name, Math.floor(widthPx / 6.5));
      if (text === null && glyph === null && mark === undefined) continue;
      const zone = s.band === 'zone';
      rows.push({
        s,
        visual,
        x: zone ? s.bbox[0] : s.center[0],
        y: zone ? s.bbox[1] : s.center[1],
        text,
        glyph,
        mark,
        tone: visual.tone,
        zone,
        halo: false,
      });
    }
    return rows;
  });

  /** Halos transparentes del área de toque (44 px) para los espacios que se ven más chicos que eso. */
  protected readonly haloRows = computed(() => {
    if (!this.touchSeen()) return [];
    const scale = this.lod().scale;
    return this.fillRows()
      .filter((r) => r.interactive && Math.min(r.s.bbox[2] - r.s.bbox[0], r.s.bbox[3] - r.s.bbox[1]) * scale < PLAN_MIN_TOUCH_TARGET_PX)
      .map((r) => ({ id: r.s.id, x: r.s.center[0], y: r.s.center[1] }));
  });

  protected readonly zoneRows = computed(() => this.fillRows().filter((r) => r.s.band === 'zone'));
  protected readonly solidRows = computed(() => this.fillRows().filter((r) => r.s.band !== 'zone'));

  protected readonly circulation = computed(() => (this.layers().has('circulation') ? sortedElements(this.elements(), 'circulation') : []));
  protected readonly verticals = computed(() => (this.layers().has('circulation') ? sortedElements(this.elements(), 'vertical') : []));
  protected readonly walls = computed(() => (this.layers().has('walls') ? sortedElements(this.elements(), 'walls') : []));
  protected readonly openings = computed(() => (this.layers().has('openings') ? sortedElements(this.elements(), 'openings') : []));
  protected readonly annotations = computed(() => (this.layers().has('labels') ? sortedElements(this.elements(), 'labels') : []));
  protected readonly dimensions = computed(() =>
    this.layers().has('dimensions') && this.lod().labels
      ? this.walls().filter((w) => w.vertices.length >= 2 && (w.thicknessM ?? 0) <= 0.2 && !w.label).slice(0, 80)
      : [],
  );

  protected readonly gridPath = computed(() => {
    if (!this.layers().has('grid')) return '';
    const step = this.gridSizeM();
    if (!(step > 0) || step * this.lod().scale < 6) return '';
    const parts: string[] = [];
    for (let x = 0; x <= this.widthM() + 1e-6; x += step) parts.push(`M${round(x)} 0V${this.heightM()}`);
    for (let y = 0; y <= this.heightM() + 1e-6; y += step) parts.push(`M0 ${round(y)}H${this.widthM()}`);
    return parts.join('');
  });

  protected readonly selected = computed(() => this.byId().get(this.selectedId() ?? ''));
  protected readonly active = computed(() => this.byId().get(this.activeId() ?? ''));
  protected readonly highlighted = computed(() => this.byId().get(this.highlightId() ?? ''));
  protected readonly hovered = computed(() => this.byId().get(this.hoveredId() ?? ''));

  /** Espacios por los que se navega con flechas: locales y camas visibles, no las zonas. */
  private readonly navItems = computed<NavItem[]>(() => {
    const layers = this.layers();
    const lod = this.lod();
    const hidden = this.hiddenValues();
    return this.spaces()
      .filter((s) => s.inScope && s.band !== 'zone')
      .filter((s) => (s.band === 'bed' ? layers.has('beds') && lod.beds : layers.has('rooms')))
      .filter((s) => hidden.size === 0 || !hidden.has(this.visual(s).key))
      .map((s) => ({ id: s.id, bbox: s.bbox }));
  });

  protected readonly groupLabel = computed(() => {
    const total = this.spaces().length;
    return `${this.planName()}, ${total} ${total === 1 ? 'espacio' : 'espacios'}`;
  });

  protected readonly northTransform = computed(() => `rotate(${this.northBearingDeg()})`);

  constructor() {
    // El espacio activo por omisión: el seleccionado o el primero en orden de lectura.
    effect(() => {
      const items = this.navItems();
      const current = untracked(() => this.activeId());
      if (items.length === 0) {
        if (current !== null) this.activeId.set(null);
        return;
      }
      if (current !== null && items.some((i) => i.id === current)) return;
      const preferred = untracked(() => this.selectedId());
      const next = preferred && items.some((i) => i.id === preferred) ? preferred : readingOrder(items)[0]!;
      this.activeId.set(next);
    });

    // La selección externa mueve el espacio activo.
    effect(() => {
      const id = this.selectedId();
      if (id && untracked(() => this.navItems()).some((i) => i.id === id)) this.activeId.set(id);
    });

    // Cambiar de lienzo reencuadra todo.
    effect(() => {
      this.widthM();
      this.heightM();
      untracked(() => {
        this.fitted = false;
        this.fitWhole();
      });
    });

    effect(() => {
      const request = this.frame();
      if (!request || request.nonce === this.lastFrameNonce) return;
      this.lastFrameNonce = request.nonce;
      untracked(() => this.frameBox(request.bbox, request.maxScale, request.bottomInsetPx ?? 0));
    });

    effect(() => {
      const request = this.reveal();
      if (!request || request.nonce === this.lastRevealNonce) return;
      this.lastRevealNonce = request.nonce;
      const space = untracked(() => this.byId().get(request.spaceId));
      if (space) untracked(() => this.centerOn(space.center, Math.max(this.view().scale, 24)));
    });

    // Cada cambio de vista se informa (el minimapa y la tarjeta se reubican).
    effect(() => {
      const viewport = this.view();
      const sizePx = this.size();
      untracked(() => {
        this.viewChange.emit({ viewport, sizePx, visible: visibleBBox(viewport, sizePx), zoomPercent: zoomPercent(viewport.scale) });
        if (this.intent.activeId !== null) queueMicrotask(() => this.reanchor());
      });
    });

    // Anuncio de cambios de estado del espacio enfocado (no de todo el plano).
    effect(() => {
      const id = this.activeId();
      if (!id || !this.focusVisible()) return;
      const row = this.fillRows().find((r) => r.s.id === id);
      if (!row?.aria) return;
      if (row.aria !== this.lastLive) {
        this.lastLive = row.aria;
        this.liveText.set(row.aria);
      }
    });

    afterNextRender(() => this.connectBrowser());
    this.destroyRef.onDestroy(() => this.disconnect());
  }

  /* ---- API pública ---------------------------------------------------------- */

  fit(): void {
    this.fitWhole();
  }

  zoomBy(factor: number): void {
    const size = this.size();
    this.setView(zoomAt(this.view(), size, factor, [size.width / 2, size.height / 2]));
  }

  zoomIn(): void {
    this.zoomBy(ZOOM_STEP);
  }

  zoomOut(): void {
    this.zoomBy(1 / ZOOM_STEP);
  }

  centerOn(point: Point, scale?: number): void {
    const next = { ...this.view(), cx: point[0], cy: point[1] };
    this.setView(scale ? { ...next, scale } : next);
  }

  frameBox(box: BBox, maxScale?: number, bottomInsetPx = 0): void {
    const size = this.size();
    const framed = frameBBox(box, { width: size.width, height: Math.max(40, size.height - bottomInsetPx) }, 32, maxScale);
    // El centro baja medio inset para que el espacio quede en la parte visible.
    this.setView({ ...framed, cy: framed.cy + bottomInsetPx / (2 * framed.scale) });
  }

  /** Centra una caja del mundo en el minimapa o tras elegirla. */
  setCenter(point: Point): void {
    this.setView({ ...this.view(), cx: point[0], cy: point[1] });
  }

  /** Coordenadas de cliente a metros. */
  toWorld(clientX: number, clientY: number): Point {
    const rect = this.hostElement.nativeElement.getBoundingClientRect();
    return screenToWorld(this.view(), this.size(), [clientX - rect.left, clientY - rect.top]);
  }

  pxPerMeter(): number {
    return this.view().scale;
  }

  cardEnter(): void {
    this.intent.cardEnter();
  }

  cardLeave(): void {
    this.intent.cardLeave();
  }

  /** Cierra la tarjeta ya (clic en el fondo, otro espacio, botón Cerrar). */
  closeCard(): void {
    this.intent.closeNow();
    this.touchState = { openId: null };
  }

  /** Mueve el foco de teclado a un espacio. */
  focusSpace(id: string): void {
    this.activeId.set(id);
    this.focusActive();
  }

  boundsRect(): { left: number; top: number; width: number; height: number } {
    const rect = this.hostElement.nativeElement.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  /* ---- navegador ------------------------------------------------------------ */

  private connectBrowser(): void {
    if (!this.isBrowser) return;
    const host = this.hostElement.nativeElement;
    const measure = (): void => {
      const rect = host.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const previous = this.size();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      if (previous.width === next.width && previous.height === next.height) return;
      this.size.set(next);
      if (!this.fitted) this.fitWhole();
    };
    measure();
    this.resizeObserver = new ResizeObserver(measure);
    this.resizeObserver.observe(host);
    // La rueda con Ctrl hace zoom: el listener no puede ser pasivo.
    this.wheelListener = (event: WheelEvent): void => this.onWheel(event);
    host.addEventListener('wheel', this.wheelListener, { passive: false });
  }

  private disconnect(): void {
    this.resizeObserver?.disconnect();
    if (this.wheelListener) this.hostElement.nativeElement.removeEventListener('wheel', this.wheelListener);
    cancelAnimationFrameSafe(this.hoverFrame);
    this.intent.destroy();
  }

  private fitWhole(): void {
    this.fitted = true;
    const size = this.size();
    this.view.set(frameBBox([0, 0, this.widthM(), this.heightM()], size, 16, 40));
  }

  private setView(next: Viewport): void {
    this.view.set(clampViewport(next, this.size(), [0, 0, this.widthM(), this.heightM()]));
  }

  /* ---- puntero -------------------------------------------------------------- */

  private targetOf(event: Event): { spaceId: string | null; handleId: string | null } {
    const element = event.target instanceof Element ? event.target : null;
    const handle = element?.closest('[data-handle-id]');
    if (handle) return { spaceId: null, handleId: handle.getAttribute('data-handle-id') };
    const space = element?.closest('[data-space-id]');
    return { spaceId: space?.getAttribute('data-space-id') ?? null, handleId: null };
  }

  private localPoint(event: PointerEvent | WheelEvent | MouseEvent): [number, number] {
    const rect = this.hostElement.nativeElement.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'touch') this.touchSeen.set(true);
    this.focusVisible.set(false);
    const [x, y] = this.localPoint(event);
    this.gestures.down(event.pointerId, x, y, event.timeStamp);
    const target = this.targetOf(event);
    this.downTarget = target.spaceId;
    this.downButton = event.button;
    const panGesture = event.button === 1 || this.handTool() || this.interactionMode() === 'view';
    if (this.interactionMode() === 'edit' && !this.gestures.isPinching && !panGesture) {
      this.editDragging = true;
      (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
      this.worldPointer.emit(this.worldEvent('down', event, target));
      return;
    }
    (event.currentTarget as Element).setPointerCapture?.(event.pointerId);
    if (this.gestures.isPinching) this.dragging.set(true);
  }

  private downTarget: string | null = null;
  private downButton = 0;

  protected onPointerMove(event: PointerEvent): void {
    const [x, y] = this.localPoint(event);
    this.lastPointer = { x: event.clientX, y: event.clientY };
    if (this.editDragging) {
      this.worldPointer.emit(this.worldEvent('move', event, this.targetOf(event)));
      return;
    }
    const step = this.gestures.move(event.pointerId, x, y);
    if (step === null) {
      // Sin botón apretado: es un paso del mouse (o un lápiz flotando) → intención de hover.
      if (this.interactionMode() === 'edit') {
        this.worldPointer.emit(this.worldEvent('move', event, this.targetOf(event)));
        return;
      }
      if (event.pointerType === 'mouse' || event.pointerType === 'pen') this.scheduleHover(this.targetOf(event).spaceId, event.clientX, event.clientY);
      return;
    }
    if (step.kind === 'pinch') {
      this.dragging.set(true);
      this.intent.closeNow();
      const size = this.size();
      let next = zoomAt(this.view(), size, step.factor, [step.center.x, step.center.y]);
      next = panBy(next, step.dx, step.dy);
      this.setView(next);
      return;
    }
    if (this.gestures.moved) {
      if (!this.dragging()) {
        this.dragging.set(true);
        this.intent.closeNow();
        this.hoverChange.emit(null);
      }
      this.setView(panBy(this.view(), step.dx, step.dy));
    }
  }

  protected onPointerUp(event: PointerEvent): void {
    (event.currentTarget as Element).releasePointerCapture?.(event.pointerId);
    if (this.editDragging) {
      this.editDragging = false;
      this.worldPointer.emit(this.worldEvent('up', event, this.targetOf(event)));
      this.gestures.up(event.pointerId, event.timeStamp);
      return;
    }
    const { wasTap } = this.gestures.up(event.pointerId, event.timeStamp);
    if (this.gestures.count === 0) this.dragging.set(false);
    if (!wasTap) return;
    const target = this.targetOf(event).spaceId;
    if (event.pointerType === 'touch') {
      this.onTouchTap(target);
      return;
    }
    if (this.interactionMode() === 'edit') return;
    if (this.downButton !== 0) return;
    this.pick.emit(target);
    if (target) this.setActive(target);
    if (target === null) this.intent.closeNow();
  }

  protected onPointerCancel(event: PointerEvent): void {
    if (this.editDragging) {
      this.editDragging = false;
      this.worldPointer.emit(this.worldEvent('cancel', event, { spaceId: null, handleId: null }));
    }
    this.gestures.cancel();
    this.dragging.set(false);
  }

  protected onPointerLeave(): void {
    this.cancelScheduledHover();
    const id = this.hoveredId();
    if (id) this.intent.pointerLeave(id);
    this.hoveredId.set(null);
  }

  private onTouchTap(target: string | null): void {
    const interactive = target !== null && this.fillRows().some((r) => r.s.id === target && r.interactive);
    const { state, outcome } = reduceTouch(this.touchState, interactive ? target : null);
    this.touchState = state;
    switch (outcome.action) {
      case 'open-card':
        this.setActive(outcome.id);
        this.pick.emit(outcome.id);
        this.emitHover(outcome.id, 'touch');
        break;
      case 'open-file':
        this.open.emit(outcome.id);
        break;
      case 'close':
        this.pick.emit(null);
        this.hoverChange.emit(null);
        break;
      case 'none':
        this.pick.emit(null);
        break;
    }
  }

  private scheduleHover(target: string | null, x: number, y: number): void {
    this.pendingHover = { target, x, y };
    if (this.hoverFrame) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const pending = this.pendingHover;
      this.pendingHover = null;
      if (pending) this.applyHover(pending.target);
    });
  }

  private cancelScheduledHover(): void {
    cancelAnimationFrameSafe(this.hoverFrame);
    this.hoverFrame = 0;
    this.pendingHover = null;
  }

  private applyHover(target: string | null): void {
    const interactive = target !== null && this.fillRows().some((r) => r.s.id === target && !r.hiddenByLegend);
    const next = interactive ? target : null;
    const previous = this.hoveredId();
    if (next === previous) return;
    if (previous) this.intent.pointerLeave(previous);
    this.hoveredId.set(next);
    if (next) this.intent.pointerEnter(next);
  }

  private onWheel(event: WheelEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const [x, y] = this.localPoint(event);
    const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
    this.setView(zoomAt(this.view(), this.size(), factor, [x, y]));
  }

  private worldEvent(phase: WorldPointerEvent['phase'], event: PointerEvent, target: { spaceId: string | null; handleId: string | null }): WorldPointerEvent {
    return {
      phase,
      world: this.toWorld(event.clientX, event.clientY),
      targetId: target.spaceId,
      handleId: target.handleId,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey || event.metaKey,
      pointerType: event.pointerType,
      detail: event.detail,
      scale: this.view().scale,
    };
  }

  /* ---- teclado y foco ------------------------------------------------------- */

  protected onKeyDown(event: KeyboardEvent): void {
    this.focusVisible.set(true);
    const key = event.key;
    const ctrl = event.ctrlKey || event.metaKey;
    if (key === 'Escape') {
      this.intent.dismiss();
      this.touchState = { openId: null };
      this.hoverChange.emit(null);
      return;
    }
    if (key === '+' || key === '=') return this.consume(event, () => this.zoomIn());
    if (key === '-' || key === '_') return this.consume(event, () => this.zoomOut());
    if (key === '0') return this.consume(event, () => this.fit());
    if (key === '.') {
      const selected = this.selected();
      return this.consume(event, () => (selected ? this.frameBox(bboxInflate(selected.bbox, 1)) : this.fit()));
    }
    if (key === '/') return this.consume(event, () => this.searchRequested.emit());
    if (key === 'PageDown') return this.consume(event, () => this.floorStep.emit(1));
    if (key === 'PageUp') return this.consume(event, () => this.floorStep.emit(-1));

    const direction = arrowDirection(key);
    if (direction !== null) {
      if (event.altKey || this.interactionMode() === 'edit') {
        const step = 80;
        const dx = direction === 'left' ? step : direction === 'right' ? -step : 0;
        const dy = direction === 'up' ? step : direction === 'down' ? -step : 0;
        return this.consume(event, () => this.setView(panBy(this.view(), dx, dy)));
      }
      const current = this.activeId();
      if (current === null) return;
      const next = nextInDirection(current, direction, this.navItems());
      return this.consume(event, () => {
        if (next === null) return;
        this.setActive(next);
        this.focusActive();
        this.ensureActiveVisible();
      });
    }
    if (key === 'Home' || key === 'End') {
      const order = readingOrder(this.navItems());
      const id = key === 'Home' ? order[0] : order[order.length - 1];
      return this.consume(event, () => {
        if (!id) return;
        this.setActive(id);
        this.focusActive();
        this.ensureActiveVisible();
      });
    }
    if ((key === 'Enter' || key === ' ') && !ctrl) {
      const id = this.targetOf(event).spaceId ?? this.activeId();
      if (id) this.consume(event, () => this.open.emit(id));
    }
  }

  private consume(event: Event, action: () => void): void {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  protected onFocusIn(event: FocusEvent): void {
    const id = this.targetOf(event).spaceId;
    if (id === null) return;
    this.activeId.set(id);
    this.activeChange.emit(id);
    // Solo el foco de teclado abre la tarjeta; un clic ya tiene su propio camino.
    if (this.focusVisible() || this.isKeyboardFocus(event)) {
      this.focusVisible.set(true);
      this.intent.focus(id);
    }
  }

  private isKeyboardFocus(event: FocusEvent): boolean {
    const target = event.target;
    return target instanceof Element && target.matches(':focus-visible');
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.svg()?.nativeElement.contains(next)) return;
    this.intent.blur();
    this.focusVisible.set(false);
  }

  private setActive(id: string): void {
    if (this.activeId() === id) return;
    this.activeId.set(id);
    this.activeChange.emit(id);
  }

  private focusActive(): void {
    const id = this.activeId();
    const svg = this.svg()?.nativeElement;
    if (!id || !svg) return;
    const find = (): SVGElement | null => svg.querySelector<SVGElement>(`[data-space-id="${cssEscape(id)}"][role="button"]`);
    const element = find();
    if (element) {
      element.focus({ preventScroll: true });
      return;
    }
    // Aún no se montó (virtualizado): después del próximo ciclo de cambios.
    queueMicrotask(() => setTimeout(() => find()?.focus({ preventScroll: true }), 0));
  }

  private ensureActiveVisible(): void {
    const space = this.active();
    if (!space) return;
    const next = ensureVisible(this.view(), this.size(), space.bbox, 48);
    if (next !== this.view()) this.setView(next);
  }

  /* ---- tarjeta -------------------------------------------------------------- */

  private onIntent(id: string | null, source: HoverSource | null): void {
    if (id === null || source === null) {
      this.hoverChange.emit(null);
      return;
    }
    this.emitHover(id, source);
  }

  private emitHover(id: string, source: HoverSource | 'touch'): void {
    const hover = this.buildHover(id, source);
    if (hover) this.hoverChange.emit(hover);
  }

  private buildHover(id: string, source: HoverSource | 'touch'): CanvasHover | null {
    const svg = this.svg()?.nativeElement;
    if (!svg) return null;
    const element = svg.querySelector<SVGGraphicsElement>(`[data-space-id="${cssEscape(id)}"]`);
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      spaceId: id,
      source,
      anchor: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      pointer: this.lastPointer,
      bounds: this.boundsRect(),
    };
  }

  private reanchor(): void {
    const id = this.intent.activeId ?? (this.touchState.openId);
    if (!id) return;
    const source: HoverSource | 'touch' = this.touchState.openId === id ? 'touch' : this.focusVisible() ? 'focus' : 'pointer';
    this.emitHover(id, source);
  }

  /** Cuánto mide un espacio en pantalla (para decidir si la tarjeta se ancla al cursor). */
  screenSizeOf(spaceId: string): { width: number; height: number } | null {
    const s = this.byId().get(spaceId);
    if (!s) return null;
    const scale = this.view().scale;
    return { width: (s.bbox[2] - s.bbox[0]) * scale, height: (s.bbox[3] - s.bbox[1]) * scale };
  }

  /** Para el minimapa: ¿dónde queda un punto del mundo en el lienzo? */
  toScreen(point: Point): Point {
    return worldToScreen(this.view(), this.size(), point);
  }

  protected ageText(): string {
    const asOf = this.asOf();
    return asOf ? ageLabel(asOf, this.nowMs() || Date.now()) : '';
  }

  protected layerOn(id: PlanLayerId): boolean {
    return this.layers().has(id);
  }
}

function arrowDirection(key: string): NavDirection | null {
  switch (key) {
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    default:
      return null;
  }
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

function cancelAnimationFrameSafe(handle: number): void {
  if (handle && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle);
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/["\\]/g, '\\$&');
}

/** El nombre del local recortado a lo que cabe: «Consultorio 1 · Medicina general» → «Consultorio 1». */
export function shortName(name: string, maxChars: number): string {
  const head = name.split(' · ')[0]!;
  if (head.length <= maxChars) return head;
  if (maxChars < 4) return '';
  return `${head.slice(0, maxChars - 1).trimEnd()}…`;
}
