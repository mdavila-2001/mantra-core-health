import type { GeoPoint } from './pharmacy.types';

/**
 * P34 · los contratos del horario declarado de una sede de farmacia: «abre
 * 24 h» y los turnos de guardia, y la lectura pública «abiertas ahora».
 * Viven aparte de `pharmacy.types.ts` para no seguir engordándolo.
 */

/** Quién declaró un turno: la farmacia, o la plataforma en su nombre. */
export type OnCallShiftSource = 'PHARMACY' | 'PLATFORM';

/** Un turno de guardia, con la hora en UTC y en la hora local de la sede. */
export interface OnCallShift {
  readonly id: string;
  readonly siteId: string;
  /** Instante UTC. */
  readonly startsAt: string;
  /** Instante UTC, exclusivo. */
  readonly endsAt: string;
  /** El mismo instante en la hora de la sede (`2026-10-26T20:00:00-04:00`). */
  readonly startsAtLocal: string;
  readonly endsAtLocal: string;
  /** Huso de la sede; `America/La_Paz` por defecto. */
  readonly timeZone: string;
  readonly source: OnCallShiftSource;
  readonly status: 'ACTIVE' | 'CANCELLED';
  /** Vigente en el `asOf` de la respuesta. */
  readonly current: boolean;
}

/** El horario declarado de una sede. */
export interface SiteOpeningHours {
  readonly siteId: string;
  readonly siteName: string;
  readonly timeZone: string;
  /** `null` = no lo declaró. */
  readonly open24h: boolean | null;
  /** Activos que todavía no terminaron, del más próximo al más lejano. */
  readonly shifts: readonly OnCallShift[];
}

/** `GET /pharmacies/:pharmacyId/opening-hours`. */
export interface PharmacyOpeningHours {
  readonly pharmacyId: string;
  readonly asOf: string;
  readonly sites: readonly SiteOpeningHours[];
}

/** Cuerpo del alta de un turno: instantes ISO-8601 **con** desplazamiento. */
export interface OnCallShiftDraft {
  readonly startsAt: string;
  readonly endsAt: string;
}

/** Qué sedes pide `GET /public/pharmacies/open-now`. */
export type OpenNowMode = 'any' | '24h' | 'on-call';

/** Una sede abierta ahora, tal como la publica la API. */
export interface OpenNowSite {
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyName: string;
  readonly pharmacySlug: string;
  readonly addressText: string | null;
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly distanceKm: number | null;
  readonly open24h: boolean;
  readonly onCall: {
    readonly startsAt: string;
    readonly endsAt: string;
    readonly endsAtLocal: string;
    readonly source: OnCallShiftSource;
  } | null;
  readonly timeZone: string;
}

/** `GET /public/pharmacies/open-now`. */
export interface OpenNowPage {
  readonly items: readonly OpenNowSite[];
  readonly nextCursor: string | null;
  /** El instante con que se decidió «abierta ahora». */
  readonly asOf: string;
  readonly asOfLocal: string;
  readonly timeZone: string;
}

/** Filtros de `open-now`. */
export interface OpenNowQuery {
  readonly mode?: OpenNowMode;
  readonly city?: string;
  readonly origin?: GeoPoint;
  readonly cursor?: string;
  readonly limit?: number;
}
