import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { DelegatedAccessHome } from './delegated-access-home';

/**
 * La portada es el índice de un módulo sin listados: lo que se fija acá es que
 * cada operación del contrato tenga su enlace, sin puertas muertas.
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

  it('las once operaciones del módulo tienen su enlace, en el orden de las áreas', () => {
    expect(enlaces()).toEqual([
      '/administracion/acceso-delegado/delegaciones/nueva',
      '/administracion/acceso-delegado/delegaciones/solicitudes/nueva',
      '/administracion/acceso-delegado/delegaciones/concesiones/nueva',
      '/administracion/acceso-delegado/delegaciones/revocar',
      '/administracion/acceso-delegado/asignaciones/nueva',
      '/administracion/acceso-delegado/asignaciones/editar',
      '/administracion/acceso-delegado/solicitudes/resolver',
      '/administracion/acceso-delegado/conjuntos/nuevo',
      '/administracion/acceso-delegado/conjuntos/versionar',
      '/administracion/acceso-delegado/operacion/evaluar-actor',
      '/administracion/acceso-delegado/operacion/barrido-expiracion',
    ]);
  });

  it('ya no queda nada «en preparación»: los 11 comandos del contrato tienen pantalla', () => {
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
