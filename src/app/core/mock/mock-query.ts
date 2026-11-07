import type { HttpRequest } from '@angular/common/http';

/**
 * The query the simulator hands to a handler. The API reads it from the URL itself (signed
 * download links carry it there) and from `HttpParams`; an explicit param wins over the same
 * key embedded in the URL.
 */
export function mockQueryOf(request: HttpRequest<unknown>): URLSearchParams {
  const query = new URLSearchParams(request.params.toString());
  const embedded = request.url.split('?')[1]?.split('#')[0];
  if (embedded) {
    new URLSearchParams(embedded).forEach((value, key) => {
      if (!query.has(key)) query.append(key, value);
    });
  }
  return query;
}
