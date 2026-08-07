import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DelegatedAccessHome } from './delegated-access-home';

/**
 * La portada es el índice de un módulo sin listados: lo que se fija acá es que
 * lo construido tenga enlace y lo pendiente lo diga, sin puertas muertas.
 */
describe('DelegatedAccessHome', () => {
  let fixture: ComponentFixture<DelegatedAccessHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DelegatedAccessHome],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(DelegatedAccessHome);
    fixture.detectChanges();
  });

  function enlaces(): readonly string[] {
    return Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('a[app-link]'),
      (a) => a.getAttribute('href') ?? '',
    );
  }

  it('las cuatro operaciones de delegación tienen su enlace', () => {
    expect(enlaces()).toEqual([
      '/administracion/acceso-delegado/delegaciones/nueva',
      '/administracion/acceso-delegado/delegaciones/solicitudes/nueva',
      '/administracion/acceso-delegado/delegaciones/concesiones/nueva',
      '/administracion/acceso-delegado/delegaciones/revocar',
    ]);
  });

  it('lo que no está construido lo dice, en vez de enlazar al vacío', () => {
    const pendientes = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.portada__pendiente',
    );

    expect(pendientes.length).toBeGreaterThan(0);
    for (const pendiente of Array.from(pendientes)) {
      expect(pendiente.textContent).toContain('en preparación');
    }
  });

  it('avisa por qué no hay listados: el módulo no expone consultas todavía', () => {
    const aviso = (fixture.nativeElement as HTMLElement).querySelector('app-alert');

    expect(aviso?.textContent).toContain('identificador');
  });
});
