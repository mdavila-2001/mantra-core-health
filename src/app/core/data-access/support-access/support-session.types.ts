/**
 * Tipos de los **controles de sesión** de la organización (forma de los DTO de
 * la API, `iam/presentation/dto/session-policies.dto.ts`) y de los filtros de la
 * bitácora del personal de apoyo. Se reexportan desde `support-access.types.ts`.
 */

/**
 * Filtros de la bitácora (`SupportActivityQuery` de la API). Los filtra **la API**:
 * la pantalla los manda y no vuelve a filtrar lo recibido.
 */
export interface SupportActivityQuery {
  /** Persona de apoyo: su id o su nombre completo (sin distinguir mayúsculas ni acentos). */
  readonly person?: string;
  /** Solo la actividad de esta persona, por id. */
  readonly userId?: string;
  /** Doctor: su asignación de rol o su perfil (id), o su nombre completo. */
  readonly doctor?: string;
  /** Código de la entrada (`schedule.confirm`, `engagement.ended`) o el asiento crudo (`BOOKING_CONFIRMED`). */
  readonly action?: string;
  /** `YYYY-MM-DD` (el día completo, hora de La Paz) o un instante ISO. Ambos extremos incluidos. */
  readonly from?: string;
  readonly to?: string;
  /** Solo una organización: lo usa «Mi actividad», que no tiene una activa. */
  readonly tenantId?: string;
  /** De 1 a 200. */
  readonly limit?: number;
  /** El `nextCursor` de la página anterior. */
  readonly cursor?: string;
}

export type SessionPolicyScope = 'ALL_ACCOUNTS' | 'ORG_STAFF' | 'ROLE';

/**
 * Franja del horario laboral, **igual que el DTO de la API** (`AllowedHoursDto`):
 * una sola franja `HH:mm`–`HH:mm` y los días en que rige (`0` = domingo … `6` =
 * sábado; ausente = todos). Si `to` es menor que `from`, la franja cruza la
 * medianoche y pertenece al día en que empezó. Ausente la política entera:
 * sin restricción de horario.
 */
export interface AllowedHours {
  readonly days?: readonly number[];
  readonly from: string;
  readonly to: string;
  /** Zona horaria IANA; sin ella la API usa `America/La_Paz`. */
  readonly timeZone?: string;
}

export interface SessionPolicy {
  readonly scope: SessionPolicyScope;
  /** Solo con `scope: 'ROLE'`: el código de la plantilla de rol. */
  readonly roleCode?: string;
  readonly idleTimeoutMinutes: number;
  readonly newDeviceAlert: boolean;
  /** Ausente = sin restricción de horario. */
  readonly allowedHours?: AllowedHours;
  readonly enforceIpRules: boolean;
  readonly requireMfa: boolean;
}

export interface SessionPolicies {
  readonly policies: readonly SessionPolicy[];
}

/* ---- reglas de red de la organización (`/org/ip-access-rules`) ---------------- */

/** `ALLOW`: solo se entra desde estos rangos. `DENY`: desde estos no se entra. */
export type IpRuleType = 'ALLOW' | 'DENY';

/**
 * Una regla de red, igual que `IpAccessRuleDto` de la API. El rango va en CIDR
 * **con prefijo**: `190.129.0.0/16`, `203.0.113.7/32`, `2001:db8::/32`.
 */
export interface IpAccessRule {
  readonly type: IpRuleType;
  readonly cidr: string;
  readonly description?: string;
  /** Instante ISO desde el que rige; ausente = desde siempre. */
  readonly validFrom?: string;
  /** Instante ISO hasta el que rige (exclusivo); ausente = sin fin. */
  readonly validTo?: string;
}

/** Una regla vigente con su identificador (`IpAccessRuleViewDto`). */
export interface IpAccessRuleView extends IpAccessRule {
  readonly id: string;
}

/** `GET|PUT /org/ip-access-rules`: el conjunto completo de la organización. Vacío = sin restricción de red. */
export interface IpAccessRules {
  readonly rules: readonly IpAccessRuleView[];
}
