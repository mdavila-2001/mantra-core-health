import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AdminOperationResult,
  CreatePriceScheduleInput,
  CreateStudyOfferingInput,
  CreateStudyPriceInput,
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminList,
  DiagnosticUnitVerificationResult,
  PriceScheduleCreated,
  StudyOfferingCreated,
  StudyPriceCreated,
} from './diagnostic-units-admin.types';

/**
 * Cliente de la consola de administración del laboratorio (módulo 23).
 *
 * ## Por qué no se le agregan estos métodos a `DiagnosticUnitsClient`
 *
 * Aquél es el cliente del **directorio**: lo consume la pantalla que un
 * paciente usa para elegir dónde hacerse un estudio, y todo lo que exponga
 * viaja en el fragmento diferido de esa pantalla. Lo de acá es administración,
 * exige `SECURITY_ADMIN` y trae datos que a la vitrina no le corresponden
 * —números de serie, precios de convenios con aseguradoras, permisos de firma
 * del personal—. Separarlos mantiene esa frontera visible en el código y no
 * sólo en el servidor.
 *
 * ## Las escrituras no cuelgan todas de la misma raíz
 *
 * Publicar, ofertar y crear un cronograma cuelgan de la unidad; poner un precio
 * cuelga del cronograma, y cerrar un precio o retirar una oferta cuelgan de la
 * cosa misma. Es la forma que expone la API y se copia tal cual: recolgarlas de
 * `/diagnostic-units/{id}` para que se vean parejas daría rutas que el servidor
 * no atiende.
 */
@Injectable({ providedIn: 'root' })
export class DiagnosticUnitsAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /diagnostic-units/administration` — todas las del tenant.
   *
   * Incluye las que todavía no se publicaron, que son justamente las que el
   * directorio esconde y las que hay que terminar de configurar.
   *
   * @returns Las unidades con sus recuentos y su estado de publicación.
   */
  list(): Observable<DiagnosticUnitAdminList> {
    return this.http.get<DiagnosticUnitAdminList>(
      this.url('/diagnostic-units/administration'),
    );
  }

  /**
   * `GET /diagnostic-units/:id/administration` — la ficha completa.
   *
   * @param id - Unidad que se administra.
   * @returns Sedes, equipamiento, catálogo con precios, legajo y personal.
   */
  getById(id: string): Observable<DiagnosticUnitAdminDetail> {
    return this.http.get<DiagnosticUnitAdminDetail>(
      this.url(`/diagnostic-units/${encodeURIComponent(id)}/administration`),
    );
  }

  /**
   * `POST /diagnostic-units/:id/verify-and-publish` — la publica.
   *
   * Sin cuerpo: la unidad ya declara todo lo que hace falta, y lo que el
   * servidor comprueba —que tenga al menos una sede activa— no es un dato que
   * la pantalla pueda mandar.
   *
   * @param unitId - Unidad que se publica.
   * @returns La unidad con su estado de verificación ya resuelto.
   */
  verifyAndPublish(unitId: string): Observable<DiagnosticUnitVerificationResult> {
    return this.http.post<DiagnosticUnitVerificationResult>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/verify-and-publish`),
      null,
    );
  }

  /**
   * `POST /diagnostic-units/:id/study-offerings` — suma un estudio al catálogo.
   *
   * @param unitId - Unidad que ofrece el estudio.
   * @param body - Código, concepto y nombre visible del estudio.
   * @returns La oferta creada, con su identificador.
   */
  createStudyOffering(
    unitId: string,
    body: CreateStudyOfferingInput,
  ): Observable<StudyOfferingCreated> {
    return this.http.post<StudyOfferingCreated>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/study-offerings`),
      body,
    );
  }

  /**
   * `POST /diagnostic-units/:id/price-schedules` — crea un tarifario.
   *
   * @param unitId - Unidad dueña del tarifario.
   * @param body - Código, vigencia y visibilidad del tarifario.
   * @returns El tarifario creado, con su identificador.
   */
  createPriceSchedule(
    unitId: string,
    body: CreatePriceScheduleInput,
  ): Observable<PriceScheduleCreated> {
    return this.http.post<PriceScheduleCreated>(
      this.url(`/diagnostic-units/${encodeURIComponent(unitId)}/price-schedules`),
      body,
    );
  }

  /**
   * `POST /price-schedules/:id/study-prices` — versiona el precio de un estudio.
   *
   * @param scheduleId - Tarifario al que se le pone el precio.
   * @param body - Oferta e importes, como cadenas numéricas.
   * @returns La versión de precio creada.
   */
  createStudyPrice(
    scheduleId: string,
    body: CreateStudyPriceInput,
  ): Observable<StudyPriceCreated> {
    return this.http.post<StudyPriceCreated>(
      this.url(`/price-schedules/${encodeURIComponent(scheduleId)}/study-prices`),
      body,
    );
  }

  /**
   * `POST /study-prices/:id/close` — cierra una versión de precio vigente.
   *
   * @param priceId - Versión de precio que deja de regir.
   * @returns Si la operación se aplicó.
   */
  closeStudyPrice(priceId: string): Observable<AdminOperationResult> {
    return this.http.post<AdminOperationResult>(
      this.url(`/study-prices/${encodeURIComponent(priceId)}/close`),
      null,
    );
  }

  /**
   * `DELETE /diagnostic-study-offerings/:id` — retira una oferta del catálogo.
   *
   * Es una baja lógica: la oferta queda retirada y deja de ofrecerse, pero sus
   * precios y sus reservas pasadas siguen existiendo.
   *
   * @param offeringId - Oferta que se retira.
   * @returns Si la operación se aplicó.
   */
  deleteStudyOffering(offeringId: string): Observable<AdminOperationResult> {
    return this.http.delete<AdminOperationResult>(
      this.url(`/diagnostic-study-offerings/${encodeURIComponent(offeringId)}`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
