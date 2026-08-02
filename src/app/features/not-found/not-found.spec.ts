import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NotFound } from './not-found';

/**
 * Antes el comodín redirigía a `/`, que mandaba al panel —o al login, vía el
 * guard— sin decir nada. Para quien navega con lector de pantalla, un destino
 * inesperado y silencioso es especialmente desorientador.
 */
describe('NotFound', () => {
  let fixture: ComponentFixture<NotFound>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();
  });

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('se anuncia: la persona esperaba contenido y llegó acá', () => {
    expect(html().querySelector('[role="alert"]')).not.toBeNull();
  });

  it('ofrece una salida', () => {
    expect(html().querySelector('a[routerLink="/"]')).not.toBeNull();
  });

  /**
   * Mismo texto que el estado S6 del M34, y por el mismo motivo: una URL
   * desconocida y una que existe pero no se puede ver tienen que verse igual.
   * Si el 404 dijera «esta página no existe», la diferencia sería una forma de
   * averiguar qué rutas hay.
   */
  it('no dice si la dirección existe o no', () => {
    const texto = html().textContent ?? '';

    expect(texto).toContain('No encontramos lo que buscás');
    expect(texto).not.toMatch(/no existe|inexistente|sin permiso|no tenés acceso/i);
  });
});
