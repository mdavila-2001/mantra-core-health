import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MonthView, type BloqueoDelMes } from './month-view';

const MES = new Date(2026, 7, 1); // agosto de 2026

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
 * 1. **La celda dice ocupación, no citas.** «6/8», nunca quién viene: los
 *    nombres son la vista del día, y un mes con nombres es ilegible.
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

  it('muestra la ocupación como «reservados/total»', () => {
    // Dos cupos de capacidad 4 y 4, con 1 y 3 libres: 8 publicados, 4 tomados.
    montar([cupo(11, 4, 1), cupo(11, 4, 3)]);

    expect(celda(11)?.textContent).toContain('4/8');
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

  it('un día con cupos y nadie anotado es libre, con su cuenta en cero', () => {
    montar([cupo(11, 4, 4)]);

    expect(celda(11)?.textContent).toContain('0/4');
    expect(celda(11)?.getAttribute('aria-label')).toContain('ninguno reservado');
  });

  it('un día sin capacidad restante es «completo»', () => {
    montar([cupo(11, 4, 0)]);

    expect(celda(11)?.textContent).toContain('4/4');
    expect(celda(11)?.getAttribute('aria-label')).toContain('completo');
  });

  it('cada celda se entiende con lector de pantalla, sin mirar el color', () => {
    montar([cupo(11, 8, 2)]);

    const etiqueta = celda(11)?.getAttribute('aria-label') ?? '';
    // `es-BO` formatea con coma: «martes, 11 de agosto».
    expect(etiqueta).toContain('11 de agosto');
    expect(etiqueta).toContain('6 de 8 turnos reservados');
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
    expect(celda(11)?.getAttribute('aria-label')).not.toContain('ninguno reservado');
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

  it('tocar un día lo emite, para que el contenedor decida qué hacer', () => {
    const elegidos: Date[] = [];
    montar([cupo(11, 4, 4)]);
    fixture.componentInstance.diaElegido.subscribe((d: Date) => elegidos.push(d));

    celda(11)?.click();

    expect(elegidos).toHaveLength(1);
    expect(elegidos[0].getDate()).toBe(11);
  });
});
