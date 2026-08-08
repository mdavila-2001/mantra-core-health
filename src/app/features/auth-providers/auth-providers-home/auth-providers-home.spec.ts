import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthProvidersHome } from './auth-providers-home';

/**
 * La portada es el índice de un módulo sin listados: lo que se fija acá es que
 * cada operación del contrato aparezca — con enlace si ya tiene pantalla, como
 * pendiente honesto si todavía no.
 */
describe('AuthProvidersHome', () => {
  let fixture: ComponentFixture<AuthProvidersHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthProvidersHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthProvidersHome);
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
      '/administracion/proveedores-identidad/proveedores/nuevo',
      '/administracion/proveedores-identidad/proveedores/protocolo',
      '/administracion/proveedores-identidad/claves/nueva',
      '/administracion/proveedores-identidad/claves/rotar',
    ]);
  });

  it('las operaciones sin pantalla se declaran en preparación, no se ocultan', () => {
    const pendientes = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.portada__pendiente',
    );

    // 12 comandos del contrato: 4 con pantalla, 8 a la espera de las suyas.
    expect(pendientes.length).toBe(8);
  });

  it('avisa por qué no hay listados: el módulo no expone consultas todavía', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('app-alert');

    expect(aviso?.textContent).toContain('identificador');
  });
});
