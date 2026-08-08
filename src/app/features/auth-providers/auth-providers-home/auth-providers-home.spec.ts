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
      '/administracion/proveedores-identidad/proveedores/mapeo-atributos',
      '/administracion/proveedores-identidad/proveedores/regla-aprovisionamiento',
      '/administracion/proveedores-identidad/claves/nueva',
      '/administracion/proveedores-identidad/claves/rotar',
      '/administracion/proveedores-identidad/organizaciones/vincular',
      '/administracion/proveedores-identidad/login/iniciar',
      '/administracion/proveedores-identidad/login/callback',
      '/administracion/proveedores-identidad/cuentas/vincular',
      '/administracion/proveedores-identidad/cuentas/completar',
      '/administracion/proveedores-identidad/cuentas/desvincular',
    ]);
  });

  it('no queda ninguna operación en preparación: los 12 comandos tienen pantalla', () => {
    const pendientes = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.portada__pendiente',
    );

    expect(pendientes.length).toBe(0);
  });

  it('avisa por qué no hay listados: el módulo no expone consultas todavía', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('app-alert');

    expect(aviso?.textContent).toContain('identificador');
  });
});
