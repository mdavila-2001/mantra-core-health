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

  function montar(
    cupos: unknown[] = [],
    bloqueos: readonly BloqueoDelMes[] = [],
    citas: unknown[] = [],
    etiquetas: ReadonlyMap<string, { code: string; display: string }> = new Map(),
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(WeekView);
    fixture.componentRef.setInput('semana', MIERCOLES);
    fixture.componentRef.setInput('cupos', cupos);
    fixture.componentRef.setInput('bloqueos', bloqueos);
    fixture.componentRef.setInput('citas', citas);
    fixture.componentRef.setInput('etiquetas', etiquetas);
    fixture.detectChanges();
  }

  function dias(): readonly {
    fecha: Date;
    estado: string;
    libres: number;
    tomados: number;
    motivo: string | null;
    citas: readonly { id: string; desde: Date; paciente: string }[];
    masCitas: number;
  }[] {
    return (fixture.componentInstance as never as { dias: () => never[] }).dias();
  }

  /** Una cita del día `dia` a la hora `hora`, con el estado que se le pase. */
  function cita(
    dia: number,
    hora: number,
    paciente: string | undefined,
    estado = 'st-confirmada',
  ): unknown {
    return {
      id: `b-${dia}-${hora}`,
      startAt: new Date(2026, 8, dia, hora),
      statusConceptId: estado,
      ...(paciente === undefined ? {} : { patientName: paciente }),
    };
  }

  /** El mapa de etiquetas con los dos estados que las pruebas usan. */
  const ETIQUETAS = new Map([
    ['st-confirmada', { code: 'BOOKING_CONFIRMED', display: 'Confirmada' }],
    ['st-cancelada', { code: 'BOOKING_CANCELLED', display: 'Cancelada' }],
  ]);

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

  /**
   * Con quién viene el día — el pedido del propietario: «revisar su calendario
   * de citas con horarios y nombre completo del paciente de forma diaria,
   * semanal y mensual».
   *
   * La semana ya existía y sabía contar; lo que no sabía era **a quién espera
   * el médico**, que es la mitad que se pidió.
   */
  describe('con quién viene cada día', () => {
    it('pone el nombre y la hora en el día que corresponde, ordenados', () => {
      montar(
        [cupo(7, 9, 0), cupo(7, 11, 0)],
        [],
        [cita(7, 11, 'Rosa Vargas'), cita(7, 9, 'Ana Paz'), cita(9, 8, 'Luis Rojas')],
        ETIQUETAS,
      );

      const lunes = dias()[0];
      expect(lunes.citas.map((c) => c.paciente)).toEqual(['Ana Paz', 'Rosa Vargas']);
      expect(dias()[2].citas.map((c) => c.paciente)).toEqual(['Luis Rojas']);
      expect(dias()[1].citas).toEqual([]);
    });

    it('sin nombre lo dice, no muestra el uuid ni un blanco', () => {
      // La API manda `patientName` sólo al titular y al profesional de esa
      // agenda: que falte es una condición del servidor, no un error.
      montar([cupo(7, 9, 0)], [], [cita(7, 9, undefined)], ETIQUETAS);
      expect(dias()[0].citas[0].paciente).toBe('Paciente sin nombre registrado');
    });

    it('una cancelada no se nombra: ese paciente no viene', () => {
      montar(
        [cupo(7, 9, 0), cupo(7, 10, 0)],
        [],
        [cita(7, 9, 'Ana Paz', 'st-cancelada'), cita(7, 10, 'Rosa Vargas')],
        ETIQUETAS,
      );

      expect(dias()[0].citas.map((c) => c.paciente)).toEqual(['Rosa Vargas']);
    });

    it('sin el catálogo de estados no esconde a nadie', () => {
      // Preferible nombrar de más que esconder a un paciente que sí viene
      // porque la terminología no respondió.
      montar([cupo(7, 9, 0)], [], [cita(7, 9, 'Ana Paz', 'st-cancelada')], new Map());
      expect(dias()[0].citas.map((c) => c.paciente)).toEqual(['Ana Paz']);
    });

    it('muestra tres y cuenta el resto', () => {
      // Una jornada de doce turnos convertiría la semana en ochenta líneas y
      // dejaría de responder «¿cómo viene esto?».
      montar(
        [],
        [],
        [8, 9, 10, 11, 12].map((h) => cita(7, h, `Paciente ${h}`)),
        ETIQUETAS,
      );

      const lunes = dias()[0];
      expect(lunes.citas).toHaveLength(3);
      expect(lunes.masCitas).toBe(2);
      expect(fixture.nativeElement.textContent).toContain('+2 turnos más');
    });

    it('el «+N turnos más» abre ESE día, no el de hoy', () => {
      // Pedido 2026-09-24: el resto de la jornada se ve en la vista del día, y
      // tiene que abrirse en la fecha tocada.
      montar(
        [],
        [],
        [8, 9, 10, 11].map((h) => cita(10, h, `Paciente ${h}`)),
        ETIQUETAS,
      );
      const abiertos: Date[] = [];
      fixture.componentInstance.diaElegido.subscribe((d: Date) => abiertos.push(d));

      const botones: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll(
        '[data-testid="semana-ver-dia"]',
      );
      expect(botones).toHaveLength(1);
      expect(botones[0].textContent).toContain('+1 turno más');
      botones[0].click();

      expect(abiertos).toHaveLength(1);
      expect(abiertos[0].getTime()).toBe(new Date(2026, 8, 10).getTime());
    });

    it('un día sin cupos publicados igual muestra a quien viene', () => {
      // El alta directa del profesional (AG-2) crea la cita con su cupo
      // puntual: el día no figura como jornada publicada. Decir «No atendés» y
      // esconder al paciente sería el peor error de esta vista.
      montar([], [], [cita(7, 9, 'Ana Paz')], ETIQUETAS);

      expect(dias()[0].estado).toBe('sin-agenda');
      expect(dias()[0].citas.map((c) => c.paciente)).toEqual(['Ana Paz']);
    });

    it('un bloqueo no se traga la cita: la persona viene igual', () => {
      montar(
        [cupo(7, 9, 0)],
        [{ desde: new Date(2026, 8, 7), hasta: new Date(2026, 8, 8), motivo: 'Vacaciones' }],
        [cita(7, 9, 'Ana Paz')],
        ETIQUETAS,
      );

      expect(dias()[0].estado).toBe('bloqueado');
      expect(dias()[0].citas.map((c) => c.paciente)).toEqual(['Ana Paz']);
    });

    it('una cita sin hora no se coloca en ningún día', () => {
      montar([], [], [{ id: 'b-sin-hora', statusConceptId: 'st-confirmada' }], ETIQUETAS);
      expect(dias().every((d) => d.citas.length === 0)).toBe(true);
    });

    it('los nombres van FUERA del botón del día', () => {
      // Un `<ul>` dentro de un `<button>` es HTML inválido y el lector de
      // pantalla lo aplana contra el nombre del botón. Se fija acá porque es
      // invisible a ojo y se rompe con un solo movimiento de etiqueta.
      montar([], [], [cita(7, 9, 'Ana Paz')], ETIQUETAS);

      const lista = fixture.nativeElement.querySelector('[data-testid="semana-citas"]');
      expect(lista).not.toBeNull();
      expect(lista.closest('button')).toBeNull();
      expect(lista.textContent).toContain('Ana Paz');
    });
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
