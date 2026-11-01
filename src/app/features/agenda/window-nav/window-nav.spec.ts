import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AgendaWindowNav } from './window-nav';

/**
 * La navegación de la ventana de la agenda: el rango visible, anterior y
 * siguiente (botones de ícono con nombre accesible) y «Volver a hoy» sólo
 * cuando la ventana no incluye hoy.
 */
describe('AgendaWindowNav', () => {
  let fixture: ComponentFixture<AgendaWindowNav>;
  let movidas: (-1 | 1)[];
  let hoy: number;

  const q = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="agenda-ventana-${id}"]`);

  function pintar(enHoy: boolean): void {
    fixture = TestBed.createComponent(AgendaWindowNav);
    fixture.componentRef.setInput('rango', '27 oct – 2 nov');
    fixture.componentRef.setInput('enHoy', enHoy);
    movidas = [];
    hoy = 0;
    fixture.componentInstance.mover.subscribe((d) => movidas.push(d));
    fixture.componentInstance.hoy.subscribe(() => (hoy += 1));
    fixture.detectChanges();
  }

  it('muestra el rango y navega hacia atrás y adelante', () => {
    pintar(true);
    expect(q('rango')?.textContent).toBe('27 oct – 2 nov');
    expect(q('anterior')?.getAttribute('aria-label')).toBe('Ventana anterior');
    q('anterior')!.click();
    q('siguiente')!.click();
    expect(movidas).toEqual([-1, 1]);
  });

  it('en la ventana de hoy no ofrece «Volver a hoy»', () => {
    pintar(true);
    expect(q('hoy')).toBeNull();
  });

  it('fuera de hoy lo ofrece y emite hoy', () => {
    pintar(false);
    q('hoy')!.click();
    expect(hoy).toBe(1);
  });
});
