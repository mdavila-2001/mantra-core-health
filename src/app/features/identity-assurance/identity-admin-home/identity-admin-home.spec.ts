import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { IdentityAdminHome } from './identity-admin-home';

/**
 * La portada es el índice de un módulo sin listados: lo que se fija acá es que
 * cada operación del contrato aparezca — con enlace si ya tiene pantalla, como
 * pendiente honesto si todavía no.
 */
describe('IdentityAdminHome', () => {
  let fixture: ComponentFixture<IdentityAdminHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IdentityAdminHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(IdentityAdminHome);
    fixture.detectChanges();
  });

  function enlaces(): readonly string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a[app-link]'),
      (a) => a.getAttribute('href') ?? '',
    );
  }

  it('las pantallas ya construidas tienen su enlace, en el orden de las áreas', () => {
    expect(enlaces()).toEqual([
      // La cola encabeza: es la lectura desde la que se llega a las demás.
      '/administracion/verificacion-identidad/cola',
      '/administracion/verificacion-identidad/autoridades/nueva',
      '/administracion/verificacion-identidad/autoridades/endpoint',
      '/administracion/verificacion-identidad/politicas/nueva',
      '/administracion/verificacion-identidad/casos/nuevo',
      '/administracion/verificacion-identidad/casos/evidencia',
      '/administracion/verificacion-identidad/casos/checks',
      '/administracion/verificacion-identidad/casos/barrido',
      '/administracion/verificacion-identidad/checks/intento',
      '/administracion/verificacion-identidad/checks/resultado',
      '/administracion/verificacion-identidad/checks/fraude',
      '/administracion/verificacion-identidad/revision/escalar',
      '/administracion/verificacion-identidad/revision/decision',
      '/administracion/verificacion-identidad/aserciones/emitir',
      '/administracion/verificacion-identidad/aserciones/revocar',
    ]);
  });

  it('no queda ninguna operación en preparación: los 14 comandos tienen pantalla', () => {
    const pendientes = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.portada__pendiente',
    );

    expect(pendientes.length).toBe(0);
  });

  it('avisa que, salvo la cola, las pantallas siguen operando por identificador', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('app-alert');

    expect(aviso?.textContent).toContain('identificador');
  });
});
