import { ComponentRef } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AppointmentCalendar } from './appointment-calendar';
import type { CalendarAppointment } from './appointment-calendar.types';

/**
 * Un turno del calendario. La fecha se da explícita porque el mes que se dibuja
 * arranca en hoy: las pruebas fabrican fechas relativas a hoy para no atarse a
 * un mes concreto del calendario real.
 */
function turno(overrides: Partial<CalendarAppointment> = {}): CalendarAppointment {
  const cuando = new Date();
  cuando.setHours(10, 30, 0, 0);
  return {
    id: 't-1',
    cuando,
    hasta: null,
    titulo: 'Dra. Paz',
    estado: 'Confirmado',
    tono: 'success',
    ...overrides,
  };
}

function montar(turnos: readonly CalendarAppointment[]): {
  fixture: ComponentFixture<AppointmentCalendar>;
  ref: ComponentRef<AppointmentCalendar>;
} {
  TestBed.configureTestingModule({ imports: [AppointmentCalendar] });
  const fixture = TestBed.createComponent(AppointmentCalendar);
  fixture.componentRef.setInput('turnos', turnos);
  fixture.detectChanges();
  return { fixture, ref: fixture.componentRef };
}

/** Los botones de turno que hay dibujados en la grilla. */
function eventos(fixture: ComponentFixture<AppointmentCalendar>): HTMLButtonElement[] {
  return [...fixture.nativeElement.querySelectorAll('.calendario__turno')];
}

describe('AppointmentCalendar', () => {
  it('dibuja seis semanas completas para que la grilla no cambie de alto', () => {
    const { fixture } = montar([]);

    const filas = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(filas.length).toBe(6);
    expect(filas[0].querySelectorAll('td').length).toBe(7);
  });

  it('la semana empieza el lunes, como se lee un calendario acá', () => {
    const { fixture } = montar([]);

    const encabezados = [...fixture.nativeElement.querySelectorAll('thead th')].map(
      (th: HTMLElement) => (th.textContent ?? '').trim(),
    );
    expect(encabezados[0]).toBe('Lun');
    expect(encabezados[6]).toBe('Dom');
  });

  it('pone el turno en su día, con hora y estado en palabras', () => {
    const { fixture } = montar([turno()]);

    const [evento] = eventos(fixture);
    expect(evento.textContent).toContain('10:30');
    expect(evento.textContent).toContain('Dra. Paz');
    // El estado también en texto: el color del filo no se lee en voz alta.
    expect(evento.textContent).toContain('Confirmado');
  });

  it('elegir un turno emite su identificador y no opera nada', () => {
    const { fixture } = montar([turno()]);
    const elegidos: string[] = [];
    fixture.componentInstance.turnoElegido.subscribe((id) => elegidos.push(id));

    eventos(fixture)[0].click();

    expect(elegidos).toEqual(['t-1']);
  });

  it('los turnos sin horario no se dibujan, pero se cuentan', () => {
    const { fixture } = montar([turno({ id: 'sin-hora', cuando: null })]);

    expect(eventos(fixture)).toHaveLength(0);
    const aviso = fixture.nativeElement.querySelector('[data-testid="calendario-sin-horario"]');
    expect(aviso?.textContent).toContain('1 turno sin horario');
  });

  it('al cambiar de mes el turno de hoy deja de verse, y «Hoy» lo trae de vuelta', () => {
    const { fixture } = montar([turno()]);
    expect(eventos(fixture)).toHaveLength(1);

    const siguiente: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="calendario-mes-siguiente"]',
    );
    siguiente.click();
    fixture.detectChanges();
    expect(eventos(fixture)).toHaveLength(0);

    const hoy = [...fixture.nativeElement.querySelectorAll('button')].find(
      (boton: HTMLButtonElement) => (boton.textContent ?? '').trim() === 'Hoy',
    );
    hoy?.click();
    fixture.detectChanges();
    expect(eventos(fixture)).toHaveLength(1);
  });

  it('cada día se anuncia con su fecha y cuántos turnos tiene', () => {
    const { fixture } = montar([turno()]);

    const conTurno = [...fixture.nativeElement.querySelectorAll('td')].find(
      (celda: HTMLElement) => celda.querySelector('.calendario__turno') !== null,
    );
    expect(conTurno?.getAttribute('aria-label')).toContain('1 turno');

    const sinTurnos = [...fixture.nativeElement.querySelectorAll('td')].find(
      (celda: HTMLElement) => celda.querySelector('.calendario__turno') === null,
    );
    expect(sinTurnos?.getAttribute('aria-label')).toContain('sin turnos');
  });

  it('el turno abierto en el detalle queda marcado también acá', () => {
    const { fixture, ref } = montar([turno()]);

    ref.setInput('seleccionado', 't-1');
    fixture.detectChanges();

    expect(eventos(fixture)[0].classList.contains('calendario__turno--activo')).toBe(true);
    expect(eventos(fixture)[0].getAttribute('aria-current')).toBe('true');
  });

  it('ordena los turnos del mismo día por hora', () => {
    const tarde = new Date();
    tarde.setHours(16, 0, 0, 0);
    const temprano = new Date();
    temprano.setHours(8, 0, 0, 0);

    const { fixture } = montar([
      turno({ id: 'tarde', cuando: tarde, titulo: 'Tarde' }),
      turno({ id: 'temprano', cuando: temprano, titulo: 'Temprano' }),
    ]);

    const textos = eventos(fixture).map((evento) => evento.textContent ?? '');
    expect(textos[0]).toContain('Temprano');
    expect(textos[1]).toContain('Tarde');
  });
});
