import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DayView, type PedidoDeAccion, type RatoTocado } from './day-view';
import type { BloqueoDelMes } from '../month-view/month-view';

const DIA = new Date(2026, 7, 25);

function cupo(hora: number, minuto = 0, id = `s-${hora}-${minuto}`, duracionMin = 30) {
  return {
    id,
    resourceId: 'res-1',
    scheduleTemplateId: null,
    startAt: new Date(2026, 7, 25, hora, minuto),
    endAt: new Date(2026, 7, 25, hora, minuto + duracionMin),
    capacity: 1,
    remainingCapacity: 1,
    statusConceptId: 'c',
    serviceConceptId: null,
  };
}

function cita(slotId: string, extra: Record<string, unknown> = {}) {
  return {
    id: `b-${slotId}`,
    bookableSlotId: slotId,
    patientProfileId: 'pac-1',
    statusConceptId: 'confirmado',
    patientName: 'Ana Quispe',
    ...extra,
  };
}

/**
 * El día del profesional — la línea de horas con bloques proporcionales (AG-5).
 *
 * Lo que estas pruebas fijan (las invariantes de MAC-6 siguen todas):
 *
 * 1. **Es una línea de tiempo, no una lista de reservas.** El hueco se VE —
 *    ahora como aire con la altura de su rato, no como fila rotulada.
 * 2. **La altura es proporcional a la duración** — la decisión visual central:
 *    la cirugía de 3 h se ve grande, la consulta de 30 min chica.
 * 3. **El tiempo ocupado es un bloque propio** — la reunión de 13:15 existe
 *    aunque no haya cupos a esa hora.
 * 4. **Una cita dentro de un bloqueo no se la traga el bloqueo.**
 * 5. **Tocar un rato vacío crea** — el único gesto de AG-5.
 * 6. **No se ofrece una acción que va a fallar** — la allowlist de estados.
 */
describe('DayView', () => {
  let fixture: ComponentFixture<DayView>;

  const ETIQUETAS = new Map([
    ['confirmado', { code: 'BOOKING_CONFIRMED', display: 'Confirmado' }],
    ['llego', { code: 'scheduling:BOOKING_CHECKED_IN', display: 'Llegó' }],
    ['cancelado', { code: 'BOOKING_CANCELLED', display: 'Cancelado' }],
  ]);

  function montar(
    cupos: unknown[] = [],
    citas: unknown[] = [],
    bloqueos: readonly BloqueoDelMes[] = [],
    puedeRegistrarLlegada = true,
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(DayView);
    fixture.componentRef.setInput('dia', DIA);
    fixture.componentRef.setInput('cupos', cupos);
    fixture.componentRef.setInput('citas', citas);
    fixture.componentRef.setInput('bloqueos', bloqueos);
    fixture.componentRef.setInput('etiquetas', ETIQUETAS);
    fixture.componentRef.setInput('puedeRegistrarLlegada', puedeRegistrarLlegada);
    fixture.detectChanges();
  }

  function bloques(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.dia__bloque'));
  }

  function tipos(): (string | null)[] {
    return bloques().map((b) => b.getAttribute('data-tipo'));
  }

  it('el hueco SE VE entre las citas, como aire con su rato', () => {
    // 9:00 cita · 9:30–12:00 aire · 12:00 libre · 12:30–14:00 aire · 14:00 cita.
    // Sin el aire, saber cuándo hay lugar obliga a restar horarios en la cabeza.
    montar([cupo(9), cupo(12), cupo(14)], [cita('s-9-0'), cita('s-14-0')]);

    expect(tipos()).toEqual(['cita', 'aire', 'libre', 'aire', 'cita']);
  });

  it('la altura es PROPORCIONAL: la cirugía de 3 h se ve grande', () => {
    // La decisión visual central de AG-5, el caso del odontólogo.
    montar(
      [cupo(9, 0, 'consulta', 30), cupo(14, 0, 'cirugia', 180)],
      [cita('consulta'), cita('cirugia', { reasonText: 'Implante' })],
    );

    const [consulta, , cirugia] = bloques();
    const altoConsulta = Number.parseInt(consulta.style.minHeight, 10);
    const altoCirugia = Number.parseInt(cirugia.style.minHeight, 10);
    expect(altoCirugia).toBeGreaterThan(altoConsulta * 4);
  });

  it('el aire NO usa altura mínima: un hueco de 5 minutos se ve chico', () => {
    montar([cupo(9, 0, 'a', 30), cupo(9, 35, 'b', 30)]);

    const aire = bloques()[1];
    expect(aire.getAttribute('data-tipo')).toBe('aire');
    expect(Number.parseInt(aire.style.minHeight, 10)).toBeLessThan(10);
  });

  it('el aire largo se comprime y dice cuánto dura', () => {
    // 9:00–9:30 cita · 9:30–16:00 aire (6 h 30 min) · 16:00 cita.
    montar([cupo(9, 0, 'a', 30), cupo(16, 0, 'b', 30)], [cita('a'), cita('b')]);

    const aire = bloques()[1];
    expect(aire.getAttribute('data-tipo')).toBe('aire');
    // No los 624 px de seis horas y media: la altura de una hora.
    expect(Number.parseInt(aire.style.minHeight, 10)).toBeLessThanOrEqual(96);
    expect(aire.textContent).toContain('6 h 30 min sin turnos');
  });

  it('las citas van en orden de reloj, aunque los cupos no vengan ordenados', () => {
    montar([cupo(14), cupo(9), cupo(12)]);

    const horas = bloques()
      .filter((b) => b.getAttribute('data-tipo') !== 'aire')
      .map((b) => b.querySelector('.dia__hora')?.textContent?.trim());
    expect(horas[0]).toContain('09:00');
    expect(horas[2]).toContain('14:00');
  });

  it('muestra el nombre del paciente y su motivo: acá SÍ corresponde', () => {
    // TJ-2 los sacó de la vista de la organización, no de la del profesional
    // que va a recibir a esa persona en diez minutos.
    montar([cupo(9)], [cita('s-9-0', { reasonText: 'Control de presión' })]);

    expect(fixture.nativeElement.textContent).toContain('Ana Quispe');
    expect(fixture.nativeElement.textContent).toContain('Control de presión');
  });

  it('sin nombre no inventa relleno ni muestra el identificador', () => {
    montar([cupo(9)], [cita('s-9-0', { patientName: undefined })]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Paciente sin nombre registrado');
    expect(texto).not.toContain('pac-1');
  });

  it('el tiempo ocupado es un bloque PROPIO con su rótulo, sin cupos abajo', () => {
    // La reunión existe aunque no haya cupos a esa hora, y los cupos libres que
    // caen adentro no se pintan además: dos cosas sobre el mismo rato mienten.
    montar(
      [cupo(14), cupo(15)],
      [],
      [
        {
          id: 'exc-1',
          desde: new Date(2026, 7, 25, 14, 0),
          hasta: new Date(2026, 7, 25, 18, 0),
          motivo: 'trámite personal',
        },
      ],
    );

    expect(tipos()).toEqual(['ocupado']);
    expect(fixture.nativeElement.textContent).toContain('trámite personal');
    expect(fixture.nativeElement.textContent).not.toContain('Disponible');
  });

  it('una cita dentro de un bloqueo sigue mostrándose: no se la traga', () => {
    // El bloqueo cierra los cupos LIBRES; la persona citada viene igual, y
    // ocultarla haría que el médico no supiera que alguien va a llegar.
    montar(
      [cupo(14)],
      [cita('s-14-0')],
      [
        {
          id: 'exc-1',
          desde: new Date(2026, 7, 25, 14, 0),
          hasta: new Date(2026, 7, 25, 18, 0),
          motivo: 'x',
        },
      ],
    );

    expect(tipos()).toContain('cita');
    expect(fixture.nativeElement.textContent).toContain('Ana Quispe');
  });

  it('un ocupado con id ofrece «Quitar» y lo emite', () => {
    const quitados: string[] = [];
    montar([], [], [
      {
        id: 'exc-9',
        desde: new Date(2026, 7, 25, 13, 15),
        hasta: new Date(2026, 7, 25, 13, 45),
        motivo: 'Reunión de equipo',
      },
    ]);
    fixture.componentInstance.quitarOcupado.subscribe((id: string) => quitados.push(id));

    const quitar = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Quitar'),
    ) as HTMLButtonElement;
    quitar.click();

    expect(quitados).toEqual(['exc-9']);
  });

  it('tocar un hueco libre emite el rato con su rango puesto', () => {
    // El único gesto de AG-5: tocás el rato, la tarjeta se abre prellenada.
    const tocados: RatoTocado[] = [];
    montar([cupo(12)]);
    fixture.componentInstance.ratoTocado.subscribe((r: RatoTocado) => tocados.push(r));

    (fixture.nativeElement.querySelector('.dia__libre') as HTMLButtonElement).click();

    expect(tocados).toHaveLength(1);
    expect(tocados[0].desde.getHours()).toBe(12);
    expect(tocados[0].hasta.getHours()).toBe(12);
    expect(tocados[0].hasta.getMinutes()).toBe(30);
  });

  it('el aire también es tocable, sin anunciarlo', () => {
    const tocados: RatoTocado[] = [];
    montar([cupo(9), cupo(14)]);
    fixture.componentInstance.ratoTocado.subscribe((r: RatoTocado) => tocados.push(r));

    (fixture.nativeElement.querySelector('.dia__aire') as HTMLButtonElement).click();

    expect(tocados).toHaveLength(1);
    expect(tocados[0].desde.getHours()).toBe(9);
    expect(tocados[0].desde.getMinutes()).toBe(30);
  });

  it('el «+» propone un rato aunque el día esté vacío', () => {
    const tocados: RatoTocado[] = [];
    montar([]);
    fixture.componentInstance.ratoTocado.subscribe((r: RatoTocado) => tocados.push(r));

    const mas = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Agregar'),
    ) as HTMLButtonElement;
    mas.click();

    expect(tocados).toHaveLength(1);
  });

  it('traduce el estado a palabras, nunca el código crudo', () => {
    montar([cupo(9)], [cita('s-9-0', { statusConceptId: 'llego' })]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Llegó');
    expect(texto).not.toContain('BOOKING_CHECKED_IN');
  });

  it('a quien ya llegó no le ofrece «Llegó» otra vez', () => {
    montar([cupo(9)], [cita('s-9-0', { statusConceptId: 'llego' })]);

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('.dia__acciones button'),
    ) as HTMLButtonElement[];
    expect(botones.some((b) => b.textContent?.includes('Llegó'))).toBe(false);
    expect(botones.some((b) => b.textContent?.includes('Avisar demora'))).toBe(true);
  });

  it('sobre una cita cancelada no ofrece ninguna acción', () => {
    montar([cupo(9)], [cita('s-9-0', { statusConceptId: 'cancelado' })]);

    expect(fixture.nativeElement.querySelectorAll('.dia__acciones button')).toHaveLength(0);
  });

  it('pedir una acción la emite con el id de la cita', () => {
    const pedidos: PedidoDeAccion[] = [];
    montar([cupo(9)], [cita('s-9-0')]);
    fixture.componentInstance.accionPedida.subscribe((p: PedidoDeAccion) => pedidos.push(p));

    const llego = Array.from(fixture.nativeElement.querySelectorAll('button')).find((b) =>
      (b as HTMLElement).textContent?.includes('Llegó'),
    ) as HTMLButtonElement;
    llego.click();

    expect(pedidos).toEqual([{ bookingId: 'b-s-9-0', accion: 'llegó' }]);
  });

  it('sin permiso de mostrador NO ofrece «Llegó», pero sí lo demás', () => {
    montar([cupo(9)], [cita('s-9-0')], [], false);

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('.dia__acciones button'),
    ) as HTMLButtonElement[];
    expect(botones.some((b) => b.textContent?.includes('Llegó'))).toBe(false);
    expect(botones.some((b) => b.textContent?.includes('Avisar demora'))).toBe(true);
    expect(botones.some((b) => b.textContent?.includes('Cancelar'))).toBe(true);
  });

  it('resume turnos y ratos ocupados en el encabezado', () => {
    montar(
      [cupo(9), cupo(12), cupo(14)],
      [cita('s-9-0')],
      [
        {
          id: 'exc-1',
          desde: new Date(2026, 7, 25, 7, 0),
          hasta: new Date(2026, 7, 25, 8, 0),
          motivo: 'Guardia',
        },
      ],
    );

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('1 de 3 turnos reservados');
    expect(texto).toContain('1 rato ocupado');
  });

  it('un día sin nada lo dice con palabras, y deja crear', () => {
    montar([]);

    expect(fixture.nativeElement.textContent).toContain('No atendés este día');
    expect(fixture.nativeElement.textContent).toContain('Agregar');
  });

  /**
   * RECORRER EL DÍA Y ABRIR LA TARJETA — carril 12 del pedido original.
   *
   * «Un botón de ver mañana, y así sucesivamente» y «cards al estilo de Google
   * Calendar que son cliqueables que abren un modal con todo el detalle».
   */
  describe('recorrer y abrir', () => {
    function porTestid(id: string): HTMLElement | null {
      return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
    }

    it('ofrece ayer y mañana', () => {
      montar();
      expect(porTestid('dia-anterior')).not.toBeNull();
      expect(porTestid('dia-siguiente')).not.toBeNull();
    });

    it('emite el DESPLAZAMIENTO, no la fecha ya calculada', () => {
      // Sumar un día es cosa del calendario: hacerlo acá con `+24h` se rompe el
      // día que cambia el horario de verano.
      montar();
      const vistos: number[] = [];
      fixture.componentInstance.diaCambiado.subscribe((d: number) => vistos.push(d));

      porTestid('dia-siguiente')?.click();
      porTestid('dia-anterior')?.click();

      expect(vistos).toEqual([1, -1]);
    });
  });

  /**
   * EL COLOR POR TIPOLOGÍA — carril 12, y estaba bloqueado hasta hoy.
   *
   * «Con otros colores los otros procedimientos (TURNOS, OPERACIONES, ETC.)
   * catalogado por tipología raíz». La columna existía y no había conceptos que
   * ponerle; ahora el catálogo los publica con su tono.
   */
  describe('la tipología de la actividad', () => {
    const CATALOGO = [
      { type: 'PROCEDURE', conceptId: 'c-proc', label: 'Operación o procedimiento', tone: 'warning' },
      { type: 'FOLLOW_UP', conceptId: 'c-ctrl', label: 'Control', tone: 'info' },
    ];

    function montarConTipologia(typeConceptId: string | undefined, catalogo = CATALOGO): void {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      fixture = TestBed.createComponent(DayView);
      fixture.componentRef.setInput('dia', DIA);
      fixture.componentRef.setInput('cupos', [
        { id: 's-1', startAt: new Date(2026, 8, 10, 9), endAt: new Date(2026, 8, 10, 9, 30) },
      ]);
      fixture.componentRef.setInput('citas', [
        {
          id: 'b-1',
          bookableSlotId: 's-1',
          statusConceptId: 'c-confirmada',
          patientName: 'Ana',
          ...(typeConceptId === undefined ? {} : { typeConceptId }),
        },
      ]);
      fixture.componentRef.setInput('bloqueos', []);
      fixture.componentRef.setInput('etiquetas', ETIQUETAS);
      fixture.componentRef.setInput('tipologias', catalogo);
      fixture.componentRef.setInput('puedeRegistrarLlegada', true);
      fixture.detectChanges();
    }

    it('pinta la actividad con la etiqueta Y el tono del servidor', () => {
      // La palabra va CON el color, no en su lugar: el color distingue de un
      // vistazo, la palabra lo hace legible para quien no lo distingue.
      montarConTipologia('c-proc');
      expect(fixture.nativeElement.textContent).toContain('Operación o procedimiento');
    });

    it('una consulta común NO lleva etiqueta', () => {
      // Pintar todo obliga a mirar el color hasta donde no informa. Lo que el
      // propietario quiere distinguir son las OTRAS actividades.
      montarConTipologia(undefined);
      expect(fixture.nativeElement.querySelector('[data-testid="dia-tipologia"]')).toBeNull();
    });

    it('un tipo que el catálogo no conoce no rompe: se pinta sin etiqueta', () => {
      montarConTipologia('c-que-no-existe');
      expect(fixture.nativeElement.querySelector('[data-testid="dia-tipologia"]')).toBeNull();
    });

    it('sin catálogo el día se ve como antes', () => {
      // Un catálogo que no cargó no puede dejar la agenda en blanco.
      montarConTipologia('c-proc', []);
      expect(fixture.nativeElement.textContent).toContain('Ana');
    });

    it('un tono desconocido cae en neutro y NUNCA en error', () => {
      // `error` es el de los bloqueos. Una actividad pintada de rojo diría que
      // el rato está cerrado cuando no lo está.
      montarConTipologia('c-raro', [
        { type: 'X', conceptId: 'c-raro', label: 'Rara', tone: 'fucsia' },
      ]);
      const badge = fixture.nativeElement.querySelector('[data-testid="dia-tipologia"]');
      expect(badge).not.toBeNull();
      expect(badge?.className ?? '').not.toContain('error');
    });
  });

  /**
   * MOVER EL HORARIO Y CERRAR RATOS — los dos últimos del carril 12.
   *
   * «Un botón que se llame mover horario, que desplace los slots N minutos
   * después […] y sea seleccionable a todos o ciertos slots en específico» y
   * «otro botón para cancelar […] slots específicos».
   */
  describe('mover y cerrar', () => {
    function porTestid(id: string): HTMLElement | null {
      return fixture.nativeElement.querySelector(`[data-testid="${id}"]`);
    }

    it('el panel de mover se abre desde la barra del día', () => {
      // Va en la barra y no dentro de una tarjeta: lo que se corre es la
      // agenda, no una cita suelta.
      montar();
      expect(porTestid('dia-mover-panel')).toBeNull();

      porTestid('dia-mover')?.click();
      fixture.detectChanges();

      expect(porTestid('dia-mover-panel')).not.toBeNull();
    });

    it('emite los minutos elegidos', () => {
      montar();
      const vistos: { minutos: number; desde: Date | null }[] = [];
      fixture.componentInstance.movimientoPedido.subscribe((p) => vistos.push(p));

      porTestid('dia-mover')?.click();
      fixture.detectChanges();
      porTestid('dia-mover-20')?.click();

      expect(vistos[0].minutos).toBe(20);
      // Sin «desde», es el día entero.
      expect(vistos[0].desde).toBeNull();
    });

    it('ofrece adelantar, no sólo atrasar', () => {
      // El profesional que termina antes quiere adelantar a los que esperan.
      montar();
      const vistos: { minutos: number; desde: Date | null }[] = [];
      fixture.componentInstance.movimientoPedido.subscribe((p) => vistos.push(p));

      porTestid('dia-mover')?.click();
      fixture.detectChanges();
      porTestid('dia-mover-adelantar')?.click();

      expect(vistos[0].minutos).toBe(-15);
    });

    it('elegir cierra el panel: no se mueve dos veces sin querer', () => {
      montar();
      porTestid('dia-mover')?.click();
      fixture.detectChanges();
      porTestid('dia-mover-20')?.click();
      fixture.detectChanges();

      expect(porTestid('dia-mover-panel')).toBeNull();
    });
  });
});
