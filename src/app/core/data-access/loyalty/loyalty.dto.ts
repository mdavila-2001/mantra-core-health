/**
 * Contratos de cable del portal de lealtad, tal como los publica la API.
 *
 * Copiados de los DTO de `src/modules/promotions/dto/promotions.dto.ts`: son lo
 * que viaja, no lo que la pantalla muestra. La traducción a los tipos del
 * dominio vive en `loyalty.adapter.ts`, para que un cambio de nombre en el
 * cable no se filtre a los componentes.
 */

/** Nivel de la membresía, en `GET loyalty/me`. */
export interface LoyaltyTierDto {
  readonly code: string;
  readonly name: string;
  readonly multiplier?: string;
  readonly minPoints: string;
}

/** Membresía del titular, en `GET loyalty/me`. */
export interface LoyaltyMembershipDto {
  readonly membershipId: string;
  readonly programName: string;
  readonly pointsCurrencyName?: string;
  readonly pointsBalance: string;
  readonly lifetimePoints: string;
  readonly tier?: LoyaltyTierDto;
  readonly enrolledAt?: string;
  readonly active: boolean;
}

/**
 * Respuesta de `GET loyalty/me`.
 *
 * `enrolled: false` es un estado normal —la persona no está inscrita— y llega
 * con 200, no con 404: no es un error y la pantalla no lo pinta como tal.
 */
export interface MyLoyaltyResponseDto {
  readonly enrolled: boolean;
  readonly membership?: LoyaltyMembershipDto;
}

/** Un movimiento del ledger, en `GET loyalty/me/points`. */
export interface PointsLedgerEntryDto {
  readonly entryId: string;
  /** Código del catálogo; ausente si el concepto no es de puntos. */
  readonly direction?: string;
  readonly points: string;
  /** Código del catálogo; ausente con el mismo criterio que `direction`. */
  readonly reason?: string;
  readonly balanceAfter?: string;
  readonly expiresAt?: string;
  readonly occurredAt: string;
}

/** Una página del ledger. El cursor es opaco: no se interpreta ni se fabrica. */
export interface PointsLedgerPageDto {
  readonly entries: readonly PointsLedgerEntryDto[];
  readonly nextCursor?: string;
}

/** Respuesta de `POST loyalty/me/points/redeem`. */
export interface PointsLedgerResponseDto {
  readonly ledgerEntryId: string;
  readonly membershipId: string;
  readonly points: string;
  readonly balanceAfter: string;
  readonly lifetimePoints: string;
  readonly currentTierId?: string;
  readonly duplicate: boolean;
}

/** Cuerpo de `POST loyalty/me/points/redeem`. **Sin titular**: sale del token. */
export interface RedeemPointsRequestDto {
  readonly points: string;
  readonly idempotencyKey: string;
}
