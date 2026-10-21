import { describe, expect, it } from 'vitest';

import { PORTAL_NAV, groupOf, isActive, portalCrumbs, portalUrl } from './portal-nav';

const item = (path: string) => PORTAL_NAV.flatMap((g) => g.items).find((i) => i.path === path)!;

describe('portal-nav', () => {
  it('cada pantalla vive bajo administration/portal y no hay rutas repetidas', () => {
    const rutas = PORTAL_NAV.flatMap((g) => g.items.map((i) => portalUrl(i.path)));
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(rutas.every((r) => r.startsWith('/administration/portal'))).toBe(true);
  });

  it('el centro sólo se ilumina en su ruta exacta', () => {
    expect(isActive(item(''), '/administration/portal')).toBe(true);
    expect(isActive(item(''), '/administration/portal/')).toBe(true);
    expect(isActive(item(''), '/administration/portal/procesos')).toBe(false);
  });

  it('una ficha ilumina la pantalla de la que cuelga', () => {
    expect(
      isActive(
        item('sistemas/operaciones'),
        '/administration/portal/sistemas/operaciones/Foo_bar?vista=contratos',
      ),
    ).toBe(true);
    expect(
      isActive(item('catalogo/tablas'), '/administration/portal/catalogo/tablas/iam/users/ficha'),
    ).toBe(true);
  });

  it('la más específica gana: el mapa de rutas no se ilumina en el diagrama', () => {
    const url = '/administration/portal/sistemas/flujos/diagrama?flujo=scheduling';
    expect(isActive(item('sistemas/flujos/diagrama'), url)).toBe(true);
    expect(isActive(item('sistemas/flujos'), url)).toBe(false);
    expect(
      isActive(item('sistemas/flujos'), '/administration/portal/sistemas/flujos?senal=SIN_PRUEBAS'),
    ).toBe(true);
  });

  it('sólo hay una pantalla activa por dirección', () => {
    for (const url of [
      '/administration/portal',
      '/administration/portal/sistemas/flujos/diagrama',
      '/administration/portal/catalogo/tablas/a/b',
    ]) {
      expect(PORTAL_NAV.flatMap((g) => g.items).filter((i) => isActive(i, url))).toHaveLength(1);
    }
  });

  it('las migas dicen portal, grupo y pantalla; el centro sólo «Portal»', () => {
    expect(portalCrumbs('/administration/portal/procesos/scheduling').map((c) => c.label)).toEqual([
      'Portal',
      'Procesos',
      'Procesos',
    ]);
    expect(portalCrumbs('/administration/portal')).toEqual([{ label: 'Portal', url: null }]);
    expect(portalCrumbs('/administration/portal/desconocida')).toEqual([
      { label: 'Portal', url: null },
    ]);
  });

  it('groupOf devuelve el grupo abierto por la ruta activa', () => {
    expect(groupOf('/administration/portal/linaje')?.id).toBe('linaje');
    expect(groupOf('/otra/cosa')).toBeNull();
  });
});
