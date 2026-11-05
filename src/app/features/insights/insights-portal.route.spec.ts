import { ErrorRecovery } from '../error-recovery/error-recovery';
import { ROLES_ROUTE_DATA } from '../../core/navigation/navigation.types';
import { rolesAlcanzan } from '../../core/navigation/navigation.types';
import { ROLES_INSIGHTS } from '../reporting/reporting-access';
import { insightsPortalRoute } from './insights-portal.route';

describe('insightsPortalRoute', () => {
  const ruta = insightsPortalRoute(() => ErrorRecovery);

  it('cuelga de /insights, fuera de cualquier armazón', () => {
    expect(ruta.path).toBe('insights');
  });

  it('exige sesión y rol: los dos guards, con los roles escritos en la propia ruta', () => {
    expect(ruta.canActivate?.length).toBe(2);
    expect(ruta.data?.[ROLES_ROUTE_DATA]).toBe(ROLES_INSIGHTS);
  });

  it('abre a plataforma y a marketing', () => {
    for (const rol of ['SUPERADMIN', 'PLATFORM_ADMIN', 'DATA_PLATFORM_ADMIN', 'MARKETING_MANAGER']) {
      expect(rolesAlcanzan(ROLES_INSIGHTS, [rol]), rol).toBe(true);
    }
  });

  it('NEGATIVO: no abre a BUSINESS_ADMIN, a reportería ni a quien no tiene rol', () => {
    for (const rol of ['BUSINESS_ADMIN', 'REPORTING_ADMIN', 'REPORT_VIEWER', 'PATIENT']) {
      expect(rolesAlcanzan(ROLES_INSIGHTS, [rol]), rol).toBe(false);
    }
    expect(rolesAlcanzan(ROLES_INSIGHTS, [])).toBe(false);
  });

  it('carga el marco y las rutas hijas bajo demanda', async () => {
    const hijas = await ruta.loadChildren?.();
    expect(Array.isArray(hijas)).toBe(true);
    const rutas = hijas as readonly { path?: string }[];
    expect(rutas.map((r) => r.path)).toContain('campaigns');
  });
});
