import { APP_SECTIONS } from '@core/navigation/navigation.map';
import { PUBLIC_NAV_RAIL_SECTIONS } from '@shared/components/organisms/public-nav-rail/public-nav-rail.types';

import { ALOVIDA_ROUTES } from './alovida.routes';
import {
  CONNECTED_CANONICAL_URLS,
  designMockupRoutes,
  mockupPaths,
  PROFILE_SLUG_PREFIXES,
  REAL_EQUIVALENTS,
} from './design-mockup-gate';

/** Las direcciones de la bóveda que, con el gate apagado, no se registran (c). */
function gatedPaths(): readonly string[] {
  const kept = new Set([...Object.keys(CONNECTED_CANONICAL_URLS), ...Object.keys(REAL_EQUIVALENTS)]);
  // `buscar` a secas lo redirige `app.routes.ts` a `/search` antes de llegar acá.
  return mockupPaths().filter((path) => path !== 'buscar' && !kept.has(path));
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
      for (const route of ALOVIDA_ROUTES) {
        expect(tree).toContain(route);
      }
    });

    it('además, la ficha de la bóveda con slug abre la ficha pública real', () => {
      expect(tree).toContainEqual(
        expect.objectContaining({
          path: 'buscar/perfil-farmacia-detalle/:slug',
          redirectTo: '/f/:slug',
        }),
      );
    });
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
      ['accesos/permisos-listado'],
      ['datos-compartidos/archivos-listado'],
      ['directorio/organizaciones-suspender'],
      ['personas/profesionales-listado'],
      ['terminologia/relaciones-listado'],
      ['buscar/seguidos-y-guardados-listado'],
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
