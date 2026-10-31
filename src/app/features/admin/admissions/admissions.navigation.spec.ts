import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { NAV_SUBGROUPS } from '../../../core/navigation/navigation.subgroups';
import { isVisibleTo } from '../../../core/navigation/navigation.types';
import { ADMISSIONS_ROUTE, ADMISSIONS_SCREENS, admissionDetailRoute } from './admissions.routes';

const seccion = APP_SECTIONS.find((s) => s.path === 'administration/admissions')!;

describe('la sección «Admisiones»', () => {
  it('existe, en Administración, con la ruta de la bandeja', () => {
    expect(seccion).toBeDefined();
    expect(seccion.group).toBe('Administración');
    expect(seccion.label).toBe('Admisiones');
    expect(ADMISSIONS_ROUTE).toBe(`/${seccion.path}`);
    expect(Object.keys(ADMISSIONS_SCREENS)).toEqual([seccion.path]);
  });

  it('la ven la administración de seguridad, quien revisa y quien aprueba', () => {
    for (const rol of ['SECURITY_ADMIN', 'ADMISSIONS_REVIEWER', 'ADMISSIONS_APPROVER', 'SUPERADMIN']) {
      expect(isVisibleTo(seccion, [rol], [], null), rol).toBe(true);
    }
  });

  it('no la ven el paciente ni el médico: ni en el menú ni por ruta', () => {
    for (const rol of ['PATIENT', 'PRACTITIONER', 'CLINICIAN', 'USER']) {
      expect(isVisibleTo(seccion, [rol], [], null), rol).toBe(false);
    }
  });

  it('está en exactamente un bloque del menú de Administración', () => {
    const bloques = NAV_SUBGROUPS.filter((b) => b.paths.includes('administration/admissions'));
    expect(bloques).toHaveLength(1);
    expect(bloques[0]!.group).toBe('Administración');
  });

  it('la ficha cuelga de la bandeja y escapa el identificador', () => {
    expect(admissionDetailRoute('abc')).toBe('/administration/admissions/abc');
    expect(admissionDetailRoute('a/b?c')).toBe('/administration/admissions/a%2Fb%3Fc');
  });
});
