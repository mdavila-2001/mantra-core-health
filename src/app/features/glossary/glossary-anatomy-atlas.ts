import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, Scroll } from '@angular/router';
import { filter, map, type Subscription } from 'rxjs';

import { AnatomyAtlasClient } from '../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import type {
  AnatomyIndex,
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
  AnatomyReference,
  AnatomySex,
  AnatomyStructure,
} from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { GlossaryTerm } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import {
  ATLAS_3D_FEMALE_ONLY_IDS,
  ATLAS_3D_META,
  ATLAS_3D_SOURCES,
} from '../../core/mock/fixtures/anatomy-ontology.generated';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Checkbox } from '../../shared/components/atoms/checkbox/checkbox';
import { Card } from '../../shared/components/molecules/card/card';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { Pagination } from '../../shared/components/molecules/pagination/pagination';
import { AnatomyViewer } from '../../shared/components/organisms/anatomy-viewer/anatomy-viewer';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  DEFAULT_LAYERS,
  displayName,
  groupRelations,
  groupSentences,
  LAYER_LABELS,
  LAYER_ORDER,
  meshesOf,
  missingAspectsLabel,
  normalizeSearch,
  ontologyUrl,
  pageOf,
  pageRelationGroups,
  partVisibleFor,
  relatedMeshes,
  searchIndex,
  sideLabel,
} from './glossary-anatomy-atlas.logic';

/** Tope de coincidencias que se calculan; se muestran de a `PAGE_SIZE.results`. */
const SEARCH_LIMIT = 500;

/** Filas por página en cada lista del panel: el panel no crece con el catálogo. */
const PAGE_SIZE = { results: 8, relations: 10, references: 6, female: 12 } as const;

const SEX_OPTIONS: readonly SegmentedOption<AnatomySex>[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
];

/** El nombre de una región del atlas (las de Netter), por su id. */
const REGION_NAMES: Readonly<Record<string, string>> = {
  R01: 'Cabeza y cuello',
  R02: 'Dorso y médula espinal',
  R03: 'Tórax',
  R04: 'Abdomen',
  R05: 'Pelvis y periné',
  R06: 'Miembro superior',
  R07: 'Miembro inferior',
};

/**
 * Atlas anatómico 3D: el cuerpo, sus piezas y la ficha de cada una.
 *
 * ## De dónde sale lo que se ve
 *
 * Las mallas son BodyParts3D (CC-BY-SA 2.1 JP); las fichas, UBERON y el FMA
 * (CC-BY 3.0). Nada se completa a mano: lo que la ontología no declara no se
 * muestra, y lo que se tradujo al castellano dice que es una traducción.
 *
 * ## «Mujer»
 *
 * No existe un modelo 3D femenino completo con licencia libre: BodyParts3D y
 * Z-Anatomy son un único cuerpo masculino. La vista «Mujer» quita las piezas
 * exclusivas de ese cuerpo y lista las estructuras femeninas como fichas sin
 * pieza. Lo dice en pantalla; no se presenta como un modelo femenino.
 *
 * El estado —sexo y estructura elegida— vive en la URL: una ficha abierta se
 * comparte con un enlace.
 */
@Component({
  selector: 'app-glossary-anatomy-atlas',
  imports: [AnatomyViewer, Card, Checkbox, PageHeader, Pagination, RouterLink, SearchField, SegmentedControl, Tab, Tabs, ViewStateHost],
  templateUrl: './glossary-anatomy-atlas.html',
  styleUrl: './glossary-anatomy-atlas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryAnatomyAtlas {
  private readonly atlas = inject(AnatomyAtlasClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly meta = ATLAS_3D_META;
  protected readonly sources = ATLAS_3D_SOURCES;
  protected readonly sexOptions = SEX_OPTIONS;
  protected readonly layerOrder = LAYER_ORDER;
  protected readonly layerLabels = LAYER_LABELS;
  protected readonly displayName = displayName;
  protected readonly ontologyUrl = ontologyUrl;
  protected readonly missingAspectsLabel = missingAspectsLabel;
  protected readonly modelUrls: Readonly<Record<AnatomyLayer, string>> = {
    skeleton: this.atlas.modelUrl('skeleton.glb'),
    muscles: this.atlas.modelUrl('muscles.glb'),
    vessels: this.atlas.modelUrl('vessels.glb'),
    nervous: this.atlas.modelUrl('nervous.glb'),
    organs: this.atlas.modelUrl('organs.glb'),
  };

  private readonly query = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });
  protected readonly sex = computed<AnatomySex>(() => (this.query().get('sex') === 'female' ? 'female' : 'male'));
  protected readonly structureId = computed(() => this.query().get('structure'));
  /** La entrada de la bibliografía a la que llevó una cita [n]; se resalta (`:target` no se entera de la navegación del router). */
  protected readonly fragment = toSignal(this.route.fragment, { initialValue: this.route.snapshot.fragment });
  /** La malla tocada, para decir de qué lado es. */
  protected readonly meshId = computed(() => this.query().get('mesh'));

  protected readonly layers = signal<readonly AnatomyLayer[]>(DEFAULT_LAYERS);
  protected readonly tab = signal(0);
  protected readonly search = signal('');
  protected readonly pageSize = PAGE_SIZE;
  protected readonly resultsPage = signal(1);
  protected readonly relationsPage = signal(1);
  protected readonly referencesPage = signal(1);
  protected readonly femalePage = signal(1);

  protected readonly partsState = signal<ViewState<readonly AnatomyPart[]>>(loading());
  private readonly indexState = signal<ViewState<AnatomyIndex>>(loading());
  protected readonly structureState = signal<ViewState<AnatomyStructure | null> | null>(null);

  /**
   * La definición que el glosario ya tiene de la estructura abierta, o `null`.
   *
   * Es la misma que se lee en `/glossary`: las definiciones de anatomía del
   * glosario (Wikidata, TA98) en castellano. Sólo se usa si el nombre coincide
   * exactamente con el de la estructura —sin tildes ni mayúsculas—; un parecido
   * no es la misma estructura y no se muestra.
   */
  protected readonly glossaryEntry = signal<GlossaryTerm | null>(null);

  protected readonly parts = computed(() => dataOf(this.partsState()) ?? []);
  private readonly index = computed(() => dataOf(this.indexState()));
  private readonly withMesh = computed(() => new Set(this.parts().map((p) => p.structureId)));
  private readonly inCatalog = computed(() => new Set((this.index()?.entries ?? []).map((e) => e[0])));
  private readonly entryById = computed(() => new Map((this.index()?.entries ?? []).map((e) => [e[0], e])));

  protected readonly structure = computed(() => {
    const estado = this.structureState();
    return estado === null ? null : dataOf(estado);
  });

  protected readonly selectedMeshes = computed(() => {
    const id = this.structureId();
    return id === null ? [] : meshesOf(this.parts(), id, this.sex());
  });

  protected readonly relatedMeshIds = computed(() => {
    const ficha = this.structure();
    return ficha === null ? [] : relatedMeshes(this.parts(), ficha, this.sex());
  });

  /** Las estructuras que se están dibujando: con pieza en una capa encendida y visibles para el sexo elegido. */
  private readonly drawn = computed(() => {
    const capas = new Set(this.layers());
    const sexo = this.sex();
    return new Set(this.parts().filter((p) => capas.has(p.layer) && partVisibleFor(p, sexo)).map((p) => p.structureId));
  });

  protected readonly relationGroups = computed(() => {
    const ficha = this.structure();
    return ficha === null ? [] : groupRelations(ficha, this.withMesh(), this.inCatalog(), this.drawn());
  });

  /** Las frases de la descripción extendida, por aspecto y con sus citas numeradas. */
  protected readonly sentenceGroups = computed(() => {
    const descripcion = this.structure()?.extendedDescription;
    return descripcion?.status === 'described' ? groupSentences(descripcion) : [];
  });

  /** Las láminas de Netter donde aparece la estructura, sin repetir y en orden. */
  protected readonly netterPlates = computed(() => {
    const ficha = this.structure();
    const laminas = [...new Set((ficha?.netter ?? []).flatMap((e) => e.plates))].sort((a, b) => a - b);
    return laminas.length > 0 ? laminas : null;
  });

  protected readonly pickedSide = computed(() => {
    const malla = this.meshId();
    const parte = malla === null ? undefined : this.parts().find((p) => p.meshId === malla);
    return parte === undefined ? null : sideLabel(parte.side);
  });

  protected readonly results = computed<AnatomyIndexEntry[]>(() => searchIndex(this.index()?.entries ?? [], this.search(), SEARCH_LIMIT));

  protected readonly resultsShown = computed(() => pageOf(this.results(), this.resultsPage(), PAGE_SIZE.results));

  protected readonly relationRows = computed(() => this.relationGroups().reduce((n, g) => n + g.items.length, 0));
  protected readonly relationGroupsShown = computed(() =>
    pageRelationGroups(this.relationGroups(), this.relationsPage(), PAGE_SIZE.relations),
  );

  protected readonly referencesShown = computed(() =>
    pageOf(this.structure()?.definition?.refs ?? [], this.referencesPage(), PAGE_SIZE.references),
  );

  protected readonly femaleOnly = computed(() =>
    ATLAS_3D_FEMALE_ONLY_IDS.map((id) => this.entryById().get(id))
      .filter((e): e is AnatomyIndexEntry => e !== undefined)
      .sort((a, b) => displayName(a[1], a[2], a[0]).localeCompare(displayName(b[1], b[2], b[0]), 'es')),
  );

  protected readonly femaleShown = computed(() => pageOf(this.femaleOnly(), this.femalePage(), PAGE_SIZE.female));

  protected readonly viewerLabel = computed(() => {
    const visibles = this.layers().map((c) => LAYER_LABELS[c].toLowerCase()).join(', ');
    const ficha = this.structure();
    const foco = ficha === null ? '' : `. Pieza resaltada: ${displayName(ficha.labelEs, ficha.labelEn, ficha.id)}`;
    const cuerpo =
      this.sex() === 'female'
        ? 'cuerpo masculino de referencia sin sus órganos genitales (vista «Mujer»; no existe un modelo femenino libre)'
        : 'cuerpo masculino de referencia';
    return `Modelo anatómico 3D, ${cuerpo}; capas: ${visibles}${foco}`;
  });

  private structureRequest: Subscription | null = null;
  private glossaryRequest: Subscription | null = null;
  private readonly injector = inject(Injector);
  private readonly panel = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly fichaTitulo = viewChild<ElementRef<HTMLElement>>('fichaTitulo');

  constructor() {
    // Bajo SSR la pantalla queda inerte (esqueleto de carga): el catálogo y el
    // modelo sólo se piden en el navegador, que es donde se van a usar.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    this.atlas.parts().subscribe({
      next: (partes) => this.partsState.set(ready(partes)),
      error: (error: unknown) => this.partsState.set(errorToViewState(error)),
    });
    this.atlas.index().subscribe({
      next: (indice) => this.indexState.set(ready(indice)),
      error: (error: unknown) => this.indexState.set(errorToViewState(error)),
    });

    // Otra búsqueda o otra ficha vuelve a la primera página de sus listas.
    effect(() => {
      this.search();
      untracked(() => this.resultsPage.set(1));
    });
    effect(() => {
      this.structureId();
      untracked(() => {
        this.relationsPage.set(1);
        this.referencesPage.set(1);
      });
    });

    // La ficha sigue a la URL: abrir un enlace compartido abre la misma ficha.
    effect(() => {
      const id = this.structureId();
      untracked(() => this.loadStructure(id));
    });

    // Una cita [n] lleva a su entrada de la bibliografía. El desplazamiento
    // del router (`anchorScrolling`) la deja en el borde superior, debajo de
    // la barra fija, y no le da el foco: se centra y se enfoca acá, después
    // de que el router termine. El evento `Scroll` sale en cada toque, aunque
    // el ancla ya estuviera en la URL (tocar dos veces la misma fuente)...
    // Al volver con «Atrás» a la URL sin ancla, el foco regresa a la cita
    // desde la que se saltó (si no, quedaba en una entrada fuera de la vista).
    this.router.events
      .pipe(
        filter((e): e is Scroll => e instanceof Scroll),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        const ancla = e.anchor ?? '';
        if (ancla.startsWith('atlas3d-fuente-')) {
          setTimeout(() => this.revealSource(ancla), 0);
        } else if (this.citationOrigin !== null) {
          const origen = this.citationOrigin;
          this.citationOrigin = null;
          setTimeout(() => origen.isConnected && origen.focus({ preventScroll: true }), 0);
        }
      });
    // ...y esto cubre el enlace abierto con el ancla, que llega antes que la ficha.
    effect(() => {
      const ancla = this.fragment();
      const ficha = this.structure();
      if (ancla === null || ficha === null || !ancla.startsWith('atlas3d-fuente-')) return;
      untracked(() => setTimeout(() => this.revealSource(ancla), 0));
    });

    // La definición del glosario sigue a la ficha abierta.
    effect(() => {
      const ficha = this.structure();
      untracked(() => this.loadGlossaryEntry(ficha));
    });

    // Y el modelo también: la estructura de la URL —venga de la búsqueda o de
    // un enlace compartido— se ve aunque su capa estuviera apagada.
    effect(() => {
      const id = this.structureId();
      this.parts();
      untracked(() => {
        if (id !== null) this.showLayersOf(id);
      });
    });
  }

  private loadStructure(id: string | null): void {
    this.structureRequest?.unsubscribe();
    if (id === null) {
      this.structureState.set(null);
      return;
    }
    this.structureState.set(loading());
    this.structureRequest = this.atlas
      .structure(id)
      .pipe(map((ficha) => ready(ficha)))
      .subscribe({
        next: (estado) => {
          this.structureState.set(estado);
          // Una ficha recién abierta se ve desde su título y se anuncia:
          // abrirla desde abajo de la lista femenina dejaba el panel scrolleado
          // en la lista y la ficha fuera de la vista.
          afterNextRender(() => this.revealStructure(), { injector: this.injector });
        },
        error: (error: unknown) => this.structureState.set(errorToViewState(error)),
      });
  }

  private loadGlossaryEntry(ficha: AnatomyStructure | null): void {
    this.glossaryRequest?.unsubscribe();
    this.glossaryEntry.set(null);
    const nombres = [ficha?.labelEs, ficha?.labelEn].filter((n): n is string => n !== null && n !== undefined);
    if (nombres.length === 0) return;
    const buscado = nombres.map(normalizeSearch);
    this.glossaryRequest = this.terminology.searchGlossary({ query: nombres[0], limit: 12 }).subscribe({
      // Un fallo del glosario no rompe la ficha: la ficha sigue con lo de UBERON.
      error: () => this.glossaryEntry.set(null),
      next: (pagina) =>
        this.glossaryEntry.set(
          pagina.items.find(
            (t) =>
              t.category?.internalCode === 'glossary-category-anatomy' &&
              t.shortDefinition !== '' &&
              buscado.includes(normalizeSearch(t.display)),
          ) ?? null,
        ),
    });
  }

  private revealStructure(): void {
    const titulo = this.fichaTitulo()?.nativeElement;
    if (titulo === undefined) return;
    titulo.focus({ preventScroll: true });
    const panel = this.panel()?.nativeElement;
    if (panel !== undefined && panel.getBoundingClientRect().top < 0) {
      panel.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }

  /** La cita [n] desde la que se saltó a la bibliografía, para devolverle el foco al volver. */
  private citationOrigin: HTMLElement | null = null;

  protected rememberCitation(event: Event): void {
    this.citationOrigin = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  }

  private revealSource(id: string): void {
    const entrada = this.panel()?.nativeElement.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (entrada === null || entrada === undefined) return;
    entrada.scrollIntoView({ block: 'center' });
    entrada.focus({ preventScroll: true });
  }

  private setQuery(params: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: params, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected chooseSex(sex: AnatomySex): void {
    this.setQuery({ sex: sex === 'female' ? 'female' : null });
  }

  protected toggleLayer(layer: AnatomyLayer, on: boolean): void {
    this.layers.update((capas) => (on ? LAYER_ORDER.filter((c) => c === layer || capas.includes(c)) : capas.filter((c) => c !== layer)));
  }

  protected onPicked(meshId: string | null): void {
    if (meshId === null) {
      this.setQuery({ structure: null, mesh: null });
      return;
    }
    const parte = this.parts().find((p) => p.meshId === meshId);
    if (parte === undefined) return;
    this.tab.set(0);
    this.setQuery({ structure: parte.structureId, mesh: meshId });
  }

  protected openStructure(id: string): void {
    this.tab.set(0);
    this.setQuery({ structure: id, mesh: null });
  }

  /** Enciende las capas donde está la estructura: abrirla desde la búsqueda tiene que mostrarla. */
  private showLayersOf(id: string): void {
    const suyas = new Set(this.parts().filter((p) => p.structureId === id).map((p) => p.layer));
    if (suyas.size === 0) return;
    this.layers.update((capas) => LAYER_ORDER.filter((c) => capas.includes(c) || suyas.has(c)));
  }

  protected clearSelection(): void {
    this.setQuery({ structure: null, mesh: null });
  }

  protected regionName(id: string): string {
    return REGION_NAMES[id] ?? id;
  }

  protected entryHasMesh(entry: AnatomyIndexEntry): boolean {
    return entry[3] === 1;
  }

  /** El enlace de una referencia, si es de un tipo que se puede abrir. */
  protected referenceUrl(ref: AnatomyReference): string | null {
    switch (ref.kind) {
      case 'pmid':
        return `https://pubmed.ncbi.nlm.nih.gov/${ref.value}/`;
      case 'doi':
        return `https://doi.org/${ref.value}`;
      case 'wikipedia':
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(ref.value)}`;
      case 'url':
      case 'curator':
        return ref.value;
      default:
        return null;
    }
  }

  protected referenceLabel(ref: AnatomyReference): string {
    const nombres: Record<AnatomyReference['kind'], string> = {
      pmid: 'PubMed',
      doi: 'DOI',
      isbn: 'ISBN',
      wikipedia: 'Wikipedia (en)',
      url: 'Enlace',
      curator: 'Curador (ORCID)',
      xref: 'Referencia cruzada',
    };
    return `${nombres[ref.kind]}: ${ref.value}`;
  }
}
