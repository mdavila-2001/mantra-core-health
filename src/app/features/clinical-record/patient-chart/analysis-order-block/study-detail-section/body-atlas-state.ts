import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID, signal, type Signal } from '@angular/core';

import type { BodyRegionsData } from '../../../../../core/data-access/anatomy-atlas/anatomy-atlas.logic';
import { AnatomyAtlasClient } from '../../../../../core/data-access/anatomy-atlas/anatomy-atlas.client';
import type {
  AnatomyIndex,
  AnatomyLayer,
  AnatomyPart,
} from '../../../../../core/data-access/anatomy-atlas/anatomy-atlas.types';

export interface BodyAtlasState {
  readonly parts: Signal<readonly AnatomyPart[]>;
  readonly index: Signal<AnatomyIndex | null>;
  /** `idle` hasta que alguien pide el catálogo. */
  readonly status: Signal<'idle' | 'loading' | 'ready' | 'error'>;
  /** Los nombres no bajaron: la lista no puede buscar, el cuerpo sigue sirviendo. */
  readonly indexFailed: Signal<boolean>;
  /** De la pieza a la región del catálogo (datos de la API, bajados con el catálogo); `null` mientras bajan o si fallan. */
  readonly regions: Signal<BodyRegionsData | null>;
  readonly modelUrls: Readonly<Record<AnatomyLayer, string>>;
  /** Baja el catálogo (una vez; reintenta tras un fallo). Sólo en el navegador. */
  load(): void;
}

/**
 * El catálogo del atlas 3D para el selector de la parte del cuerpo, **bajo
 * demanda**: no se pide nada hasta `load()` (cuando el estudio elegido es de
 * imagen), y bajo SSR nunca. Las mallas pesan más: las pide el visor, capa por
 * capa, cuando se enciende. Se crea en el contexto de inyección del componente.
 */
export function createBodyAtlasState(): BodyAtlasState {
  const atlas = inject(AnatomyAtlasClient);
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const parts = signal<readonly AnatomyPart[]>([]);
  const index = signal<AnatomyIndex | null>(null);
  const status = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const indexFailed = signal(false);
  const regions = signal<BodyRegionsData | null>(null);

  return {
    parts,
    index,
    status,
    indexFailed,
    regions,
    modelUrls: {
      skeleton: atlas.modelUrl('skeleton.glb'),
      muscles: atlas.modelUrl('muscles.glb'),
      vessels: atlas.modelUrl('vessels.glb'),
      nervous: atlas.modelUrl('nervous.glb'),
      organs: atlas.modelUrl('organs.glb'),
    },
    load(): void {
      if (!browser || status() === 'loading' || status() === 'ready') return;
      status.set('loading');
      indexFailed.set(false);
      atlas.parts().subscribe({
        next: (all) => {
          parts.set(all);
          status.set('ready');
        },
        error: () => status.set('error'),
      });
      // Sin esta tabla la parte marcada no propone región: el médico la elige, que es lo que ya hace hoy.
      void import('../../../../../core/data-access/anatomy-atlas/body-regions.data').then(
        (d) => regions.set({ regions: d.BODY_REGIONS, meshToRegion: d.MESH_TO_REGION, structureToRegion: d.STRUCTURE_TO_REGION }),
        () => regions.set(null),
      );
      atlas.index().subscribe({ next: (all) => index.set(all), error: () => indexFailed.set(true) });
    },
  };
}
