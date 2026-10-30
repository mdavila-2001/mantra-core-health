import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { esPerfilDeGestion, seccionDeGestion } from './navigation.management';
import { APP_SECTIONS } from './navigation.map';
import { NavigationService } from './navigation.service';

@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Vacio {}

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('Menú del perfil de gestión', () => {
  let service: NavigationService;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });
    service = TestBed.inject(NavigationService);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(roles: readonly string[]) {
    session.start({
      accessToken: jwt({ sub: 'u-1', roles, tenants: ['t-1'] }),
    } as never);
  }

  const rutasDelMenu = () => service.menu().flatMap((g) => g.items.map((i) => i.route));

  describe('esPerfilDeGestion', () => {
    it('es de gestión con un rol de plataforma', () => {
      expect(esPerfilDeGestion(['PLATFORM_ADMIN'])).toBe(true);
      expect(esPerfilDeGestion(['SUPERADMIN'])).toBe(true);
      expect(esPerfilDeGestion(['DPO', 'USER'])).toBe(true);
    });

    it('no lo es sin rol de plataforma, ni si además usa la app para sí', () => {
      expect(esPerfilDeGestion([])).toBe(false);
      expect(esPerfilDeGestion(['USER'])).toBe(false);
      expect(esPerfilDeGestion(['BILLING'])).toBe(false);
      expect(esPerfilDeGestion(['PLATFORM_ADMIN', 'PATIENT'])).toBe(false);
      expect(esPerfilDeGestion(['SUPERADMIN', 'PRACTITIONER'])).toBe(false);
      expect(esPerfilDeGestion(['SECURITY_ADMIN', 'CLINICIAN', 'BILLING'])).toBe(false);
    });
  });

  describe('menú de quien gestiona la plataforma', () => {
    it.each([['SUPERADMIN'], ['PLATFORM_ADMIN'], ['SECURITY_ADMIN'], ['GOVERNANCE_ADMIN']])(
      '%s no ve ningún «Mis…» ni autoservicio',
      (rol) => {
        abrirSesion([rol]);
        const rutas = rutasDelMenu();
        expect(rutas.length).toBeGreaterThan(0);
        expect(rutas.filter((r) => r.startsWith('/my-'))).toEqual([]);
        const rotulos = service.menu().flatMap((g) => g.items.map((i) => i.label));
        expect(rotulos.filter((l) => /^Mi[s]?\s/.test(l))).toEqual([]);
        expect(service.menu().map((g) => g.label)).not.toContain('Mi cuenta');
        expect(service.menu().map((g) => g.label)).not.toContain('Atención');
      },
    );

    it('conserva «Superadministración» entera y el dinero (Facturación y Contabilidad)', () => {
      abrirSesion(['SUPERADMIN']);
      const rutas = rutasDelMenu();
      expect(rutas).toEqual(
        expect.arrayContaining([
          '/superadmin/observability',
          '/superadmin/data-catalog',
          '/superadmin/web-analytics',
          '/billing',
          '/administration/accounting',
          '/administration/users',
        ]),
      );
    });

    it('conserva «Mi perfil» y «Notificaciones» fijos arriba', () => {
      abrirSesion(['PLATFORM_ADMIN']);
      expect(service.pinnedItems().map((i) => i.label)).toEqual(['Mi perfil', 'Notificaciones']);
    });

    it('no es permiso: la sección sigue visible para la guarda aunque salga del menú', () => {
      abrirSesion(['SUPERADMIN']);
      const rutas = service.visibleSections().map((s) => `/${s.path}`);
      expect(rutas).toContain('/my-account/appointments');
    });
  });

  describe('el resto de los perfiles no cambia', () => {
    it('un paciente conserva «Mi cuenta» completa', () => {
      abrirSesion(['PATIENT']);
      expect(rutasDelMenu()).toEqual(
        expect.arrayContaining([
          '/my-account/appointments',
          '/my-account/medical-record',
          '/my-account/privacy',
        ]),
      );
    });

    it('un administrador de plataforma que además es paciente conserva su menú personal', () => {
      abrirSesion(['PLATFORM_ADMIN', 'PATIENT']);
      expect(rutasDelMenu()).toContain('/my-account/appointments');
    });

    it('un médico conserva «Atención»', () => {
      abrirSesion(['PRACTITIONER']);
      expect(service.menu().map((g) => g.label)).toContain('Atención');
    });
  });

  describe('seccionDeGestion', () => {
    it('toda ruta de la lista existe en el registro (sin rutas huérfanas)', () => {
      const existentes = new Set(APP_SECTIONS.map((s) => s.path));
      for (const ruta of [
        'administration/users',
        'administration/accounting',
        'billing',
        'administration/services-catalog',
      ]) {
        expect(existentes.has(ruta)).toBe(true);
      }
    });

    it('«Mis…» nunca es de gestión', () => {
      const mis = APP_SECTIONS.filter((s) => /^Mi[s]?\s/.test(s.label) && s.group !== 'Superadministración');
      expect(mis.length).toBeGreaterThan(0);
      for (const s of mis) expect(seccionDeGestion(s)).toBe(false);
    });
  });
});
