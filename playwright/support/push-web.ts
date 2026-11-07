import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

import type { BrowserContext, Page } from '@playwright/test';

/**
 * Support for the web push specs: a static host for a `real-api` build (no mock
 * interceptor) and an API answered with `page.route`, plus a fake `PushManager`
 * because headless Chromium has no push service. Nothing here touches a real API.
 */
export const PUSH_DIST = process.env['E2E_PUSH_DIST'] ?? 'dist/mantra-core-health/browser';
export const PUSH_EVIDENCE = 'docs/trabajo/2026-11-06-push-notificaciones/evidencia';
export const pushBuildMissing = !existsSync(join(PUSH_DIST, 'push-sw.js'));

const TYPES: Record<string, string> = {
  '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

/** Static files with SPA fallback, like the production host; `/e2e-blank` is an empty page. */
export async function serveBuild(): Promise<{ origin: string; close: () => void }> {
  const index = existsSync(join(PUSH_DIST, 'index.csr.html')) ? 'index.csr.html' : 'index.html';
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/e2e-blank') return void res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>e2e</title>');
    let file = join(PUSH_DIST, path);
    if (!existsSync(file) || !extname(file)) file = join(PUSH_DIST, index);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return { origin: `http://127.0.0.1:${port}`, close: () => server.close() };
}

/** A token the app can read (claims only; the API is mocked). */
export function token(sub: string, extra: Record<string, unknown> = {}): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const claims = { sub, roles: ['CLINICIAN', 'USER'], tenants: ['t-1'], name: `Persona ${sub}`, iat: now, exp: now + 3600 };
  return `${b64({ alg: 'HS256' })}.${b64({ ...claims, ...extra })}.x`;
}

export interface MockApi {
  /** Who the next login/refresh signs in as. */
  user: string;
  extraClaims: Record<string, unknown>;
  /** Answers of `GET /web-push/config`, in order; the last one repeats. */
  config: boolean[];
  putStatus: number;
  putDelayMs: number;
  readonly calls: { method: string; path: string; body: unknown }[];
}

export function mockApi(user: string): MockApi {
  return { user, extraClaims: {}, config: [true], putStatus: 204, putDelayMs: 0, calls: [] };
}

export const pushCalls = (api: MockApi) => api.calls.filter((c) => c.path.includes('/web-push/subscription'));

/**
 * Fake push manager and notification permission, kept in `localStorage` so they
 * survive reloads. `permission` is what `Notification.permission` reads, and
 * `answer` what the prompt returns. Without `push`, the browser has no PushManager.
 * `serviceOff` rejects `subscribe` as Brave does with its push service off (the default).
 */
export async function fakeBrowserPush(
  context: BrowserContext,
  opts: { permission: NotificationPermission; answer?: NotificationPermission; push?: boolean; serviceOff?: boolean },
): Promise<void> {
  await context.addInitScript((o) => {
    if (o.push === false) {
      Reflect.deleteProperty(window, 'PushManager');
      return;
    }
    const read = () => localStorage.getItem('e2e.permission') ?? o.permission;
    Object.defineProperty(Notification, 'permission', { configurable: true, get: read });
    Notification.requestPermission = async () => {
      const answer = o.answer ?? 'granted';
      localStorage.setItem('e2e.permission', answer);
      return answer;
    };
    const make = (endpoint: string) => ({
      endpoint,
      toJSON: () => ({ endpoint, keys: { p256dh: 'p'.repeat(30), auth: 'a'.repeat(12) } }),
      unsubscribe: async () => (localStorage.removeItem('e2e.sub'), true),
    });
    PushManager.prototype.subscribe = async () => {
      if (o.serviceOff) throw new DOMException('Registration failed - push service error', 'AbortError');
      const n = Number(localStorage.getItem('e2e.n') ?? '0') + 1;
      localStorage.setItem('e2e.n', String(n));
      localStorage.setItem('e2e.sub', `https://fcm.googleapis.com/fcm/send/e2e-${n}`);
      return make(localStorage.getItem('e2e.sub')!) as unknown as PushSubscription;
    };
    PushManager.prototype.getSubscription = async () => {
      const endpoint = localStorage.getItem('e2e.sub');
      return (endpoint ? make(endpoint) : null) as unknown as PushSubscription | null;
    };
  }, opts);
}

/** Answers every API call the private area makes; push and auth calls are recorded. */
export async function routeApi(page: Page, api: MockApi): Promise<void> {
  let configAnswers = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['xhr', 'fetch'].includes(request.resourceType())) return route.continue();
    const path = new URL(request.url()).pathname;
    const session = () => ({
      accessToken: token(api.user, api.extraClaims),
      refreshToken: `r-${api.user}`,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    if (/\/(web-push|iam\/auth)\//.test(path)) api.calls.push({ method: request.method(), path, body: request.postDataJSON() });
    if (path.endsWith('/iam/auth/token/refresh') || path.endsWith('/iam/auth/login')) return route.fulfill({ json: session() });
    if (path.endsWith('/iam/auth/logout')) return route.fulfill({ status: 204, body: '' });
    if (path.endsWith('/notifications/web-push/config')) {
      const enabled = api.config[Math.min(configAnswers++, api.config.length - 1)];
      return route.fulfill({ json: { enabled, publicKey: enabled ? 'BAAA' : null } });
    }
    if (path.endsWith('/notifications/web-push/subscription')) {
      if (api.putDelayMs) await new Promise((r) => setTimeout(r, api.putDelayMs));
      return api.putStatus >= 400
        ? route.fulfill({ status: api.putStatus, json: { message: 'e2e' } })
        : route.fulfill({ status: api.putStatus, body: '' });
    }
    // Everything else the shell reads: empty, so screens render their empty states.
    return route.fulfill({ json: path.includes('unread') ? { count: 0 } : [] });
  });
}

/** Opens the private area with a stored session for `api.user`. */
export async function openSignedIn(page: Page, origin: string, api: MockApi, path = '/dashboard'): Promise<void> {
  await page.addInitScript((user) => {
    if (!sessionStorage.getItem('e2e.started')) {
      sessionStorage.setItem('e2e.started', '1');
      localStorage.setItem('mantra.refresh-token', `r-${user}`);
    }
  }, api.user);
  await page.goto(`${origin}${path}`);
}

/** Logs out from the account menu, like a person. */
export async function logout(page: Page): Promise<void> {
  await page.getByTestId('header-cuenta').click();
  await page.getByTestId('header-cerrar-sesion').click();
  await page.waitForURL(/\/auth/);
}

/** Logs in through the form; the mocked API signs in as `api.user`. */
export async function login(page: Page): Promise<void> {
  await page.getByTestId('login-identifier').fill('persona@alovida.test');
  await page.getByTestId('login-password').fill('Clave-de-prueba-1!');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/dashboard/);
}
