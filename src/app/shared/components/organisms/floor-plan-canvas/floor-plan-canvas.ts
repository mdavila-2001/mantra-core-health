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
import { buildFillRows, buildHaloRows, buildLabelRows, type FillRow, type LabelRow } from '../../../../core/floor-plan/canvas-rows';
import { keyAction } from '../../../../core/floor-plan/canvas-keys';
import {
  DEFAULT_LAYERS,
  PLAN_LOD_BEDS_MIN_ZOOM,
  PLAN_LOD_GLYPHS_MIN_ZOOM,
  PLAN_LOD_LABELS_MIN_ZOOM,
  PLAN_VIRTUALIZE_MIN_NODES,
  type CanvasHover,
  type CanvasOverlay,
  type FrameRequest,
  type PlanLayerId,
  type RevealRequest,
  type ViewInfo,
  type WorldPointerEvent,
} from '../../../../core/floor-plan/canvas.types';
import { bboxInflate, type BBox, type Point } from '../../../../core/floor-plan/geometry';
import { paintOrder, sortedElements, type ElementView, type SpaceView } from '../../../../core/floor-plan/plan-view';
import {
  clampViewport,
  ensureVisible,
  frameBBox,
  panBy,
  screenToWorld,
  viewBoxOf,
  visibleBBox,
  zoomAt,
  zoomPercent,
  ZOOM_STEP,
  type PixelSize,
  type Viewport,
} from '../../../../core/floor-plan/plan-viewport';
import { GridIndex, defaultCellSize } from '../../../../core/floor-plan/spatial-index';
import { nextInDirection, readingOrder, type NavItem } from '../../../../core/floor-plan/spatial-nav';
import { NO_STATE_VISUAL, stateVisual, type ColorMode, type StateVisual } from '../../../../core/floor-plan/state-visuals';
import { AppButton } from '../../atoms/button/button';
import { PlanGlyphDefs } from './plan-glyph-defs';
import { PlanPointerController, type PointerHost } from './plan-pointer-controller';

/**
 * Lienzo del plano de planta (CONTRATO-PLANO §5.2, §5.5, §5.6 y §5.9): SVG con el
 * `viewBox` en metros. Una capa de rellenos hace de blanco de puntería y de nodo
 * enfocable; muros, aberturas, glifos y rótulos van encima, sin eventos. Puntero
 * y tarjeta: `PlanPointerController`; teclas: `keyAction`; filas: `canvas-rows`.
 * La tarjeta NO se pinta acá: se avisa con `hoverChange` y quien lo usa la dibuja.
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
    // La inversa del zoom (metros por píxel): los rótulos y los glifos se escalan con ella.
    '[style.--u]': 'unit()',
  },
})
export class FloorPlanCanvas {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
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
  private resizeObserver: ResizeObserver | null = null;
  /** Mientras nadie movió la vista, un cambio de tamaño del contenedor vuelve a encuadrar el lienzo entero. */
  private userMoved = false;
  private lastLive = '';
  private lastFrameNonce = -1;
  private lastRevealNonce = -1;
  private wheelListener: ((event: WheelEvent) => void) | null = null;

  /** Lo que el controlador de puntero necesita del lienzo. */
  private readonly pointerHost: PointerHost = {
    interactionMode: () => this.interactionMode(),
    handTool: () => this.handTool(),
    hostRect: () => this.boundsRect(),
    svg: () => this.svg()?.nativeElement ?? null,
    view: () => this.view(),
    size: () => this.size(),
    setView: (view) => this.setView(view),
    isInteractive: (id) => this.fillRows().some((r) => r.s.id === id && r.interactive),
    isHoverable: (id) => this.fillRows().some((r) => r.s.id === id && !r.hiddenByLegend),
    hoveredId: () => this.hoveredId(),
    setHovered: (id) => this.hoveredId.set(id),
    setTouchSeen: () => this.touchSeen.set(true),
    dragging: () => this.dragging(),
    setDragging: (on) => this.dragging.set(on),
    setFocusVisible: (on) => this.focusVisible.set(on),
    focusVisible: () => this.focusVisible(),
    setActive: (id) => this.setActive(id),
    emitPick: (id) => this.pick.emit(id),
    emitOpen: (id) => this.open.emit(id),
    emitHover: (hover) => this.hoverChange.emit(hover),
    emitWorld: (event) => this.worldPointer.emit(event),
  };
  private readonly pointer = new PlanPointerController(this.pointerHost);

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

  private readonly rowContext = computed(() => ({
    ordered: this.ordered(),
    layers: this.layers(),
    lod: this.lod(),
    mounted: this.mountedIds(),
    visual: this.visual,
  }));

  protected readonly fillRows = computed<FillRow[]>(() =>
    buildFillRows({
      ...this.rowContext(),
      hidden: this.hiddenValues(),
      focus: this.focusIds(),
      selectable: this.selectable(),
      asOf: this.asOf() ?? undefined,
      now: this.nowMs() || Date.now(),
      states: this.states(),
      canSeeState: this.canSeeState(),
      colorBy: this.colorBy(),
    }),
  );

  protected readonly labelRows = computed<LabelRow[]>(() => buildLabelRows(this.rowContext()));

  protected readonly haloRows = computed(() => (this.touchSeen() ? buildHaloRows(this.fillRows(), this.lod().scale) : []));

  protected readonly zoneRows = computed(() => this.fillRows().filter((r) => r.s.band === 'zone'));
  protected readonly solidRows = computed(() => this.fillRows().filter((r) => r.s.band !== 'zone'));

  protected readonly circulation = computed(() => (this.layers().has('circulation') ? sortedElements(this.elements(), 'circulation') : []));
  protected readonly verticals = computed(() => (this.layers().has('circulation') ? sortedElements(this.elements(), 'vertical') : []));
  protected readonly walls = computed(() => (this.layers().has('walls') ? sortedElements(this.elements(), 'walls') : []));
  protected readonly openings = computed(() => (this.layers().has('openings') ? sortedElements(this.elements(), 'openings') : []));
  protected readonly annotations = computed(() => (this.layers().has('labels') ? sortedElements(this.elements(), 'labels') : []));
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
      // Si el espacio activo desapareció del DOM (por ejemplo, las camas al alejar el zoom) el foco
      // se habría perdido: vuelve al nuevo espacio activo para que el teclado no quede mudo.
      if (untracked(() => this.focusVisible())) queueMicrotask(() => setTimeout(() => this.focusActive(), 0));
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
        this.userMoved = false;
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
        if (this.pointer.activeIntentId !== null) queueMicrotask(() => this.pointer.reanchor(this.focusVisible()));
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
    this.userMoved = false;
    this.fitWhole();
  }

  zoomBy(factor: number): void {
    const size = this.size();
    this.setView(zoomAt(this.view(), size, factor, [size.width / 2, size.height / 2]));
  }

  /** Desplaza el plano en píxeles (la hoja anclada abajo no debe tapar el espacio elegido). */
  panByPixels(dx: number, dy: number): void { this.setView(panBy(this.view(), dx, dy)); }

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

  cardEnter(): void {
    this.pointer.cardEnter();
  }

  cardLeave(): void {
    this.pointer.cardLeave();
  }

  /** Cierra la tarjeta ya (clic en el fondo, otro espacio, botón Cerrar). */
  closeCard(): void {
    this.pointer.closeCard();
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
      if (!this.userMoved) this.fitWhole();
    };
    measure();
    this.resizeObserver = new ResizeObserver(measure);
    this.resizeObserver.observe(host);
    // La rueda con Ctrl hace zoom: el listener no puede ser pasivo.
    this.wheelListener = (event: WheelEvent): void => this.pointer.onWheel(event);
    host.addEventListener('wheel', this.wheelListener, { passive: false });
  }

  private disconnect(): void {
    this.resizeObserver?.disconnect();
    if (this.wheelListener) this.hostElement.nativeElement.removeEventListener('wheel', this.wheelListener);
    this.pointer.destroy();
  }

  private fitWhole(): void {
    this.view.set(frameBBox([0, 0, this.widthM(), this.heightM()], this.size(), 16, 40));
  }

  private setView(next: Viewport): void {
    this.userMoved = true;
    this.view.set(clampViewport(next, this.size(), [0, 0, this.widthM(), this.heightM()]));
  }

  /* ---- eventos del SVG (delegados al controlador) ---------------------------- */

  protected onPointerDown(event: PointerEvent): void {
    this.pointer.onDown(event);
  }

  protected onPointerMove(event: PointerEvent): void {
    this.pointer.onMove(event);
  }

  protected onPointerUp(event: PointerEvent): void {
    this.pointer.onUp(event);
  }

  protected onPointerCancel(event: PointerEvent): void {
    this.pointer.onCancel(event);
  }

  protected onPointerLeave(): void {
    this.pointer.onLeave();
  }

  /* ---- teclado y foco ------------------------------------------------------- */

  protected onKeyDown(event: KeyboardEvent): void {
    this.focusVisible.set(true);
    const action = keyAction(event, this.interactionMode() === 'edit');
    if (action === null) return;
    if (action.type === 'dismiss') {
      this.pointer.dismiss();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    switch (action.type) {
      case 'zoomIn':
        this.zoomIn();
        break;
      case 'zoomOut':
        this.zoomOut();
        break;
      case 'fit':
        this.fit();
        break;
      case 'frameSelected': {
        const selected = this.selected();
        if (selected) this.frameBox(bboxInflate(selected.bbox, 1));
        else this.fit();
        break;
      }
      case 'search':
        this.searchRequested.emit();
        break;
      case 'floor':
        this.floorStep.emit(action.step);
        break;
      case 'pan':
        this.setView(panBy(this.view(), action.dx, action.dy));
        break;
      case 'move': {
        const current = this.activeId();
        const next = current === null ? null : nextInDirection(current, action.direction, this.navItems());
        if (next !== null) this.goTo(next);
        break;
      }
      case 'edge': {
        const order = readingOrder(this.navItems());
        const id = action.which === 'first' ? order[0] : order[order.length - 1];
        if (id) this.goTo(id);
        break;
      }
      case 'open': {
        const id = this.pointer.targetOf(event).spaceId ?? this.activeId();
        if (id) this.open.emit(id);
        break;
      }
    }
  }

  private goTo(id: string): void {
    this.setActive(id);
    this.focusActive();
    this.ensureActiveVisible();
  }

  protected onFocusIn(event: FocusEvent): void {
    const id = this.pointer.targetOf(event).spaceId;
    if (id === null) return;
    this.activeId.set(id);
    this.activeChange.emit(id);
    // Solo el foco de teclado abre la tarjeta; un clic ya tiene su propio camino.
    const keyboard = event.target instanceof Element && event.target.matches(':focus-visible');
    if (this.focusVisible() || keyboard) {
      this.focusVisible.set(true);
      this.pointer.focus(id);
    }
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.svg()?.nativeElement.contains(next)) return;
    this.pointer.blur();
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
    const selector = `[data-space-id="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id}"][role="button"]`;
    const element = svg.querySelector<SVGElement>(selector);
    if (element) {
      element.focus({ preventScroll: true });
      return;
    }
    // Aún no se montó (virtualizado): después del próximo ciclo de cambios.
    queueMicrotask(() => setTimeout(() => svg.querySelector<SVGElement>(selector)?.focus({ preventScroll: true }), 0));
  }

  private ensureActiveVisible(): void {
    const space = this.active();
    if (!space) return;
    const next = ensureVisible(this.view(), this.size(), space.bbox, 48);
    if (next !== this.view()) this.setView(next);
  }

  /** Cuánto mide un espacio en pantalla (para decidir si la tarjeta se ancla al cursor). */
  screenSizeOf(spaceId: string): { width: number; height: number } | null {
    const s = this.byId().get(spaceId);
    if (!s) return null;
    const scale = this.view().scale;
    return { width: (s.bbox[2] - s.bbox[0]) * scale, height: (s.bbox[3] - s.bbox[1]) * scale };
  }
}

const round = (value: number): number => Math.round(value * 1000) / 1000;
