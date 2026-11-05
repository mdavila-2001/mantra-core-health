import { PORTAL_VISIBILITY_ROUTES } from './visibility.routes';

describe('PORTAL_VISIBILITY_ROUTES', () => {
  it('declara las tres pantallas en el grupo «Gobierno y acceso», relativas a superadmin/portal', () => {
    expect(PORTAL_VISIBILITY_ROUTES.map((r) => r.path)).toEqual([
      'governance/ui-catalog',
      'governance/ui-rules',
      'governance/ui-preview',
    ]);
  });

  it('cada ruta tiene título propio y descarga un componente de verdad', async () => {
    const titles = new Set<string>();
    for (const route of PORTAL_VISIBILITY_ROUTES) {
      expect(typeof route.title).toBe('string');
      titles.add(route.title as string);
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component).toBeTruthy();
    }
    expect(titles.size).toBe(3);
  });
});
