import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import {
  SPECIALTY_SEPARATOR,
  type ImportProceduresBody,
  type ImportProceduresResult,
  type NewServiceCatalogItem,
  type Practice,
  type ProcedureNomenclaturePage,
  type ProcedureNomenclatureQuery,
  type ProcedureSpecialty,
  type ServiceCatalogChanges,
  type ServiceCatalogItem,
  type ServiceCatalogPage,
  type ServiceCatalogQuery,
} from './services-catalog.types';

/**
 * Cliente del catálogo maestro de servicios (`billing.service_catalog`, punto 3
 * del reclamo) y de las prácticas sobre las que se organiza.
 *
 * ## Todo cuelga de la práctica elegida
 *
 * Igual que el mayor contable: ninguna lectura del catálogo responde sin
 * `practiceId`, así que `listPractices` va primero. Se lee `GET /practices`
 * directo —no el cliente de contabilidad, que es otro dominio aunque comparta
 * el mismo endpoint— para que este cliente quede autocontenido.
 */
@Injectable({ providedIn: 'root' })
export class ServicesCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practices` — las prácticas de la organización.
   *
   * El endpoint devuelve el **array pelado**, no una página `{ items }`: eso
   * último era una suposición de este cliente, y con la respuesta real emitía
   * `undefined` y dejaba a la pantalla clavada en el esqueleto.
   */
  listPractices(): Observable<readonly Practice[]> {
    return this.http.get<readonly Practice[]>(this.url('/practices'));
  }

  /**
   * `GET /billing/service-catalog` — una página del catálogo de una práctica.
   *
   * Sin rol de administración: cualquier profesional que arme un presupuesto
   * necesita leer la lista fija de servicios sobre la que cotiza.
   */
  search(practiceId: string, query: ServiceCatalogQuery = {}): Observable<ServiceCatalogPage> {
    // Parámetro a parámetro y no con un objeto: el backend valida con
    // `forbidNonWhitelisted`, así que un opcional presente en `undefined`
    // viajaría como clave declarada y la petición volvería con 400.
    let params = new HttpParams().set('practiceId', practiceId);
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.isActive !== undefined) {
      params = params.set('isActive', String(query.isActive));
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<ServiceCatalogPage>(this.url('/billing/service-catalog'), { params });
  }

  /**
   * `POST /billing/service-catalog` — alta de un servicio nuevo. Sólo
   * `SECURITY_ADMIN`: la lista queda fija y no cada profesional inventando
   * servicios nuevos.
   */
  create(item: NewServiceCatalogItem): Observable<ServiceCatalogItem> {
    return this.http.post<ServiceCatalogItem>(this.url('/billing/service-catalog'), item);
  }

  /**
   * `PATCH /billing/service-catalog/:id` — corrige un servicio de la práctica
   * propia.
   *
   * Es la contracara del alta: aquélla la hace una cuenta administradora, ésta
   * la puede hacer también quien atiende en esa práctica, porque el precio de lo
   * que ofrece es suyo. El alcance lo comprueba el servidor por la vinculación
   * con la práctica; un servicio de otra responde **404**, igual que uno
   * inexistente.
   *
   * Sólo viajan las claves presentes: el cuerpo se arma con las que el llamador
   * puso, sin declarar en `undefined` las que no, porque el backend valida con
   * `forbidNonWhitelisted`.
   */
  update(id: string, cambios: ServiceCatalogChanges): Observable<ServiceCatalogItem> {
    return this.http.patch<ServiceCatalogItem>(
      this.url(`/billing/service-catalog/${encodeURIComponent(id)}`),
      sinIndefinidos(cambios),
    );
  }

  /**
   * `GET /billing/service-catalog/procedure-specialties` — las especialidades
   * del arancel, con su recuento.
   *
   * Se pide **una vez** y permite dibujar el filtro sin traer las 4408
   * entradas del nomenclador.
   *
   * @returns Las especialidades, ordenadas en español por el servidor.
   */
  listProcedureSpecialties(): Observable<readonly ProcedureSpecialty[]> {
    return this.http
      .get<{ readonly items: readonly ProcedureSpecialty[] }>(
        this.url('/billing/service-catalog/procedure-specialties'),
      )
      .pipe(map((body) => body.items));
  }

  /**
   * `GET /billing/service-catalog/procedure-specialties/mine` — las
   * especialidades del arancel que le corresponden al médico autenticado.
   *
   * Puede responder vacío (el médico no tiene especialidad cargada o ninguna
   * coincide con el arancel): quien lo use debe tratarlo como «sin filtro por
   * defecto», no como error.
   */
  listMyProcedureSpecialties(): Observable<readonly ProcedureSpecialty[]> {
    return this.http
      .get<{ readonly items: readonly ProcedureSpecialty[] }>(
        this.url('/billing/service-catalog/procedure-specialties/mine'),
      )
      .pipe(map((body) => body.items));
  }

  /**
   * `POST /billing/service-catalog/import-procedures` — importa en lote al
   * catálogo de una práctica todo lo del arancel que cumpla el filtro.
   *
   * Idempotente. Sólo viajan las claves con valor: el backend valida con
   * `forbidNonWhitelisted`, y además un `q` vacío o una lista vacía se omiten
   * en vez de mandarse, porque «sin filtro» y «filtro vacío» no son lo mismo
   * para el servidor.
   */
  importProcedures(body: ImportProceduresBody): Observable<ImportProceduresResult> {
    const cuerpo = sinIndefinidos({
      practiceId: body.practiceId,
      specialties: body.specialties?.length ? body.specialties : undefined,
      codes: body.codes?.length ? body.codes : undefined,
      q: body.q === '' ? undefined : body.q,
    });
    return this.http.post<ImportProceduresResult>(
      this.url('/billing/service-catalog/import-procedures'),
      cuerpo,
    );
  }

  /**
   * `GET /billing/service-catalog/procedures` — una página del arancel.
   *
   * @param query - Especialidad, texto y cursor.
   * @returns La página, con el cursor de la siguiente.
   */
  searchProcedures(
    query: ProcedureNomenclatureQuery = {},
  ): Observable<ProcedureNomenclaturePage> {
    // Parámetro a parámetro, por lo mismo que en `search`: un opcional en
    // `undefined` viajaría como clave declarada y volvería 400.
    let params = new HttpParams();
    // Varias especialidades viajan unidas con `|` en un solo parámetro.
    const especialidades =
      query.specialties !== undefined
        ? query.specialties.filter((e) => e !== '')
        : query.specialty !== undefined && query.specialty !== ''
          ? [query.specialty]
          : [];
    if (especialidades.length > 0) {
      params = params.set('specialty', especialidades.join(SPECIALTY_SEPARATOR));
    }
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<ProcedureNomenclaturePage>(
      this.url('/billing/service-catalog/procedures'),
      { params },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * Quita las claves sin valor antes de enviar: el backend valida con
 * `forbidNonWhitelisted` y un opcional presente en `undefined` viaja como clave
 * declarada.
 */
function sinIndefinidos<T extends object>(source: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([, valor]) => valor !== undefined));
}
