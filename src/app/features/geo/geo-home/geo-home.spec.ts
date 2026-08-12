import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GeoHome } from './geo-home';

/**
 * Las **once** operaciones del módulo —diez comandos y la única lectura—
 * ofrecidas, sin puertas muertas.
 */
describe('GeoHome', () => {
  let fixture: ComponentFixture<GeoHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeoHome],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GeoHome);
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function enlaces(): readonly string[] {
    return Array.from(
      raiz().querySelectorAll('a[app-link]'),
      (a) => a.getAttribute('href') ?? '',
    );
  }

  it('ofrece las diez operaciones del contrato, agrupadas en tres áreas', () => {
    expect(raiz().querySelectorAll('app-card').length).toBe(3);
    expect(raiz().querySelectorAll('.portada__operaciones li').length).toBe(10);
  });

  /**
   * Es la prueba que impide reintroducir la colisión: el prefijo de la API es
   * `/geo` y el proxy compara por inicio de ruta, así que ninguna ruta de esta
   * sección puede empezar con `geo`.
   */
  it('ninguna ruta de la sección empieza con el prefijo de la API', () => {
    expect(enlaces().length).toBeGreaterThan(0);
    for (const href of enlaces()) {
      expect(href.startsWith('/geo'), href).toBe(false);
      expect(href.startsWith('/administration/geolocation/'), href).toBe(true);
    }
  });

  it('la única lectura del módulo tiene pantalla', () => {
    expect(enlaces()).toContain('/administration/geolocation/subjects/last-position');
  });

  it('lo que todavía no tiene pantalla lo dice, en vez de enlazar a un 404', () => {
    const pendientes = raiz().querySelectorAll('.portada__pendiente');

    expect(pendientes.length + enlaces().length).toBe(10);
    for (const pendiente of pendientes) {
      expect(pendiente.textContent).toContain('en preparación');
    }
  });

  it('avisa por qué no hay listados: el módulo no expone consultas de colección', () => {
    const aviso = raiz().querySelector('app-alert');

    expect(aviso?.textContent).toContain('listados');
  });
});
