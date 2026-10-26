import { APP_SECTIONS } from '@core/navigation/navigation.map';
import { PUBLIC_NAV_RAIL_SECTIONS } from '@shared/components/organisms/public-nav-rail/public-nav-rail.types';

import { ALOVIDA_ROUTES } from './alovida.routes';
import {
  CONNECTED_CANONICAL_URLS,
  designMockupRoutes,
  mockupPaths,
  legacyMockupRedirects,
  PROFILE_SLUG_PREFIXES,
  profileSlugRedirects,
  REAL_EQUIVALENTS,
} from './design-mockup-gate';
import { LEGACY_MOCKUP_PATHS } from './legacy-mockup-paths';

/** Las direcciones de la bóveda que, con el gate apagado, no se registran (c). */
function gatedPaths(): readonly string[] {
  const kept = new Set([...Object.keys(CONNECTED_CANONICAL_URLS), ...Object.keys(REAL_EQUIVALENTS)]);
  return mockupPaths().filter((path) => !kept.has(path));
}

describe('designMockupRoutes', () => {
  it('los tres mapas sólo nombran direcciones que el archivo generado declara', () => {
    // Si una regeneración de la bóveda renombra una pantalla, el mapa quedaría
    // redirigiendo una URL que ya nadie tiene y la maqueta nueva, sin gate
    // explícito, caería igual en (c): falla segura, pero hay que enterarse.
    const declared = new Set(mockupPaths());
    const named = [
      ...Object.keys(CONNECTED_CANONICAL_URLS),
      ...Object.keys(REAL_EQUIVALENTS),
      ...Object.keys(PROFILE_SLUG_PREFIXES),
    ];

    expect(named.filter((path) => !declared.has(path))).toEqual([]);
  });

  it('una dirección no puede ser a la vez conectada (a) y con equivalente (b)', () => {
    const both = Object.keys(CONNECTED_CANONICAL_URLS).filter((path) => path in REAL_EQUIVALENTS);

    expect(both).toEqual([]);
  });

  describe('encendido (maqueta)', () => {
    const tree = designMockupRoutes(true);

    it('monta las pantallas del archivo generado tal cual, sin tocarlas', () => {
      expect(tree).toBe(ALOVIDA_ROUTES);
    });
  });

  describe('las direcciones viejas en castellano (TAREA-29)', () => {
    it('cada una apunta a una dirección que el archivo generado declara', () => {
      const declared = new Set(mockupPaths());

      expect(Object.values(LEGACY_MOCKUP_PATHS).filter((path) => !declared.has(path))).toEqual([]);
      // Ninguna dirección vieja sobrevive como ruta: si no, el mapa sobra.
      expect(Object.keys(LEGACY_MOCKUP_PATHS).filter((path) => declared.has(path))).toEqual([]);
    });

    it('el archivo generado tiene una dirección vieja por cada ruta', () => {
      const legacyTargets = new Set(Object.values(LEGACY_MOCKUP_PATHS));

      expect(mockupPaths().filter((path) => !legacyTargets.has(path))).toEqual([]);
    });

    it('con maquetas, la vieja lleva a la maqueta con su ruta nueva', () => {
      const paths = legacyMockupRedirects(true).map((route) => route.path);

      expect(paths).toEqual(Object.keys(LEGACY_MOCKUP_PATHS));
    });

    it('con la API real, sólo se registran las que tienen destino real (a) o (b)', () => {
      const real = new Set([...Object.keys(CONNECTED_CANONICAL_URLS), ...Object.keys(REAL_EQUIVALENTS)]);
      const expected = Object.entries(LEGACY_MOCKUP_PATHS)
        .filter(([, current]) => real.has(current))
        .map(([legacy]) => legacy);

      expect(legacyMockupRedirects(false).map((route) => route.path)).toEqual(expected);
      expect(expected).toContain('personas/pacientes-listado');
      expect(expected).not.toContain('accesos/permisos-listado');
    });
  });

  it('la ficha de la bóveda con slug abre la ficha pública real (en los dos modos)', () => {
    expect(profileSlugRedirects()).toContainEqual(
      expect.objectContaining({
        path: 'explore/pharmacy-profile-detail/:slug',
        pathMatch: 'full',
        redirectTo: '/f/:slug',
      }),
    );
    expect(profileSlugRedirects()).toContainEqual(
      expect.objectContaining({
        path: 'buscar/perfil-farmacia-detalle/:slug',
        pathMatch: 'full',
        redirectTo: '/f/:slug',
      }),
    );
  });

  describe('apagado (API real)', () => {
    const tree = designMockupRoutes(false);

    it('no monta ninguna pantalla: sólo redirecciones', () => {
      // Sin componentes no hay marco con sesión falsa, ni nav de módulos de la
      // bóveda, ni una sola fila escrita a mano.
      expect(tree.filter((route) => route.loadComponent || route.component || route.children)).toEqual(
        [],
      );
      expect(tree.every((route) => route.redirectTo !== undefined)).toBe(true);
    });

    it('ninguna ruta sin equivalente (c) queda registrada', () => {
      const registered = new Set(tree.map((route) => route.path));
      const gated = gatedPaths();

      expect(gated.length).toBeGreaterThan(0);
      expect(gated.filter((path) => registered.has(path))).toEqual([]);
    });

    it('las (a) y (b) quedan registradas, cada una una sola vez y con coincidencia exacta', () => {
      const expected = [...Object.keys(CONNECTED_CANONICAL_URLS), ...Object.keys(REAL_EQUIVALENTS)];
      const paths = tree.map((route) => route.path);

      for (const path of expected) {
        expect(paths.filter((candidate) => candidate === path)).toHaveLength(1);
        expect(tree.find((route) => route.path === path)?.pathMatch).toBe('full');
      }
    });

    it.each([
      ['access/permissions-list'],
      ['shared-data/files-list'],
      ['institutions/organizations-suspend'],
      ['people/practitioners-list'],
      ['vocabulary/relationships-list'],
      ['explore/followed-and-saved-list'],
    ])('%s (maqueta sin equivalente) no existe', (path) => {
      expect(tree.some((route) => route.path === path)).toBe(false);
    });
  });
});

/**
 * Ningún menú visible con el gate apagado puede ofrecer una ruta gateada: sería
 * un enlace a un 404. Cubre el menú lateral por rol (`APP_SECTIONS`, del que se
 * construyen el menú y las rutas del armazón) y el rail del marco público. El
 * nav de módulos de la bóveda (`MODULOS_ALOVIDA`) no entra: sólo lo pinta
 * `AlovidaShell`, que con el gate apagado no se monta (ver arriba).
 */
describe('los menús no enlazan maquetas gateadas', () => {
  const gated = new Set(gatedPaths());
  const normalize = (route: string): string => route.replace(/^\//, '').split(/[?#]/)[0];

  it('ninguna sección del menú por rol apunta a una maqueta gateada', () => {
    const offenders = APP_SECTIONS.map((section) => normalize(section.path)).filter((path) =>
      gated.has(path),
    );

    expect(offenders).toEqual([]);
  });

  it('ninguna entrada del rail público apunta a una maqueta gateada', () => {
    const offenders = PUBLIC_NAV_RAIL_SECTIONS.flatMap((group) => group.entries)
      .map((entry) => normalize(entry.route))
      .filter((path) => gated.has(path));

    expect(offenders).toEqual([]);
  });

  it('ninguna sección del menú vive bajo un módulo de la bóveda', () => {
    const modules = new Set(ALOVIDA_ROUTES.map((route) => route.path));
    const offenders = APP_SECTIONS.map((section) => normalize(section.path).split('/')[0]).filter(
      (first) => modules.has(first),
    );

    expect(offenders).toEqual([]);
  });
});
