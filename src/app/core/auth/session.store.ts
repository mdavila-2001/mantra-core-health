import { computed, Injectable, signal } from '@angular/core';

import { decodeAccessToken, type AccessTokenClaims } from './access-token';

/** Sesión abierta, tal como la necesita el interceptor. */
export interface SessionTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Estado de la sesión en memoria.
 *
 * Deliberadamente **sin persistencia**: el token vive solo en memoria, así que
 * no hay nada que leer durante el render del servidor y ninguna rama del código
 * toca `localStorage` en la ruta de SSR. La persistencia del refresh token es
 * parte de `AuthService` (J8), que va a envolver a este store sin cambiarlo.
 *
 * No existe `/me` en la API a propósito: todo lo que la interfaz necesita saber
 * del usuario sale del propio token.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionStore {
  private readonly tokens = signal<SessionTokens | null>(null);

  /** Tenant elegido cuando el token trae más de uno. */
  private readonly selectedTenantId = signal<string | null>(null);

  readonly accessToken = computed(() => emptyToNull(this.tokens()?.accessToken));

  /**
   * Un texto vacío es lo mismo que no tener token: se normaliza acá para que
   * quien lo consulte compare contra `null` y nada más. Dejar pasar `''` haría
   * que el interceptor intentara refrescar con una credencial que no existe.
   */
  readonly refreshToken = computed(() => emptyToNull(this.tokens()?.refreshToken));

  /** Claims del token vigente, o `null` si no hay sesión o es ilegible. */
  readonly claims = computed<AccessTokenClaims | null>(() => {
    const token = this.accessToken();
    return token === null ? null : decodeAccessToken(token);
  });

  readonly isAuthenticated = computed(() => this.claims() !== null);
  readonly userId = computed(() => this.claims()?.sub ?? null);
  readonly roles = computed<readonly string[]>(() => this.claims()?.roles ?? []);
  readonly tenants = computed<readonly string[]>(() => this.claims()?.tenants ?? []);

  /** Nombre para mostrar, si el token lo trae. */
  readonly displayName = computed<string | null>(() => this.claims()?.name ?? null);

  /**
   * Perfil de paciente del titular, o `null` si la cuenta no es la de un
   * paciente (personal de salud, administración).
   *
   * Es lo que distingue a quien puede usar el autoservicio del portal: sin este
   * dato no se puede confirmar una reserva, porque `confirm` lo exige.
   */
  readonly patientProfileId = computed<string | null>(
    () => this.claims()?.pid ?? null,
  );

  /**
   * Nombre de una organización por su identificador.
   *
   * Cae al identificador cuando el token no trae el nombre: es feo, pero es
   * preferible a una pantalla en blanco donde debería ir una organización.
   */
  tenantName(tenantId: string): string {
    return this.claims()?.tenantNames?.[tenantId] ?? tenantId;
  }

  /**
   * Tenant que viaja en `X-Tenant-Id`.
   *
   * Con uno solo se resuelve solo; con varios manda la elección de la persona y
   * **no se adivina**: hasta que elija, el encabezado no se manda y la API
   * responde lo que corresponda. Elegir por ella podría mostrarle datos de la
   * organización equivocada.
   */
  readonly activeTenantId = computed<string | null>(() => {
    const chosen = this.selectedTenantId();
    if (chosen !== null) {
      return chosen;
    }
    const tenants = this.tenants();
    return tenants.length === 1 ? (tenants[0] ?? null) : null;
  });

  /** Si hay que pedirle a la persona que elija organización. */
  readonly needsTenantSelection = computed(
    () => this.tenants().length > 1 && this.selectedTenantId() === null,
  );

  /** Abre la sesión. Descarta la elección de tenant anterior, si la había. */
  start(tokens: SessionTokens): void {
    this.tokens.set(tokens);
    this.selectedTenantId.set(null);
  }

  /**
   * Reemplaza los tokens tras un refresco. **No** toca el tenant elegido: la
   * rotación es transparente para la persona y perder su elección la sacaría de
   * la organización en la que estaba trabajando.
   */
  renew(tokens: SessionTokens): void {
    this.tokens.set(tokens);
  }

  /** Fija la organización activa. Debe ser una de las del token. */
  selectTenant(tenantId: string): void {
    if (this.tenants().includes(tenantId)) {
      this.selectedTenantId.set(tenantId);
    }
  }

  clear(): void {
    this.tokens.set(null);
    this.selectedTenantId.set(null);
  }
}

function emptyToNull(token: string | undefined): string | null {
  return token === undefined || token === '' ? null : token;
}
