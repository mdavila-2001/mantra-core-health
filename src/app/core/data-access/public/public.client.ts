import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** Cómo viaja la proyección: las fechas son texto y pueden ser `null`. */
interface PublicProjectionBody {
  readonly slug: string;
  readonly records: readonly Record<string, unknown>[];
  readonly refreshedAt: string | null;
  readonly generatedAt: string;
}

/**
 * Una proyección pública ya lista para la vista.
 *
 * `refreshedAt` es **el dato que S7 obliga a mostrar**: estas son vistas materializadas, así que lo
 * que se ve puede estar atrasado respecto de la base. `null` significa que la vista nunca se
 * refrescó, que no es lo mismo que «se refrescó recién» y no debe mostrarse como si lo fuera.
 */
export interface PublicProjection {
  readonly slug: string;
  readonly records: readonly Record<string, unknown>[];
  readonly refreshedAt: Date | null;
  /** Momento en que la API armó **esta respuesta**, que no es cuándo se calculó el dato. */
  readonly generatedAt: Date;
}

/**
 * Cliente de las proyecciones públicas (`read_models`, UC-30-10).
 *
 * Es el único módulo de la API que se puede leer **sin sesión**: el controlador está marcado
 * `@Public()` y sirve solo campos de vistas materializadas con `contains_phi = false`. Por eso es
 * lo que la aplicación usa para comprobar de punta a punta que hay API del otro lado sin necesitar
 * credenciales ni arriesgar un dato clínico.
 *
 * `authInterceptor` ya lo trata como público —`/public/` está en su lista—, así que un 401 de acá
 * no dispara ningún refresco.
 */
@Injectable({
  providedIn: 'root',
})
export class PublicClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /public/directory`. Los dos filtros son opcionales y se omiten si no vienen: mandarlos
   * vacíos filtraría por la cadena vacía en vez de no filtrar.
   */
  searchDirectory(filters?: { city?: string; specialty?: string }): Observable<PublicProjection> {
    let params = new HttpParams();
    if (filters?.city !== undefined && filters.city !== '') {
      params = params.set('city', filters.city);
    }
    if (filters?.specialty !== undefined && filters.specialty !== '') {
      params = params.set('specialty', filters.specialty);
    }

    return this.http
      .get<PublicProjectionBody>(apiUrl(this.baseUrl, '/public/directory'), { params })
      .pipe(map(toProjection));
  }
}

function toProjection(body: PublicProjectionBody): PublicProjection {
  return {
    slug: body.slug,
    records: body.records,
    refreshedAt: body.refreshedAt === null ? null : new Date(body.refreshedAt),
    generatedAt: new Date(body.generatedAt),
  };
}
