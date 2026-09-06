import { readFileSync } from 'node:fs';
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

  /**
   * FT-07-R03 · la tarjeta del día muestra el **resumen**: la hora y con quién.
   * El estado bajó al detalle, que es lo que hace que la tarjeta tenga un alto
   * previsible sin importar cuánto texto traiga la cita.
   */
  it('pone el turno en su día, con hora y con quién', () => {
    const { fixture } = montar([turno()]);

    const [evento] = eventos(fixture);
    expect(evento.textContent).toContain('10:30');
    expect(evento.textContent).toContain('Dra. Paz');
  });

  /**
   * FT-07-R04 · el detalle acompaña a cada tarjeta y trae lo que no entra en
   * ella. El estado también en texto: el color del filo no se lee en voz alta.
   */
  it('cada turno lleva su detalle con el estado y las líneas extra', () => {
    const { fixture } = montar([
      turno({ detalles: ['Consultorio: Sala 2', 'Motivo: control anual'] }),
    ]);

    const detalle = fixture.nativeElement.querySelector('.calendario__detalle') as HTMLElement;
    expect(detalle).not.toBeNull();
    expect(detalle.getAttribute('role')).toBe('tooltip');
    expect(detalle.textContent).toContain('Confirmado');
    expect(detalle.textContent).toContain('Consultorio: Sala 2');
    expect(detalle.textContent).toContain('Motivo: control anual');
  });

  /**
   * FT-07-R07 · el detalle se anuncia como descripción del botón, así que quien
   * navega con teclado o con lector de pantalla lo recibe sin apuntar con el
   * puntero — que era justo lo que el `title` nativo no permitía.
   */
  it('el botón del turno apunta a su detalle con aria-describedby', () => {
    const { fixture } = montar([turno({ id: 'cita-1' })]);

    const boton = fixture.nativeElement.querySelector('.calendario__turno') as HTMLElement;
    const detalle = fixture.nativeElement.querySelector('.calendario__detalle') as HTMLElement;
    expect(boton.getAttribute('aria-describedby')).toBe(detalle.id);
    expect(detalle.id).toBe('detalle-cita-1');
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

  /* ---- el calendario como punto de entrada a la reserva (F-10) ------------ */

  /**
   * Antes el calendario sólo servía para mirar: para pedir turno había que
   * bajar al formulario y recorrer catorce días de horarios.
   */
  it('señalar un día emite su fecha para pedir turno ahí', () => {
    const { fixture } = montar([]);
    const dias: Date[] = [];
    fixture.componentInstance.diaElegido.subscribe((dia) => dias.push(dia));

    const hoy = new Date();
    const boton = [...fixture.nativeElement.querySelectorAll('.calendario__numero--pedible')].find(
      (b: HTMLButtonElement) => (b.textContent ?? '').trim() === String(hoy.getDate()),
    ) as HTMLButtonElement;
    boton.click();

    expect(dias).toHaveLength(1);
    expect(dias[0].getDate()).toBe(hoy.getDate());
    expect(dias[0].getMonth()).toBe(hoy.getMonth());
  });

  /** Hacia atrás no hay horario que pedir: el día pasado se mira, no se ofrece. */
  it('los días pasados no ofrecen pedir turno', () => {
    const { fixture } = montar([]);

    const anterior: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="calendario-mes-anterior"]',
    );
    anterior.click();
    fixture.detectChanges();

    // Ojo con el aserto fácil —«el mes anterior no tiene ni un día pedible»—:
    // es falso cuatro días al mes. La grilla completa las semanas con días del
    // mes vecino, así que mirando agosto un 3 de septiembre la última fila
    // arrastra el 3, 4, 5 y 6, que son futuro y sí se piden. Esos llevan
    // `--fuera` porque no son de agosto. Lo que hay que comprobar es que
    // ningún día **del mes que se está mirando** se ofrezca.
    expect(
      fixture.nativeElement.querySelectorAll(
        '.calendario__dia:not(.calendario__dia--fuera) .calendario__numero--pedible',
      ).length,
    ).toBe(0);
  });

  /** El botón dice de qué día es: un número suelto no se entiende leído en voz alta. */
  it('el día accionable se anuncia con su fecha en palabras', () => {
    const { fixture } = montar([]);

    const boton: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.calendario__numero--pedible',
    );
    expect(boton.getAttribute('aria-label')).toContain('Ver horarios libres del');
  });

  /* ---- que la grilla no se deforme (F-08, F-09) --------------------------- */

  /**
   * F-08. Con varios turnos en un día, la celda tiene alto fijo y el contenido
   * la estiraba: se deformaba la fila entera. Ahora los turnos viven en una
   * caja propia que se desplaza, así que el bloque se ajusta a la celda y no
   * al revés.
   */
  it('los turnos de un día viven en una caja acotada, no sueltos en la celda', () => {
    const manana = new Date();
    manana.setHours(9, 0, 0, 0);
    const tarde = new Date();
    tarde.setHours(16, 0, 0, 0);

    const { fixture } = montar([
      turno({ id: 'a', cuando: manana, titulo: 'Uno' }),
      turno({ id: 'b', cuando: tarde, titulo: 'Dos' }),
    ]);

    // Una sola caja, la del día que tiene turnos: los días vacíos no la dibujan.
    const cajas = fixture.nativeElement.querySelectorAll('.calendario__turnos');
    expect(cajas.length).toBe(1);
    expect(cajas[0].querySelectorAll('.calendario__turno').length).toBe(2);
  });

  /**
   * El texto largo se trunca en la tarjeta —si no, empujaría la columna del día
   * siguiente— pero sigue entero en el detalle.
   *
   * FT-07 cambió dónde vive: era el `[title]` nativo del botón, que no se puede
   * leer con teclado, tarda un segundo largo y no admite más de una línea.
   */
  it('un turno con nombre largo conserva su texto completo en el detalle', () => {
    const { fixture } = montar([
      turno({ titulo: 'Dra. María Fernanda Villarroel Antezana', estado: 'Confirmado' }),
    ]);

    const detalle = fixture.nativeElement.querySelector('.calendario__detalle') as HTMLElement;
    expect(detalle.textContent).toContain('Dra. María Fernanda Villarroel Antezana');
    expect(detalle.textContent).toContain('Confirmado');
  });

  /**
   * F-09. Las iniciales de la semana usaban el mismo tamaño que el número del
   * día y se perdían entre las fechas. Se lee del CSS porque la regla es
   * visual: si alguien la vuelve a bajar a `caption`, esto se cae.
   */
  it('la cabecera de la semana no usa el tamaño del número del día', () => {
    const css = readFileSync(
      'src/app/features/account/appointments/appointment-calendar/appointment-calendar.css',
      'utf8',
    );
    const cabecera = css.slice(css.indexOf('.calendario__encabezado {'));
    const regla = cabecera.slice(0, cabecera.indexOf('}'));

    expect(regla).toContain('--fs-h4');
    expect(regla).not.toContain('--fs-caption');
  });
});
