import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeekView, lunesDe } from './week-view';
import type { BloqueoDelMes } from '../month-view/month-view';

/** Un miércoles cualquiera. */
const MIERCOLES = new Date(2026, 8, 9);

/**
 * LA SEMANA — el botón que el pedido original pide junto al del mes.
 *
 * *«Luego un botón para ver la semana y otro para ver el mes, cada uno con su
 * respectiva paginación de adelante y atrás.»*
 *
 * Existe teniendo el mes porque son dos preguntas distintas: el mes responde
 * «¿cuándo tengo hueco?», la semana «¿cómo viene esto?». Con siete días en
 * pantalla los números caben, y por eso acá sí se dice cuántos turnos libres y
 * cuántos tomados tiene cada día.
 */
describe('WeekView', () => {
  let fixture: ComponentFixture<WeekView>;

  function montar(cupos: unknown[] = [], bloqueos: readonly BloqueoDelMes[] = []): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(WeekView);
    fixture.componentRef.setInput('semana', MIERCOLES);
    fixture.componentRef.setInput('cupos', cupos);
    fixture.componentRef.setInput('bloqueos', bloqueos);
    fixture.detectChanges();
  }

  function dias(): readonly {
    fecha: Date;
    estado: string;
    libres: number;
    tomados: number;
    motivo: string | null;
  }[] {
    return (fixture.componentInstance as never as { dias: () => never[] }).dias();
  }

  function cupo(dia: number, hora: number, restante: number): unknown {
    return {
      id: `s-${dia}-${hora}`,
      startAt: new Date(2026, 8, dia, hora),
      endAt: new Date(2026, 8, dia, hora + 1),
      remainingCapacity: restante,
    };
  }

  it('arranca el LUNES aunque se le pase un miércoles', () => {
    // `getDay()` da 0 para domingo: el cálculo se corre seis días atrás, no uno
    // adelante, y el domingo es el error fácil de cometer.
    montar();
    expect(dias()[0].fecha.getDay()).toBe(1);
    expect(dias()).toHaveLength(7);
  });

  it('el domingo cae al final, no al principio', () => {
    montar();
    expect(dias()[6].fecha.getDay()).toBe(0);
    // Y el lunes de un domingo es el lunes ANTERIOR, no el siguiente.
    expect(lunesDe(new Date(2026, 8, 13)).getDate()).toBe(7);
  });

  it('cuenta libres y tomados por día', () => {
    // Es lo que la vista del mes no puede mostrar sin volverse ilegible, y la
    // razón de que esta pantalla exista.
    montar([cupo(7, 9, 1), cupo(7, 10, 0), cupo(7, 11, 0)]);

    const lunes = dias()[0];
    expect(lunes.libres).toBe(1);
    expect(lunes.tomados).toBe(2);
    expect(lunes.estado).toBe('con-reservas');
  });

  it('sin ningún cupo libre el día está lleno', () => {
    montar([cupo(7, 9, 0)]);
    expect(dias()[0].estado).toBe('lleno');
  });

  it('un bloqueo manda sobre el conteo', () => {
    // Que un día cerrado tenga cupos sin reservar no significa que se pueda
    // pedir turno: si no, la semana ofrecería lo que la agenda niega.
    montar([cupo(7, 9, 5)], [
      { desde: new Date(2026, 8, 7), hasta: new Date(2026, 8, 8), motivo: 'Vacaciones' },
    ]);

    expect(dias()[0].estado).toBe('bloqueado');
    expect(dias()[0].motivo).toBe('Vacaciones');
  });

  it('un bloqueo largo cierra TODOS los días que pisa', () => {
    // Unas vacaciones de dos semanas cierran los catorce días, no sólo el
    // primero. Es el error de comparar sólo el arranque.
    montar([], [
      { desde: new Date(2026, 8, 1), hasta: new Date(2026, 8, 30), motivo: 'Vacaciones' },
    ]);

    expect(dias().every((d) => d.estado === 'bloqueado')).toBe(true);
  });

  it('la paginación va de siete en siete', () => {
    montar();
    const vistas: Date[] = [];
    fixture.componentInstance.semanaElegida.subscribe((d: Date) => vistas.push(d));

    const anterior: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-testid="semana-anterior"]',
    );
    const siguiente: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '[data-testid="semana-siguiente"]',
    );
    anterior?.click();
    siguiente?.click();

    expect(vistas[0].getDate()).toBe(31);
    expect(vistas[1].getDate()).toBe(14);
  });
});
