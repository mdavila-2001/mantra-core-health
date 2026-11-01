import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from '../admin-portal/admin-portal.wire';
import type {
  UiElement,
  UiElementDraft,
  UiElementKind,
  UiElementStatus,
  UiElementSyncResult,
  UiPreview,
  UiRuleCreate,
  UiRuleSubjectType,
  UiRuleUpdate,
  UiVisibilityPage,
  UiVisibilityRule,
} from './ui-visibility.types';

/** Filtros de `GET /admin/ui-visibility/elements`. Las claves vacías no viajan. */
export interface UiElementQuery {
  readonly module?: string;
  readonly kind?: UiElementKind;
  readonly q?: string;
  readonly status?: UiElementStatus;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Filtros de `GET /admin/ui-visibility/rules`. `active` sólo viaja si se decide. */
export interface UiRuleQuery {
  readonly elementKey?: string;
  readonly subjectType?: UiRuleSubjectType;
  readonly subjectId?: string;
  readonly active?: boolean;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Cliente admin de la visibilidad de la interfaz (docs/trabajo/2026-10-31-visibilidad-rbac/CONTRATO.md).
 *
 * **La visibilidad no es autorización.** Estas llamadas deciden qué se *presenta*; la API autoriza
 * cada petición y responde 403 a quien no sea `SECURITY_ADMIN` (o `SUPERADMIN`). Las reglas no se
 * borran: se terminan.
 *
 * Errores estables que el contrato promete (el cuerpo trae el código en `code` o en `reason`):
 * `UI_ELEMENT_NOT_FOUND` (404), `UI_ELEMENT_RETIRED` (409), `UI_RULE_VERSION_MISMATCH` (409),
 * `UI_RULE_DUPLICATE` (409), `UI_RULE_INVALID_SUBJECT` (422). Los que agrega el módulo de la API
 * (`UI_RULE_PROTECTED_ELEMENT`, `UI_RULE_NOT_FOUND`, `UI_RULE_ENDED`, `UI_RULE_IF_MATCH_REQUIRED`…) los traduce
 * `features/admin/portal/visibility/visibility-labels.ts`.
 */
@Injectable({ providedIn: 'root' })
export class UiVisibilityAdminClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Cada llamada escribe su ruta entera (`/admin/ui-visibility/…`): así la leen los gates que cruzan
   * los clientes con el proxy y con los simuladores (`check-client-prefixes`, `check-mock-vs-client`).
   */
  private url(path: `/admin/ui-visibility/${string}`): string {
    return apiUrl(this.baseUrl, path);
  }

  listElements(query: UiElementQuery = {}): Observable<UiVisibilityPage<UiElement>> {
    return this.http.get<UiVisibilityPage<UiElement>>(this.url('/admin/ui-visibility/elements'), {
      params: queryParams({ ...query }),
    });
  }

  /** Alta manual: el servidor la registra con `source = ADMIN`. */
  createElement(draft: UiElementDraft): Observable<UiElement> {
    return this.http.post<UiElement>(this.url('/admin/ui-visibility/elements'), draft);
  }

  /** Sincroniza lo que el front declara. Idempotente por `key`: repetirlo no duplica nada. */
  syncElements(elements: readonly UiElementDraft[]): Observable<UiElementSyncResult> {
    return this.http.post<UiElementSyncResult>(this.url('/admin/ui-visibility/elements/sync'), { elements });
  }

  listRules(query: UiRuleQuery = {}): Observable<UiVisibilityPage<UiVisibilityRule>> {
    return this.http.get<UiVisibilityPage<UiVisibilityRule>>(this.url('/admin/ui-visibility/rules'), {
      params: queryParams({ ...query }),
    });
  }

  createRule(body: UiRuleCreate): Observable<UiVisibilityRule> {
    return this.http.post<UiVisibilityRule>(this.url('/admin/ui-visibility/rules'), body);
  }

  /** Bloqueo optimista: `If-Match` lleva la versión que la persona vio; otra distinta es 409. */
  updateRule(id: string, body: UiRuleUpdate, version: number): Observable<UiVisibilityRule> {
    return this.http.patch<UiVisibilityRule>(this.url(`/admin/ui-visibility/rules/${encodeURIComponent(id)}`), body, {
      headers: new HttpHeaders({ 'If-Match': String(version) }),
    });
  }

  /** Termina la regla (`validTo = ahora`): queda en la auditoría, no se borra. */
  endRule(id: string): Observable<UiVisibilityRule> {
    return this.http.post<UiVisibilityRule>(this.url(`/admin/ui-visibility/rules/${encodeURIComponent(id)}/end`), {});
  }

  /** «Ver como» una persona: qué le queda oculto y qué regla lo decide. */
  previewForUser(userId: string): Observable<UiPreview> {
    return this.http.get<UiPreview>(this.url('/admin/ui-visibility/preview'), { params: queryParams({ userId }) });
  }

  /** «Ver como» un rol (código, p. ej. `DPO`). */
  previewForRole(roleCode: string): Observable<UiPreview> {
    return this.http.get<UiPreview>(this.url('/admin/ui-visibility/preview'), { params: queryParams({ roleCode }) });
  }
}
