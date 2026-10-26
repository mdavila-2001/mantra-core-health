import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type ActivatedRouteSnapshot, type Routes } from '@angular/router';
import { of } from 'rxjs';
import { PublicDirectoryClient } from './core/data-access/public-directory/public-directory.client';

import { routes } from './app.routes';
import { ALOVIDA_ROUTES } from './features/alovida/alovida.routes';
import {
  CONNECTED_CANONICAL_URLS,
  designMockupRoutes,
  REAL_EQUIVALENTS,
} from './features/alovida/design-mockup-gate';

/** El router por defecto ya usa API real. La demo se comprueba con su gate explicito. */
function apiTree(): Routes {
  return withoutGuards(routes);
}

function withoutGuards(tree: Routes): Routes {
  return tree.map((route) => ({
    ...route,
    ...(route.canActivate === undefined ? {} : { canActivate: [] }),
    ...(route.children === undefined ? {} : { children: withoutGuards(route.children) }),
  }));
}

describe('el gate de maquetas con la API real (production-api)', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(apiTree()),
        { provide: PublicDirectoryClient, useValue: { getProfile: () => of(null) } },
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  /** La hoja activa: `**` quiere decir que cayó en el 404. */
  function leafPath(): string | undefined {
    let node: ActivatedRouteSnapshot = router.routerState.snapshot.root;
    while (node.firstChild) node = node.firstChild;
    return node.routeConfig?.path;
  }

  it.each(Object.entries({ ...CONNECTED_CANONICAL_URLS, ...REAL_EQUIVALENTS }))(
    '/%s lleva a %s, y esa pantalla existe',
    async (legacyPath, target) => {
      await router.navigateByUrl(`/${legacyPath}`);

      expect(location.path() || '/').toBe(target);
      expect(leafPath()).not.toBe('**');
    },
  );

  it.each([
    ['/access-control/permissions-list'],
    ['/access-control'],
    ['/shared-data/files-list'],
    ['/provider-directory/organizations-suspend'],
    ['/people/practitioners-list'],
    ['/vocabulary/relationships-list'],
    ['/search/followed-and-saved-list'],
  ])('%s (sin equivalente) cae en el 404', async (url) => {
    await router.navigateByUrl(url);

    expect(location.path()).toBe(url);
    expect(leafPath()).toBe('**');
  });

  it('la búsqueda guardada en la URL de la bóveda sobrevive a la redirección', async () => {
    await router.navigateByUrl('/search/practitioners-list?q=cardio');

    expect(location.path()).toBe('/search/practitioners?q=cardio');
  });

  it('el #ancla de una dirección vieja de la bóveda sobrevive a la redirección', async () => {
    await router.navigateByUrl('/directorio/organizaciones-listado?q=clinica#tabla');

    expect(location.path(true)).toBe('/administration/organizations?q=clinica#tabla');
  });

  it('la ficha de la bóveda con slug abre la ficha pública real', async () => {
    await router.navigateByUrl('/search/pharmacy-profile-detail/farmacia-central');

    expect(location.path()).toBe('/f/farmacia-central');
  });
});

describe('el gate de maquetas en la maqueta (configuracion demo)', () => {
  it('las pantallas de la bóveda siguen montadas', () => {
    for (const route of ALOVIDA_ROUTES) {
      expect(designMockupRoutes(true)).toContain(route);
    }
  });
});
