import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { ContentPack, ContentPackResult } from './content-packs.types';

/**
 * Cliente de los paquetes de contenido (`/admin/content-packs`).
 *
 * Superficie de plataforma, como `/admin/tenants`: aplicar un paquete cambia el
 * catálogo que ve **toda** la instalación, no el de una organización. Por eso
 * ninguna de las dos llamadas manda cabecera de organización — no habría cuál — y
 * la API las reserva a `SUPERADMIN`.
 *
 * Es la contracara de `SEED_CONTENT_ON_BOOT`: lo que el arranque dejó de sembrar
 * solo, entra por acá cuando alguien lo pide.
 */
@Injectable({ providedIn: 'root' })
export class ContentPacksClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /admin/content-packs` — qué se puede aplicar. */
  listPacks(): Observable<readonly ContentPack[]> {
    return this.http
      .get<{ items: readonly ContentPack[] }>(this.url('/admin/content-packs'))
      .pipe(map((body) => body.items));
  }

  /**
   * `POST /admin/content-packs/{code}/apply` — aplica un paquete.
   *
   * Puede tardar: el nomenclador son más de cuatro mil filas. La pantalla tiene
   * que decirlo antes, no dejar el botón mudo.
   *
   * @param code - Código del paquete.
   * @param demoPassword - Contraseña de las cuentas, sólo para `CUENTAS_DEMO`.
   */
  applyPack(code: string, demoPassword?: string): Observable<ContentPackResult> {
    return this.http.post<ContentPackResult>(
      this.url(`/admin/content-packs/${encodeURIComponent(code)}/apply`),
      demoPassword === undefined ? {} : { demoPassword },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
