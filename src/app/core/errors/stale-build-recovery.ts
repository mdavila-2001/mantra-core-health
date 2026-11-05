import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, Injector, PLATFORM_ID } from '@angular/core';

import { BUILD_INFO, buildFingerprint } from '../build/build-info';
import { BuildVersionWatcher } from '../build/build-version-watcher';

/**
 * Recovers a tab that is still running a build the server no longer has.
 *
 * Every build renames its lazy chunks and a redeploy removes the old ones. A
 * tab opened before the redeploy keeps the old `main-*.js`, so the first chunk
 * it has not loaded yet (typically the patient dashboard right after login)
 * answers 404: lazy routes fail with "Failed to fetch dynamically imported
 * module" and every `@defer` block with `NG0750`. A manual reload fixed it;
 * `no-cache` on the HTML (`server.ts`) only helps new visits.
 *
 * This does that reload for the user, **once per build**: if the reload brings
 * back the same build, the chunk is really missing and the error goes through
 * the normal path (log, error screen) instead of looping.
 *
 * - {@link recoverFrom}: while navigating (router error, `ErrorRecovery`). The
 *   new screen never opened and `canDeactivate` already passed: reload now.
 * - {@link recoverFromBackground}: outside a navigation (`@defer`). The user may
 *   be typing and a network drop looks the same as a 404, so it first asks the
 *   server for a newer build and only reloads a screen that just opened;
 *   otherwise the watcher turns the next navigation into a full load.
 */
@Injectable({ providedIn: 'root' })
export class StaleBuildRecovery {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly build = inject(BUILD_INFO);
  // Lazy: the watcher needs the Router, and ErrorHandler (which injects this
  // service) must not depend on the Router at construction time.
  private readonly injector = inject(Injector);

  /** Resolves `true` when it reloaded the page. */
  async recoverFromBackground(error: unknown): Promise<boolean> {
    if (!this.isBrowser || !isStaleBuildError(error)) return false;
    const watcher = this.injector.get(BuildVersionWatcher);
    await watcher.check();
    if (!watcher.outdated() || watcher.msSinceNavigation() > JUST_OPENED_MS) return false;
    return this.recoverFrom(error);
  }

  /** Reloads towards `destination` (or the current page); `false` when it does not apply. */
  recoverFrom(error: unknown, destination?: string): boolean {
    if (!this.isBrowser || !isStaleBuildError(error)) return false;
    const location = this.document.defaultView?.location;
    const storage = sessionStorageOf(this.document);
    // Without session storage there is no loop guard: show the error instead.
    if (location === undefined || storage === null) return false;
    const fingerprint = buildFingerprint(this.build);
    try {
      if (storage.getItem(RECOVERY_KEY) === fingerprint) return false;
      storage.setItem(RECOVERY_KEY, fingerprint);
    } catch {
      return false;
    }
    if (destination) location.assign(destination);
    else location.reload();
    return true;
  }
}

/** A screen opened less than this ago has nothing typed to lose yet. */
export const JUST_OPENED_MS = 8_000;

/** `sessionStorage` key holding the fingerprint of the last build reloaded. */
export const RECOVERY_KEY = 'alovida.recarga-por-version';

/** Chromium, Firefox, Safari, Angular `@defer` (NG0750) and legacy bundlers. */
const PATTERNS = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /chunkloaderror/i,
  /loading chunk [\w-]+ failed/i,
  /\bNG0750\b/,
] as const;

/** Whether the error is a build chunk that could not be downloaded. */
export function isStaleBuildError(error: unknown): boolean {
  return causeChain(error).some((e) => {
    if (typeof e === 'object' && e !== null) {
      const { code, name } = e as { code?: unknown; name?: unknown };
      if (code === -750 || code === 750 || name === 'ChunkLoadError') return true;
    }
    const text = messageOf(e);
    return text !== '' && PATTERNS.some((p) => p.test(text));
  });
}

/** The error plus its `cause` / unhandled-promise `rejection`, cycle-safe. */
function causeChain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current: unknown = error;
  while (current !== undefined && current !== null && !seen.includes(current) && seen.length < 5) {
    seen.push(current);
    if (typeof current !== 'object') break;
    const { cause, rejection } = current as { cause?: unknown; rejection?: unknown };
    current = cause ?? rejection;
  }
  return seen;
}

function messageOf(error: unknown): string {
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : '';
}

function sessionStorageOf(document: Document): Storage | null {
  try {
    return document.defaultView?.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Route loaders turn a failed `import()` into `ErrorRecovery` (`chunkFallido`)
 * outside any injection context, so they park the error here and
 * `ErrorRecovery` picks it up when it is created.
 */
let pendingRouteFailure: { readonly error: unknown; readonly at: number } | null = null;

/** Older than this, the failure belongs to a navigation a guard cancelled. */
const PENDING_FAILURE_TTL_MS = 15_000;

export function recordRouteChunkFailure(error: unknown): void {
  pendingRouteFailure = { error, at: Date.now() };
}

/** Returns the pending failure once (if recent), or `null`. */
export function takeRouteChunkFailure(): { readonly error: unknown } | null {
  const pending = pendingRouteFailure;
  pendingRouteFailure = null;
  if (pending === null || Date.now() - pending.at > PENDING_FAILURE_TTL_MS) return null;
  return { error: pending.error };
}
