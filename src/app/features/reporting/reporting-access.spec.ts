import { MOCK_USERS } from '../../core/mock/mock-session';
import {
  accesoAPortales,
  cantidadDePortales,
  entryDestination,
  puedeVerAdministracion,
  puedeVerInsights,
  puedeVerPlataforma,
  puedeVerReporteria,
  ROLES_ADMINISTRACION,
  ROLES_INSIGHTS,
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

  describe('puedeVerInsights', () => {
    it.each(ROLES_INSIGHTS.filter((rol) => rol !== 'SUPERADMIN'))('%s abre AloVida Insights', (rol) => {
      expect(puedeVerInsights([rol])).toBe(true);
    });

    it('SUPERADMIN pasa siempre', () => {
      expect(puedeVerInsights(['SUPERADMIN'])).toBe(true);
    });

    it.each([
      ['paciente', ['PATIENT']],
      ['profesional', ['PRACTITIONER']],
      ['solo reportería', ['REPORT_VIEWER']],
      ['administrador de negocio', ['BUSINESS_ADMIN']],
      ['sin roles', []],
    ])('NEGATIVO: %s no abre Insights', (_nombre, roles) => {
      expect(puedeVerInsights(roles)).toBe(false);
    });

    it('las cuentas admin@ y superadmin@ del servidor simulado lo abren; las demás no', () => {
      const abre = (clave: string) => puedeVerInsights(MOCK_USERS.find((u) => u.key === clave)?.roles ?? []);
      expect(abre('admin')).toBe(true);
      expect(abre('superadmin')).toBe(true);
      for (const clave of ['medica', 'paciente', 'visitador', 'aprobador', 'laboratorio', 'farmacia']) {
        expect(abre(clave), clave).toBe(false);
      }
    });
  });

  describe('accesoAPortales', () => {
    it('administración + reportería: los dos', () => {
      expect(accesoAPortales(['SECURITY_ADMIN', 'REPORTING_ADMIN'])).toEqual({
        administracion: true,
        reporteria: true,
        insights: false,
      });
    });

    it('BUSINESS_ADMIN da administración y reportería, pero no Insights', () => {
      expect(accesoAPortales(['BUSINESS_ADMIN'])).toEqual({
        administracion: true,
        reporteria: true,
        insights: false,
      });
    });

    it('PLATFORM_ADMIN da los tres por sí solo', () => {
      expect(accesoAPortales(['PLATFORM_ADMIN'])).toEqual({
        administracion: true,
        reporteria: true,
        insights: true,
      });
    });

    it('solo administración', () => {
      expect(accesoAPortales(['SECURITY_ADMIN'])).toEqual({
        administracion: true,
        reporteria: false,
        insights: false,
      });
    });

    it('solo reportería', () => {
      expect(accesoAPortales(['REPORT_AUTHOR'])).toEqual({
        administracion: false,
        reporteria: true,
        insights: false,
      });
    });

    it('ninguno', () => {
      expect(accesoAPortales(['PATIENT'])).toEqual({
        administracion: false,
        reporteria: false,
        insights: false,
      });
    });
  });

  describe('las cuentas del servidor simulado', () => {
    const acceso = (clave: string) => {
      const account = MOCK_USERS.find((u) => u.key === clave);
      expect(account, clave).toBeDefined();
      return accesoAPortales(account?.roles ?? []);
    };

    it('admin@ y superadmin@ eligen portal: tienen los tres accesos', () => {
      expect(acceso('admin')).toEqual({ administracion: true, reporteria: true, insights: true });
      expect(acceso('superadmin')).toEqual({
        administracion: true,
        reporteria: true,
        insights: true,
      });
    });

    it('marketing@ entra solo a Insights, con el rol que la API limita a su tenant', () => {
      expect(acceso('marketing')).toEqual({
        administracion: false,
        reporteria: false,
        insights: true,
      });
      const cuenta = MOCK_USERS.find((u) => u.key === 'marketing');
      expect(cuenta?.roles).toEqual(['MARKETING_MANAGER']);
      expect(Object.values(cuenta?.scopedRoles ?? {}).flat()).toContain('MARKETING_MANAGER');
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

  describe('entryDestination', () => {
    it('con los dos accesos hay que elegir', () => {
      expect(entryDestination(['PLATFORM_ADMIN'])).toBe('/portal-selector');
      expect(entryDestination(['SECURITY_ADMIN', 'REPORTING_ADMIN'])).toBe('/portal-selector');
      expect(entryDestination(['SUPERADMIN'])).toBe('/portal-selector');
    });

    it('quien solo tiene reportería entra derecho a su portal', () => {
      expect(entryDestination(['REPORT_VIEWER'])).toBe('/reports');
      expect(entryDestination(['REPORT_AUTHOR'])).toBe('/reports');
    });

    it('quien solo es de marketing entra derecho a AloVida Insights', () => {
      expect(entryDestination(['MARKETING_MANAGER'])).toBe('/insights');
    });

    it('quien tiene administración e Insights, sin reportería, elige en el selector', () => {
      expect(entryDestination(['DATA_PLATFORM_ADMIN'])).toBe('/portal-selector');
    });

    it('NEGATIVO: BUSINESS_ADMIN nunca abre Insights', () => {
      expect(puedeVerInsights(['BUSINESS_ADMIN'])).toBe(false);
      expect(accesoAPortales(['BUSINESS_ADMIN']).insights).toBe(false);
    });

    it('cantidadDePortales cuenta los accesos de la sesión', () => {
      expect(cantidadDePortales(accesoAPortales(['SUPERADMIN']))).toBe(3);
      expect(cantidadDePortales(accesoAPortales(['MARKETING_MANAGER']))).toBe(1);
      expect(cantidadDePortales(accesoAPortales(['PATIENT']))).toBe(0);
    });

    it('quien solo tiene administración, o ninguno de los dos, entra como siempre', () => {
      expect(entryDestination(['SECURITY_ADMIN'])).toBe('/');
      expect(entryDestination(['PATIENT'])).toBe('/');
      expect(entryDestination([])).toBe('/');
    });
  });
});

describe('puedeVerPlataforma', () => {
  it('solo los roles de plataforma eligen el alcance «Plataforma»', () => {
    expect(puedeVerPlataforma(['SUPERADMIN'])).toBe(true);
    expect(puedeVerPlataforma(['PLATFORM_ADMIN'])).toBe(true);
    for (const rol of ['BUSINESS_ADMIN', 'REPORTING_ADMIN', 'REPORT_AUTHOR', 'REPORT_VIEWER']) {
      expect(puedeVerPlataforma([rol])).toBe(false);
    }
    expect(puedeVerPlataforma([])).toBe(false);
  });
});
