import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';

/**
 * Hasta P47 el portal con el modal (categoría, imágenes, precio, estado) era
 * sólo del simulador porque el DTO real no publicaba esos campos y la API real
 * caía en `PharmacyCatalog` (alta y retiro, sin edición). Desde P47 la API los
 * sirve (`managed=true`, categorías por farmacia, imágenes): visto en navegador
 * contra la API real el 26/10/2026 (alta, edición con categoría propia, imagen
 * y precio, recarga y consulta a la base). Las dos rutas cargan la pantalla
 * completa, que desde el catálogo por pestañas es `PharmacyCatalogHub`.
 */
describe('pharmacy catalog route', () => {
  const originalMockBackend = environment.mockBackend;
  afterEach(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  for (const [mockBackend, component] of [[false, 'PharmacyCatalogHub'], [true, 'PharmacyCatalogHub']] as const) {
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

/**
 * Las cuatro pantallas sueltas del catálogo son pestañas: su dirección vieja
 * abre la pestaña y conserva el query y el `#ancla` que traía el enlace.
 */
describe('las direcciones viejas del catálogo de la farmacia', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(withoutGuards(routes))] });
    router = TestBed.inject(Router);
  });

  for (const tab of ['categories', 'prices', 'inventory', 'import'] as const) {
    it(`/administration/pharmacy-${tab} abre la pestaña «${tab}»`, async () => {
      expect(await router.navigateByUrl(`/administration/pharmacy-${tab}`)).toBe(true);
      expect(router.url).toBe(`/administration/pharmacy-catalog?tab=${tab}`);
    });
  }

  it('conserva el query y el ancla: «solo alertas» sigue llegando a Inventario', async () => {
    expect(await router.navigateByUrl('/administration/pharmacy-inventory?alerts=true#tabla')).toBe(true);
    expect(router.url).toBe('/administration/pharmacy-catalog?alerts=true&tab=inventory#tabla');
  });

  it('un `tab` entrante no le gana: la dirección vieja sigue siendo su pestaña', async () => {
    expect(await router.navigateByUrl('/administration/pharmacy-prices?tab=products')).toBe(true);
    expect(router.url).toBe('/administration/pharmacy-catalog?tab=prices');
  });
});

function withoutGuards(tree: typeof routes): typeof routes {
  return tree.map((route) => ({
    ...route,
    ...(route.canActivate === undefined ? {} : { canActivate: [] }),
    ...(route.children === undefined ? {} : { children: withoutGuards(route.children) }),
  }));
}
