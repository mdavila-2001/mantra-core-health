import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewStateGallery } from './view-state-gallery';

/**
 * La vitrina es la referencia viva del contrato del M34: si un estado deja de
 * renderizarse, el equipo pierde la única muestra de cómo debe verse.
 */
describe('ViewStateGallery · vitrina de los 9 estados', () => {
  let fixture: ComponentFixture<ViewStateGallery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewStateGallery],
    }).compileComponents();

    fixture = TestBed.createComponent(ViewStateGallery);
    await fixture.whenStable();
  });

  it('renderiza una tarjeta por estado, incluido el camino feliz', () => {
    const tarjetas = fixture.nativeElement.querySelectorAll('.gallery__card');

    // Los 9 del M34 + el camino feliz.
    expect(tarjetas.length).toBe(10);
  });

  it('muestra los 9 códigos literales del M34', () => {
    const texto: string = fixture.nativeElement.textContent ?? '';

    for (const codigo of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9']) {
      expect(texto).toContain(codigo);
    }
  });

  it('S7 expone la antigüedad del dato, que es su requisito propio', () => {
    const texto: string = fixture.nativeElement.textContent ?? '';

    expect(texto).toContain('Datos de hace 7 minutos');
  });

  it('S9 muestra el identificador de la petición', () => {
    const texto: string = fixture.nativeElement.textContent ?? '';

    expect(texto).toContain('req-7f3a91c4');
  });

  it('S6 no dice nada del recurso: no filtra que exista', () => {
    const tarjetas = [...fixture.nativeElement.querySelectorAll('.gallery__card')];
    const tarjetaS6 = tarjetas.find((tarjeta) =>
      (tarjeta as HTMLElement).textContent?.includes('No encontrado'),
    ) as HTMLElement | undefined;

    expect(tarjetaS6).toBeDefined();
    expect(tarjetaS6?.textContent).toContain('No encontramos lo que buscabas');
    // La ocupación de camas es el dato de las tarjetas con contenido: S6 no lo tiene.
    expect(tarjetaS6?.textContent).not.toContain('Ocupación de camas');
  });
});
