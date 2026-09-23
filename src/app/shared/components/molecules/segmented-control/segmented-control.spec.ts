import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentedControl } from './segmented-control';
import type { SegmentedOption } from './segmented-control.types';

/**
 * El selector de vista (FT-04).
 *
 * Lo que fijan estas pruebas no es la maqueta sino las tres promesas: que la
 * opción puesta se anuncie como puesta, que las flechas la muevan, y que
 * elegir la que ya está no dispare un cambio —que es lo que provocaba una
 * navegación por cada clic repetido.
 */
@Component({
  imports: [SegmentedControl],
  template: `
    <app-segmented-control
      [options]="opciones"
      [value]="vista()"
      ariaLabel="Cómo ver tus citas"
      (valueChange)="cambios.push($event); vista.set($event)"
    />
  `,
})
class Anfitrion {
  readonly opciones: readonly SegmentedOption[] = [
    { value: 'lista', label: 'Lista', icon: 'orders' },
    { value: 'calendario', label: 'Calendario', icon: 'calendar' },
  ];
  readonly vista = signal('lista');
  readonly cambios: string[] = [];
}

describe('SegmentedControl', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  function opciones(): HTMLButtonElement[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[role="radio"]',
      ),
    ];
  }

  /** FT-04-R01/R02 · las dos son botones, no texto ni enlaces. */
  it('dibuja cada opción como un botón', () => {
    const botones = opciones();
    expect(botones.length).toBe(2);
    for (const boton of botones) {
      expect(boton.tagName).toBe('BUTTON');
      expect(boton.type).toBe('button');
    }
  });

  /** FT-04-R03/R06 · la puesta se dice en el marcado, no sólo con color. */
  it('marca la opción activa con aria-checked y la saca del recorrido a las demás', () => {
    const [lista, calendario] = opciones();
    expect(lista.getAttribute('aria-checked')).toBe('true');
    expect(lista.getAttribute('tabindex')).toBe('0');
    expect(calendario.getAttribute('aria-checked')).toBe('false');
    expect(calendario.getAttribute('tabindex')).toBe('-1');
  });

  it('el grupo se anuncia con su rótulo', () => {
    const grupo = (fixture.nativeElement as HTMLElement).querySelector('[role="radiogroup"]');
    expect(grupo?.getAttribute('aria-label')).toBe('Cómo ver tus citas');
  });

  /** FT-04-R05 · el clic cambia de verdad. */
  it('elegir otra opción emite su valor', () => {
    opciones()[1].click();
    fixture.detectChanges();

    expect(anfitrion.cambios).toEqual(['calendario']);
    expect(opciones()[1].getAttribute('aria-checked')).toBe('true');
  });

  /** Volver a clickear la puesta no es un cambio: no puede navegar otra vez. */
  it('elegir la opción que ya está puesta no emite nada', () => {
    opciones()[0].click();
    fixture.detectChanges();

    expect(anfitrion.cambios).toEqual([]);
  });

  /** FT-04-R06 · flechas, con vuelta al otro extremo. */
  it('las flechas mueven la selección y dan la vuelta', () => {
    opciones()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(anfitrion.vista()).toBe('calendario');

    opciones()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(anfitrion.vista()).toBe('lista');
  });

  /**
   * Sin respuesta, ninguna puesta.
   *
   * Un valor que no está entre las opciones es un estado legítimo —una pregunta
   * de sí/no todavía sin contestar— y no un error. Antes caía en la primera,
   * así que el control decía `aria-checked="true"` sobre algo que nadie eligió:
   * la persona veía contestado lo que no contestó.
   */
  it('con un valor que no está en la lista no marca ninguna, y sigue tabulable', () => {
    anfitrion.vista.set('');
    fixture.detectChanges();

    const [lista, calendario] = opciones();
    expect(lista.getAttribute('aria-checked')).toBe('false');
    expect(calendario.getAttribute('aria-checked')).toBe('false');
    // Y el control no se cae del recorrido del teclado: un radiogroup sin nada
    // marcado se tabula por su primer radio.
    expect(lista.getAttribute('tabindex')).toBe('0');
    expect(calendario.getAttribute('tabindex')).toBe('-1');
  });

  it('desde «ninguna puesta» el clic elige, sin tener que pasar por otra', () => {
    anfitrion.vista.set('');
    fixture.detectChanges();

    opciones()[1].click();
    fixture.detectChanges();

    expect(anfitrion.cambios).toEqual(['calendario']);
  });

  it('Home y End van a los extremos', () => {
    opciones()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(anfitrion.vista()).toBe('calendario');

    opciones()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(anfitrion.vista()).toBe('lista');
  });
});
