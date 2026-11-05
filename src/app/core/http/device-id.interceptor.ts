import type { HttpInterceptorFn } from '@angular/common/http';

const STORAGE_KEY = 'alovida.device-id';

/**
 * Stable per-browser key, generated once and kept in `localStorage`. The API hashes it with the
 * account id to recognise the device («Ajustes › Dispositivos»); it is not a secret and proves
 * nothing by itself. `null` where there is no storage (SSR, private mode).
 */
export function deviceKey(): string | null {
  try {
    const known = localStorage.getItem(STORAGE_KEY);
    if (known) return known;
    const fresh = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Adds `X-Device-Id` to the login request only: that is where the API detects the device. */
export const deviceIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.endsWith('/iam/auth/login')) return next(request);
  const key = deviceKey();
  return next(key === null ? request : request.clone({ setHeaders: { 'X-Device-Id': key } }));
};
