import type { Type } from '@angular/core';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

/** El portal demo usa campos que el DTO de farmacia real todavia no publica. */
describe('pharmacy catalog route', () => {
  const originalMockBackend = environment.mockBackend;
  afterEach(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  for (const [mockBackend, component] of [[false, 'PharmacyCatalog'], [true, 'PharmacyProducts']] as const) {
    it(`loads ${component} with mockBackend=${mockBackend}`, async () => {
      Object.assign(environment, { mockBackend });
      const shell = routes.find((route) => route.path === '' && route.component !== undefined && route.children !== undefined);
      const route = shell?.children?.find((child) => child.path === 'administration/pharmacy-catalog');
      expect(route).toBeDefined();
      const loaded = await route?.loadComponent?.();
      expect((loaded as Type<unknown>).name.replace(/^_+/, '')).toBe(component);
    });
  }
});
