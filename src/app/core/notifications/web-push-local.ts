/**
 * What this browser remembers about push, per person (a clinic PC is shared).
 *
 * - `offered:<userId>`: the one-time offer was already shown to that person.
 * - `optin:<userId>`: that person turned push on here and wants it back after each login.
 * - `owner`: who the live browser subscription was last saved for, and a hash of its
 *   endpoint. A live subscription with another or unknown owner is never adopted, and
 *   an unchanged endpoint is not re-sent to the API on every page load.
 *
 * Every read and write tolerates a missing or blocked `localStorage`.
 */
const OFFERED = 'alovida.webpush.offered';
const OPTED_IN = 'alovida.webpush.optin';
const OWNER = 'alovida.webpush.owner';

export type PushFlag = 'offered' | 'optin';

export interface PushOwner {
  readonly user: string;
  readonly endpoint: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function attempt<T>(fn: (s: Storage) => T, fallback: T): T {
  const s = storage();
  if (s === null) return fallback;
  try {
    return fn(s);
  } catch {
    return fallback;
  }
}

const keyOf = (flag: PushFlag, userId: string) => `${flag === 'offered' ? OFFERED : OPTED_IN}:${userId}`;

export function readFlag(flag: PushFlag, userId: string): boolean {
  return attempt((s) => s.getItem(keyOf(flag, userId)) === '1', false);
}

export function writeFlag(flag: PushFlag, userId: string, on: boolean): void {
  attempt((s) => (on ? s.setItem(keyOf(flag, userId), '1') : s.removeItem(keyOf(flag, userId))), undefined);
}

/**
 * The offer flag used to be one key for the whole browser. It is honoured once, for
 * the first person who signs in after the upgrade, and then removed.
 */
export function migrateLegacyOffered(userId: string): void {
  attempt((s) => {
    if (s.getItem(OFFERED) !== '1') return;
    s.removeItem(OFFERED);
    s.setItem(keyOf('offered', userId), '1');
  }, undefined);
}

export function readOwner(): PushOwner | null {
  return attempt((s) => {
    const parsed = JSON.parse(s.getItem(OWNER) ?? 'null') as Partial<PushOwner> | null;
    return typeof parsed?.user === 'string' && typeof parsed.endpoint === 'string'
      ? { user: parsed.user, endpoint: parsed.endpoint }
      : null;
  }, null);
}

export function writeOwner(owner: PushOwner | null): void {
  attempt((s) => (owner ? s.setItem(OWNER, JSON.stringify(owner)) : s.removeItem(OWNER)), undefined);
}

/** Short, stable, non-secret fingerprint of an endpoint (FNV-1a): the endpoint itself is not stored. */
export function endpointHash(endpoint: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < endpoint.length; i += 1) {
    hash ^= endpoint.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${endpoint.length}-${(hash >>> 0).toString(36)}`;
}
