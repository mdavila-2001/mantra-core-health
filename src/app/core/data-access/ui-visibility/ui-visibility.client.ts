import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { MyUiVisibility, UiElementDraft, UiElementSyncResult } from './ui-visibility.types';

/**
 * Cliente de la visibilidad de la interfaz (`docs/trabajo/2026-10-31-visibilidad-rbac/CONTRATO.md`).
 *
 * Sólo dos operaciones, las que usa el motor del front:
 *
 * - `GET /me/ui-visibility` — lo que el usuario **no** ve (sólo lo oculto; lo demás es visible).
 * - `POST /admin/ui-visibility/elements/sync` — publica el catálogo que declara el código, idempotente por `key`.
 *
 * **La visibilidad no es autorización.** Esto decide qué se presenta; la API sigue autorizando cada petición.
 */
@Injectable({ providedIn: 'root' })
export class UiVisibilityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Las claves ocultas para la sesión actual (ya resueltas por el servidor, cascada de ancestros incluida). */
  mine(): Observable<MyUiVisibility> {
    return this.http.get<MyUiVisibility>(apiUrl(this.baseUrl, '/me/ui-visibility'));
  }

  /** Sincroniza el catálogo declarado por el código: crea, actualiza y retira por `key`. Rol `SECURITY_ADMIN`. */
  sync(elements: readonly UiElementDraft[]): Observable<UiElementSyncResult> {
    return this.http.post<UiElementSyncResult>(
      apiUrl(this.baseUrl, '/admin/ui-visibility/elements/sync'),
      { elements },
    );
  }
}
