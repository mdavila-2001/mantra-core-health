import { coordinatesFromMapUrl } from '../../../shared/utils/branch-import/branch-coordinates';
import type { MockRouter } from '../mock-router';

/** Where the simulator places a `maps.app.goo.gl` short link: it cannot follow redirects. */
const SHORT_LINK_POINT = { latitude: -17.7833, longitude: -63.1821 };

/**
 * `POST /tenants/:id/branches/location-preview`, as the API answers it: the point a
 * map link carries, or `resolved: false`. Short links resolve to a fixed demo point.
 */
export function registerBranchLocationPreview(router: MockRouter): void {
  router.post('/tenants/:id/branches/location-preview', (request) => {
    const url = String((request.body as { url?: string } | null)?.url ?? '').trim();
    const point = coordinatesFromMapUrl(url) ?? (/^https:\/\/(maps\.app\.)?goo\.gl\//i.test(url) ? SHORT_LINK_POINT : null);
    return point === null ? { resolved: false } : { resolved: true, ...point };
  });
}
