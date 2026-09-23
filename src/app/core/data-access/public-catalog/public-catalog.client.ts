import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PublicPage } from '../public-directory/public-directory.types';
import type {
  PublicBranchAvailability,
  PublicGeoPoint,
  PublicOfferedService,
  PublicPharmacyBranch,
  PublicPharmacyProduct,
} from './public-catalog.types';

/** La envoltura de página tal como viaja: el instante todavía es texto. */
interface WirePage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly totalHint: number | null;
  readonly generatedAt: string;
}

/**
 * Lo que una clínica y una farmacia **ofrecen**, para su ficha dentro del
 * panel.
 *
 * ## Por qué es un cliente aparte de `PublicDirectoryClient`
 *
 * Por lo mismo que aquél está separado de `CommunityClient`: no es otra ruta
 * de la misma superficie, es otra superficie. `PublicDirectoryClient` es la
 * transcripción de un contrato que la API ya publica; esto son las dos
 * lecturas que **todavía no publica** (P30 y P31 de `PENDIENTES-BACKEND.md`).
 * Tenerlas juntas haría que un archivo que se compara línea a línea contra el
 * contrato dejara de poder compararse.
 *
 * ## Qué sirve y qué no
 *
 * Sólo lectura, y sólo lo que hace falta para mirar la oferta antes de ir:
 * nombre, qué incluye y a cuánto. **No hay reserva, carrito ni edición de
 * precio** — el precio lo fija su dueño en «Mis servicios» o en el catálogo de
 * su farmacia, y esta pantalla no es de ellos.
 */
@Injectable({ providedIn: 'root' })
export class PublicCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /public/profiles/o/:slug/services` — el catálogo de una organización.
   *
   * Cuelga de `/public/profiles/…` y no de `/o/:slug/services` por el mismo
   * motivo que `getProfile`: `/o` es **también** una ruta del router, y el
   * proxy de desarrollo enruta comparando el comienzo de la ruta. Ver el
   * JSDoc de `PublicDirectoryClient.getProfile`.
   */
  organizationServices(
    slug: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicPage<PublicOfferedService>> {
    return this.getPage<PublicOfferedService>(
      `/public/profiles/o/${encodeURIComponent(slug)}/services`,
      opciones,
    );
  }

  /** `GET /public/profiles/f/:slug/products` — el catálogo de una farmacia. */
  pharmacyProducts(
    slug: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicPage<PublicPharmacyProduct>> {
    return this.getPage<PublicPharmacyProduct>(
      `/public/profiles/f/${encodeURIComponent(slug)}/products`,
      opciones,
    );
  }

  /**
   * `GET /public/profiles/f/:slug/branches` — las sucursales de la cadena a la
   * que pertenece esta farmacia, **con ella adentro**.
   *
   * La farmacia que no pertenece a ninguna cadena devuelve una sola: ella. Es
   * la respuesta honesta —«ésta es la única»— y evita que la sección tenga que
   * adivinar la diferencia entre «no tiene sucursales» y «falló la lectura».
   */
  pharmacyBranches(slug: string): Observable<PublicPage<PublicPharmacyBranch>> {
    return this.getPage<PublicPharmacyBranch>(
      `/public/profiles/f/${encodeURIComponent(slug)}/branches`,
      {},
    );
  }

  /**
   * `GET /public/profiles/f/:slug/branch-availability` — qué sucursal tiene lo
   * de una receta, y a cuánto.
   *
   * Los renglones viajan como **texto**, que es lo que una persona tiene en la
   * mano: una receta en papel no trae ids de producto. El punto de origen es
   * opcional —sin él no hay distancias, pero la búsqueda sirve igual— y va en
   * la consulta y no en el cuerpo porque esto es una lectura.
   *
   * El orden lo decide el servidor: primero las que tienen todo, y entre ésas
   * la más cercana. La pantalla no reordena, para que las dos superficies digan
   * lo mismo.
   */
  prescriptionAvailability(
    slug: string,
    renglones: readonly string[],
    origen: PublicGeoPoint | null = null,
  ): Observable<readonly PublicBranchAvailability[]> {
    let params = new HttpParams().set('items', renglones.join('|'));
    if (origen !== null) {
      params = params.set('lat', String(origen.lat)).set('lng', String(origen.lng));
    }
    return this.http
      .get<{ readonly items: readonly PublicBranchAvailability[] }>(
        apiUrl(this.baseUrl, `/public/profiles/f/${encodeURIComponent(slug)}/branch-availability`),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  private getPage<T>(
    path: string,
    opciones: { cursor?: string; limit?: number },
  ): Observable<PublicPage<T>> {
    let params = new HttpParams();
    if (opciones.cursor !== undefined && opciones.cursor !== '') {
      params = params.set('cursor', opciones.cursor);
    }
    if (opciones.limit !== undefined) {
      params = params.set('limit', String(opciones.limit));
    }
    return this.http
      .get<WirePage<T>>(apiUrl(this.baseUrl, path), { params })
      .pipe(
        map((body) => ({
          items: body.items,
          nextCursor: body.nextCursor,
          totalHint: body.totalHint,
          generatedAt: new Date(body.generatedAt),
        })),
      );
  }
}
