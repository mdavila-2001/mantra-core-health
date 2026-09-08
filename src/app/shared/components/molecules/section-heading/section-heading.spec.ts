import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SectionHeading } from './section-heading';

/** El encabezado de una card de ficha. */
describe('SectionHeading', () => {
  let fixture: ComponentFixture<SectionHeading>;

  function montar(entradas: {
    titulo: string;
    icono: 'flask' | 'building' | 'scan';
    cuantos?: number | null;
    nivel?: 2 | 3;
  }): HTMLElement {
    fixture = TestBed.createComponent(SectionHeading);
    fixture.componentRef.setInput('titulo', entradas.titulo);
    fixture.componentRef.setInput('icono', entradas.icono);
    if (entradas.cuantos !== undefined) {
      fixture.componentRef.setInput('cuantos', entradas.cuantos);
    }
    if (entradas.nivel !== undefined) {
      fixture.componentRef.setInput('nivel', entradas.nivel);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('escribe el título como h2 por omisión', () => {
    // La card cuelga del `<h1>` de la ficha, así que su encabezado es un `h2`:
    // saltarse un nivel rompe la navegación por encabezados de un lector.
    const host = montar({ titulo: 'Equipos', icono: 'scan' });

    expect(host.querySelector('h2')?.textContent?.trim()).toBe('Equipos');
    expect(host.querySelector('h3')).toBeNull();
  });

  it('baja a h3 cuando se lo pide quien lo monta', () => {
    const host = montar({ titulo: 'Equipos', icono: 'scan', nivel: 3 });

    expect(host.querySelector('h3')?.textContent?.trim()).toBe('Equipos');
    expect(host.querySelector('h2')).toBeNull();
  });

  it('muestra el recuento cuando lo hay', () => {
    const host = montar({ titulo: 'Equipos', icono: 'scan', cuantos: 4 });

    expect(host.textContent).toContain('4');
  });

  it('sin recuento no dibuja el hueco', () => {
    // `null` y no `0`: una sección vacía no se dibuja entera, así que un cero
    // en el encabezado sería un estado que no existe.
    const host = montar({ titulo: 'Identificación', icono: 'flask', cuantos: null });

    expect(host.querySelector('.encabezado-seccion__cuantos')).toBeNull();
  });

  it('el ícono no es el nombre accesible', () => {
    // El título ya está escrito al lado; anunciar el dibujo diría «imagen» una
    // vez por sección de la ficha.
    const host = montar({ titulo: 'Sedes', icono: 'building' });

    expect(host.querySelector('.encabezado-seccion__marca')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});
