import { routes } from '../../app.routes';
import { seccionRolesGuard } from '../../core/navigation/section-roles.guard';
import { ErrorRecovery } from '../error-recovery/error-recovery';
import { PHARMACY_OPEN_PRESCRIPTION_ROUTE } from '../prescription-share/prescription-share.paths';
import { OpenPrescription } from './open-prescription/open-prescription';
import { OPEN_PRESCRIPTION_PATH, prescriptionDispenseRoutes } from './prescription-dispense.routes';

/**
 * La ruta de «Abrir receta» (FAR-02, REQ-FAR-02-008): la dirección a la que
 * lleva `/rx/:token`, dentro del armazón y con el guard de la sección de la
 * bandeja, y antes del detalle de mostrador.
 */
describe('prescriptionDispenseRoutes', () => {
  const declared = prescriptionDispenseRoutes(() => ErrorRecovery);

  it('es la dirección a la que lleva /rx/:token, con el token detrás', () => {
    expect(OPEN_PRESCRIPTION_PATH).toBe(`${PHARMACY_OPEN_PRESCRIPTION_ROUTE.slice(1)}/:token`);
    expect(declared.map((route) => route.path)).toEqual([OPEN_PRESCRIPTION_PATH]);
  });

  it('lleva el guard de la sección y un título', () => {
    expect(declared[0].canActivate).toEqual([seccionRolesGuard]);
    expect(declared[0].title).toBeTruthy();
  });

  it('descarga la pantalla al entrar', async () => {
    expect(await declared[0].loadComponent?.()).toBe(OpenPrescription);
  });

  it('cuelga del armazón con sesión, junto al detalle de mostrador', () => {
    const shell = routes.find((route) => route.path === '' && route.children !== undefined && route.children.length > 0);
    const children = shell?.children ?? [];
    const paths = children.map((route) => route.path);

    expect(paths).toContain(OPEN_PRESCRIPTION_PATH);
    expect(paths.indexOf(OPEN_PRESCRIPTION_PATH)).toBeLessThan(
      paths.indexOf('administration/pharmacy-orders/:orderId'),
    );
  });
});
