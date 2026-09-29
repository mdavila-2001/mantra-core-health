import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AvailabilityQuery,
  AvailabilityResult,
  PharmacyDirectoryPage,
  PharmacyProductCreated,
  PharmacyProductDraft,
  PharmacyProductSearchPage,
  PharmacyProductSearchQuery,
  PharmacyStatusResult,
} from './pharmacy.types';

/**
 * Cliente del directorio de farmacias y su disponibilidad (carril E3).
 *
 * Habla con las dos caras de lectura del carril E2 del backend: `/pharmacy`
 * (directorio y búsqueda de productos) y `/pharmacy-inventory` (qué sedes
 * pueden surtir un pedido). Sólo expone lo que la pantalla «Dónde comprar mi
 * receta» consume; el resto del directorio (perfiles, precios por sede) se
 * agrega cuando alguna pantalla lo pida, no antes.
 *
 * Del lado de la escritura sólo el catálogo de la propia farmacia
 * (`/pharmacies/:pharmacyId/products`): el alta y el retiro que usa la pantalla
 * «Catálogo de productos». No hay edición: el backend no publica un `PATCH`.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /pharmacy/pharmacies` — el directorio de farmacias publicadas.
   *
   * Lo pidió el carril de promociones (FAR-I7): una campaña es **de una
   * farmacia**, y su panel necesita saber cuál antes de que se elija un solo
   * producto. La lectura no lleva `@Roles` en el backend porque el filtro real
   * es la publicación, no el rol.
   */
  listPharmacies(): Observable<PharmacyDirectoryPage> {
    return this.http.get<PharmacyDirectoryPage>(this.url('/pharmacy/pharmacies'));
  }

  /**
   * `GET /pharmacy/products` — búsqueda de productos publicados.
   *
   * Es el puente entre la receta y el inventario: la receta trae el
   * medicamento del vademécum (`medicationConceptId`) y esta búsqueda lo
   * resuelve a los productos concretos que las farmacias publican.
   */
  searchProducts(query: PharmacyProductSearchQuery = {}): Observable<PharmacyProductSearchPage> {
    // Parámetro a parámetro y nunca con un objeto: el backend valida con
    // `forbidNonWhitelisted` y un opcional en `undefined` viaja como clave
    // declarada y vuelve 400.
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === '') {
        continue;
      }
      params = params.set(clave, String(valor));
    }
    return this.http.get<PharmacyProductSearchPage>(this.url('/pharmacy/products'), { params });
  }

  /**
   * `GET /pharmacy-inventory/availability` — qué sedes pueden surtir el pedido.
   *
   * El backend ya devuelve las sedes ordenadas: completas primero, después
   * por distancia (si viajó el origen), total y nombre. El origen viaja
   * entero o no viaja: `lat` sin `lng` es un 400 del contrato.
   */
  availability(query: AvailabilityQuery): Observable<AvailabilityResult> {
    let params = new HttpParams().set('products', query.productIds.join(','));
    if (query.origin !== undefined) {
      params = params
        .set('lat', String(query.origin.lat))
        .set('lng', String(query.origin.lng));
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    return this.http.get<AvailabilityResult>(this.url('/pharmacy-inventory/availability'), {
      params,
    });
  }

  /**
   * `POST /pharmacies/:pharmacyId/products` — publica un producto en el
   * catálogo de la farmacia (UC-24-04).
   *
   * El producto nace activo y aparece en `GET /pharmacy/products` en cuanto
   * la respuesta vuelve. Un código repetido en la misma farmacia es un 409
   * (`CONFLICT`); la farmacia no activa, un 412. Quién puede publicar lo
   * decide el `@Roles` del backend, no esta pantalla.
   */
  publishProduct(
    pharmacyId: string,
    draft: PharmacyProductDraft,
  ): Observable<PharmacyProductCreated> {
    return this.http.post<PharmacyProductCreated>(
      this.url(`/pharmacies/${encodeURIComponent(pharmacyId)}/products`),
      sinVacios(draft),
    );
  }

  /**
   * `DELETE /pharmacies/:pharmacyId/products/:productId` — retira el producto
   * del catálogo (UC-24-09). Es un borrado lógico: el producto deja de
   * publicarse y sus precios vigentes quedan reemplazados.
   */
  retireProduct(pharmacyId: string, productId: string): Observable<PharmacyStatusResult> {
    return this.http.delete<PharmacyStatusResult>(
      this.url(
        `/pharmacies/${encodeURIComponent(pharmacyId)}/products/${encodeURIComponent(productId)}`,
      ),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * El alta sin sus opcionales vacíos. `IsOptional` sólo salta `null` y
 * `undefined`: un `''` pasa `IsString` y `MaxLength` y se **guarda** como
 * marca o genérico vacío, que en el catálogo se lee como un producto sin
 * nombre. Una lista de identificadores vacía tampoco dice nada.
 */
function sinVacios(draft: PharmacyProductDraft): PharmacyProductDraft {
  const limpio: Record<string, unknown> = {};
  for (const [clave, valor] of Object.entries(draft)) {
    if (valor === undefined || valor === '') {
      continue;
    }
    if (Array.isArray(valor) && valor.length === 0) {
      continue;
    }
    limpio[clave] = valor;
  }
  return limpio as unknown as PharmacyProductDraft;
}
