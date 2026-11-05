import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { GuardsCheckEnd, NavigationEnd, NavigationStart, Router } from '@angular/router';

import { BUILD_INFO, buildFingerprint } from './build-info';

/** Where the server publishes the identity of the deployed build (served with `no-cache`). */
export const BUILD_VERSION_URL = '/build-version.json';

/** Minimum polling cadence while the tab is visible. */
const POLL_MS = 5 * 60_000;

/** Navigations do not trigger more than one check within this window. */
const MIN_GAP_MS = 60_000;

/**
 * Notices a redeploy **before** the open tab asks for a chunk that no longer
 * exists. `StaleBuildRecovery` fixes the failure once it happened; this one
 * prevents it, which matters because some dynamic `import()` failures (PDF,
 * map, 3D viewer) end up as a generic in-screen message nobody can catch.
 *
 * Compares `BUILD_INFO` with {@link BUILD_VERSION_URL} when the tab becomes
 * visible, every {@link POLL_MS} and on navigation. When they differ, the
 * **next** navigation becomes a full page load at `GuardsCheckEnd`, so
 * `canDeactivate` (unsaved changes) still runs first. It never reloads on its
 * own: that could wipe what the user is typing.
 */
@Injectable({ providedIn: 'root' })
export class BuildVersionWatcher {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly build = inject(BUILD_INFO);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  /** The server already serves a different build. */
  readonly outdated = signal(false);

  private lastCheckAt = 0;
  private lastNavigationAt = Date.now();
  private inFlight: Promise<void> | null = null;
  private started = false;

  start(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    const view = this.document.defaultView;
    if (view === null) return;

    const onVisible = (): void => {
      if (this.document.visibilityState === 'visible') void this.check();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    const poll = view.setInterval(onVisible, POLL_MS);
    // The first check does not compete with app startup.
    const first = view.setTimeout(() => void this.check(), 10_000);

    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart || event instanceof NavigationEnd) {
        this.lastNavigationAt = Date.now();
        return;
      }
      if (!(event instanceof GuardsCheckEnd)) return;
      if (this.outdated() && event.shouldActivate) {
        // Full load of the target with the new build. The session lives in
        // storage, so it survives. Abort the old SPA navigation so resolvers and
        // the screen constructor (e.g. a one-time-link POST) do not run twice.
        const navigation = this.router.currentNavigation();
        if (navigation?.extras.replaceUrl === true) view.location.replace(event.urlAfterRedirects);
        else view.location.assign(event.urlAfterRedirects);
        navigation?.abort();
        return;
      }
      if (Date.now() - this.lastCheckAt >= MIN_GAP_MS) void this.check();
    });

    this.destroyRef.onDestroy(() => {
      this.document.removeEventListener('visibilitychange', onVisible);
      view.clearInterval(poll);
      view.clearTimeout(first);
      sub.unsubscribe();
    });
  }

  /** Milliseconds since the last router navigation started or ended. */
  msSinceNavigation(): number {
    return Date.now() - this.lastNavigationAt;
  }

  /** Asks the server which build it serves. Network errors change nothing. */
  check(): Promise<void> {
    if (!this.isBrowser || this.outdated()) return Promise.resolve();
    this.inFlight ??= this.fetchRemote().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async fetchRemote(): Promise<void> {
    this.lastCheckAt = Date.now();
    const view = this.document.defaultView;
    if (!view?.fetch) return;
    try {
      const response = await view.fetch(BUILD_VERSION_URL, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) return;
      const remote: unknown = await response.json();
      if (isBuildIdentity(remote) && buildFingerprint(remote) !== buildFingerprint(this.build)) {
        this.outdated.set(true);
      }
    } catch {
      // Offline, server restarting or partial JSON: try again next time.
    }
  }
}

function isBuildIdentity(value: unknown): value is { commit: string; builtAt: string } {
  const { commit, builtAt } = (value ?? {}) as { commit?: unknown; builtAt?: unknown };
  return typeof commit === 'string' && commit !== '' && typeof builtAt === 'string' && builtAt !== '';
}
