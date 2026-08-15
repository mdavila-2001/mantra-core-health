import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  DiagnosticUnitAdminDetail,
  DiagnosticUnitAdminList,
} from './diagnostic-units-admin.types';

/**
 * Cliente de la consola de administración del laboratorio (módulo 23).
 *
 * ## Por qué no se le agregan dos métodos a `DiagnosticUnitsClient`
 *
 * Aquél es el cliente del **directorio**: lo consume la pantalla que un
 * paciente usa para elegir dónde hacerse un estudio, y todo lo que exponga
 * viaja en el fragmento diferido de esa pantalla. Estas dos lecturas son de
 * administración, exigen `SECURITY_ADMIN` y traen datos que a la vitrina no le
 * corresponden —números de serie, precios de convenios con aseguradoras,
 * permisos de firma del personal—. Separarlos mantiene esa frontera visible en
 * el código y no sólo en el servidor.
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
