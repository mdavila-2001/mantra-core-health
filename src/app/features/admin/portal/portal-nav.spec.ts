import { describe, expect, it } from 'vitest';

import { PORTAL_NAV, groupOf, isActive, portalCrumbs, portalUrl } from './portal-nav';

const item = (path: string) => PORTAL_NAV.flatMap((g) => g.items).find((i) => i.path === path)!;

describe('portal-nav', () => {
  it('cada pantalla vive bajo superadmin/portal y no hay rutas repetidas', () => {
    const rutas = PORTAL_NAV.flatMap((g) => g.items.map((i) => portalUrl(i.path)));
    expect(new Set(rutas).size).toBe(rutas.length);
    expect(rutas.every((r) => r.startsWith('/superadmin/portal'))).toBe(true);
  });

  it('el centro sólo se ilumina en su ruta exacta', () => {
    expect(isActive(item(''), '/superadmin/portal')).toBe(true);
    expect(isActive(item(''), '/superadmin/portal/')).toBe(true);
    expect(isActive(item(''), '/superadmin/portal/procesos')).toBe(false);
  });

  it('una ficha ilumina la pantalla de la que cuelga', () => {
    expect(
      isActive(
        item('sistemas/operaciones'),
        '/superadmin/portal/sistemas/operaciones/Foo_bar?vista=contratos',
      ),
    ).toBe(true);
    expect(
      isActive(item('catalogo/tablas'), '/superadmin/portal/catalogo/tablas/iam/users/ficha'),
    ).toBe(true);
  });

  it('la más específica gana: el mapa de rutas no se ilumina en el diagrama', () => {
    const url = '/superadmin/portal/sistemas/flujos/diagrama?flujo=scheduling';
    expect(isActive(item('sistemas/flujos/diagrama'), url)).toBe(true);
    expect(isActive(item('sistemas/flujos'), url)).toBe(false);
    expect(
      isActive(item('sistemas/flujos'), '/superadmin/portal/sistemas/flujos?senal=SIN_PRUEBAS'),
    ).toBe(true);
  });

  it('sólo hay una pantalla activa por dirección', () => {
    for (const url of [
      '/superadmin/portal',
      '/superadmin/portal/sistemas/flujos/diagrama',
      '/superadmin/portal/catalogo/tablas/a/b',
    ]) {
      expect(PORTAL_NAV.flatMap((g) => g.items).filter((i) => isActive(i, url))).toHaveLength(1);
    }
  });

  it('las migas dicen portal, grupo y pantalla; el centro sólo «Portal»', () => {
    expect(portalCrumbs('/superadmin/portal/procesos/scheduling').map((c) => c.label)).toEqual([
      'Portal',
      'Procesos',
      'Procesos',
    ]);
    expect(portalCrumbs('/superadmin/portal')).toEqual([{ label: 'Portal', url: null }]);
    expect(portalCrumbs('/superadmin/portal/desconocida')).toEqual([
      { label: 'Portal', url: null },
    ]);
  });

  it('groupOf devuelve el grupo abierto por la ruta activa', () => {
    expect(groupOf('/superadmin/portal/linaje')?.id).toBe('linaje');
    expect(groupOf('/otra/cosa')).toBeNull();
  });

  it('el gobierno de acceso declara auditoría, usuarios y roles y deriva de permisos', () => {
    const governance = PORTAL_NAV.find((g) => g.id === 'gobierno')!;
    expect(governance.items.map((i) => i.path)).toEqual([
      'gobierno/auditoria',
      'gobierno/usuarios',
      'gobierno/deriva-permisos',
    ]);
    expect(groupOf('/superadmin/portal/gobierno/usuarios?user=x')?.id).toBe('gobierno');
    expect(portalCrumbs('/superadmin/portal/gobierno/auditoria?view=data-access').map((c) => c.label)).toEqual([
      'Portal',
      'Gobierno y acceso',
      'Auditoría',
    ]);
  });
});
