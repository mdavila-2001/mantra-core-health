import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, shareReplay, type Observable } from 'rxjs';

import { ANATOMY_ATLAS_BASE } from './anatomy-atlas.client';
import type { BodyRegionMap, BodyRegionMesh, BodyRegionsFile } from './body-regions.types';

/** Resuelve las posiciones de la tabla de mallas a ids. Puro, para probarlo sin red. */
export function expandBodyRegions(archivo: BodyRegionsFile): BodyRegionMap {
  const id = (i: number): string => {
    const malla = archivo.mallas[i];
    if (malla === undefined) throw new Error(`body-regions: posición de malla fuera de la tabla (${i})`);
    return malla;
  };
  const ids = (lista: readonly number[]): readonly string[] => lista.map(id);
  const regiones: Record<string, BodyRegionMesh> = {};
  for (const [codigo, r] of Object.entries(archivo.regiones)) {
    regiones[codigo] = {
      tipo: r.tipo,
      tocar: r.tocar,
      capa: r.capa,
      capas: r.capas,
      izq: ids(r.izq),
      der: ids(r.der),
      centro: ids(r.centro),
      encuadre: r.encuadre
        ? { modo: r.encuadre.modo, izq: r.encuadre.izq.map(ids), der: r.encuadre.der.map(ids), caja: r.encuadre.caja }
        : null,
    };
  }
  const regionDeMalla = new Map<string, string>();
  for (const [region, lista] of Object.entries(archivo.toque)) for (const i of lista) regionDeMalla.set(id(i), region);
  return { regiones, regionDeMalla };
}

/**
 * Lee el mapeo región -> mallas. Un pedido por sesión; un fallo no queda
 * guardado, así que el siguiente intento vuelve a la red.
 */
@Injectable({ providedIn: 'root' })
export class BodyRegionsClient {
  private readonly http = inject(HttpClient);
  private pedido: Observable<BodyRegionMap> | null = null;

  regions(): Observable<BodyRegionMap> {
    if (this.pedido === null) {
      const nuevo = this.http.get<BodyRegionsFile>(`${ANATOMY_ATLAS_BASE}/catalog/body-regions.json`).pipe(
        map(expandBodyRegions),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.pedido = nuevo;
      nuevo.subscribe({
        error: () => {
          if (this.pedido === nuevo) this.pedido = null;
        },
      });
    }
    return this.pedido;
  }
}
