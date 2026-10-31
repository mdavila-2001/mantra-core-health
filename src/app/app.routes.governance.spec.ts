import { RUTAS_DE_GOBIERNO } from './app.routes.governance';
import { seccionRolesGuard } from './core/navigation/section-roles.guard';
import { APP_SECTIONS } from './core/navigation/navigation.map';

/** Las pantallas del gobierno de accesos: cada ruta cuelga de una sección del registro y hereda su regla de rol. */
describe('RUTAS_DE_GOBIERNO', () => {
  const rutas = RUTAS_DE_GOBIERNO;

  it('declara las 18 pantallas hijas, sin repetir ninguna dirección', () => {
    expect(rutas).toHaveLength(18);
    expect(new Set(rutas.map((r) => r.path)).size).toBe(18);
  });

  it('todas llevan el guard de rol, carga diferida y un título con el nombre de la aplicación (AloVida)', () => {
    for (const r of rutas) {
      expect(r.canActivate).toEqual([seccionRolesGuard]);
      expect(typeof r.loadComponent).toBe('function');
      expect(r.title).toMatch(/^AloVida - /);
    }
  });

  it('los segmentos fijos van antes que los parámetros de su mismo prefijo (si no, el parámetro se los traga)', () => {
    const indice = (path: string): number => rutas.findIndex((r) => r.path === path);
    expect(indice('administration/access-governance/campaigns/new')).toBeLessThan(indice('administration/access-governance/campaigns/:campaignId'));
  });

  it('cada ruta resuelve a una sección del registro de menú (así hereda sus roles) y esa sección existe', () => {
    for (const r of rutas) {
      const ruta = r.path ?? '';
      const seccion = APP_SECTIONS.filter((s) => ruta === s.path || ruta.startsWith(`${s.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
      expect(seccion, ruta).toBeDefined();
    }
  });

  it('las tres secciones nuevas están en el registro con su rol y sin pertenecer al paciente', () => {
    const por = (path: string) => APP_SECTIONS.find((s) => s.path === path);
    expect(por('administration/access-governance')).toMatchObject({ label: 'Gobierno de accesos', roles: ['SECURITY_ADMIN'], onlyForAccountKind: 'ORGANIZATION' });
    expect(por('administration/team-management')).toMatchObject({ label: 'Mi equipo (administración)', roles: ['SUPPORT_STAFF'] });
    // El doctor no la ve en el menú (su lista es cerrada, §4.H): entra por `my-team/reviews`.
    expect(por('my-reviews')).toMatchObject({ label: 'Mis revisiones', roles: ['SECURITY_ADMIN', 'SUPPORT_STAFF'] });
  });
});
