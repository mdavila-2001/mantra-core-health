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
    ]);
  });

  it('las operaciones sin pantalla se declaran en preparación, no se ocultan', () => {
    const pendientes = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.portada__pendiente',
    );

    // 14 comandos del contrato: 10 con pantalla, 4 a la espera de las suyas.
    expect(pendientes.length).toBe(4);
  });

  it('avisa por qué no hay listados: el módulo no expone consultas todavía', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('app-alert');

    expect(aviso?.textContent).toContain('identificador');
  });
});
