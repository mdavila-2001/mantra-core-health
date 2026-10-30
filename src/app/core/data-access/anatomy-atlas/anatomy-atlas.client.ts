import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, shareReplay, type Observable } from 'rxjs';

import type { AnatomyComposites, AnatomyIndex, AnatomyPart, AnatomyStructure } from './anatomy-atlas.types';

/** Dónde publica el generador el catálogo y las mallas, en el mismo origen. */
export const ANATOMY_ATLAS_BASE = '/anatomy-atlas-3d';

/** FNV-1a de 32 bits; el mismo cálculo que `shardDe` del generador. */
export function anatomyShardOf(id: string, shards: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % shards;
}

/**
 * Lee el catálogo del atlas 3D: las piezas del modelo, el índice y las fichas.
 *
 * Cada archivo se pide una vez por sesión (`shareReplay`); un shard se baja
 * sólo cuando se abre una ficha que vive en él. Las rutas llevan extensión, así
 * que el interceptor de la maqueta las deja pasar al servidor de estáticos.
 */
@Injectable({ providedIn: 'root' })
export class AnatomyAtlasClient {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<unknown>>();

  private once<T>(path: string): Observable<T> {
    let pedido = this.cache.get(path);
    if (pedido === undefined) {
      pedido = this.http.get<T>(`${ANATOMY_ATLAS_BASE}/${path}`).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.cache.set(path, pedido);
      // Un fallo no queda guardado: el siguiente intento vuelve a pedir.
      pedido.subscribe({ error: () => this.cache.delete(path) });
    }
    return pedido as Observable<T>;
  }

  parts(): Observable<readonly AnatomyPart[]> {
    return this.once<readonly AnatomyPart[]>('catalog/parts.json');
  }

  /** Qué partes con malla tiene cada estructura compuesta (el pulmón, por sus lóbulos). */
  composites(): Observable<AnatomyComposites> {
    return this.once<AnatomyComposites>('catalog/composites.json');
  }

  index(): Observable<AnatomyIndex> {
    return this.once<AnatomyIndex>('catalog/index.json');
  }

  /** La ficha de una estructura, o `null` si el catálogo no la tiene. */
  structure(id: string, shards = 32): Observable<AnatomyStructure | null> {
    const shard = String(anatomyShardOf(id, shards)).padStart(2, '0');
    return this.once<Readonly<Record<string, AnatomyStructure>>>(`catalog/structures-${shard}.json`).pipe(
      map((contenido) => contenido[id] ?? null),
    );
  }

  /** La URL del GLB de una capa. */
  modelUrl(file: string): string {
    return `${ANATOMY_ATLAS_BASE}/models/${file}`;
  }
}
