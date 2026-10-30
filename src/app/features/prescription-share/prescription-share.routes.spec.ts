import { ErrorRecovery } from '../error-recovery/error-recovery';
import { PrescriptionVerify } from './prescription-verify/prescription-verify';
import { publicPrescriptionShareRoutes } from './prescription-share.routes';
import { PublicShare } from './public-share/public-share';

/**
 * Las rutas públicas de la receta (FAR-01, REQ-015 y REQ-016): las dos
 * direcciones exactas que imprimen la API y el PDF, sin guard ni sección
 * —quien llega puede no tener sesión— y con su pantalla diferida.
 */
describe('publicPrescriptionShareRoutes', () => {
  const routes = publicPrescriptionShareRoutes(() => ErrorRecovery);

  it('declara `rx/:token` y `verify/rx/:id`, sin guard', () => {
    expect(routes.map((route) => route.path)).toEqual(['rx/:token', 'verify/rx/:id']);
    for (const route of routes) {
      expect(route.canActivate, route.path).toBeUndefined();
      expect(route.title, route.path).toBeTruthy();
    }
  });

  it('cada una descarga su pantalla al entrar', async () => {
    const [share, verify] = await Promise.all(routes.map((route) => route.loadComponent?.()));
    expect(share).toBe(PublicShare);
    expect(verify).toBe(PrescriptionVerify);
  });
});
