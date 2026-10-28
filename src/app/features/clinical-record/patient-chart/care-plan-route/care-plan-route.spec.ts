import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { CarePlanRoute, duracionEnPalabras, type PasoDelPlan } from './care-plan-route';

/**
 * La hoja de ruta es lectura pura de lo que hay en el formulario: lo que se
 * fija acá es el orden en que dibuja los pasos y cómo dice la vigencia.
 */
describe('CarePlanRoute', () => {
  let fixture: ComponentFixture<CarePlanRoute>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CarePlanRoute] }).compileComponents();
    fixture = TestBed.createComponent(CarePlanRoute);
    fixture.componentRef.setInput('estado', { tipo: 'faltan', cuantos: 2 });
  });

  function vista(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('ordena los pasos por fecha, deja los sin fecha al final y omite los vacíos', () => {
    const pasos: PasoDelPlan[] = [
      { clave: 0, detalle: 'Sin fecha', cuando: null },
      { clave: 1, detalle: 'Más tarde', cuando: new Date(2026, 11, 20) },
      { clave: 2, detalle: 'Antes', cuando: new Date(2026, 10, 5) },
      { clave: 3, detalle: '   ', cuando: new Date(2026, 10, 1) },
    ];
    fixture.componentRef.setInput('pasos', pasos);

    const hitos = Array.from(vista().querySelectorAll('[data-testid="plan-vista-paso"]'));
    expect(hitos.map((h) => h.querySelector('.vista__nota')?.textContent?.trim())).toEqual([
      'Antes',
      'Más tarde',
      'Sin fecha',
    ]);
    // El número es el del formulario, no el de la pista.
    expect(hitos.map((h) => h.querySelector('.vista__nodo')?.textContent?.trim())).toEqual([
      '3',
      '2',
      '1',
    ]);
  });

  it('sin pasos escritos, la pista lo dice en vez de quedar vacía', () => {
    expect(vista().textContent).toContain('Sin pasos todavía');
  });

  it('la meta sin escribir se marca como pendiente', () => {
    expect(vista().querySelector('.vista__nota--falta')?.textContent?.trim()).toBe('Por escribir');

    fixture.componentRef.setInput('meta', '  Presión bajo control  ');
    expect(vista().querySelector('.vista__hito--meta .vista__nota')?.textContent?.trim()).toBe(
      'Presión bajo control',
    );
  });

  it('la vigencia se dice en la unidad de la consulta', () => {
    expect(duracionEnPalabras(new Date(2026, 0, 1), new Date(2026, 0, 1))).toBe('el mismo día');
    expect(duracionEnPalabras(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe('1 día');
    expect(duracionEnPalabras(new Date(2026, 0, 1), new Date(2026, 0, 11))).toBe('10 días');
    expect(duracionEnPalabras(new Date(2026, 0, 1), new Date(2026, 1, 5))).toBe('5 semanas');
    expect(duracionEnPalabras(new Date(2026, 0, 1), new Date(2026, 6, 1))).toBe('6 meses');

    fixture.componentRef.setInput('desde', new Date(2026, 0, 1));
    fixture.componentRef.setInput('hasta', new Date(2026, 6, 1));
    expect(vista().querySelector('[data-testid="plan-duracion"]')?.textContent?.trim()).toContain(
      'Vigencia de 6 meses',
    );
  });

  it('con las fechas invertidas no inventa una duración', () => {
    fixture.componentRef.setInput('desde', new Date(2026, 6, 1));
    fixture.componentRef.setInput('hasta', new Date(2026, 0, 1));
    expect(vista().querySelector('[data-testid="plan-duracion"]')).toBeNull();
  });

  it('la insignia dice cuántos obligatorios faltan, o que está lista', () => {
    expect(vista().querySelector('[data-testid="plan-pendientes"]')?.textContent?.trim()).toBe(
      'Faltan 2 datos obligatorios',
    );
    fixture.componentRef.setInput('estado', { tipo: 'listo' });
    const insignia = vista().querySelector('[data-testid="plan-pendientes"]');
    expect(insignia?.textContent?.trim()).toBe('Lista para abrir');
    expect(insignia?.classList).toContain('vista__estado--listo');
  });
});
