import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, map, mergeMap, of, type Subscription } from 'rxjs';

import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type {
  GlossaryNeighborGroup,
  GlossaryNeighborhood,
  GlossaryTermDetail,
} from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { Switch } from '../../shared/components/atoms/switch/switch';
import { EmptyState } from '../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
import { ShareMenu, type ShareFormat } from '../../shared/components/molecules/share-menu/share-menu';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import { ShareService } from '../../shared/utils/share/share.service';
import { mergeFullGroups } from './glossary-clinical-route';
import {
  buildGraphSvg,
  graphDefinitions,
  graphFileName,
  readGraphColors,
  renderGraphPdf,
  renderGraphPng,
} from './glossary-graph.export';
import { layoutTree, type GraphNode, type PlacedNode } from './glossary-graph.layout';
import { buildTermTree, countNodes, GRAPH_GROUP_PAGE } from './glossary-graph.tree';
import { GraphViewport } from './glossary-graph.viewport';
import { GlossaryTermSearch } from './glossary-term-search';

/** Vecinos por grupo en la primera lectura de un término. */
const SAMPLE_PER_GROUP = 8;
/** Lo que se pide al completar un grupo: el máximo que acepta el contrato. */
const FULL_GROUP_LIMIT = 200;
/** Términos cuya definición se lee de una vez al pedir «Mostrar definiciones». */
const DEFINITIONS_BATCH = 30;
/** Lecturas simultáneas al traer definiciones. */
const DEFINITIONS_CONCURRENCY = 4;
/** Términos abiertos que viajan en el enlace compartido. */
const SHARED_EXPANDED_LIMIT = 12;
/** Cuántos cuadros se espera a que el lienzo tenga medida antes de rendirse. */
const FIT_RETRIES = 30;

type GraphMode = 'tree' | 'list';

const MODE_OPTIONS: readonly SegmentedOption<GraphMode>[] = [
  { value: 'tree', label: 'Árbol' },
  { value: 'list', label: 'Lista' },
];

/**
 * El árbol de términos médicos: cada término con su definición y, ramificado,
 * lo que lo rodea —síntomas, enfermedades, estudios, tratamientos, especialidades—
 * y, de cada uno de ésos, lo que lo rodea a su vez.
 *
 * Es el segundo modo de mirar lo mismo que el mapa en columnas
 * (`glossary-network`): las mismas relaciones, los mismos títulos de grupo
 * (`buildClinicalRoute`), pero abiertas **en profundidad**. Un clic en un
 * término lo abre; otro lo cierra. Lo que se abre se pide a la API en ese
 * momento (`glossary-neighborhood`), nunca el catálogo entero.
 *
 * **El árbol no inventa relaciones.** Todo nodo sale del vecindario que la API
 * devolvió; un término no vuelve a aparecer debajo de sí mismo.
 *
 * Tiene dos caras para el mismo dato: el árbol dibujado (con acercar y
 * arrastrar) y una lista anidada, que es la que lee un lector de pantalla y la
 * que cabe cómoda en un celular.
 *
 * Se comparte por enlace (`?focus=…&expand=…`) o como imagen, vector o documento.
 */
@Component({
  selector: 'app-glossary-graph',
  imports: [
    AppButton,
    EmptyState,
    FormField,
    NgTemplateOutlet,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    SegmentedControl,
    ShareMenu,
    Switch,
    ViewStateHost,
  ],
  templateUrl: './glossary-graph.html',
  styleUrl: './glossary-graph.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryGraph {
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly canvas = viewChild<ElementRef<SVGSVGElement>>('canvas');

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly termSearch = new GlossaryTermSearch(this.terminology);

  /** El término central: `?focus=<conceptId>`. */
  protected readonly focusId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('focus') ?? '')),
    { initialValue: this.route.snapshot.queryParamMap.get('focus') ?? '' },
  );

  protected readonly mode = signal<GraphMode>('tree');
  protected readonly showDefinitions = signal(this.route.snapshot.queryParamMap.get('defs') === '1');

  /* ---- lo leído -------------------------------------------------------------- */
  private readonly loaded = signal<ReadonlyMap<string, GlossaryNeighborhood>>(new Map());
  private readonly completed = signal<ReadonlyMap<string, readonly GlossaryNeighborGroup[]>>(new Map());
  protected readonly expanded = signal<ReadonlySet<string>>(new Set());
  private readonly pending = signal<ReadonlySet<string>>(new Set());
  private readonly definitions = signal<ReadonlyMap<string, string>>(new Map());
  private readonly visibleByGroup = signal<ReadonlyMap<string, number>>(new Map());

  /** La lectura del término central: es la que decide si hay pantalla o error. */
  protected readonly rootState = signal<ViewState<true>>(loading());

  /** El vecindario de cada término, con los grupos completados donde se pidió «Ver todos». */
  private readonly neighborhoods = computed<ReadonlyMap<string, GlossaryNeighborhood>>(() => {
    const full = this.completed();
    return new Map(
      [...this.loaded()].map(([id, hood]) => [id, mergeFullGroups(hood, full.get(id) ?? [])] as const),
    );
  });

  protected readonly tree = computed<GraphNode | null>(() =>
    this.focusId() === ''
      ? null
      : buildTermTree({
          rootId: this.focusId(),
          neighborhoods: this.neighborhoods(),
          expanded: this.expanded(),
          loading: this.pending(),
          definitions: this.definitions(),
          visibleByGroup: this.visibleByGroup(),
          showDefinitions: this.showDefinitions(),
        }),
  );
  protected readonly placed = computed(() => {
    const tree = this.tree();
    return tree === null ? null : layoutTree(tree);
  });
  protected readonly counts = computed(() => {
    const tree = this.tree();
    return tree === null ? { terms: 0, groups: 0 } : countNodes(tree);
  });
  /** «7 términos en 1 grupo»: el plural se dice bien. */
  protected readonly summary = computed(() => {
    const { terms, groups } = this.counts();
    return `${terms} ${terms === 1 ? 'término' : 'términos'} en ${groups} ${groups === 1 ? 'grupo' : 'grupos'}.`;
  });
  protected readonly selectedOption = computed<ReferenceOption | null>(() => {
    const focus = this.neighborhoods().get(this.focusId())?.focus;
    return focus === undefined
      ? null
      : { value: focus.conceptId, label: focus.display, ...(focus.category ? { hint: focus.category.name } : {}) };
  });

  /* ---- selección y ficha ----------------------------------------------------- */
  protected readonly selectedId = signal<string | null>(null);
  protected readonly detail = signal<ViewState<GlossaryTermDetail> | null>(null);
  private readonly details = new Map<string, GlossaryTermDetail>();

  /* ---- acercar y arrastrar --------------------------------------------------- */
  protected readonly viewport = new GraphViewport(() => this.canvas()?.nativeElement.getBoundingClientRect());
  /** Hay que ajustar el árbol a la ventana en cuanto el lienzo exista (al abrir un término central). */
  private pendingFit = false;
  /** El componente ya no existe: los reintentos de ajuste se detienen. */
  private destroyed = false;

  /* ---- compartir ------------------------------------------------------------- */
  protected readonly exporting = signal(false);
  protected readonly shareUrl = computed<string | null>(() => {
    const root = this.focusId();
    if (root === '') return null;
    const open = [...this.expanded()].filter((id) => id !== root).slice(0, SHARED_EXPANDED_LIMIT);
    return this.share.linkWith({
      focus: root,
      expand: open.length === 0 ? null : open.join(','),
      defs: this.showDefinitions() ? '1' : null,
    });
  });
  protected readonly shareTitle = computed(
    () => `Árbol de términos · ${this.neighborhoods().get(this.focusId())?.focus.display ?? 'glosario'}`,
  );

  private rootRequest: Subscription | null = null;
  private detailRequest: Subscription | null = null;
  private definitionsRequest: Subscription | null = null;
  private readonly requests = new Set<Subscription>();

  constructor() {
    effect(() => {
      const root = this.focusId();
      untracked(() => this.openRoot(root));
    });

    // El lienzo recién existe después de pintar, y su medida llega un cuadro más
    // tarde: se reintenta hasta que la tenga (ajustar con ancho 0 deja el árbol
    // sin encuadrar y, con la raíz a media altura, el lienzo se ve vacío).
    effect(() => {
      const canvas = this.canvas();
      const placed = this.placed();
      if (!this.pendingFit || canvas === undefined || placed === null) return;
      untracked(() => {
        this.pendingFit = false;
        this.fitWhenReady();
      });
    });

    // El árbol sigue creciendo mientras llegan los vecindarios y las definiciones
    // (sobre todo al abrir un enlace con ramas abiertas): mientras nadie lo haya
    // tocado, se lo vuelve a encuadrar. Un clic de la persona corta esto.
    effect(() => {
      if (this.placed() === null) return;
      untracked(() => {
        if (this.viewport.untouched) this.fitWhenReady();
      });
    });

    // El lienzo cambia de medida mientras se asienta la página (y si se gira el
    // aparato): mientras nadie lo haya movido, el encuadre sigue a su tamaño.
    effect((onCleanup) => {
      const canvas = this.canvas()?.nativeElement;
      if (canvas === undefined || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        if (this.viewport.untouched) this.fit();
      });
      observer.observe(canvas);
      onCleanup(() => observer.disconnect());
    });

    // Con «Mostrar definiciones» se leen las de los términos que se ven.
    effect(() => {
      if (!this.showDefinitions()) return;
      const tree = this.tree();
      if (tree === null) return;
      untracked(() => this.readMissingDefinitions(tree));
    });

    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.rootRequest?.unsubscribe();
      this.detailRequest?.unsubscribe();
      this.definitionsRequest?.unsubscribe();
      this.requests.forEach((request) => request.unsubscribe());
      this.termSearch.dispose();
    });
  }

  /* ---- el término central ---------------------------------------------------- */

  private openRoot(conceptId: string): void {
    this.rootRequest?.unsubscribe();
    this.expanded.set(new Set());
    this.visibleByGroup.set(new Map());
    this.selectedId.set(null);
    this.detail.set(null);
    this.viewport.reset();
    if (conceptId === '') {
      this.rootState.set(loading());
      return;
    }
    this.rootState.set(loading());
    const toOpen = [
      conceptId,
      ...(this.route.snapshot.queryParamMap.get('expand') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id !== '' && id !== conceptId),
    ];
    this.rootRequest = forkJoin(toOpen.map((id) => this.read(id))).subscribe({
      next: () => {
        this.expanded.set(new Set(toOpen.filter((id) => this.loaded().has(id))));
        this.rootState.set(ready(true));
        this.selectedId.set(conceptId);
        this.readDetail(conceptId);
        this.pendingFit = true;
      },
      error: (error: unknown) => this.rootState.set(errorToViewState<true>(error)),
    });
  }

  protected reload(): void {
    this.openRoot(this.focusId());
  }

  /** Lee el vecindario de un término (o lo toma de lo ya leído). */
  private read(conceptId: string) {
    const known = this.loaded().get(conceptId);
    if (known !== undefined) return of(known);
    return this.terminology.readGlossaryNeighborhood(conceptId, { perGroup: SAMPLE_PER_GROUP }).pipe(
      map((hood) => {
        this.loaded.update((current) => new Map(current).set(conceptId, hood));
        return hood;
      }),
    );
  }

  protected focusOn(conceptId: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { focus: conceptId, expand: null },
      queryParamsHandling: 'merge',
    });
  }

  protected choose(option: ReferenceOption | null): void {
    if (option !== null && option.value !== this.focusId()) this.focusOn(option.value);
  }

  /* ---- abrir, cerrar y elegir -------------------------------------------------- */

  /** Un clic en un término: lo elige (para su ficha) y lo abre o lo cierra. */
  protected activate(node: GraphNode): void {
    if (this.viewport.consumeDrag()) return;
    this.viewport.markTouched();
    switch (node.kind) {
      case 'term':
        if (node.conceptId !== undefined) {
          this.select(node.conceptId);
          this.toggle(node.conceptId);
        }
        break;
      case 'more':
        this.showMore(node);
        break;
      case 'group':
        break;
    }
  }

  protected select(conceptId: string): void {
    this.selectedId.set(conceptId);
    this.readDetail(conceptId);
  }

  private toggle(conceptId: string): void {
    if (this.expanded().has(conceptId)) {
      this.expanded.update((current) => {
        const next = new Set(current);
        next.delete(conceptId);
        return next;
      });
      return;
    }
    if (this.loaded().has(conceptId)) {
      this.expanded.update((current) => new Set(current).add(conceptId));
      return;
    }
    this.pending.update((current) => new Set(current).add(conceptId));
    const request = this.read(conceptId).subscribe({
      next: () => {
        this.expanded.update((current) => new Set(current).add(conceptId));
        this.finish(conceptId, request);
      },
      error: () => {
        this.finish(conceptId, request);
        this.toast.show({
          type: 'warning',
          message: 'No pudimos abrir este término. Intente de nuevo en unos segundos.',
        });
      },
    });
    this.requests.add(request);
  }

  private finish(conceptId: string, request: Subscription): void {
    this.pending.update((current) => {
      const next = new Set(current);
      next.delete(conceptId);
      return next;
    });
    this.requests.delete(request);
  }

  /** «+N más» muestra la página siguiente; «Ver todos» pide a la API el resto del grupo. */
  private showMore(node: GraphNode): void {
    const groupKey = node.key.replace(/\/more$/, '');
    this.visibleByGroup.update((current) =>
      new Map(current).set(groupKey, (current.get(groupKey) ?? GRAPH_GROUP_PAGE) + GRAPH_GROUP_PAGE),
    );
    const owner = node.conceptId;
    if (owner === undefined || this.completed().has(owner)) return;
    const hood = this.loaded().get(owner);
    if (hood === undefined) return;
    const incomplete = hood.groups.filter((group) => group.total > group.items.length);
    if (incomplete.length === 0) return;
    const request = forkJoin(
      incomplete.map((group) =>
        this.terminology
          .readGlossaryNeighborhood(owner, {
            type: group.type,
            direction: group.direction,
            offset: 0,
            limit: FULL_GROUP_LIMIT,
          })
          .pipe(map((page) => page.groups)),
      ),
    ).subscribe({
      next: (pages) => {
        this.completed.update((current) => new Map(current).set(owner, pages.flat()));
        this.requests.delete(request);
      },
      error: () => this.requests.delete(request),
    });
    this.requests.add(request);
  }

  /* ---- ficha lateral ----------------------------------------------------------- */

  private readDetail(conceptId: string): void {
    this.detailRequest?.unsubscribe();
    const cached = this.details.get(conceptId);
    if (cached !== undefined) {
      this.detail.set(ready(cached));
      return;
    }
    this.detail.set(loading());
    this.detailRequest = this.terminology.readGlossaryTerm(conceptId).subscribe({
      next: (term) => {
        this.details.set(conceptId, term);
        this.detail.set(ready(term));
      },
      error: (error: unknown) => this.detail.set(errorToViewState<GlossaryTermDetail>(error)),
    });
  }

  protected retryDetail(): void {
    const id = this.selectedId();
    if (id !== null) this.readDetail(id);
  }

  /* ---- definiciones ------------------------------------------------------------ */

  private readMissingDefinitions(tree: GraphNode): void {
    const missing: string[] = [];
    const walk = (node: GraphNode): void => {
      if (
        node.kind === 'term' &&
        node.conceptId !== undefined &&
        node.definition === undefined &&
        !this.definitions().has(node.conceptId) &&
        !missing.includes(node.conceptId)
      ) {
        missing.push(node.conceptId);
      }
      node.children.forEach(walk);
    };
    walk(tree);
    const batch = missing.slice(0, DEFINITIONS_BATCH);
    if (batch.length === 0) return;
    this.definitionsRequest?.unsubscribe();
    this.definitionsRequest = of(...batch)
      .pipe(
        mergeMap(
          (id) =>
            this.terminology
              .readGlossaryNeighborhood(id, { perGroup: 1 })
              .pipe(map((hood) => [id, hood.focus.shortDefinition] as const)),
          DEFINITIONS_CONCURRENCY,
        ),
      )
      .subscribe({
        next: ([id, definition]) =>
          this.definitions.update((current) => new Map(current).set(id, definition)),
        // Un término sin definición legible no frena a los demás.
        error: () => undefined,
      });
  }

  /** Ajusta el árbol entero a la ventana; `false` si el lienzo todavía no tiene medida. */
  protected fit(): boolean {
    const placed = this.placed();
    if (placed === null) return false;
    const root = placed.nodes.find((entry) => entry.depth === 0);
    return this.viewport.fit(placed.width, placed.height, root === undefined ? undefined : root.y + root.height / 2);
  }

  private fitWhenReady(attempt = 0): void {
    if (this.destroyed) return;
    afterNextRender(
      () => {
        if (!this.fit() && attempt < FIT_RETRIES) requestAnimationFrame(() => this.fitWhenReady(attempt + 1));
      },
      { injector: this.injector },
    );
  }

  protected setMode(mode: GraphMode): void {
    this.mode.set(mode);
    // El lienzo estaba oculto: se lo mide recién cuando vuelve a pintarse.
    if (mode === 'tree') this.fitWhenReady();
  }

  /* ---- lo que dice la pantalla ---------------------------------------------------- */

  protected isSelected(node: GraphNode): boolean {
    return node.kind === 'term' && node.conceptId !== undefined && node.conceptId === this.selectedId();
  }

  protected ariaLabelOf(node: GraphNode): string {
    switch (node.kind) {
      case 'group':
        return `${node.label}: ${node.sublabel ?? ''}`;
      case 'more':
        return `${node.label}: mostrar más términos`;
      case 'term': {
        const state = node.loading ? 'abriendo' : node.expanded ? 'abierto, pulse para cerrar' : 'cerrado, pulse para abrir';
        return `${node.label}${node.sublabel ? `, ${node.sublabel}` : ''}, ${state}`;
      }
    }
  }

  protected centerX(entry: PlacedNode): number {
    return entry.node.kind === 'term' ? entry.x + 14 : entry.x + entry.width / 2;
  }

  /* ---- exportar -------------------------------------------------------------------- */

  protected async exportAs(format: ShareFormat): Promise<void> {
    const placed = this.placed();
    const tree = this.tree();
    if (placed === null || tree === null || this.exporting()) return;
    this.exporting.set(true);
    try {
      const title = this.shareTitle();
      const svg = buildGraphSvg(placed, title, readGraphColors(this.host.nativeElement));
      const height = placed.height + 56;
      const width = Math.max(placed.width, 360);
      const name = graphFileName(tree.label, format);
      switch (format) {
        case 'svg':
          this.share.save(new Blob([svg], { type: 'image/svg+xml' }), name);
          break;
        case 'png':
          await this.share.shareFile(await renderGraphPng(svg, width, height), name, title);
          break;
        case 'pdf': {
          const png = await renderGraphPng(svg, width, height);
          await this.share.shareFile(await renderGraphPdf(png, title, graphDefinitions(tree)), name, title);
          break;
        }
      }
    } catch {
      this.toast.show({
        type: 'error',
        message: 'No pudimos preparar el archivo. Intente de nuevo en unos segundos.',
      });
    } finally {
      this.exporting.set(false);
    }
  }
}
