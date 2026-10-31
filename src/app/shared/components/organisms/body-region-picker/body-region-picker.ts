import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { forkJoin } from 'rxjs';

import { AnatomyAtlasClient } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import type { AnatomyLayer, AnatomyPart } from '../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';
import { BodyRegionsClient } from '../../../../core/data-access/anatomy-atlas/body-regions.client';
import type {
  BodyRegionCatalogEntry,
  BodyRegionMap,
  ImagingModalityCode,
  Laterality,
} from '../../../../core/data-access/anatomy-atlas/body-regions.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { FormField } from '../../molecules/form-field/form-field';
import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';
import { AnatomyViewer, type AnatomyPick } from '../anatomy-viewer/anatomy-viewer';
import { TreeSelect } from '../tree-select/tree-select';
import {
  afterSelect,
  BODY_REGION_ATTRIBUTION,
  describeRegion,
  EMPTY_BODY_REGION,
  focusFor,
  groupRegions,
  layersFor,
  meshesOf,
  noteOf,
  resolveTouch,
  type BodyRegionValue,
} from './body-region-picker.logic';
import { ViewStateHost } from '../view-state-host/view-state-host';

interface Atlas {
  readonly parts: readonly AnatomyPart[];
  readonly map: BodyRegionMap;
}

const LATERALITY_OPTIONS: readonly SegmentedOption<Laterality | ''>[] = [
  { value: 'IZQ', label: 'Izquierda' },
  { value: 'DER', label: 'Derecha' },
  { value: 'BIL', label: 'Bilateral' },
];

/**
 * Elige la región del cuerpo de un estudio de imagenología: el modelo 3D arriba
 * y, debajo, la lista agrupada por región. Presentacional: no sabe de órdenes
 * ni de la API; recibe el catálogo ya resuelto y emite un valor.
 *
 * ## Una sola fuente de verdad
 *
 * `value` es el único estado. El 3D y la lista se derivan de él con `computed`
 * y sólo lo escriben desde un gesto de la persona (clic en el modelo, elegir en
 * la lista, tocar el lado). No hay `effect` que sincronice: el visor emite
 * `picked` únicamente por un clic real, así que escribir `value` desde la lista
 * no puede volver como un toque, y no hay bucle.
 *
 * ## Camino accesible
 *
 * La lista (`app-tree-select`: diálogo con buscador y teclado completo) es el
 * camino principal y completo; el lienzo es un complemento. Lo que cambia desde
 * el 3D se anuncia en una región viva propia. Las regiones sin malla
 * (contenedora, referencia, ninguna) sólo se eligen desde la lista, con aviso.
 *
 * ## SSR y peso
 *
 * En el servidor no pide nada y el visor es un recuadro; el visor entra con
 * `@defer (on viewport)`. Un picker = un contexto WebGL: montar uno solo.
 */
@Component({
  selector: 'app-body-region-picker',
  imports: [AnatomyViewer, FormField, SegmentedControl, TreeSelect, ViewStateHost],
  templateUrl: './body-region-picker.html',
  styleUrl: './body-region-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BodyRegionPicker {
  /** Regiones del catálogo de imagenología (`imagenologia.json › regiones`). */
  readonly regions = input.required<readonly BodyRegionCatalogEntry[]>();
  /** Regiones que admite el estudio; vacío = todas. */
  readonly allowed = input<readonly string[]>([]);
  /** Modalidad del estudio: decide la capa del modelo. */
  readonly modality = input<ImagingModalityCode | null>(null);
  readonly disabled = input(false);

  /** FUENTE DE VERDAD ÚNICA. */
  readonly value = model<BodyRegionValue>(EMPTY_BODY_REGION);

  private readonly atlasClient = inject(AnatomyAtlasClient);
  private readonly regionsClient = inject(BodyRegionsClient);

  protected readonly atlasState = signal<ViewState<Atlas>>(loading());
  /** Un aviso de lo que pasó al tocar (región no admitida, pieza sin región). */
  protected readonly aviso = signal<string | null>(null);
  protected readonly attribution = BODY_REGION_ATTRIBUTION;
  protected readonly lateralityOptions = LATERALITY_OPTIONS;
  protected readonly modelUrls: Readonly<Record<AnatomyLayer, string>> = {
    skeleton: this.atlasClient.modelUrl('skeleton.glb'),
    muscles: this.atlasClient.modelUrl('muscles.glb'),
    vessels: this.atlasClient.modelUrl('vessels.glb'),
    nervous: this.atlasClient.modelUrl('nervous.glb'),
    organs: this.atlasClient.modelUrl('organs.glb'),
  };

  private readonly atlas = computed(() => dataOf(this.atlasState()));
  protected readonly parts = computed(() => this.atlas()?.parts ?? []);
  private readonly partById = computed(() => new Map(this.parts().map((p) => [p.meshId, p])));
  private readonly catalog = computed(() => new Map(this.regions().map((r) => [r.codigo, r])));
  private readonly allowedSet = computed(() => new Set(this.allowed()));

  private readonly entry = computed(() => this.catalog().get(this.value().region ?? '') ?? null);
  private readonly def = computed(() => this.atlas()?.map.regiones[this.value().region ?? ''] ?? null);
  protected readonly lateral = computed(() => this.entry()?.admite_lateralidad === true);

  protected readonly regionCode = computed(() => this.value().region);
  protected readonly groups = computed(() => groupRegions(this.regions(), this.allowedSet(), this.atlas()?.map ?? null));
  protected readonly lateralityValue = computed(() => this.value().laterality ?? '');

  private readonly meshes = computed(() => meshesOf(this.def(), this.lateral(), this.value().laterality));
  /** Sólo una región con malla propia se marca como «elegida»; las demás, como «relacionadas». */
  protected readonly selected = computed(() => (this.def()?.tipo === 'propia' ? this.meshes() : []));
  protected readonly related = computed(() => (this.def() !== null && this.def()?.tipo !== 'propia' ? this.meshes() : []));
  protected readonly focus = computed(() => focusFor(this.def(), this.lateral(), this.value().laterality));
  protected readonly layers = computed(() => layersFor(this.modality(), this.def()));

  protected readonly note = computed(() => noteOf(this.def(), this.atlas() !== null, this.entry()?.nombre ?? ''));
  protected readonly announcement = computed(
    () => this.aviso() ?? describeRegion(this.value(), this.entry(), this.def(), this.atlas() !== null),
  );
  protected readonly viewerLabel = computed(() => {
    const nombre = this.entry()?.nombre;
    return `Modelo 3D para elegir la región del cuerpo${nombre === undefined ? '' : `; resaltada: ${nombre}`}`;
  });

  /** Rótulo del hover en castellano: la región que se elegiría al tocar la pieza. */
  protected readonly hoverLabel = computed(() => {
    const mapa = this.atlas()?.map;
    const catalogo = this.catalog();
    const partes = this.partById();
    return (meshId: string): string | null => {
      const region = mapa?.regionDeMalla.get(meshId);
      const entrada = region === undefined ? undefined : catalogo.get(region);
      if (entrada === undefined) return null;
      const lado = entrada.admite_lateralidad ? partes.get(meshId)?.side : null;
      return lado === 'left' ? `${entrada.nombre} · izquierda` : lado === 'right' ? `${entrada.nombre} · derecha` : entrada.nombre;
    };
  });

  constructor() {
    // Bajo SSR queda inerte: el mapeo y las piezas sólo se piden en el navegador.
    if (isPlatformBrowser(inject(PLATFORM_ID))) this.load();
  }

  protected load(): void {
    this.atlasState.set(loading());
    forkJoin({ parts: this.atlasClient.parts(), map: this.regionsClient.regions() }).subscribe({
      next: (atlas) => this.atlasState.set(ready(atlas)),
      error: (error: unknown) => this.atlasState.set(errorToViewState(error)),
    });
  }

  /** 3D -> valor. Un clic en el vacío no borra: borrar es una acción de la lista. */
  protected onPicked(toque: AnatomyPick | null): void {
    const atlas = this.atlas();
    if (toque === null || atlas === null || this.disabled()) return;
    const resultado = resolveTouch({
      pick: toque,
      map: atlas.map,
      partById: this.partById(),
      catalog: this.catalog(),
      allowed: this.allowedSet(),
      current: this.value(),
    });
    switch (resultado.kind) {
      case 'chosen':
        this.aviso.set(null);
        this.value.set(resultado.value);
        break;
      case 'not-allowed':
        this.aviso.set(`Este estudio no admite ${this.catalog().get(resultado.region)?.nombre ?? 'esa región'}.`);
        break;
      case 'select-only':
        this.aviso.set('Esa pieza no corresponde a una sola región: elíjala desde la lista.');
        break;
      case 'none':
        this.aviso.set('Esa pieza no corresponde a ninguna región de estudio.');
        break;
    }
  }

  /** Lista -> valor. */
  protected onRegion(region: string | null): void {
    this.aviso.set(null);
    this.value.set(afterSelect(region, this.catalog(), this.value()));
  }

  protected onLaterality(laterality: Laterality | ''): void {
    if (laterality === '' || this.disabled()) return;
    this.aviso.set(null);
    this.value.set({ region: this.value().region, laterality });
  }
}
