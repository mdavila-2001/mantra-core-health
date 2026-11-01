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
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { AnatomyAtlasClient } from '../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import type {
  AnatomyComposites,
  AnatomyIndex,
  AnatomyIndexEntry,
  AnatomyLayer,
  AnatomyPart,
  AnatomyReference,
  AnatomySex,
  AnatomyStructure,
} from '../../core/data-access/anatomy-atlas/anatomy-atlas.types';
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
import { Pagination } from '../../shared/components/molecules/pagination/pagination';
import { SearchField } from '../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { AnatomyViewer } from '../../shared/components/organisms/anatomy-viewer/anatomy-viewer';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';
import {
  DEFAULT_LAYERS,
  displayName,
  drawnStructures,
  groupRelations,
  LAYER_LABELS,
  LAYER_ORDER,
  meshesOf,
  ontologyUrl,
  pageOf,
  pageRelationGroups,
  relatedMeshes,
  searchIndex,
  sideLabel,
  structureIdsOf,
  structuresWithMesh,
} from './glossary-anatomy-atlas.logic';

/** Tope de coincidencias que se calculan; se muestran de a `PAGE_SIZE.results`. */
const SEARCH_LIMIT = 500;

/** Filas por página en cada lista del panel: el panel no crece con el catálogo. */
const PAGE_SIZE = { results: 8, relations: 10, references: 6, female: 12, femaleMissing: 12 } as const;

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
 * Las mallas son BodyParts3D (CC-BY-SA 2.1 JP) y, para «Mujer», el Human
 * Reference Atlas de HuBMAP (CC BY 4.0); las fichas, UBERON y el FMA
 * (CC-BY 3.0). Nada se completa a mano: lo que la ontología no declara no se
 * muestra, y lo que se tradujo al castellano dice que es una traducción.
 *
 * ## «Mujer»
 *
 * BodyParts3D es un único cuerpo masculino. La vista «Mujer» cambia su pelvis
 * y sus genitales por los del Visible Human Female que publica HuBMAP: pelvis
 * ósea, útero con su cuello, trompas, ovarios y mamas con sus partes,
 * alineados al cuerpo de referencia (`tools/anatomy-atlas-3d/build_female_parts.py`).
 * Músculos, vasos y nervios siguen siendo los de referencia, y la vagina y la
 * vulva no tienen malla libre: la pantalla dice las dos cosas.
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
  protected readonly femaleMissingPage = signal(1);

  protected readonly partsState = signal<ViewState<readonly AnatomyPart[]>>(loading());
  private readonly indexState = signal<ViewState<AnatomyIndex>>(loading());
  /** Sin él, las estructuras compuestas (el pulmón) se tratarían como sin pieza: es sólo un refuerzo, no bloquea. */
  private readonly composites = signal<AnatomyComposites>({});
  protected readonly structureState = signal<ViewState<AnatomyStructure | null> | null>(null);

  protected readonly parts = computed(() => dataOf(this.partsState()) ?? []);
  private readonly index = computed(() => dataOf(this.indexState()));
  private readonly withMesh = computed(() => structuresWithMesh(this.parts(), this.composites()));
  private readonly inCatalog = computed(() => new Set((this.index()?.entries ?? []).map((e) => e[0])));
  private readonly entryById = computed(() => new Map((this.index()?.entries ?? []).map((e) => [e[0], e])));

  protected readonly structure = computed(() => {
    const estado = this.structureState();
    return estado === null ? null : dataOf(estado);
  });

  protected readonly selectedMeshes = computed(() => {
    const id = this.structureId();
    return id === null ? [] : meshesOf(this.parts(), id, this.sex(), this.composites());
  });

  /** La estructura abierta no tiene malla propia pero se dibuja con las de sus partes (el pulmón). */
  protected readonly esCompuesta = computed(() => {
    const id = this.structureId();
    return id !== null && id in this.composites();
  });

  protected readonly relatedMeshIds = computed(() => {
    const ficha = this.structure();
    return ficha === null ? [] : relatedMeshes(this.parts(), ficha, this.sex(), this.composites());
  });

  /** Las estructuras que se están dibujando: con pieza en una capa encendida y visibles para el sexo elegido. */
  private readonly drawn = computed(() => drawnStructures(this.parts(), new Set(this.layers()), this.sex(), this.composites()));

  protected readonly relationGroups = computed(() => {
    const ficha = this.structure();
    return ficha === null ? [] : groupRelations(ficha, this.withMesh(), this.inCatalog(), this.drawn());
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

  /** El catálogo de búsqueda todavía está bajando. */
  protected readonly indexLoading = computed(() => this.indexState().status === 'loading');
  /** El catálogo de búsqueda no se pudo bajar. */
  protected readonly indexFailed = computed(() => this.indexState().status === 'error');

  protected readonly results = computed<AnatomyIndexEntry[]>(() => searchIndex(this.index()?.entries ?? [], this.search(), SEARCH_LIMIT));

  protected readonly resultsShown = computed(() => pageOf(this.results(), this.resultsPage(), PAGE_SIZE.results));

  protected readonly relationRows = computed(() => this.relationGroups().reduce((n, g) => n + g.items.length, 0));
  protected readonly relationGroupsShown = computed(() =>
    pageRelationGroups(this.relationGroups(), this.relationsPage(), PAGE_SIZE.relations),
  );

  protected readonly referencesShown = computed(() =>
    pageOf(this.structure()?.definition?.refs ?? [], this.referencesPage(), PAGE_SIZE.references),
  );

  /**
   * Lo que se ve sólo en «Mujer», para elegirlo sin tocar el lienzo: las
   * estructuras de las piezas femeninas, los órganos que ellas forman (útero,
   * mama) y las estructuras exclusivamente femeninas con pieza.
   */
  protected readonly femaleModel = computed(() => {
    const femeninas = new Set(this.parts().filter((p) => p.sex === 'female').map((p) => p.structureId));
    // Sólo los órganos: las clases genéricas que también quedan formadas sólo
    // por piezas femeninas («conducto», «tubérculo») no ayudan a elegir. Los
    // órganos de HuBMAP que UBERON no trae (la mama izquierda) son `FMA:`.
    const exclusivasIds = new Set(ATLAS_3D_FEMALE_ONLY_IDS);
    const compuestas = Object.entries(this.composites())
      .filter(([id, miembros]) => (exclusivasIds.has(id) || id.startsWith('FMA:')) && miembros.every((m) => femeninas.has(m)))
      .map(([id]) => id);
    const exclusivas = ATLAS_3D_FEMALE_ONLY_IDS.filter((id) => this.entryById().get(id)?.[3] === 1);
    return entriesOf([...femeninas, ...compuestas, ...exclusivas], this.entryById());
  });

  /** Las estructuras exclusivamente femeninas que ninguna malla libre dibuja (la vagina, la vulva). */
  protected readonly femaleMissing = computed(() =>
    entriesOf(
      ATLAS_3D_FEMALE_ONLY_IDS.filter((id) => this.entryById().get(id)?.[3] === 0),
      this.entryById(),
    ),
  );

  protected readonly femaleShown = computed(() => pageOf(this.femaleModel(), this.femalePage(), PAGE_SIZE.female));
  protected readonly femaleMissingShown = computed(() =>
    pageOf(this.femaleMissing(), this.femaleMissingPage(), PAGE_SIZE.femaleMissing),
  );

  protected readonly viewerLabel = computed(() => {
    const visibles = this.layers().map((c) => LAYER_LABELS[c].toLowerCase()).join(', ');
    const ficha = this.structure();
    const foco = ficha === null ? '' : `. Pieza resaltada: ${displayName(ficha.labelEs, ficha.labelEn, ficha.id)}`;
    const cuerpo =
      this.sex() === 'female'
        ? 'vista «Mujer»: pelvis, útero, trompas, ovarios y mamas del cuerpo femenino de referencia (Visible Human Female, HuBMAP) sobre los músculos, vasos y nervios del cuerpo de referencia'
        : 'cuerpo masculino de referencia';
    return `Modelo anatómico 3D, ${cuerpo}; capas: ${visibles}${foco}`;
  });

  private structureRequest: Subscription | null = null;
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
    this.atlas.composites().subscribe({
      next: (compuestas) => this.composites.set(compuestas),
      // Sin el archivo el atlas funciona como antes: las compuestas quedan sin pieza.
      error: () => this.composites.set({}),
    });
    this.loadIndex();

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

    // Y el modelo también: la estructura de la URL —venga de la búsqueda o de
    // un enlace compartido— se ve aunque su capa estuviera apagada.
    effect(() => {
      const id = this.structureId();
      this.parts();
      this.composites();
      untracked(() => {
        if (id !== null) this.showLayersOf(id);
      });
    });
  }

  /**
   * Pide el índice de búsqueda. Pesa unos 480 KB: hasta que llega, la búsqueda
   * no puede responder, y la pantalla lo dice en vez de mostrar «no encontramos».
   */
  private loadIndex(): void {
    this.indexState.set(loading());
    this.atlas.index().subscribe({
      next: (indice) => this.indexState.set(ready(indice)),
      error: (error: unknown) => this.indexState.set(errorToViewState(error)),
    });
  }

  protected retryIndex(): void {
    this.loadIndex();
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

  private revealStructure(): void {
    const titulo = this.fichaTitulo()?.nativeElement;
    if (titulo === undefined) return;
    titulo.focus({ preventScroll: true });
    const panel = this.panel()?.nativeElement;
    if (panel !== undefined && panel.getBoundingClientRect().top < 0) {
      panel.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
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
    const ids = new Set(structureIdsOf(id, this.composites()));
    const suyas = new Set(this.parts().filter((p) => ids.has(p.structureId)).map((p) => p.layer));
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

/** Las filas del índice de estos ids, sin repetir y en orden alfabético castellano. */
function entriesOf(ids: readonly string[], porId: ReadonlyMap<string, AnatomyIndexEntry>): AnatomyIndexEntry[] {
  return [...new Set(ids)]
    .map((id) => porId.get(id))
    .filter((e): e is AnatomyIndexEntry => e !== undefined)
    .sort((a, b) => displayName(a[1], a[2], a[0]).localeCompare(displayName(b[1], b[2], b[0]), 'es'));
}
