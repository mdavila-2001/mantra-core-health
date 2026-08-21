import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { NavigationService } from './navigation.service';

/**
 * Lo que se fija acá es el contrato del armazón: **qué se ofrece según quién
 * entró** y **dónde dice la interfaz que estás parado**. Las dos cosas salen
 * del mismo registro, así que una prueba que las viera divergir es la señal de
 * que alguien duplicó la lista.
 */
@Component({ template: '' })
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

describe('NavigationService', () => {
  let service: NavigationService;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Cualquier ruta pinta el mismo componente vacío: acá se prueba a dónde
        // se puede ir y cómo se llama, no qué se dibuja al llegar.
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });

    service = TestBed.inject(NavigationService);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  /**
   * Abre una sesión con esos roles y esas organizaciones.
   *
   * Los `tenants` importan tanto como los roles desde F-31: hay secciones cuyo
   * permiso real es una **membresía** y no un rol del token, y se filtran por
   * este claim. Vacío = alguien que no pertenece a ninguna organización, que es
   * el caso del paciente.
   */
  function abrirSesion(roles: readonly string[], tenants: readonly string[] = ['t-1']) {
    session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants }), refreshToken: 'r' });
  }

  function rutasDelMenu(): readonly string[] {
    return service.menu().flatMap((grupo) => grupo.items.map((item) => item.route));
  }

  describe('el menú se arma con los roles del token', () => {
    it('una sesión sin roles solo ve lo que no exige ninguno', () => {
      // Sin roles **y sin organización**: el paciente. «Tu organización» no
      // pide rol pero sí membresía (F-31), así que sin `tenants` no aparece.
      abrirSesion([], []);

      // Panel y autoservicio: lo que cualquiera puede hacer con su propia cuenta.
      // «Mis turnos» entra acá porque su filtro real es tener perfil de
      // paciente —un dato de la cuenta, no un rol—, y eso lo resuelve la
      // pantalla, no el menú.
      //
      // El directorio de laboratorios entra por una razón parecida: lo consulta
      // cualquiera que necesite un estudio, y no hay rol que exprese eso.
      //
      // La **Guía de profesionales** ya NO entra: desde la corrección #2 del
      // 15/08/2026 declara `roles: ['PATIENT']`, y una sesión sin roles no es
      // una sesión de paciente.
      expect(rutasDelMenu()).toEqual([
        '/dashboard',
        // Los tutoriales tampoco exigen rol: son la guía de cómo usar lo que
        // cada cuenta ya puede ver.
        '/tutorials',
        // Carril P2: la mensajería tampoco exige rol. El filtro real es tener
        // perfil público de `community`, que es un dato de la cuenta.
        '/messaging',
        // Grupos y foros (P7): un grupo público lo lee cualquier sesión, y
        // quién puede publicar en cada uno lo decide la API por membresía.
        '/groups',
        // El directorio de laboratorios tampoco: es oferta publicada, no PHI.
        '/laboratory-directory',
        // El glosario ya NO entra: desde el 18/08/2026 (feedback de la analista,
        // F-03) declara los roles de quien atiende, y una sesión sin roles no
        // es de nadie que atienda.
        '/my-account',
        '/my-account/appointments',
        // El archivo clínico propio (carril 09), por lo mismo que «Mis turnos»:
        // el filtro real es tener perfil de paciente, y lo resuelve la pantalla.
        '/my-account/medical-record',
        // Los resultados propios no exigen rol por lo mismo que los turnos: el
        // filtro real es tener perfil de paciente, que es un dato de la cuenta.
        '/my-account/diagnostic-results',
        // Las órdenes propias entran por lo mismo que los resultados: son las
        // dos mitades del mismo circuito y ninguna exige rol — el filtro real
        // es tener perfil de paciente, que la pantalla resuelve.
        '/my-account/diagnostic-orders',
        // Los cuestionarios propios tampoco exigen rol: el filtro real es tener
        // perfil de paciente, que es un dato de la cuenta y no un rol.
        '/my-account/questionnaires',
        // Carril P1: la bandeja es de la persona y el backend sólo devuelve la
        // propia, así que no hay rol que filtrar.
        // Carril P9: las preferencias de aviso, pegadas a la bandeja.
        '/my-account/notification-preferences',
        '/notification-center',
        '/my-account/identity/verify',
        '/my-account/identity/cases',
      ]);
    });

    it('un administrador de seguridad ve las secciones de administración', () => {
      abrirSesion(['SECURITY_ADMIN']);

      expect(rutasDelMenu()).toContain('/administration/users');
      expect(rutasDelMenu()).toContain('/administration/patients');
      // Carriles 13 y 16: las dos consolas de organización entran con el mismo
      // rol que el resto de la configuración.
      expect(rutasDelMenu()).toContain('/administration/medical-organization');
      expect(rutasDelMenu()).toContain('/administration/medical-laboratory');
    });

    it('la consola del laboratorio no se ofrece a quien sólo ejerce (C16)', () => {
      abrirSesion(['PRACTITIONER']);

      // Configurar precios de convenios y permisos de firma es administración,
      // no atención: el backend exige `SECURITY_ADMIN` y el menú no ofrece una
      // puerta que la API va a cerrar.
      expect(rutasDelMenu()).not.toContain('/administration/medical-laboratory');
      // La estructura de su propia organización sí: es donde ve en qué sede y
      // con qué rol trabaja, y `GET /practices` ya lo admite.
      expect(rutasDelMenu()).toContain('/administration/medical-organization');
    });

    it('la Guía de profesionales solo aparece en el menú del paciente', () => {
      // Corrección #2. La medición del carril 01 la encontró en el menú de la
      // doctora, que es exactamente lo que el cliente pidió sacar.
      abrirSesion(['PATIENT']);
      expect(rutasDelMenu()).toContain('/directory');

      abrirSesion(['PRACTITIONER', 'CLINICIAN']);
      expect(rutasDelMenu()).not.toContain('/directory');

      abrirSesion(['SECURITY_ADMIN']);
      expect(rutasDelMenu()).not.toContain('/directory');
    });

    it('un rol clínico no ve administración, y un administrador no ve el archivo clínico', () => {
      abrirSesion(['CLINICIAN']);
      expect(rutasDelMenu()).toContain('/medical-records');
      expect(rutasDelMenu()).not.toContain('/administration/users');

      abrirSesion(['SECURITY_ADMIN']);
      expect(rutasDelMenu()).not.toContain('/medical-records');
    });

    it('no quedan grupos vacíos: un rótulo sin ítems anuncia lo que no se puede ver', () => {
      abrirSesion([], []);

      for (const grupo of service.menu()) {
        expect(grupo.items.length, grupo.label).toBeGreaterThan(0);
      }
      // «Atención» ya no aparece: su único ítem sin rol era el glosario, y desde
      // F-03 es de quien atiende. Para el paciente, sus cosas viven en «Mi cuenta».
      // «Administración» tampoco: su único ítem sin rol —«Tu organización»— pide
      // membresía desde F-31, y quien no pertenece a ninguna no ve el rótulo.
      expect(service.menu().map((g) => g.label)).toEqual(['General', 'Mi cuenta']);
    });

    it('con membresía pero sin rol global sí se ve «Tu organización»', () => {
      // El caso que F-31 no podía romper: la recepcionista. Su permiso es una
      // fila de `tenant_memberships`, no un rol del token — filtrar la sección
      // por `roles` la habría dejado afuera de la pantalla que es suya.
      abrirSesion([], ['t-1']);

      expect(rutasDelMenu()).toContain('/administration/my-organization');
      expect(service.menu().map((g) => g.label)).toContain('Administración');
    });

    it('los grupos salen en el orden declarado, no en el del registro', () => {
      abrirSesion(['SECURITY_ADMIN', 'CLINICIAN', 'BILLING']);

      expect(service.menu().map((g) => g.label)).toEqual([
        'General',
        'Atención',
        'Administración',
        'Facturación',
        'Mi cuenta',
      ]);
    });
  });

  describe('dónde estás parado', () => {
    it('fuera del armazón no hay sección ni ruta de navegación', async () => {
      await router.navigateByUrl('/design-system');

      expect(service.currentSection()).toBeNull();
      expect(service.breadcrumbs()).toEqual([]);
    });

    it('en el panel el breadcrumb es un solo escalón, y sin enlace: es donde estás', async () => {
      await router.navigateByUrl('/dashboard');

      expect(service.breadcrumbs()).toEqual([{ label: 'Panel' }]);
    });

    it('en una sección el breadcrumb dice de dónde venís, el dominio y dónde estás', async () => {
      await router.navigateByUrl('/administration/users');

      expect(service.breadcrumbs()).toEqual([
        { label: 'Panel', routerLink: '/dashboard' },
        // El dominio no es una pantalla: va sin enlace a propósito.
        { label: 'Administración' },
        { label: 'Usuarios' },
      ]);
    });

    it('una pantalla hija resuelve a su sección padre', async () => {
      // El alta todavía no existe, pero cuando exista no debe dejar el menú sin
      // marcar ni la pantalla sin ruta de navegación.
      await router.navigateByUrl('/administration/users/new');

      expect(service.currentSection()?.label).toBe('Usuarios');
    });

    it('gana la coincidencia más larga, no la primera que empareja', async () => {
      await router.navigateByUrl('/administration/patients');

      // `/administration/users` y `/administration/patients` comparten
      // prefijo: comparar de a segmentos completos es lo que evita que una
      // sección se coma a su vecina.
      expect(service.currentSection()?.label).toBe('Pacientes');
    });

    it('los parámetros de consulta no confunden a la sección', async () => {
      await router.navigateByUrl('/schedule?fecha=2026-08-04');

      expect(service.currentSection()?.label).toBe('Agenda');
    });
  });
});
