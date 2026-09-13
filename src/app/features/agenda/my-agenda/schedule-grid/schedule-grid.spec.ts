import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduleGrid } from './schedule-grid';
import type { PublishedRule } from '../../../../core/data-access/scheduling/scheduling.types';
import type { BloqueoDelMes } from '../month-view/month-view';

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
 *
 * Después se pidió que se viera **como Google Calendar**: la semana en curso
 * con sus fechas y hoy marcado, las franjas como bloques continuos de alto
 * proporcional, y el detalle completo en un globo al pasar el mouse.
 */
describe('ScheduleGrid', () => {
  let fixture: ComponentFixture<ScheduleGrid>;

  /** Miércoles 9 de septiembre de 2026. La semana va del lunes 7 al domingo 13. */
  const MIERCOLES = new Date(2026, 8, 9);

  function montar(
    reglas: readonly PublishedRule[],
    entradas: Partial<{
      semana: Date;
      conFechas: boolean;
      nombre: string;
      vigencia: string;
      slotMinutes: number;
      bloqueos: readonly BloqueoDelMes[];
    }> = {},
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ScheduleGrid);
    fixture.componentRef.setInput('reglas', reglas);
    fixture.componentRef.setInput('semana', entradas.semana ?? MIERCOLES);
    for (const clave of ['conFechas', 'nombre', 'vigencia', 'slotMinutes', 'bloqueos'] as const) {
      if (entradas[clave] !== undefined) fixture.componentRef.setInput(clave, entradas[clave]);
    }
    fixture.detectChanges();
  }

  function regla(
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    extra: Partial<PublishedRule> = {},
  ): PublishedRule {
    return { dayOfWeek, startTime, endTime, ...extra } as PublishedRule;
  }

  function horas(): readonly number[] {
    return (fixture.componentInstance as never as { horas: () => number[] }).horas();
  }

  function atiende(dia: number, hora: number): boolean {
    return (
      fixture.componentInstance as never as { atiende: (d: number, h: number) => boolean }
    ).atiende(dia, hora);
  }

  function bloques(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="horario-bloque"]'));
  }

  function cabeceras(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.grilla__dia'));
  }

  it('dibuja las 24 horas del día, como un calendario', () => {
    // Pedido del cliente: todas las horas, no sólo las que se atienden — un
    // bloqueo fuera de horario también tiene que tener dónde verse.
    montar([regla(1, '09:00:00', '13:00:00')]);

    expect(horas()).toHaveLength(24);
    expect(horas()[0]).toBe(0);
    expect(horas().at(-1)).toBe(23);
    expect(fixture.nativeElement.querySelectorAll('.grilla__hora')).toHaveLength(24);
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
  });

  it('los días van de lunes a domingo, no como los numera la API', () => {
    // La API usa 0 = domingo. Mostrarlo primero pondría el domingo antes del
    // lunes, que no es como nadie lee una semana.
    montar([regla(0, '09:00:00', '11:00:00'), regla(1, '09:00:00', '11:00:00')]);

    const nombres = cabeceras().map((c) => c.textContent ?? '');
    expect(nombres.findIndex((n) => n.includes('Lun'))).toBeLessThan(
      nombres.findIndex((n) => n.includes('Dom')),
    );
  });

  it('sin horarios lo dice, en vez de dibujar un rectángulo vacío', () => {
    montar([]);
    expect(fixture.nativeElement.textContent).toContain('Todavía no publicaste horarios');
  });

  /* -- Como Google Calendar ------------------------------------------------- */

  it('muestra la semana en curso con sus fechas y marca el día de hoy', () => {
    // El horario es un patrón, pero se mira desde un día concreto: «atendés
    // los martes de 9 a 13» tiene que leerse como «mañana a las 9».
    montar([regla(1, '09:00:00', '13:00:00')]);

    expect(fixture.nativeElement.textContent).toContain('Semana del 7 al 11 de septiembre');
    const numeros = cabeceras().map((c) => c.querySelector('.grilla__dia-numero')?.textContent?.trim());
    expect(numeros).toEqual(['7', '8', '9', '10', '11']);

    const hoy = cabeceras().filter((c) => c.getAttribute('aria-current') === 'date');
    expect(hoy).toHaveLength(1);
    expect(hoy[0].textContent).toContain('9');
  });

  it('va de lunes al último día atendido, con viernes como mínimo', () => {
    // Un fin de semana vacío no dice nada que la ausencia no diga; pero el
    // sábado, si se atiende, entra.
    montar([regla(2, '09:00:00', '13:00:00')]);
    expect(cabeceras()).toHaveLength(5);

    montar([regla(6, '09:00:00', '13:00:00')]);
    expect(cabeceras()).toHaveLength(6);
    expect(cabeceras().at(-1)?.textContent).toContain('Sáb');
  });

  it('la franja es UN bloque continuo, con alto proporcional a lo que dura', () => {
    // De 8:30 a 12:30 sobre las 24 horas (1440 min): el bloque arranca a los
    // 510 min (35,42 %) y dura 240 (16,67 %). Pintar la fila de las 8 entera
    // diría que atendés desde las 8.
    montar([regla(1, '08:30:00', '12:30:00')]);

    const [bloque] = bloques();
    expect(parseFloat(bloque.style.top)).toBeCloseTo((510 / 1440) * 100, 2);
    expect(parseFloat(bloque.style.height)).toBeCloseTo((240 / 1440) * 100, 2);
    expect(bloque.textContent).toContain('08:30 – 12:30');
    expect(bloque.getAttribute('aria-label')).toBe('lunes de 08:30 a 12:30: atendés');
  });

  it('cada franja va en la columna de su día', () => {
    montar([regla(1, '09:00:00', '13:00:00'), regla(3, '14:00:00', '18:00:00')]);

    const columnas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.grilla__columna'),
    );
    const conBloque = columnas.map((c) => c.querySelectorAll('[data-testid="horario-bloque"]').length);
    // lunes, martes, miércoles, jueves, viernes
    expect(conBloque).toEqual([1, 0, 1, 0, 0]);
  });

  it('sin fechas —el horario retirado del diálogo— sólo lleva los nombres de los días', () => {
    montar([regla(1, '09:00:00', '13:00:00')], { conFechas: false });

    expect(fixture.nativeElement.querySelector('.grilla__dia-numero')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-current="date"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Semana del');
  });

  /* -- El tamaño del turno -------------------------------------------------- */

  it('cada franja dice el tamaño de su turno', () => {
    montar([regla(1, '09:00:00', '13:00:00', { slotMinutes: 30 })]);
    expect(bloques()[0].textContent).toContain('consultas de 30 min');
  });

  it('sin tamaño propio usa el de la plantilla', () => {
    montar([regla(1, '09:00:00', '13:00:00')], { slotMinutes: 45 });
    expect(bloques()[0].textContent).toContain('consultas de 45 min');
  });

  it('una franja dinámica, sin tamaño, dice «tamaño libre»', () => {
    montar([regla(1, '09:00:00', '13:00:00')]);
    expect(bloques()[0].textContent).toContain('tamaño libre');

    bloques()[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    const globo = fixture.nativeElement.querySelector('[data-testid="horario-globo"]');
    expect(globo?.textContent).toContain('Tamaño libre');
  });

  /* -- Los bloqueos, en rojo ------------------------------------------------ */

  function bloqueosPintados(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="horario-bloqueo"]'));
  }

  it('pinta el bloqueo en la columna de su día, medido contra las 24 horas', () => {
    montar([regla(1, '09:00:00', '13:00:00')], {
      bloqueos: [
        {
          id: 'b',
          desde: new Date(2026, 8, 9, 12, 0),
          hasta: new Date(2026, 8, 9, 18, 0),
          motivo: 'Congreso',
        },
      ],
    });

    const columnas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.grilla__columna'),
    );
    const conBloqueo = columnas.map(
      (c) => c.querySelectorAll('[data-testid="horario-bloqueo"]').length,
    );
    expect(conBloqueo).toEqual([0, 0, 1, 0, 0]);
    const [b] = bloqueosPintados();
    expect(parseFloat(b.style.top)).toBeCloseTo(50, 2);
    expect(parseFloat(b.style.height)).toBeCloseTo(25, 2);
    expect(b.textContent).toContain('Bloqueado');
    expect(b.textContent).toContain('12:00 – 18:00');
    expect(b.textContent).toContain('Congreso');
    expect(b.getAttribute('aria-label')).toBe('miércoles de 12:00 a 18:00: bloqueado (Congreso)');
  });

  it('un bloqueo de varios días se parte por día y cubre enteros los del medio', () => {
    montar([regla(1, '09:00:00', '13:00:00')], {
      bloqueos: [{ desde: new Date(2026, 8, 7, 20, 0), hasta: new Date(2026, 8, 9, 8, 0), motivo: null }],
    });

    const pintados = bloqueosPintados();
    expect(pintados).toHaveLength(3);
    expect(pintados[1].textContent).toContain('00:00 – 24:00');
    expect(pintados[2].textContent).toContain('00:00 – 08:00');
  });

  it('los bloqueos de otra semana no se pintan, ni en un horario sin fechas', () => {
    const fuera: BloqueoDelMes = {
      desde: new Date(2026, 8, 20, 9),
      hasta: new Date(2026, 8, 20, 10),
      motivo: null,
    };
    montar([regla(1, '09:00:00', '13:00:00')], { bloqueos: [fuera] });
    expect(bloqueosPintados()).toHaveLength(0);

    const dentro: BloqueoDelMes = { ...fuera, desde: new Date(2026, 8, 8, 9), hasta: new Date(2026, 8, 8, 10) };
    montar([regla(1, '09:00:00', '13:00:00')], { bloqueos: [dentro], conFechas: false });
    expect(bloqueosPintados()).toHaveLength(0);
  });

  /* -- El globo de detalle -------------------------------------------------- */

  it('al pasar el mouse por una franja abre el globo con todos sus datos', () => {
    // De 15 a 19 con consultas de 20 min y 10 de respiro: 240 min entre 30
    // por turno son 8 turnos. Es lo que uno quiere saber y no cabe en el
    // bloque.
    montar(
      [regla(3, '15:00:00', '19:00:00', { slotMinutes: 20, gapMinutes: 10, capacityPerSlot: 2 })],
      { nombre: 'Tarde', vigencia: 'Hasta el 30/6/2027' },
    );
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).toBeNull();

    bloques()[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();

    const globo: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="horario-globo"]',
    );
    expect(globo).not.toBeNull();
    const texto = globo?.textContent ?? '';
    expect(texto).toContain('Miércoles 9 de septiembre');
    expect(texto).toContain('Tarde');
    expect(texto).toContain('15:00 – 19:00');
    expect(texto).toContain('4 h');
    expect(texto).toContain('20 min');
    expect(texto).toContain('10 min');
    expect(texto).toContain('8');
    expect(texto).toContain('Pacientes por turno');
    expect(texto).toContain('Hasta el 30/6/2027');
    // El bloque queda descrito por el globo, para el lector de pantalla.
    expect(bloques()[0].getAttribute('aria-describedby')).toBe('grilla-globo');
  });

  it('el globo se va con el mouse y también con Escape', () => {
    montar([regla(1, '09:00:00', '13:00:00')]);

    bloques()[0].dispatchEvent(new Event('mouseenter'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).not.toBeNull();

    bloques()[0].dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).toBeNull();

    // Con teclado: el foco abre, Escape cierra.
    bloques()[0].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).toBeNull();
  });
});
