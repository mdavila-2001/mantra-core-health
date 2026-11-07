import { ChangeDetectionStrategy, Component, computed, input, model, output, signal, viewChild } from '@angular/core';

import {
  displayName,
  LAYER_LABELS,
  LAYER_ORDER,
  searchIndex,
} from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.logic';
import type {
  AnatomyIndex,
  AnatomyLayer,
  AnatomyPart,
  AnatomySex,
} from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { Checkbox } from '../../atoms/checkbox/checkbox';
import { AnatomyViewer } from '../anatomy-viewer/anatomy-viewer';
import { SearchField } from '../../molecules/search-field/search-field';
import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';
import {
  highlightedMeshes,
  pickableEntries,
  selectionOfMesh,
  selectionOfStructure,
  sideWords,
  type BodySiteSelection,
} from './body-site-picker.logic';

export type { BodySiteSelection } from './body-site-picker.logic';

const SEX_OPTIONS: readonly SegmentedOption<AnatomySex>[] = [
  { value: 'male', label: 'Hombre' },
  { value: 'female', label: 'Mujer' },
];

/** Las capas que se ofrecen al elegir una parte; las encendidas al entrar. */
const LAYERS: readonly AnatomyLayer[] = LAYER_ORDER;
const DEFAULT_LAYERS: readonly AnatomyLayer[] = ['skeleton', 'organs'];

/** Tope de coincidencias que se calculan; se muestran de a `PAGE`. */
const SEARCH_LIMIT = 200;
const PAGE = 8;

/**
 * **Selector de la parte del cuerpo**: el modelo 3D y una lista con buscador
 * que eligen lo mismo.
 *
 * Es presentacional: no pide nada. Recibe las piezas y el índice del atlas ya
 * leídos (`parts`, `index`) y devuelve una {@link BodySiteSelection} por
 * `[(value)]`: la malla tocada, su estructura (UBERON/FMA), la capa y el lado.
 * Quien lo monta decide cuándo bajar el catálogo —el visor y las mallas son
 * pesados— y qué hace con el lado y con la capa (p. ej. sólo en un hueso se pide
 * su tipo).
 *
 * ## Puntero y teclado eligen lo mismo
 *
 * Tocar una pieza del lienzo y elegirla en la lista pasan por las mismas
 * funciones puras (`body-site-picker.logic.ts`). El lienzo no puede anunciar sus
 * piezas, así que **la lista es el camino accesible**: busca por nombre (en
 * castellano o inglés), se recorre con Tab y el elegido se anuncia en una región
 * viva.
 *
 * ## Sin WebGL
 *
 * El visor avisa por sí mismo si el navegador no dibuja 3D; la lista sigue
 * sirviendo completa.
 */
@Component({
  selector: 'app-body-site-picker',
  imports: [AnatomyViewer, Checkbox, SearchField, SegmentedControl],
  templateUrl: './body-site-picker.html',
  styleUrl: './body-site-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BodySitePicker {
  /** Las piezas del modelo (`catalog/parts.json`). */
  readonly parts = input.required<readonly AnatomyPart[]>();
  /** El índice de estructuras (nombres) para la lista; `null` mientras baja. */
  readonly index = input<AnatomyIndex | null>(null);
  /** Los nombres no bajaron: la lista no puede buscar, el cuerpo sigue sirviendo. */
  readonly indexFailed = input(false);
  readonly modelUrls = input.required<Readonly<Record<AnatomyLayer, string>>>();
  /** El catálogo está bajando, falló o está listo. */
  readonly status = input<'loading' | 'ready' | 'error'>('ready');
  readonly disabled = input(false);
  /** La parte elegida, o `null`. */
  readonly value = model<BodySiteSelection | null>(null);
  /** Pide volver a bajar el catálogo tras un fallo. */
  readonly retry = output<void>();

  private readonly viewer = viewChild(AnatomyViewer);

  protected readonly sexOptions = SEX_OPTIONS;
  protected readonly layerOrder = LAYERS;
  protected readonly layerLabels = LAYER_LABELS;
  protected readonly sex = signal<AnatomySex>('male');
  protected readonly layers = signal<readonly AnatomyLayer[]>(DEFAULT_LAYERS);
  protected readonly query = signal('');
  protected readonly shown = signal(PAGE);

  private readonly pickable = computed(() => pickableEntries(this.index()?.entries ?? []));
  private readonly names = computed(() => new Map((this.index()?.entries ?? []).map((e) => [e[0], e])));

  protected readonly results = computed(() => searchIndex(this.pickable(), this.query(), SEARCH_LIMIT));
  protected readonly resultsShown = computed(() => this.results().slice(0, this.shown()));
  protected readonly highlighted = computed(() => highlightedMeshes(this.parts(), this.value(), this.sex()));

  /** El nombre de la parte elegida: el del índice (castellano) o el de la malla (inglés). */
  protected readonly selectedName = computed(() => {
    const value = this.value();
    if (value === null) return null;
    const entry = this.names().get(value.structureId);
    if (entry !== undefined) return displayName(entry[1], entry[2], value.structureId);
    return this.parts().find((p) => p.meshId === value.meshId)?.labelEn ?? value.structureId;
  });
  protected readonly selectedSide = computed(() => sideWords(this.value()?.side ?? null));
  protected readonly viewerLabel = computed(() => {
    const visibles = this.layers().map((c) => LAYER_LABELS[c].toLowerCase()).join(', ');
    const name = this.selectedName();
    return `Modelo anatómico 3D, cuerpo ${this.sex() === 'female' ? 'femenino' : 'masculino'} de referencia; capas: ${visibles}${name === null ? '' : `. Parte elegida: ${name}`}`;
  });
  protected readonly entryName = (entry: readonly [string, string | null, string, 0 | 1]): string =>
    displayName(entry[1], entry[2], entry[0]);

  protected onPicked(meshId: string | null): void {
    if (this.disabled()) return;
    if (meshId === null) return;
    const selection = selectionOfMesh(this.parts(), meshId);
    if (selection !== null) this.value.set(selection);
  }

  protected chooseStructure(structureId: string): void {
    if (this.disabled()) return;
    const selection = selectionOfStructure(this.parts(), structureId, this.sex(), this.value()?.side ?? null);
    if (selection === null) return;
    this.value.set(selection);
    // Una parte elegida por nombre tiene que verse: se enciende su capa.
    this.layers.update((capas) => (capas.includes(selection.layer) ? capas : LAYER_ORDER.filter((c) => c === selection.layer || capas.includes(c))));
  }

  protected isChosen(structureId: string): boolean {
    return this.value()?.structureId === structureId;
  }

  protected toggleLayer(layer: AnatomyLayer, on: boolean): void {
    this.layers.update((capas) => (on ? LAYER_ORDER.filter((c) => c === layer || capas.includes(c)) : capas.filter((c) => c !== layer)));
  }

  protected chooseSex(sex: AnatomySex): void {
    this.sex.set(sex);
    // Una pieza de un solo cuerpo deja de existir al cambiar: se limpia en vez de dejar un dato que no se ve.
    const value = this.value();
    if (value !== null && !this.parts().some((p) => p.meshId === value.meshId && (p.sex === 'shared' || p.sex === sex))) {
      this.value.set(null);
    }
  }

  protected search(text: string): void {
    this.query.set(text);
    this.shown.set(PAGE);
  }

  protected showMore(): void {
    this.shown.update((n) => n + PAGE);
  }

  protected clear(): void {
    this.value.set(null);
  }

  /** Vuelve a la vista inicial del modelo. */
  resetView(): void {
    this.viewer()?.resetView();
  }
}
