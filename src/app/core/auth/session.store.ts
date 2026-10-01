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
   * Perfil profesional del titular, o `null` si la cuenta no es la de quien
   * atiende (pacientes, administración, cuentas de sistema).
   *
   * Es lo que permite que la agenda se abra en la del profesional que entró, en
   * vez de en la primera de la organización. Los dos perfiles conviven: nada
   * impide que quien atiende sea además paciente de la institución.
   */
  readonly practitionerProfileId = computed<string | null>(
    () => this.claims()?.hpid ?? null,
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
   * La organización propia del titular («Mi consultorio»), si el token la
   * declara **y** está entre sus tenants. Un claim que apunte afuera se ignora.
   */
  readonly ownTenantId = computed<string | null>(() => {
    const own = this.claims()?.ownTenantId;
    return own !== undefined && this.tenants().includes(own) ? own : null;
  });

  /**
   * Tenant que viaja en `X-Tenant-Id`.
   *
   * Con uno solo se resuelve solo. Con varios manda la elección de la persona;
   * si todavía no eligió, se usa **su propia** organización —«Mi consultorio»
   * de quien atiende—, que no es adivinar: es la suya. Sin organización propia
   * **no se adivina**: hasta que elija, el encabezado no se manda. Elegir una
   * clínica por ella podría mostrarle datos de la organización equivocada.
   */
  readonly activeTenantId = computed<string | null>(() => {
    const chosen = this.selectedTenantId();
    if (chosen !== null) {
      return chosen;
    }
    const tenants = this.tenants();
    return tenants.length === 1 ? (tenants[0] ?? null) : this.ownTenantId();
  });

  /**
   * Código de tipo de la organización **activa** (`'PAYER'`, `'PROVIDER'`,
   * `'PHARMACY'`…), o `null`.
   *
   * `null` en tres casos que no se distinguen porque a quien lo consume no le
   * hace falta distinguirlos: sin organización activa (varios tenants sin
   * elegir y sin `ownTenantId`), sin el claim `tenantTypes` en el token —una
   * API vieja o un token emitido antes de que este claim existiera— o con un
   * tipo que no está en el catálogo. En los tres casos el efecto es el mismo:
   * ninguna sección se oculta por tipo de organización, que es el menú de hoy.
   *
   * Es dato de presentación, igual que `tenantName`: no autoriza nada. Sirve
   * para que el registro de navegación pueda ocultarle a una organización una
   * sección que no es suya (`AppSection.hiddenForTenantTypes`).
   */
  readonly activeTenantType = computed<string | null>(() => {
    const id = this.activeTenantId();
    return id === null ? null : (this.claims()?.tenantTypes?.[id] ?? null);
  });

  /** Si hay que pedirle a la persona que elija organización. */
  readonly needsTenantSelection = computed(
    () =>
      this.tenants().length > 1 && this.selectedTenantId() === null && this.ownTenantId() === null,
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
