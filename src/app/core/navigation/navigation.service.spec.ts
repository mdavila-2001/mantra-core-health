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
        // Grupos y foros ya NO entra: desde el 18/08/2026 (recorrida de QA,
        // F-20) declara los roles de quien ejerce o administra — son foros
        // profesionales, y una sesión sin roles no es de nadie que ejerza.
        // El directorio de laboratorios tampoco: es oferta publicada, no PHI.
        '/laboratory-directory',
        // A5 y A6 del plan de UX (22/08/2026): los directorios de clínicas y de
        // farmacias entran por lo mismo que el de laboratorios — es oferta
        // publicada, no PHI, y quien busca dónde atenderse no tiene un rol que
        // lo exprese. Salen de `GET /public/search/*`, que es anónimo.
        '/organizations-directory',
        '/pharmacies-directory',
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
    });

    it('el menú del médico son las ocho opciones del cliente, y ninguna más', () => {
      // §4.H del plan de UX del 22/08/2026. El cliente dio una lista **cerrada**
      // —«las opciones únicas que se requiere en el panel del doctor son…»— y el
      // menú tenía dieciséis entradas de primer nivel. Esta prueba es la lista,
      // en el orden en que se dibuja, y falla si alguien agrega la novena.
      abrirSesion(['PRACTITIONER']);

      const fueraDeMiCuenta = service
        .menu()
        .filter((grupo) => grupo.label !== 'Mi cuenta')
        .flatMap((grupo) => grupo.items.map((item) => item.label));

      expect(fueraDeMiCuenta).toEqual([
        'Chats',
        'Directorio de laboratorios',
        'Consulta médica',
        'Turnos',
        'Archivo clínico',
        'Evoluciones',
        'Glosario',
        'Contabilidad',
      ]);
    });

    it('lo que sale del menú del médico NO le cierra la puerta', () => {
      // La distinción entera de `fueraDelMenuPara`: la organización médica, sus
      // encuestas y su bandeja de visitas dejaron de ocupar un renglón y siguen
      // siendo suyas — se llega por su ruta y por el enlace de otra pantalla.
      // Si esto se rompiera, una limpieza de menú habría sido una pérdida
      // silenciosa de acceso, que es justo lo que no puede pasar.
      abrirSesion(['PRACTITIONER']);

      const alcanzables = service.visibleSections().map((seccion) => `/${seccion.path}`);
      expect(alcanzables).toContain('/administration/medical-organization');
      expect(alcanzables).toContain('/questionnaires');
      expect(alcanzables).toContain('/lab-visits');
      expect(alcanzables).toContain('/dashboard');

      expect(rutasDelMenu()).not.toContain('/administration/medical-organization');
      expect(rutasDelMenu()).not.toContain('/questionnaires');
      expect(rutasDelMenu()).not.toContain('/lab-visits');
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

    it('«Mis pedidos» sólo aparece en el menú del paciente', () => {
      // FAR-I2: la única sección de «Mi cuenta» con roles declarados — el
      // pedido nace de una receta propia, y la guardia lo exige en la sección.
      abrirSesion(['PATIENT']);
      expect(rutasDelMenu()).toContain('/my-account/pharmacy-orders');

      abrirSesion([]);
      expect(rutasDelMenu()).not.toContain('/my-account/pharmacy-orders');

      abrirSesion(['PRACTITIONER', 'CLINICIAN']);
      expect(rutasDelMenu()).not.toContain('/my-account/pharmacy-orders');
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

      // «Turnos» desde §4.H del plan de UX: la ruta sigue siendo `schedule`.
      expect(service.currentSection()?.label).toBe('Turnos');
    });
  });
});
