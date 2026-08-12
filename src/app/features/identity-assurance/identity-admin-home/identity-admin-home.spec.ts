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
      '/administration/identity-assurance/queue',
      '/administration/identity-assurance/authorities/new',
      '/administration/identity-assurance/authorities/endpoint',
      '/administration/identity-assurance/policies/new',
      '/administration/identity-assurance/cases/new',
      '/administration/identity-assurance/cases/evidence',
      '/administration/identity-assurance/cases/checks',
      '/administration/identity-assurance/cases/expire-sweep',
      '/administration/identity-assurance/checks/attempt',
      '/administration/identity-assurance/checks/result',
      '/administration/identity-assurance/checks/fraud-signal',
      '/administration/identity-assurance/review/escalate',
      '/administration/identity-assurance/review/decision',
      '/administration/identity-assurance/assertions/issue',
      '/administration/identity-assurance/assertions/revoke',
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
