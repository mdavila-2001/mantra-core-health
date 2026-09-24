import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthView, placePopover, type BloqueoDelMes } from './month-view';

const MES = new Date(2026, 7, 1); // agosto de 2026

/**
 * Un mes que no pasa nunca: la celda sólo cuenta turnos de días que vienen, y
 * agosto de 2026 ya quedó atrás.
 */
const MES_FUTURO = new Date(2030, 0, 1);

/** Un cupo de `MES_FUTURO`. */
function cupoFuturo(dia: number, capacity: number, remaining: number) {
  return {
    ...cupo(dia, capacity, remaining),
    startAt: new Date(2030, 0, dia, 9, 0),
    endAt: new Date(2030, 0, dia, 9, 30),
  };
}

/** Un cupo mínimo: sólo importan la fecha y las dos capacidades. */
function cupo(dia: number, capacity: number, remaining: number) {
  return {
    id: `s-${dia}-${remaining}`,
    resourceId: 'res-1',
    scheduleTemplateId: null,
    startAt: new Date(2026, 7, dia, 9, 0),
    endAt: new Date(2026, 7, dia, 9, 30),
    capacity,
    remainingCapacity: remaining,
    statusConceptId: 'c',
    serviceConceptId: null,
  };
}

/**
 * El mes de ocupación — MAC-5.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **La celda dice lo disponible, no citas ni reservas.** «2», nunca quién
 *    viene ni cuántos reservaron (cliente, 24/09): los nombres son la vista
 *    del día, y un mes con nombres es ilegible.
 * 2. **El color nunca solo.** Cada celda lleva su número visible y una etiqueta
 *    accesible completa; un mes que sólo se entienda por el tono no lo entiende
 *    nadie con baja visión.
 * 3. **Bloqueado ≠ sin agenda.** Los dos aparecen sin cupos disponibles, pero
 *    uno lleva su motivo y el otro dice «no atendés». Es toda la diferencia.
 */
describe('MonthView', () => {
  let fixture: ComponentFixture<MonthView>;

  function montar(
    cupos: unknown[] = [],
    bloqueos: readonly BloqueoDelMes[] = [],
    mes: Date = MES,
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(MonthView);
    fixture.componentRef.setInput('mes', mes);
    fixture.componentRef.setInput('cupos', cupos);
    fixture.componentRef.setInput('bloqueos', bloqueos);
    fixture.detectChanges();
  }

  /** La celda de un día del mes, por su número. */
  function celda(dia: number): HTMLElement | null {
    const botones: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.mes__dia'));
    return (
      botones.find((b) => b.querySelector('.mes__numero')?.textContent?.trim() === String(dia)) ??
      null
    );
  }

  it('dibuja seis semanas de siete días, siempre', () => {
    montar();
    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('tbody td')).toHaveLength(42);
  });

  it('muestra sólo los turnos disponibles, no los reservados', () => {
    // Dos cupos de capacidad 4 y 4, con 1 y 3 libres: 8 publicados, 4 tomados.
    montar([cupoFuturo(11, 4, 1), cupoFuturo(11, 4, 3)], [], MES_FUTURO);

    expect(celda(11)?.querySelector('.mes__cuenta')?.textContent?.trim()).toBe('4');
    expect(celda(11)?.textContent).not.toContain('/');
  });

  it('un día que ya pasó no cuenta turnos: ya no se ofrecen', () => {
    montar([cupo(11, 4, 3)]);

    expect(celda(11)?.querySelector('.mes__cuenta')).toBeNull();
    expect(celda(11)?.getAttribute('aria-label')).toContain('día pasado');
  });

  it('no muestra nombres ni citas: es ocupación, no la agenda del día', () => {
    montar([cupo(11, 4, 1)]);
    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('s-11');
  });

  it('un día sin cupos dice «no atendés», no «libre»', () => {
    // No es que nadie reservó: es que ese día no atiende. Son cosas distintas.
    montar([cupo(11, 4, 4)]);

    expect(celda(12)?.getAttribute('aria-label')).toContain('no atendés');
  });

  it('un día con cupos y nadie anotado muestra todos como disponibles', () => {
    montar([cupoFuturo(11, 4, 4)], [], MES_FUTURO);

    expect(celda(11)?.querySelector('.mes__cuenta')?.textContent?.trim()).toBe('4');
    expect(celda(11)?.getAttribute('aria-label')).toContain('4 turnos disponibles');
  });

  it('un día sin capacidad restante muestra cero disponibles', () => {
    montar([cupoFuturo(11, 4, 0)], [], MES_FUTURO);

    expect(celda(11)?.querySelector('.mes__cuenta')?.textContent?.trim()).toBe('0');
    expect(celda(11)?.getAttribute('aria-label')).toContain('sin turnos disponibles');
  });

  it('cada celda se entiende con lector de pantalla, sin mirar el color', () => {
    montar([cupoFuturo(11, 8, 2)], [], MES_FUTURO);

    const etiqueta = celda(11)?.getAttribute('aria-label') ?? '';
    // `es-BO` formatea con coma: «viernes, 11 de enero».
    expect(etiqueta).toContain('11 de enero');
    expect(etiqueta).toContain('2 turnos disponibles');
    expect(etiqueta).not.toContain('reservad');
  });

  it('un día bloqueado muestra su motivo y NO se ve como libre', () => {
    montar(
      [cupo(11, 4, 4)],
      [
        {
          desde: new Date(2026, 7, 11, 0, 0),
          hasta: new Date(2026, 7, 12, 0, 0),
          motivo: 'Congreso',
        },
      ],
    );

    expect(celda(11)?.textContent).toContain('Congreso');
    expect(celda(11)?.getAttribute('aria-label')).toContain('bloqueado — Congreso');
    // Y sobre todo: no dice que esté libre.
    expect(celda(11)?.getAttribute('aria-label')).not.toContain('disponible');
  });

  it('el bloqueo gana sobre la ocupación: es lo que hay que ver', () => {
    montar(
      [cupo(11, 4, 1)],
      [{ desde: new Date(2026, 7, 11), hasta: new Date(2026, 7, 12), motivo: null }],
    );

    expect(celda(11)?.getAttribute('aria-label')).toContain('bloqueado');
  });

  it('un bloqueo que viene del mes anterior también tapa sus días', () => {
    // Cruza por solape: un bloqueo del 30 de julio al 2 de agosto afecta al 1.
    montar(
      [cupo(1, 4, 4)],
      [{ desde: new Date(2026, 6, 30), hasta: new Date(2026, 7, 2), motivo: 'Vacaciones' }],
    );

    expect(celda(1)?.getAttribute('aria-label')).toContain('bloqueado');
  });

  it('los días del mes vecino se dibujan pero no son botones', () => {
    // Agosto de 2026 empieza sábado: la grilla arranca el 27 de julio.
    montar();
    const fuera = fixture.nativeElement.querySelectorAll('.mes__numero--fuera');
    expect(fuera.length).toBeGreaterThan(0);
  });

  it('navegar cambia de mes sin desbordar como setMonth', () => {
    const vistos: Date[] = [];
    montar([], [], new Date(2026, 0, 1));
    fixture.componentInstance.mesElegido.subscribe((m: Date) => vistos.push(m));

    const [anterior, siguiente] = fixture.nativeElement.querySelectorAll(
      '.mes__barra button',
    ) as NodeListOf<HTMLButtonElement>;
    siguiente.click();
    anterior.click();

    expect(vistos[0].getMonth()).toBe(1);
    expect(vistos[1].getFullYear()).toBe(2025);
    expect(vistos[1].getMonth()).toBe(11);
  });

  /* -- El globo del día (pedido del cliente, 18/09) ------------------------ */

  /** Abre el globo de un día con el foco, como lo haría el teclado. */
  async function globoDe(dia: number): Promise<string> {
    celda(dia)?.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('[data-testid="mes-globo"]')?.textContent ?? '';
  }

  /** Las filas del globo abierto, como texto. */
  function filasDelGlobo(): string[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="mes-globo-lista"] li') as NodeListOf<HTMLElement>,
    ).map((li) =>
      Array.from(
        li.querySelectorAll(
          // El estado dejó de ser una línea secundaria y pasó a ser un chip
          // (C-08, 2026-09-20): se lee de ahí, no de `.mes__globo-secundario`.
          '.mes__globo-hora, .mes__globo-primario, .mes__globo-secundario, [data-testid="mes-globo-chip"]',
        ),
      )
        .map((parte) => parte.textContent?.trim() ?? '')
        .join(' '),
    );
  }

  afterEach(() => fixture?.destroy());

  it('el día no es un botón: el mes se mira, no se toca', () => {
    montar([cupo(11, 4, 4)]);

    expect(fixture.nativeElement.querySelector('.mes__grilla button')).toBeNull();
    // Se sigue alcanzando con Tab, para que el globo no sea sólo del mouse.
    expect(celda(11)?.getAttribute('tabindex')).toBe('0');
  });

  it('el globo dice a qué horas atiende, con los turnos pegados en una sola franja', async () => {
    montar([
      { ...cupo(11, 1, 1), startAt: new Date(2026, 7, 11, 8, 0), endAt: new Date(2026, 7, 11, 8, 30) },
      { ...cupo(11, 1, 0), id: 'b', startAt: new Date(2026, 7, 11, 8, 30), endAt: new Date(2026, 7, 11, 9, 0) },
      { ...cupo(11, 1, 1), id: 'c', startAt: new Date(2026, 7, 11, 14, 0), endAt: new Date(2026, 7, 11, 15, 0) },
    ]);

    const texto = await globoDe(11);
    expect(texto).toContain('11 de agosto');
    expect(texto).toContain('Atendés 08:00–09:00 y 14:00–15:00');
    expect(texto).not.toContain('Bloqueado');
  });

  it('un día sin cupos dice en el globo que no atiende', async () => {
    montar();

    expect(await globoDe(12)).toContain('No atendés');
  });

  it('el globo dice qué parte del día está bloqueada, y por qué', async () => {
    montar(
      [{ ...cupo(11, 4, 4), startAt: new Date(2026, 7, 11, 8, 0), endAt: new Date(2026, 7, 11, 12, 0) }],
      [{ desde: new Date(2026, 7, 11, 10, 0), hasta: new Date(2026, 7, 11, 11, 0), motivo: 'Trámite' }],
    );

    const texto = await globoDe(11);
    expect(texto).toContain('Atendés 08:00–12:00');
    expect(texto).toContain('Bloqueado 10:00–11:00 (Trámite)');
  });

  it('un bloqueo de varios días se dice «todo el día» en cada uno', async () => {
    montar(
      [],
      [{ desde: new Date(2026, 6, 30), hasta: new Date(2026, 7, 3), motivo: 'Vacaciones' }],
    );

    expect(await globoDe(1)).toContain('Bloqueado todo el día (Vacaciones)');
  });

  /* -- El detalle del globo (pedido del cliente, 18/09, segunda vuelta) ----- */

  /** Un mes por venir: los turnos pasados no se ofrecen. */
  const FUTURO = new Date(2030, 0, 1);

  function turno(dia: number, h: number, capacity: number, remaining: number, id: string) {
    return {
      ...cupo(dia, capacity, remaining),
      id,
      startAt: new Date(2030, 0, dia, h, 0),
      endAt: new Date(2030, 0, dia, h, 30),
    };
  }

  it('en horarios, el globo lista los turnos disponibles publicados, no los tomados', async () => {
    montar(
      [
        turno(15, 10, 1, 0, 'tomado'),
        turno(15, 8, 1, 1, 'libre-8'),
        turno(15, 9, 2, 1, 'libre-9'),
      ],
      [],
      FUTURO,
    );

    const texto = await globoDe(15);
    expect(texto).toContain('2 turnos disponibles');
    expect(filasDelGlobo()).toEqual(['08:00–08:30 Libre', '09:00–09:30 1 de 2 lugares libres']);
  });

  it('el globo de un día pasado dice que el día ya fue, sin contar reservas', async () => {
    // Agosto de 2026 ya pasó: antes el globo decía «Sin turnos disponibles»
    // (propietario, 18/09). Lo reservado ya no se muestra (cliente, 24/09).
    montar([cupo(11, 2, 1)]);

    const texto = await globoDe(11);
    expect(texto).not.toContain('reservado');
    expect(texto).toContain('Día pasado: ya no se ofrecen turnos.');
    expect(texto).not.toContain('Sin turnos disponibles');
  });

  /** Una caja de día, como la da `getBoundingClientRect`. */
  function caja(left: number, top: number, width: number, height: number): DOMRect {
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top } as DOMRect;
  }

  it('el globo va al costado del día, no encima de la semana siguiente', () => {
    const dia = caja(500, 100, 140, 60);
    const lugar = placePopover(dia, { innerWidth: 1280, innerHeight: 800 });
    expect(lugar.left).toBe(644);
    expect(lugar.top).toBe(100);

    // Sin lugar a la derecha, a la izquierda.
    const alBorde = placePopover(caja(1100, 100, 140, 60), { innerWidth: 1280, innerHeight: 800 });
    expect(alBorde.left).toBe(1100 - 4 - 320);

    // En un teléfono no entra a ningún costado: debajo.
    const telefono = placePopover(caja(150, 100, 50, 50), { innerWidth: 390, innerHeight: 800 });
    expect(telefono.top).toBe(154);
  });

  it('en horarios, un turno dentro de un bloqueo no se ofrece', async () => {
    montar(
      [turno(15, 8, 1, 1, 'a'), turno(15, 9, 1, 1, 'b')],
      [{ desde: new Date(2030, 0, 15, 9, 0), hasta: new Date(2030, 0, 15, 10, 0), motivo: null }],
      FUTURO,
    );

    await globoDe(15);
    expect(filasDelGlobo()).toEqual(['08:00–08:30 Libre']);
  });

  it('en la agenda, el globo lista TODAS las citas del día, en hora, con paciente y estado', async () => {
    TestBed.resetTestingModule();
    fixture = TestBed.createComponent(MonthView);
    const r = fixture.componentRef;
    r.setInput('mes', FUTURO);
    r.setInput('cupos', [turno(15, 8, 1, 0, 'x')]);
    r.setInput('bloqueos', []);
    r.setInput('selectable', true);
    r.setInput('dayDetail', 'bookings');
    r.setInput('etiquetas', new Map([['st-conf', { code: 'BOOKING_CONFIRMED', display: 'Confirmada' }]]));
    r.setInput(
      'citas',
      Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        statusConceptId: 'st-conf',
        startAt: new Date(2030, 0, 15, 19 - i, 0),
        endAt: new Date(2030, 0, 15, 19 - i, 30),
        patientName: i === 11 ? undefined : `Paciente ${i}`,
      })).concat([
        // Otro día: no entra.
        { id: 'otro', statusConceptId: 'st-conf', startAt: new Date(2030, 0, 16, 9, 0), endAt: new Date(2030, 0, 16, 9, 30), patientName: 'Ajena' },
      ]),
    );
    fixture.detectChanges();

    const texto = await globoDe(15);
    expect(texto).toContain('12 citas');
    const filas = filasDelGlobo();
    expect(filas).toHaveLength(12);
    expect(filas[0]).toBe('08:00–08:30 Paciente sin nombre registrado Confirmada');
    expect(filas[11]).toBe('19:00–19:30 Paciente 0 Confirmada');
    expect(texto).not.toContain('Ajena');
  });

  /**
   * C-08 (2026-09-20) — el chip de estado del globo del mes.
   *
   * Antes el estado salía del `display` del catálogo, **que viene en inglés**:
   * el globo anunciaba «Booking in progress» sobre una cita en curso. El mapa
   * de `booking-status.ts` ya resolvía las tres formas que la identidad exige
   * —color, silueta y palabra en castellano— y era el único lugar de la agenda
   * que no lo usaba.
   */
  it('el chip dice el estado en castellano, y no el display inglés del catálogo', async () => {
    TestBed.resetTestingModule();
    fixture = TestBed.createComponent(MonthView);
    const r = fixture.componentRef;
    r.setInput('mes', FUTURO);
    r.setInput('cupos', [turno(15, 8, 1, 0, 'x')]);
    r.setInput('bloqueos', []);
    r.setInput('selectable', true);
    r.setInput('dayDetail', 'bookings');
    r.setInput(
      'etiquetas',
      new Map([
        // Tal como llega del catálogo: en inglés.
        ['st-curso', { code: 'scheduling:BOOKING_IN_PROGRESS', display: 'Booking in progress' }],
        ['st-noshow', { code: 'BOOKING_NO_SHOW', display: 'Booking no-show' }],
        ['st-hecha', { code: 'BOOKING_COMPLETED', display: 'Booking completed' }],
      ]),
    );
    r.setInput('citas', [
      { id: 'b1', statusConceptId: 'st-curso', startAt: new Date(2030, 0, 15, 9, 0), endAt: new Date(2030, 0, 15, 9, 30), patientName: 'Ana' },
      { id: 'b2', statusConceptId: 'st-noshow', startAt: new Date(2030, 0, 15, 10, 0), endAt: new Date(2030, 0, 15, 10, 30), patientName: 'Beto' },
      { id: 'b3', statusConceptId: 'st-hecha', startAt: new Date(2030, 0, 15, 11, 0), endAt: new Date(2030, 0, 15, 11, 30), patientName: 'Cora' },
    ]);
    fixture.detectChanges();

    const texto = await globoDe(15);
    expect(texto).toContain('En curso');
    expect(texto).toContain('No asistió');
    expect(texto).toContain('Atendida');
    // Y NADA del catálogo en inglés.
    expect(texto).not.toContain('Booking');

    // El estado va con color Y con palabra: tres chips, tres etiquetas legibles.
    const chips = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="mes-globo-chip"]') as NodeListOf<HTMLElement>,
    ).map((c) => c.textContent?.trim());
    expect(chips).toEqual(['En curso', 'No asistió', 'Atendida']);
  });

  it('un cupo libre no lleva chip: no tiene estado de cita que mostrar', async () => {
    montar([turno(15, 8, 2, 0, 'x')], [], FUTURO);
    await globoDe(15);

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="mes-globo-chip"]'),
    ).toHaveLength(0);
  });

  it('en la agenda, si las citas no llegaron el globo lo dice en vez de «sin citas»', async () => {
    montar([], [], FUTURO);
    fixture.componentRef.setInput('dayDetail', 'bookings');
    fixture.componentRef.setInput('bookingsFailed', true);
    fixture.detectChanges();

    expect(await globoDe(15)).toContain('No se pudieron traer las citas');
  });

  it('Escape cierra el globo', async () => {
    montar([], [], FUTURO);
    await globoDe(15);
    celda(15)?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="mes-globo"]')).toBeNull();
  });

  it('el globo describe al día mientras está abierto', async () => {
    montar([], [], FUTURO);
    await globoDe(15);
    const globo = fixture.nativeElement.querySelector('[data-testid="mes-globo"]') as HTMLElement;

    expect(celda(15)?.getAttribute('aria-describedby')).toBe(globo.id);
  });
});
