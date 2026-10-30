import { MOCK_USERS } from '../../core/mock/mock-session';
import {
  accesoAPortales,
  destinoDeEntrada,
  puedeVerAdministracion,
  puedeVerReporteria,
  ROLES_ADMINISTRACION,
  ROLES_REPORTERIA,
} from './reporting-access';

describe('acceso a los portales (administración y reportería)', () => {
  describe('puedeVerReporteria', () => {
    it.each(ROLES_REPORTERIA.filter((rol) => rol !== 'SUPERADMIN'))('%s abre reportería', (rol) => {
      expect(puedeVerReporteria([rol])).toBe(true);
    });

    it('SUPERADMIN pasa siempre (comodín)', () => {
      expect(puedeVerReporteria(['SUPERADMIN'])).toBe(true);
    });

    it('alcanza con uno solo de los roles', () => {
      expect(puedeVerReporteria(['USER', 'REPORT_VIEWER'])).toBe(true);
    });

    it.each([
      ['paciente', ['PATIENT']],
      ['profesional', ['PRACTITIONER']],
      ['clínico', ['CLINICIAN']],
      ['visitador médico', ['MEDICAL_VISITOR']],
      ['aprobador de admisiones', ['ADMISSIONS_APPROVER']],
      ['administrador de seguridad', ['SECURITY_ADMIN']],
      ['solo el rol base', ['USER']],
      ['sin roles', []],
    ])('NEGATIVO: %s no abre reportería', (_nombre, roles) => {
      expect(puedeVerReporteria(roles)).toBe(false);
    });

    it('un nombre parecido no cuenta (no hay coincidencia parcial)', () => {
      expect(puedeVerReporteria(['REPORT_VIEWER_X', 'reporting_admin'])).toBe(false);
    });
  });

  describe('puedeVerAdministracion', () => {
    it.each(ROLES_ADMINISTRACION.filter((rol) => rol !== 'SUPERADMIN'))(
      '%s abre administración',
      (rol) => {
        expect(puedeVerAdministracion([rol])).toBe(true);
      },
    );

    it('SUPERADMIN pasa siempre', () => {
      expect(puedeVerAdministracion(['SUPERADMIN'])).toBe(true);
    });

    it.each([
      ['paciente', ['PATIENT']],
      ['profesional', ['PRACTITIONER']],
      ['visitador médico', ['MEDICAL_VISITOR']],
      ['solo reportería', ['REPORT_VIEWER']],
      ['sin roles', []],
    ])('NEGATIVO: %s no abre administración', (_nombre, roles) => {
      expect(puedeVerAdministracion(roles)).toBe(false);
    });
  });

  describe('accesoAPortales', () => {
    it('administración + reportería: los dos', () => {
      expect(accesoAPortales(['SECURITY_ADMIN', 'REPORTING_ADMIN'])).toEqual({
        administracion: true,
        reporteria: true,
      });
    });

    it('BUSINESS_ADMIN y PLATFORM_ADMIN dan los dos por sí solos', () => {
      for (const rol of ['BUSINESS_ADMIN', 'PLATFORM_ADMIN']) {
        expect(accesoAPortales([rol])).toEqual({ administracion: true, reporteria: true });
      }
    });

    it('solo administración', () => {
      expect(accesoAPortales(['SECURITY_ADMIN'])).toEqual({
        administracion: true,
        reporteria: false,
      });
    });

    it('solo reportería', () => {
      expect(accesoAPortales(['REPORT_AUTHOR'])).toEqual({
        administracion: false,
        reporteria: true,
      });
    });

    it('ninguno', () => {
      expect(accesoAPortales(['PATIENT'])).toEqual({ administracion: false, reporteria: false });
    });
  });

  describe('las cuentas del servidor simulado', () => {
    const acceso = (clave: string) => {
      const account = MOCK_USERS.find((u) => u.key === clave);
      expect(account, clave).toBeDefined();
      return accesoAPortales(account?.roles ?? []);
    };

    it('admin@ y superadmin@ eligen portal: tienen los dos accesos', () => {
      expect(acceso('admin')).toEqual({ administracion: true, reporteria: true });
      expect(acceso('superadmin')).toEqual({ administracion: true, reporteria: true });
    });

    it('ambas llevan el rol REPORTING_ADMIN además de los que ya abrían reportería', () => {
      for (const clave of ['admin', 'superadmin']) {
        expect(MOCK_USERS.find((u) => u.key === clave)?.roles).toContain('REPORTING_ADMIN');
      }
    });

    it.each(['medica', 'paciente', 'visitador', 'aprobador', 'medico_nuevo'])(
      'NEGATIVO: %s no tiene acceso a reportería',
      (clave) => {
        expect(acceso(clave).reporteria).toBe(false);
      },
    );

    it('NEGATIVO: ninguna otra cuenta de organización (aseguradora, laboratorio, farmacia) entra', () => {
      for (const clave of ['aseguradora', 'aseguradora_staff', 'laboratorio', 'farmacia']) {
        expect(acceso(clave).reporteria, clave).toBe(false);
      }
    });
  });

  describe('destinoDeEntrada', () => {
    it('con los dos accesos hay que elegir', () => {
      expect(destinoDeEntrada(['PLATFORM_ADMIN'])).toBe('/portal-selector');
      expect(destinoDeEntrada(['SECURITY_ADMIN', 'REPORTING_ADMIN'])).toBe('/portal-selector');
      expect(destinoDeEntrada(['SUPERADMIN'])).toBe('/portal-selector');
    });

    it('quien solo tiene reportería entra derecho a su portal', () => {
      expect(destinoDeEntrada(['REPORT_VIEWER'])).toBe('/reports');
      expect(destinoDeEntrada(['REPORT_AUTHOR'])).toBe('/reports');
    });

    it('quien solo tiene administración, o ninguno de los dos, entra como siempre', () => {
      expect(destinoDeEntrada(['SECURITY_ADMIN'])).toBe('/');
      expect(destinoDeEntrada(['PATIENT'])).toBe('/');
      expect(destinoDeEntrada([])).toBe('/');
    });
  });
});
