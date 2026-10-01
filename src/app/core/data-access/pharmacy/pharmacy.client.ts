import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AvailabilityQuery,
  AvailabilityResult,
  CatalogProductPage,
  CatalogProductQuery,
  CatalogRequestCreated,
  CatalogRequestDraft,
  PharmacyCategory,
  PharmacyCategoryPage,
  PharmacyContacts,
  PharmacyDetail,
  PharmacyDirectoryPage,
  PharmacyInventoryLine,
  PharmacyLicensePage,
  PharmacyProduct,
  PharmacyProductChanges,
  PharmacyProductCreated,
  PharmacyProductDraft,
  PharmacyProductSearchPage,
  PharmacyProductSearchQuery,
  PharmacySitePage,
  PharmacySitePrices,
  PharmacySiteQuery,
  PharmacySummary,
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
 * (`/pharmacies/:pharmacyId/products`): el alta, la edición y el retiro que usa
 * la pantalla «Catálogo de productos». La edición (`PATCH`) sólo existe en el
 * simulador por ahora (P47).
 *
 * Los productos no se tipean: se buscan en el **catálogo universal de
 * medicamentos** ({@link searchCatalog}) y se dan de alta por su id.
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
   * `GET /pharmacy/catalog-products` — busca en el catálogo universal de
   * medicamentos (registros sanitarios oficiales).
   *
   * Es de lectura y no depende de la farmacia: el mismo registro lo ven todas.
   * Lo que no tiene registro vigente llega con `selectable: false` y no se puede
   * elegir. Parámetro a parámetro: el backend valida con `forbidNonWhitelisted`.
   */
  searchCatalog(query: CatalogProductQuery = {}): Observable<CatalogProductPage> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(query)) {
      if (valor === undefined || valor === '') {
        continue;
      }
      params = params.set(clave, String(valor));
    }
    return this.http.get<CatalogProductPage>(this.url('/pharmacy/catalog-products'), { params });
  }

  /**
   * `POST /pharmacies/:pharmacyId/catalog-requests` — «no encuentro mi
   * medicamento»: pide que un administrador lo incorpore al catálogo. La
   * farmacia no publica un producto libre.
   */
  requestCatalogEntry(
    pharmacyId: string,
    draft: CatalogRequestDraft,
  ): Observable<CatalogRequestCreated> {
    return this.http.post<CatalogRequestCreated>(
      this.url(`/pharmacies/${encodeURIComponent(pharmacyId)}/catalog-requests`),
      sinVaciosDeSolicitud(draft),
    );
  }

  /**
   * `GET /pharmacy/pharmacies/:id` — el perfil de una farmacia, con sus
   * sedes y direcciones.
   *
   * Carril A (Ola 0, 2026-09-25): lo necesita «Farmacia» para mostrar la
   * ficha de una tienda antes de listar su catálogo.
   */
  getPharmacy(id: string): Observable<PharmacyDetail> {
    return this.http.get<PharmacyDetail>(this.url(`/pharmacy/pharmacies/${id}`));
  }

  /**
   * `GET /pharmacy/pharmacies/:id/licenses` — la carpeta de licencias de la
   * farmacia, con los días hasta el vencimiento ya contados por el servidor.
   * Sólo la ve el personal de la farmacia: para cualquier otro es un 404.
   */
  listLicenses(id: string): Observable<PharmacyLicensePage> {
    return this.http.get<PharmacyLicensePage>(this.url(`/pharmacy/pharmacies/${id}/licenses`));
  }

  /**
   * `GET /pharmacy/pharmacies/:id/contacts` — el representante legal y las
   * gerencias de la organización dueña. Mismo alcance que las licencias.
   */
  getContacts(id: string): Observable<PharmacyContacts> {
    return this.http.get<PharmacyContacts>(this.url(`/pharmacy/pharmacies/${id}/contacts`));
  }

  /**
   * `GET /pharmacy/sites` — las sedes publicadas, sueltas.
   *
   * A diferencia de {@link availability}, no exige productos: es lo que
   * «elegir farmacia» (pestaña Comprar de «Farmacia», 25/09/2026) necesita
   * antes de que la persona haya buscado nada — ver farmacias cercanas o
   * buscar una por nombre.
   */
  nearbySites(query: PharmacySiteQuery = {}): Observable<PharmacySitePage> {
    let params = new HttpParams();
    if (query.search !== undefined && query.search !== '') {
      params = params.set('search', query.search);
    }
    if (query.origin !== undefined) {
      params = params.set('lat', String(query.origin.lat)).set('lng', String(query.origin.lng));
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    return this.http.get<PharmacySitePage>(this.url('/pharmacy/sites'), { params });
  }

  /**
   * `GET /pharmacy/sites/:siteId/prices` — los precios públicos vigentes de
   * una sede.
   *
   * Carril A (Ola 0, 2026-09-25): el catálogo con precio real de la página
   * de farmacia. `productId` acota a un producto puntual; sin él, `product`
   * nunca viaja como clave (el backend valida con `forbidNonWhitelisted`).
   */
  getSitePrices(siteId: string, productId?: string): Observable<PharmacySitePrices> {
    let params = new HttpParams();
    if (productId !== undefined) {
      params = params.set('product', productId);
    }
    return this.http.get<PharmacySitePrices>(this.url(`/pharmacy/sites/${siteId}/prices`), {
      params,
    });
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
   * `PATCH /pharmacies/:pharmacyId/products/:productId` — edita un producto
   * del catálogo: nombre, presentación, precio, categoría, descripción y si
   * hoy lo tiene o no (`inStock`).
   *
   * **Sólo existe en el simulador** (P47): la API real no publica edición de
   * productos. Devuelve el producto como lo lista la búsqueda.
   */
  updateProduct(
    pharmacyId: string,
    productId: string,
    changes: PharmacyProductChanges,
  ): Observable<PharmacyProduct> {
    return this.http.patch<PharmacyProduct>(
      this.url(
        `/pharmacies/${encodeURIComponent(pharmacyId)}/products/${encodeURIComponent(productId)}`,
      ),
      changes,
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

  /** `GET /pharmacies/:id/categories` — las categorías de la farmacia (P47, sólo simulador). */
  listCategories(pharmacyId: string): Observable<PharmacyCategoryPage> {
    return this.http.get<PharmacyCategoryPage>(this.categoriesUrl(pharmacyId));
  }

  /** `POST /pharmacies/:id/categories` — crea una categoría. 409 si el nombre ya existe. */
  createCategory(pharmacyId: string, name: string): Observable<PharmacyCategory> {
    return this.http.post<PharmacyCategory>(this.categoriesUrl(pharmacyId), { name });
  }

  /** `PATCH /pharmacies/:id/categories/:categoryId` — renombra; los productos siguen. */
  renameCategory(
    pharmacyId: string,
    categoryId: string,
    name: string,
  ): Observable<PharmacyCategory> {
    return this.http.patch<PharmacyCategory>(
      `${this.categoriesUrl(pharmacyId)}/${encodeURIComponent(categoryId)}`,
      { name },
    );
  }

  /** `DELETE /pharmacies/:id/categories/:categoryId` — 409 si tiene productos. */
  deleteCategory(pharmacyId: string, categoryId: string): Observable<PharmacyStatusResult> {
    return this.http.delete<PharmacyStatusResult>(
      `${this.categoriesUrl(pharmacyId)}/${encodeURIComponent(categoryId)}`,
    );
  }

  /**
   * `PATCH /pharmacies/:id/inventory` — guarda de una vez las existencias y el
   * umbral de varios productos (P47, sólo simulador).
   */
  updateInventory(
    pharmacyId: string,
    lines: readonly PharmacyInventoryLine[],
  ): Observable<{ readonly updated: number }> {
    return this.http.patch<{ readonly updated: number }>(
      this.url(`/pharmacies/${encodeURIComponent(pharmacyId)}/inventory`),
      { lines },
    );
  }

  /** `GET /pharmacy/pharmacies/:id/summary` — los números del resumen (P47, sólo simulador). */
  getSummary(pharmacyId: string): Observable<PharmacySummary> {
    return this.http.get<PharmacySummary>(
      this.url(`/pharmacy/pharmacies/${encodeURIComponent(pharmacyId)}/summary`),
    );
  }

  private categoriesUrl(pharmacyId: string): string {
    return this.url(`/pharmacies/${encodeURIComponent(pharmacyId)}/categories`);
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

/** La solicitud sin los textos vacíos: `IsOptional` deja pasar un `''` y se guardaría vacío. */
function sinVaciosDeSolicitud(draft: CatalogRequestDraft): CatalogRequestDraft {
  return Object.fromEntries(
    Object.entries(draft).filter(([, valor]) => valor !== undefined && valor !== ''),
  ) as unknown as CatalogRequestDraft;
}
