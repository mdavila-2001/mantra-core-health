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
      '/administration/identity-providers/providers/new',
      '/administration/identity-providers/providers/protocol',
      '/administration/identity-providers/providers/attribute-mappings',
      '/administration/identity-providers/providers/provisioning-rule',
      '/administration/identity-providers/keys/new',
      '/administration/identity-providers/keys/rotate',
      '/administration/identity-providers/organizations/link',
      '/administration/identity-providers/login/start',
      '/administration/identity-providers/login/callback',
      '/administration/identity-providers/accounts/link',
      '/administration/identity-providers/accounts/complete',
      '/administration/identity-providers/accounts/unlink',
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
