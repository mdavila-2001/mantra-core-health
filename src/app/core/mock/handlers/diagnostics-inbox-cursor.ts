/**
 * El cursor opaco de la bandeja de recepción del laboratorio: la clave de la
 * última fila devuelta, en base64.
 */
export interface InboxCursorKey {
  readonly requestedAt: string;
  readonly id: string;
}

export function encodeInboxCursor(order: InboxCursorKey): string {
  return btoa(JSON.stringify({ requestedAt: order.requestedAt, id: order.id }));
}

export function decodeInboxCursor(cursor: string): InboxCursorKey | null {
  try {
    const parsed: unknown = JSON.parse(atob(cursor));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { requestedAt, id } = parsed as Record<string, unknown>;
    return typeof requestedAt === 'string' && typeof id === 'string' ? { requestedAt, id } : null;
  } catch {
    return null;
  }
}
