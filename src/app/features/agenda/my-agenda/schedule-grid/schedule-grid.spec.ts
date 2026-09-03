import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduleGrid } from './schedule-grid';
import type { PublishedRule } from '../../../../core/data-access/scheduling/scheduling.types';

/**
 * EL HORARIO POR HORAS — punto 1 del carril 10.
 *
 * *«Nos muestra una vista de los días de la semana por horas, resaltado con
 * otro color los que corresponden atención.»*
 *
 * Antes esto eran fichas de día y una lista de franjas en texto. Se lee, pero
 * **no se compara**: con una grilla se ve de un golpe que los miércoles
 * empezás cuatro horas más tarde, y eso es lo que uno mira cuando decide si
 * cambiar el horario.
 */
describe('ScheduleGrid', () => {
  let fixture: ComponentFixture<ScheduleGrid>;

  function montar(reglas: readonly PublishedRule[]): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ScheduleGrid);
    fixture.componentRef.setInput('reglas', reglas);
    fixture.detectChanges();
  }

  function regla(dayOfWeek: number, startTime: string, endTime: string): PublishedRule {
    return { dayOfWeek, startTime, endTime } as PublishedRule;
  }

  function horas(): readonly number[] {
    return (fixture.componentInstance as never as { horas: () => number[] }).horas();
  }

  function atiende(dia: number, hora: number): boolean {
    return (
      fixture.componentInstance as never as { atiende: (d: number, h: number) => boolean }
    ).atiende(dia, hora);
  }

  it('sólo dibuja las horas que se usan', () => {
    // Un día de 24 filas con dos pintadas obliga a buscar dónde está lo que
    // importa, y las 22 vacías no dicen nada que la ausencia no diga.
    montar([regla(1, '09:00:00', '13:00:00')]);

    expect(horas()[0]).toBe(9);
    expect(horas().at(-1)).toBe(12);
  });

  it('el fin es EXCLUSIVO: una franja hasta las 13:00 no ocupa esa fila', () => {
    // Es el error clásico. «De 9 a 13» son cuatro horas de atención, no cinco,
    // y pintar la de las 13 diría que atendés una hora que no atendés.
    montar([regla(1, '09:00:00', '13:00:00')]);

    expect(atiende(1, 12)).toBe(true);
    expect(atiende(1, 13)).toBe(false);
  });

  it('una franja que no arranca en punto igual pinta su hora', () => {
    // De 8:30 a 12:30: las 8 y las 12 cuentan, porque se atiende una parte.
    montar([regla(1, '08:30:00', '12:30:00')]);

    expect(atiende(1, 8)).toBe(true);
    expect(atiende(1, 12)).toBe(true);
    expect(atiende(1, 13)).toBe(false);
  });

  it('cada día pinta lo suyo y nada más', () => {
    montar([regla(1, '09:00:00', '13:00:00'), regla(3, '14:00:00', '18:00:00')]);

    expect(atiende(1, 9)).toBe(true);
    expect(atiende(3, 9)).toBe(false);
    expect(atiende(3, 15)).toBe(true);
    // Y la grilla abarca de la primera a la última: de 9 a 17.
    expect(horas()[0]).toBe(9);
    expect(horas().at(-1)).toBe(17);
  });

  it('los días van de lunes a domingo, no como los numera la API', () => {
    // La API usa 0 = domingo. Mostrarlo primero pondría el domingo antes del
    // lunes, que no es como nadie lee una semana.
    montar([regla(0, '09:00:00', '11:00:00'), regla(1, '09:00:00', '11:00:00')]);

    const cabeceras: string = fixture.nativeElement.querySelector('thead')?.textContent ?? '';
    expect(cabeceras.indexOf('Lun')).toBeLessThan(cabeceras.indexOf('Dom'));
  });

  it('sin horarios lo dice, en vez de dibujar un rectángulo vacío', () => {
    montar([]);
    expect(fixture.nativeElement.textContent).toContain('Todavía no publicaste horarios');
  });
});
