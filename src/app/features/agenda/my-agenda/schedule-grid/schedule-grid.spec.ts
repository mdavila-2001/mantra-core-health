import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScheduleGrid, type RangoDeGrilla } from './schedule-grid';
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
      rango: RangoDeGrilla;
      sede: string | null;
    }> = {},
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ScheduleGrid);
    fixture.componentRef.setInput('reglas', reglas);
    fixture.componentRef.setInput('semana', entradas.semana ?? MIERCOLES);
    for (const clave of [
      'conFechas',
      'nombre',
      'vigencia',
      'slotMinutes',
      'bloqueos',
      'rango',
      'sede',
    ] as const) {
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
    expect(fixture.nativeElement.textContent).toContain('Todavía no publicó horarios');
  });

  /* -- Como Google Calendar ------------------------------------------------- */

  it('muestra la semana en curso con sus fechas y marca el día de hoy', () => {
    // El horario es un patrón, pero se mira desde un día concreto: «atendés
    // los martes de 9 a 13» tiene que leerse como «mañana a las 9».
    montar([regla(1, '09:00:00', '13:00:00')]);

    expect(fixture.nativeElement.textContent).toContain('Semana del 7 al 13 de septiembre');
    const numeros = cabeceras().map((c) =>
      c.querySelector('.grilla__dia-numero')?.textContent?.trim(),
    );
    expect(numeros).toEqual(['7', '8', '9', '10', '11', '12', '13']);

    const hoy = cabeceras().filter((c) => c.getAttribute('aria-current') === 'date');
    expect(hoy).toHaveLength(1);
    expect(hoy[0].textContent).toContain('9');
  });

  it('muestra la semana entera, de lunes a domingo, aunque no se atienda el fin de semana', () => {
    // Pedido del cliente: faltaban sábado y domingo.
    montar([regla(2, '09:00:00', '13:00:00')]);
    expect(cabeceras()).toHaveLength(7);
    expect(cabeceras().at(-2)?.textContent).toContain('Sáb');
    expect(cabeceras().at(-1)?.textContent).toContain('Dom');
  });

  it('un día sin nada asignado va en una columna angosta', () => {
    // Lo práctico: se ve que el día existe, pero no le roba ancho a los que
    // se atienden.
    montar([regla(1, '09:00:00', '13:00:00'), regla(6, '09:00:00', '13:00:00')]);

    const vacios = cabeceras().map((c) => c.classList.contains('grilla__dia--vacio'));
    expect(vacios).toEqual([false, true, true, true, true, false, true]);
    const tabla: HTMLElement = fixture.nativeElement.querySelector('.grilla__tabla');
    expect(tabla.style.gridTemplateColumns).toContain('var(--ancho-dia-vacio)');
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
    expect(bloque.getAttribute('aria-label')).toBe('lunes de 08:30 a 12:30: atiende');
  });

  it('cada franja va en la columna de su día', () => {
    montar([regla(1, '09:00:00', '13:00:00'), regla(3, '14:00:00', '18:00:00')]);

    const columnas: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.grilla__columna'),
    );
    const conBloque = columnas.map(
      (c) => c.querySelectorAll('[data-testid="horario-bloque"]').length,
    );
    // lunes a domingo
    expect(conBloque).toEqual([1, 0, 1, 0, 0, 0, 0]);
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

  /* -- El selector de rango (AC-C3-01) -------------------------------------- */

  it('con rango «atencion» recorta la grilla a las horas que se atienden', () => {
    // De 9 a 13 el lunes y de 14 a 18 el miércoles: se dibuja de las 9 a las 17
    // —el fin es exclusivo, así que las 18 no cuentan—, nueve filas.
    montar([regla(1, '09:00:00', '13:00:00'), regla(3, '14:00:00', '18:00:00')], {
      rango: 'atencion',
    });

    expect(horas()[0]).toBe(9);
    expect(horas().at(-1)).toBe(17);
    expect(horas()).toHaveLength(9);
    expect(fixture.nativeElement.querySelectorAll('.grilla__hora')).toHaveLength(9);
  });

  it('el rango no cambia qué se atiende, sólo cuánto día se ve', () => {
    // La misma pregunta, los dos rangos: recortar la grilla no puede volver
    // atendida una hora que no lo es, ni al revés.
    for (const rango of ['completo', 'atencion'] as const) {
      montar([regla(1, '09:00:00', '13:00:00')], { rango });
      expect(atiende(1, 9), rango).toBe(true);
      expect(atiende(1, 13), rango).toBe(false);
    }
  });

  it('recortado, el bloque se mide contra las horas visibles y no contra el día', () => {
    // De 9 a 13 sobre una grilla de 9 a 12:59 (4 h = 240 min): el bloque
    // arranca arriba del todo y ocupa el alto entero. Sobre 24 h ocuparía 17%.
    montar([regla(1, '09:00:00', '13:00:00')], { rango: 'atencion' });

    const [b] = bloques();
    expect(parseFloat(b.style.top)).toBeCloseTo(0, 2);
    expect(parseFloat(b.style.height)).toBeCloseTo(100, 2);
  });

  it('recortado, el bloqueo se mide igual — y el que queda fuera no se dibuja', () => {
    // Grilla de 9 a 12:59 (240 min). El bloqueo de 10 a 11 arranca al 25% y
    // ocupa el 25%; el de las 20:00 cae fuera de la ventana y no se pinta.
    montar([regla(1, '09:00:00', '13:00:00')], {
      rango: 'atencion',
      bloqueos: [
        {
          id: 'dentro',
          desde: new Date(2026, 8, 9, 10, 0),
          hasta: new Date(2026, 8, 9, 11, 0),
          motivo: 'Reunión',
        },
        {
          id: 'fuera',
          desde: new Date(2026, 8, 9, 20, 0),
          hasta: new Date(2026, 8, 9, 22, 0),
          motivo: 'Guardia',
        },
      ],
    });

    const pintados = bloqueosPintados();
    expect(pintados).toHaveLength(1);
    expect(pintados[0].textContent).toContain('Reunión');
    expect(parseFloat(pintados[0].style.top)).toBeCloseTo(25, 2);
    expect(parseFloat(pintados[0].style.height)).toBeCloseTo(25, 2);
  });

  it('el bloqueo recortado sigue diciendo sus horas reales, no las visibles', () => {
    // Empieza a las 7 y termina a las 20, y la grilla va de 9 a 13. Lo que se
    // dibuja es lo que entra; lo que se LEE es cuánto dura de verdad.
    montar([regla(1, '09:00:00', '13:00:00')], {
      rango: 'atencion',
      bloqueos: [
        {
          id: 'largo',
          desde: new Date(2026, 8, 9, 7, 0),
          hasta: new Date(2026, 8, 9, 20, 0),
          motivo: null,
        },
      ],
    });

    const [b] = bloqueosPintados();
    expect(b.textContent).toContain('07:00 – 20:00');
    expect(parseFloat(b.style.top)).toBeCloseTo(0, 2);
    expect(parseFloat(b.style.height)).toBeCloseTo(100, 2);
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
    expect(conBloqueo).toEqual([0, 0, 1, 0, 0, 0, 0]);
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
      bloqueos: [
        { desde: new Date(2026, 8, 7, 20, 0), hasta: new Date(2026, 8, 9, 8, 0), motivo: null },
      ],
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

    const dentro: BloqueoDelMes = {
      ...fuera,
      desde: new Date(2026, 8, 8, 9),
      hasta: new Date(2026, 8, 8, 10),
    };
    montar([regla(1, '09:00:00', '13:00:00')], { bloqueos: [dentro], conFechas: false });
    expect(bloqueosPintados()).toHaveLength(0);
  });

  /* -- Qué atiende cada franja ---------------------------------------------- */

  describe('qué atiende cada franja (consultas, otros servicios o ambos)', () => {
    it('una franja sin modo es de consultas: sin clase extra y con la frase de siempre', () => {
      montar([regla(1, '09:00:00', '13:00:00')], { slotMinutes: 30 });
      const bloque = bloques()[0];
      expect(bloque.getAttribute('data-mode')).toBe('CONSULTATIONS');
      expect(bloque.classList.contains('grilla__bloque--services')).toBe(false);
      expect(bloque.classList.contains('grilla__bloque--mixed')).toBe(false);
      expect(bloque.textContent).toContain('consultas de 30 min');
    });

    it('una franja de servicios lo dice en el bloque, en su rótulo y en la celda', () => {
      montar([regla(2, '14:00:00', '18:00:00', { bookingMode: 'SERVICES' })], {
        slotMinutes: 30,
        sede: 'Sede Centro',
      });
      const bloque = bloques()[0];
      expect(bloque.classList.contains('grilla__bloque--services')).toBe(true);
      expect(bloque.textContent).toContain('otros servicios');
      expect(bloque.textContent).not.toContain('consultas de');
      expect(bloque.getAttribute('aria-label')).toBe(
        'martes de 14:00 a 18:00: atiende otros servicios en Sede Centro',
      );
      expect(celda(15, 1).getAttribute('aria-label')).toContain(
        'atiende otros servicios de 14:00 a 18:00',
      );
    });

    it('el globo de una franja de servicios dice qué atiende y no inventa turnos', () => {
      montar([regla(2, '14:00:00', '18:00:00', { bookingMode: 'SERVICES', slotMinutes: 30 })]);
      bloques()[0].dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      const texto =
        fixture.nativeElement.querySelector('[data-testid="horario-globo"]')?.textContent ?? '';
      expect(texto).toContain('Atiende');
      expect(texto).toContain('Otros servicios');
      expect(texto).not.toContain('Horarios en la franja');
      expect(texto).not.toContain('Cada consulta');
    });

    it('una franja «Ambos» conserva sus turnos y suma los servicios', () => {
      montar([regla(3, '08:00:00', '12:00:00', { bookingMode: 'MIXED', slotMinutes: 30 })]);
      const bloque = bloques()[0];
      expect(bloque.classList.contains('grilla__bloque--mixed')).toBe(true);
      expect(bloque.textContent).toContain('consultas de 30 min y servicios');
      bloque.dispatchEvent(new Event('mouseenter'));
      fixture.detectChanges();
      const texto =
        fixture.nativeElement.querySelector('[data-testid="horario-globo"]')?.textContent ?? '';
      expect(texto).toContain('Consultas y otros servicios');
      expect(texto).toContain('Horarios en la franja');
    });

    it('con otros servicios en la semana, la leyenda explica el segundo tono', () => {
      montar([
        regla(1, '08:00:00', '12:00:00', { slotMinutes: 30 }),
        regla(2, '14:00:00', '18:00:00', { bookingMode: 'SERVICES' }),
      ]);
      const leyenda: HTMLElement | null = fixture.nativeElement.querySelector(
        '[data-testid="horario-leyenda"]',
      );
      expect(leyenda?.textContent).toContain('Consultas');
      expect(leyenda?.textContent).toContain('Otros servicios: cirugías, toma de muestras');
    });

    it('sin otros servicios no hay leyenda que leer', () => {
      montar([regla(1, '08:00:00', '12:00:00', { slotMinutes: 30 })]);
      expect(fixture.nativeElement.querySelector('[data-testid="horario-leyenda"]')).toBeNull();
    });
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
    expect(texto).toContain('Pacientes por horario');
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

    // Con teclado: el foco en una celda de la franja abre, Escape cierra.
    celda(9, 0).dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).toBeNull();
  });
  /* ---- la grilla accesible (WCAG 2.1.1 · 1.3.1 · 4.1.2) ------------------- */

  /** La celda de la hora `h` (en el rango completo, la fila es la hora) y el día `col` (0 = lunes). */
  function celda(h: number, col: number): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-celda="${h - horas()[0]}-${col}"]`);
  }

  function celdas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="schedule-grid-cell"]'));
  }

  function tecla(desde: HTMLElement, key: string, extra: KeyboardEventInit = {}): void {
    desde.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }),
    );
    fixture.detectChanges();
  }

  describe('grilla accesible', () => {
    it('es un `grid` de sólo lectura con una fila por hora y una celda por día', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);

      const grilla = fixture.nativeElement.querySelector('[role="grid"]') as HTMLElement;
      expect(grilla).not.toBeNull();
      expect(grilla.getAttribute('aria-readonly')).toBe('true');
      expect(grilla.getAttribute('aria-label')).toBe('Semana del 7 al 13 de septiembre');
      // Cabecera + 24 horas; cada hora con su cabecera de fila y siete celdas.
      expect(grilla.querySelectorAll('[role="row"]')).toHaveLength(25);
      expect(grilla.querySelectorAll('[role="columnheader"]')).toHaveLength(8);
      expect(grilla.querySelectorAll('[role="rowheader"]')).toHaveLength(24);
      expect(celdas()).toHaveLength(24 * 7);
      // El dibujo dice lo mismo con color: al lector no se le repite.
      const columnas = Array.from(
        fixture.nativeElement.querySelectorAll('.grilla__columna'),
      ) as HTMLElement[];
      expect(columnas.every((c) => c.getAttribute('aria-hidden') === 'true')).toBe(true);
    });

    it('cada celda dice día, hora, qué pasa ahí y dónde', () => {
      montar([regla(1, '09:00:00', '13:00:00')], { sede: 'Sede Centro' });

      expect(celda(9, 0).getAttribute('aria-label')).toBe(
        'Lunes 7 de septiembre, 09:00, atiende de 09:00 a 13:00, Sede Centro',
      );
      // Una hora sin atención existe para el lector: antes era `aria-hidden`.
      expect(celda(14, 0).getAttribute('aria-label')).toBe(
        'Lunes 7 de septiembre, 14:00, sin atención',
      );
      expect(celda(9, 1).getAttribute('aria-label')).toBe(
        'Martes 8 de septiembre, 09:00, sin atención',
      );
    });

    it('sin sede registrada la etiqueta no la inventa', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);

      expect(celda(9, 0).getAttribute('aria-label')).toBe(
        'Lunes 7 de septiembre, 09:00, atiende de 09:00 a 13:00',
      );
      expect(bloques()[0].getAttribute('aria-label')).toBe('lunes de 09:00 a 13:00: atiende');
    });

    it('la franja dibujada también nombra la sede', () => {
      montar([regla(1, '08:30:00', '12:30:00')], { sede: 'Consultorio Norte' });

      expect(bloques()[0].getAttribute('aria-label')).toBe(
        'lunes de 08:30 a 12:30: atiende en Consultorio Norte',
      );
    });

    it('un bloqueo manda sobre la franja, con su motivo', () => {
      montar([regla(3, '09:00:00', '13:00:00')], {
        sede: 'Sede Centro',
        bloqueos: [
          {
            id: 'b',
            desde: new Date(2026, 8, 9, 12, 0),
            hasta: new Date(2026, 8, 9, 18, 0),
            motivo: 'Congreso',
          },
        ],
      });

      expect(celda(12, 2).getAttribute('aria-label')).toBe(
        'Miércoles 9 de septiembre, 12:00, bloqueado de 12:00 a 18:00 (Congreso)',
      );
      expect(celda(11, 2).getAttribute('aria-label')).toContain(
        'atiende de 09:00 a 13:00, Sede Centro',
      );
    });

    it('sin fechas —horario retirado— el día va sin número', () => {
      montar([regla(1, '09:00:00', '13:00:00')], { conFechas: false });

      expect(celda(9, 0).getAttribute('aria-label')).toBe('Lunes, 09:00, atiende de 09:00 a 13:00');
    });

    it('una sola parada de Tab, en la primera hora atendida del primer día que se atiende', () => {
      montar([regla(3, '10:00:00', '12:00:00'), regla(1, '14:00:00', '16:00:00')]);

      const tabStops = celdas().filter((c) => c.getAttribute('tabindex') === '0');
      expect(tabStops).toHaveLength(1);
      // Las 10 del miércoles: es la primera fila con atención, y en esa fila el primer día.
      expect(tabStops[0]).toBe(celda(10, 2));
    });

    it('↑/↓ cambian de hora y ←/→ de día, moviendo el foco y la parada de Tab', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);
      const inicio = celda(9, 0);
      inicio.focus();

      tecla(inicio, 'ArrowDown');
      expect(document.activeElement).toBe(celda(10, 0));

      tecla(celda(10, 0), 'ArrowRight');
      expect(document.activeElement).toBe(celda(10, 1));

      tecla(celda(10, 1), 'ArrowUp');
      expect(document.activeElement).toBe(celda(9, 1));

      tecla(celda(9, 1), 'ArrowLeft');
      expect(document.activeElement).toBe(celda(9, 0));

      // Roving tabindex: la parada sigue al foco, y sólo hay una.
      expect(celda(9, 0).getAttribute('tabindex')).toBe('0');
      expect(celdas().filter((c) => c.getAttribute('tabindex') === '0')).toHaveLength(1);
    });

    it('Inicio/Fin van al primer y al último día; con Ctrl, a la primera y la última celda', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);
      celda(9, 3).focus();

      tecla(celda(9, 3), 'End');
      expect(document.activeElement).toBe(celda(9, 6));

      tecla(celda(9, 6), 'Home');
      expect(document.activeElement).toBe(celda(9, 0));

      tecla(celda(9, 0), 'End', { ctrlKey: true });
      expect(document.activeElement).toBe(celda(23, 6));

      tecla(celda(23, 6), 'Home', { ctrlKey: true });
      expect(document.activeElement).toBe(celda(0, 0));
    });

    it('en los bordes se queda quieta, sin dar la vuelta', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);
      celda(0, 0).focus();

      tecla(celda(0, 0), 'ArrowUp');
      expect(document.activeElement).toBe(celda(0, 0));
      tecla(celda(0, 0), 'ArrowLeft');
      expect(document.activeElement).toBe(celda(0, 0));

      celda(23, 6).focus();
      tecla(celda(23, 6), 'ArrowDown');
      expect(document.activeElement).toBe(celda(23, 6));
      tecla(celda(23, 6), 'ArrowRight');
      expect(document.activeElement).toBe(celda(23, 6));
    });

    it('otras teclas no se consumen: Tab sigue saliendo de la grilla', () => {
      montar([regla(1, '09:00:00', '13:00:00')]);
      const evento = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      celda(9, 0).dispatchEvent(evento);

      expect(evento.defaultPrevented).toBe(false);
    });

    it('enfocar una celda de la franja abre su globo y la describe con él', () => {
      montar([regla(1, '09:00:00', '13:00:00')], { slotMinutes: 30 });

      celda(10, 0).dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).not.toBeNull();
      expect(celda(10, 0).getAttribute('aria-describedby')).toBe('grilla-globo');

      // Una celda sin atención no tiene globo que mostrar.
      celda(15, 0).dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-testid="horario-globo"]')).toBeNull();
    });

    it('con rango «atencion» las celdas siguen a las horas visibles', () => {
      montar([regla(1, '09:00:00', '13:00:00')], { rango: 'atencion' });

      expect(celdas()).toHaveLength(4 * 7);
      expect(celda(9, 0).getAttribute('aria-label')).toContain('09:00, atiende');
    });
  });
});
