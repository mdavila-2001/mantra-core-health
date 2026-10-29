import type { Type } from '@angular/core';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

/**
 * Hasta P47 el portal con el modal (categoría, imágenes, precio, estado) era
 * sólo del simulador porque el DTO real no publicaba esos campos y la API real
 * caía en `PharmacyCatalog` (alta y retiro, sin edición). Desde P47 la API los
 * sirve (`managed=true`, categorías por farmacia, imágenes): visto en navegador
 * contra la API real el 26/10/2026 (alta, edición con categoría propia, imagen
 * y precio, recarga y consulta a la base). Las dos rutas cargan la pantalla
 * completa.
 */
describe('pharmacy catalog route', () => {
  const originalMockBackend = environment.mockBackend;
  afterEach(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  for (const [mockBackend, component] of [[false, 'PharmacyProducts'], [true, 'PharmacyProducts']] as const) {
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
