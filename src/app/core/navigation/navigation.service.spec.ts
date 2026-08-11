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

  function abrirSesion(roles: readonly string[]) {
    session.start({ accessToken: jwt({ sub: 'u-1', roles, tenants: ['t-1'] }), refreshToken: 'r' });
  }

  function rutasDelMenu(): readonly string[] {
    return service.menu().flatMap((grupo) => grupo.items.map((item) => item.route));
  }

  describe('el menú se arma con los roles del token', () => {
    it('una sesión sin roles solo ve lo que no exige ninguno', () => {
      abrirSesion([]);

      // Panel y autoservicio: lo que cualquiera puede hacer con su propia cuenta.
      // «Mis turnos» entra acá porque su filtro real es tener perfil de
      // paciente —un dato de la cuenta, no un rol—, y eso lo resuelve la
      // pantalla, no el menú.
      expect(rutasDelMenu()).toEqual([
        '/panel',
        '/mi-cuenta',
        '/mi-cuenta/turnos',
        '/identidad/verificar',
        '/identidad/casos',
      ]);
    });

    it('un administrador de seguridad ve las secciones de administración', () => {
      abrirSesion(['SECURITY_ADMIN']);

      expect(rutasDelMenu()).toContain('/administracion/usuarios');
      expect(rutasDelMenu()).toContain('/administracion/pacientes');
    });

    it('un rol clínico no ve administración, y un administrador no ve el archivo clínico', () => {
      abrirSesion(['CLINICIAN']);
      expect(rutasDelMenu()).toContain('/clinico');
      expect(rutasDelMenu()).not.toContain('/administracion/usuarios');

      abrirSesion(['SECURITY_ADMIN']);
      expect(rutasDelMenu()).not.toContain('/clinico');
    });

    it('no quedan grupos vacíos: un rótulo sin ítems anuncia lo que no se puede ver', () => {
      abrirSesion([]);

      for (const grupo of service.menu()) {
        expect(grupo.items.length, grupo.label).toBeGreaterThan(0);
      }
      expect(service.menu().map((g) => g.label)).toEqual(['General', 'Mi cuenta']);
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
      await router.navigateByUrl('/panel');

      expect(service.breadcrumbs()).toEqual([{ label: 'Panel' }]);
    });

    it('en una sección el breadcrumb dice de dónde venís, el dominio y dónde estás', async () => {
      await router.navigateByUrl('/administracion/usuarios');

      expect(service.breadcrumbs()).toEqual([
        { label: 'Panel', routerLink: '/panel' },
        // El dominio no es una pantalla: va sin enlace a propósito.
        { label: 'Administración' },
        { label: 'Usuarios' },
      ]);
    });

    it('una pantalla hija resuelve a su sección padre', async () => {
      // El alta todavía no existe, pero cuando exista no debe dejar el menú sin
      // marcar ni la pantalla sin ruta de navegación.
      await router.navigateByUrl('/administracion/usuarios/nuevo');

      expect(service.currentSection()?.label).toBe('Usuarios');
    });

    it('gana la coincidencia más larga, no la primera que empareja', async () => {
      await router.navigateByUrl('/administracion/pacientes');

      // `/administracion/usuarios` y `/administracion/pacientes` comparten
      // prefijo: comparar de a segmentos completos es lo que evita que una
      // sección se coma a su vecina.
      expect(service.currentSection()?.label).toBe('Pacientes');
    });

    it('los parámetros de consulta no confunden a la sección', async () => {
      await router.navigateByUrl('/agenda?fecha=2026-08-04');

      expect(service.currentSection()?.label).toBe('Agenda');
    });
  });
});
