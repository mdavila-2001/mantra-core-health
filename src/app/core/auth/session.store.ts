import { computed, inject, Injectable, signal } from '@angular/core';

import { REFRESH_COOKIE_MODE } from '../data-access/api';
import type { DeniedTenant } from '../data-access/iam/tenant-denial';
import { decodeAccessToken, type AccessTokenClaims } from './access-token';

/**
 * Tipos de organización que tienen cuenta propia en el portal. Sin el claim
 * `accountKind`, una sesión sin perfil de paciente ni profesional cuya
 * organización activa es de estos tipos se trata como cuenta de organización.
 *
 * `PROVIDER`/`HOSPITAL` no están: una clínica o «Mi consultorio» la usan
 * personas (quien atiende), así que ahí la cuenta sigue siendo la persona.
 */
const ORGANIZATION_ACCOUNT_TENANT_TYPES: readonly string[] = [
  'PHARMACY',
  'DIAGNOSTIC_CENTER',
  'PAYER',
];

/** Qué se sabe de la obligación de dar de alta el segundo paso. */
export type MfaEnrollmentState = 'unknown' | 'required' | 'done';

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

  /** Con la cookie httpOnly el refresh token no pasa por acá: lo guarda el navegador. */
  private readonly refreshCookie = inject(REFRESH_COOKIE_MODE);

  /** Tenant elegido cuando el token trae más de uno. */
  private readonly selectedTenantId = signal<string | null>(null);

  /**
   * Si la persona tiene que dar de alta su verificación en dos pasos antes de
   * usar la aplicación.
   *
   * **La API también lo impone**: a quien debe dar de alta el segundo factor le emite un token de alcance
   * limitado (claim `mfaEnrollment: true`) que solo llega a `/iam/me/mfa*`, al cierre de sesión y al refresco;
   * el resto es 403 `MFA_ENROLLMENT_REQUIRED`. El cliente conserva su guarda (`mfaEnrollmentGuard`) para no
   * mostrar pantallas que van a fallar. El claim lo decide al abrir la sesión y al renovarla; con un token
   * completo y `unknown` se pregunta `GET /iam/me/mfa` la primera vez que importa.
   */
  readonly mfaEnrollment = signal<MfaEnrollmentState>('unknown');

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
  /**
   * Roles **efectivos** en la organización activa, con la misma regla que
   * `RolesGuard` de la API (TX-15):
   *
   * - `SUPERADMIN` es comodín: conserva todos.
   * - Un código que **no** figura en `scopedRoles` es global: vale siempre.
   * - Uno que figura con ámbito sólo vale en los tenants donde se concedió; sin
   *   organización activa no vale.
   *
   * Es lo que decide qué se **muestra** (menús, guards de ruta, botones). Nunca
   * reemplaza al 403: la autoridad es la API. Con un token sin `scopedRoles` es
   * exactamente la lista `roles` del token.
   */
  readonly roles = computed<readonly string[]>(() =>
    effectiveRoles(this.claims(), this.activeTenantId()),
  );
  readonly tenants = computed<readonly string[]>(() => this.claims()?.tenants ?? []);

  /**
   * Las organizaciones que **no dejan actuar ahora** a esta persona, con su motivo (claim `deniedTenants`). No están en
   * `tenants`: entró a las demás. Es para avisar y para marcarlas deshabilitadas en el selector; la que niega es la API.
   */
  readonly deniedTenants = computed<readonly DeniedTenant[]>(() =>
    Object.entries(this.claims()?.deniedTenants ?? {}).map(([tenantId, reason]) => ({ tenantId, reason })),
  );

  /**
   * Si el token es el de **alcance limitado** (`mfaEnrollment`): la API solo deja dar de alta el segundo factor, salir y
   * refrescar. La API lo impone; el cliente conserva su guarda para no mostrar una aplicación que va a responder 403.
   */
  readonly limitedToEnrollment = computed(() => this.claims()?.mfaEnrollment === true);

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
   * Tenant que viaja en `X-Tenant-Id`.
   *
   * Con uno solo se resuelve solo. Con varios manda la elección de la persona
   * —o la última que hizo en este dispositivo, que `AuthService` restaura al
   * abrir la sesión (TX-11)—. Si todavía no eligió, **no se adivina**: el
   * encabezado no se manda, porque elegir una clínica por ella podría mostrarle
   * datos de la organización equivocada.
   *
   * Antes se usaba un claim `ownTenantId` que sólo firmaba el simulador: la API
   * no lo emite, así que en producción la médica con dos organizaciones veía el
   * selector en cada sesión.
   */
  readonly activeTenantId = computed<string | null>(() => {
    const chosen = this.selectedTenantId();
    if (chosen !== null) {
      return chosen;
    }
    const tenants = this.tenants();
    return tenants.length === 1 ? (tenants[0] ?? null) : null;
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

  /**
   * Si la cuenta **es** una organización (farmacia, laboratorio, aseguradora)
   * y no una persona que la administra.
   *
   * Manda el claim `accountKind`; sin él (API anterior) se deduce: organización
   * activa de un tipo con cuenta propia y ningún perfil de paciente ni
   * profesional. La regla vive solo acá. Es presentación, no autoriza nada.
   */
  readonly isOrganizationAccount = computed<boolean>(() => {
    const claims = this.claims();
    if (claims === null) {
      return false;
    }
    if (claims.accountKind !== undefined) {
      // El claim dice la clase de cuenta **de la organización** (`org_account_mode`): el hospital en modo organización firma
      // `ORGANIZATION` para todos los que entran por él, también para su secretaria o un doctor. Quien trabaja ahí con un rol
      // propio —personal de apoyo, doctor, paciente— es una persona; la cuenta de la organización es la que no tiene ninguno.
      return claims.accountKind === 'ORGANIZATION' && !this.holdsPersonalRole(claims);
    }
    const type = this.activeTenantType();
    return (
      type !== null &&
      ORGANIZATION_ACCOUNT_TENANT_TYPES.includes(type) &&
      claims.pid === undefined &&
      claims.hpid === undefined
    );
  });

  /** ¿Entra con un rol propio de una persona que trabaja ahí (personal de apoyo o doctor)? */
  private holdsPersonalRole(claims: NonNullable<ReturnType<typeof this.claims>>): boolean {
    const personal = (codes: readonly string[]): boolean => codes.includes('SUPPORT_STAFF') || codes.includes('PRACTITIONER');
    return personal(claims.roles) || Object.values(claims.scopedRoles ?? {}).some(personal);
  }

  /** Si hay que pedirle a la persona que elija organización. */
  readonly needsTenantSelection = computed(
    () => this.tenants().length > 1 && this.selectedTenantId() === null,
  );

  /**
   * Si hay con qué renovar la sesión: un refresh token guardado o, en modo
   * cookie, una sesión abierta (el navegador manda la cookie). Sin sesión no hay
   * nada que renovar, tampoco en modo cookie.
   */
  readonly canRefresh = computed(
    () => this.refreshToken() !== null || (this.refreshCookie && this.accessToken() !== null),
  );

  /** Abre la sesión. Descarta la elección de tenant anterior, si la había. */
  start(tokens: SessionTokens): void {
    this.tokens.set(tokens);
    this.selectedTenantId.set(null);
    this.mfaEnrollment.set(this.limitedToEnrollment() ? 'required' : 'unknown');
  }

  /**
   * Reemplaza los tokens tras un refresco. **No** toca el tenant elegido: la
   * rotación es transparente para la persona y perder su elección la sacaría de
   * la organización en la que estaba trabajando.
   */
  renew(tokens: SessionTokens): void {
    this.tokens.set(tokens);
    // El refresco conserva el alcance limitado y lo reemite completo al confirmar el factor: el claim manda.
    if (this.limitedToEnrollment()) this.mfaEnrollment.set('required');
    else if (this.mfaEnrollment() === 'required') this.mfaEnrollment.set('done');
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
    this.mfaEnrollment.set('unknown');
  }
}

function emptyToNull(token: string | undefined): string | null {
  return token === undefined || token === '' ? null : token;
}

/**
 * Roles vigentes en la organización activa. Misma regla que `RolesGuard`
 * (`roles.guard.ts` de la API); ver {@link SessionStore.roles}.
 */
export function effectiveRoles(
  claims: AccessTokenClaims | null,
  activeTenantId: string | null,
): readonly string[] {
  if (claims === null) {
    return [];
  }
  const { roles, scopedRoles } = claims;
  if (scopedRoles === undefined || roles.includes('SUPERADMIN')) {
    return roles;
  }

  return roles.filter((role) => {
    const owners = Object.keys(scopedRoles).filter((tenantId) => scopedRoles[tenantId]?.includes(role));
    // No aparece con ámbito: excepción global, vale siempre.
    return owners.length === 0 || (activeTenantId !== null && owners.includes(activeTenantId));
  });
}
