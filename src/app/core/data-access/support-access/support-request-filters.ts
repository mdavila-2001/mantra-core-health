import type { SupportEngagementRequest, SupportRequestStatus, SupportRoleTemplateCode } from './support-access.types';

/**
 * Filtros de la bandeja de solicitudes de la organización: por persona, rol,
 * estado y antigüedad. Puro y local: la bandeja recibe todas las solicitudes y
 * recorta acá, de modo que recargar la URL con los mismos filtros reproduce la
 * misma lista.
 */

const DAY_MS = 86_400_000;

/** Las solicitudes vencen a los 15 días de enviadas. */
export const REQUEST_LIFETIME_DAYS = 15;
/** Desde cuántos días antes del vencimiento una solicitud pendiente se marca como urgente. */
export const URGENT_DAYS = 3;

/** Tramos de antigüedad, medidos desde que se envió la solicitud. */
export const AGE_BUCKETS = ['LT3', 'D3_7', 'D8_14', 'GE15'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export const AGE_BUCKET_LABELS: Readonly<Record<AgeBucket, string>> = {
  LT3: 'Menos de 3 días',
  D3_7: 'De 3 a 7 días',
  D8_14: 'De 8 a 14 días',
  GE15: '15 días o más (vencidas)',
};

export interface RequestFilters {
  /** `requesterUserId` de la persona. */
  readonly person?: string;
  readonly role?: SupportRoleTemplateCode;
  readonly status?: SupportRequestStatus;
  readonly age?: AgeBucket;
}

export function ageInDays(request: Pick<SupportEngagementRequest, 'createdAt'>, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(request.createdAt).getTime()) / DAY_MS);
}

export function ageBucketOf(request: Pick<SupportEngagementRequest, 'createdAt'>, now: Date = new Date()): AgeBucket {
  const dias = ageInDays(request, now);
  if (dias < 3) return 'LT3';
  if (dias < 8) return 'D3_7';
  if (dias < REQUEST_LIFETIME_DAYS) return 'D8_14';
  return 'GE15';
}

/** La solicitud pasó su plazo sin decisión, aunque la API todavía no la haya marcado. */
export function isExpired(request: Pick<SupportEngagementRequest, 'status' | 'expiresAt'>, now: Date = new Date()): boolean {
  if (request.status === 'EXPIRED') return true;
  return request.status === 'PENDING' && new Date(request.expiresAt).getTime() < now.getTime();
}

/** Pendiente a punto de vencer: pide decisión ya. */
export function isUrgent(request: Pick<SupportEngagementRequest, 'status' | 'expiresAt'>, now: Date = new Date()): boolean {
  if (request.status !== 'PENDING' || isExpired(request, now)) return false;
  return new Date(request.expiresAt).getTime() - now.getTime() <= URGENT_DAYS * DAY_MS;
}

/** El estado que se muestra: una pendiente vencida es «vencida» aunque la API no la haya barrido. */
export function effectiveStatus(request: Pick<SupportEngagementRequest, 'status' | 'expiresAt'>, now: Date = new Date()): SupportRequestStatus {
  return isExpired(request, now) ? 'EXPIRED' : request.status;
}

export function filterRequests(requests: readonly SupportEngagementRequest[], filters: RequestFilters, now: Date = new Date()): readonly SupportEngagementRequest[] {
  return requests.filter(
    (r) =>
      (filters.person === undefined || r.requesterUserId === filters.person) &&
      (filters.role === undefined || r.roleTemplate === filters.role) &&
      (filters.status === undefined || effectiveStatus(r, now) === filters.status) &&
      (filters.age === undefined || ageBucketOf(r, now) === filters.age),
  );
}

/** Las personas que aparecen en la lista, sin repetir y por orden alfabético. */
export function requesters(requests: readonly SupportEngagementRequest[]): readonly { readonly id: string; readonly name: string }[] {
  const porId = new Map<string, string>();
  for (const r of requests) porId.set(r.requesterUserId, r.requesterName);
  return [...porId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/** Lo que cuenta cada vista, con el estado efectivo. */
export function countByView(requests: readonly SupportEngagementRequest[], now: Date = new Date()): { readonly pending: number; readonly resolved: number } {
  let pending = 0;
  for (const r of requests) if (effectiveStatus(r, now) === 'PENDING') pending += 1;
  return { pending, resolved: requests.length - pending };
}
