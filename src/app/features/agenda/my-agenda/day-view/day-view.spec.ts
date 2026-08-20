import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DayView, type PedidoDeAccion } from './day-view';
import type { BloqueoDelMes } from '../month-view/month-view';

const DIA = new Date(2026, 7, 25);

function cupo(hora: number, minuto = 0, id = `s-${hora}-${minuto}`) {
  return {
    id,
    resourceId: 'res-1',
    scheduleTemplateId: null,
    startAt: new Date(2026, 7, 25, hora, minuto),
    endAt: new Date(2026, 7, 25, hora, minuto + 30),
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
 * El día del profesional — MAC-6.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Es una línea de tiempo, no una lista de reservas.** El hueco de las
 *    12:00 tiene que VERSE, no deducirse restando: es lo que hace falta cuando
 *    alguien llama urgido.
 * 2. **El nombre y el motivo se muestran acá.** TJ-2 los sacó de la vista de la
 *    organización, no de la del profesional que atiende.
 * 3. **Un bloqueo se ve bloqueado**, jamás como libre.
 * 4. **No se ofrece una acción que va a fallar**: la allowlist de estados.
 */
describe('DayView', () => {
  let fixture: ComponentFixture<DayView>;

  /**
   * Las etiquetas del catálogo, ya resueltas.
   *
   * `statusConceptId` es un uuid: el componente NO lo traduce por su cuenta
   * —sería inventar el catálogo—, lo recibe resuelto del contenedor. Acá se
   * usan claves legibles para que la prueba se entienda.
   */
  const ETIQUETAS = new Map([
    ['confirmado', { code: 'BOOKING_CONFIRMED', display: 'Confirmado' }],
    ['llego', { code: 'scheduling:BOOKING_CHECKED_IN', display: 'Llegó' }],
    ['cancelado', { code: 'BOOKING_CANCELLED', display: 'Cancelado' }],
  ]);

  function montar(
    cupos: unknown[] = [],
    citas: unknown[] = [],
    bloqueos: readonly BloqueoDelMes[] = [],
  ): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(DayView);
    fixture.componentRef.setInput('dia', DIA);
    fixture.componentRef.setInput('cupos', cupos);
    fixture.componentRef.setInput('citas', citas);
    fixture.componentRef.setInput('bloqueos', bloqueos);
    fixture.componentRef.setInput('etiquetas', ETIQUETAS);
    fixture.componentRef.setInput('puedeRegistrarLlegada', true);
    fixture.detectChanges();
  }

  function filas(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('.dia__fila'));
  }

  it('el hueco SE VE entre las citas: no es una lista de reservas', () => {
    // El criterio del §9: sin la fila del hueco, saber cuándo hay lugar obliga
    // a restar horarios en la cabeza.
    montar([cupo(9), cupo(12), cupo(14)], [cita('s-9-0'), cita('s-14-0')]);

    const tipos = filas().map((f) => f.getAttribute('data-tipo'));
    expect(tipos).toEqual(['cita', 'libre', 'cita']);
    expect(filas()[1].textContent).toContain('libre');
  });

  it('las filas van en orden de reloj, aunque los cupos no vengan ordenados', () => {
    montar([cupo(14), cupo(9), cupo(12)]);

    const horas = filas().map((f) => f.querySelector('.dia__hora')?.textContent?.trim());
    expect(horas?.[0]).toContain('09:00');
    expect(horas?.[2]).toContain('14:00');
  });

  it('muestra el nombre del paciente: es el pedido del registro del cliente', () => {
    montar([cupo(9)], [cita('s-9-0')]);

    expect(fixture.nativeElement.textContent).toContain('Ana Quispe');
  });

  it('muestra el motivo de consulta, que acá SÍ corresponde', () => {
    // TJ-2 lo sacó de la vista de la organización, no de la del profesional que
    // va a recibir a esa persona en diez minutos.
    montar([cupo(9)], [cita('s-9-0', { reasonText: 'Control de presión' })]);

    expect(fixture.nativeElement.textContent).toContain('Control de presión');
  });

  it('sin nombre no inventa relleno ni muestra el identificador', () => {
    // Que falte es una condición del servidor —no le corresponde verlo—, no un
    // error de la pantalla.
    montar([cupo(9)], [cita('s-9-0', { patientName: undefined })]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Paciente sin nombre registrado');
    expect(texto).not.toContain('pac-1');
  });

  it('un día bloqueado se ve bloqueado con su motivo, jamás como libre', () => {
    montar(
      [cupo(14), cupo(15)],
      [],
      [
        {
          desde: new Date(2026, 7, 25, 14, 0),
          hasta: new Date(2026, 7, 25, 18, 0),
          motivo: 'trámite personal',
        },
      ],
    );

    const tipos = filas().map((f) => f.getAttribute('data-tipo'));
    expect(tipos).toEqual(['bloqueado', 'bloqueado']);
    expect(fixture.nativeElement.textContent).toContain('trámite personal');
    expect(fixture.nativeElement.textContent).not.toContain('libre');
  });

  it('una cita dentro de un bloqueo sigue mostrándose: no se la traga el bloqueo', () => {
    // El bloqueo cierra los cupos LIBRES; las citas ya reservadas no se tocan,
    // y ocultarlas haría que el médico no supiera que alguien va a venir igual.
    montar(
      [cupo(14)],
      [cita('s-14-0')],
      [{ desde: new Date(2026, 7, 25, 14, 0), hasta: new Date(2026, 7, 25, 18, 0), motivo: 'x' }],
    );

    expect(filas()[0].getAttribute('data-tipo')).toBe('cita');
    expect(fixture.nativeElement.textContent).toContain('Ana Quispe');
  });

  it('traduce el estado a palabras, nunca el código crudo', () => {
    montar([cupo(9)], [cita('s-9-0', { statusConceptId: 'llego' })]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Llegó');
    expect(texto).not.toContain('BOOKING_CHECKED_IN');
    expect(texto).not.toContain('llego');
  });

  it('a quien ya llegó no le ofrece «Llegó» otra vez', () => {
    montar([cupo(9)], [cita('s-9-0', { statusConceptId: 'llego' })]);

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(botones.some((b) => b.textContent?.includes('Llegó'))).toBe(false);
    // Pero sí puede avisar demora o cancelar.
    expect(botones.some((b) => b.textContent?.includes('Avisar demora'))).toBe(true);
  });

  it('sobre una cita cancelada no ofrece ninguna acción', () => {
    // Allowlist a propósito: un estado desconocido o final no ofrece un botón
    // que casi seguro va a fallar.
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
    // `POST /bookings/:id/check-in` declara @Roles('SCHEDULING_ADMIN',
    // 'SCHEDULING_AGENT') — no PRACTITIONER. Verificado contra la API viva: el
    // botón devolvía «Rol insuficiente». No se ofrece lo que se sabe que falla.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(DayView);
    fixture.componentRef.setInput('dia', DIA);
    fixture.componentRef.setInput('cupos', [cupo(9)]);
    fixture.componentRef.setInput('citas', [cita('s-9-0')]);
    fixture.componentRef.setInput('bloqueos', []);
    fixture.componentRef.setInput('etiquetas', ETIQUETAS);
    fixture.componentRef.setInput('puedeRegistrarLlegada', false);
    fixture.detectChanges();

    const botones = Array.from(
      fixture.nativeElement.querySelectorAll('.dia__acciones button'),
    ) as HTMLButtonElement[];
    expect(botones.some((b) => b.textContent?.includes('Llegó'))).toBe(false);
    expect(botones.some((b) => b.textContent?.includes('Avisar demora'))).toBe(true);
    expect(botones.some((b) => b.textContent?.includes('Cancelar'))).toBe(true);
  });

  it('resume cuántos turnos tiene tomados', () => {
    montar([cupo(9), cupo(12), cupo(14)], [cita('s-9-0')]);

    expect(fixture.nativeElement.textContent).toContain('1 de 3 turnos reservados');
  });

  it('un día sin cupos lo dice con palabras', () => {
    montar([]);

    expect(fixture.nativeElement.textContent).toContain('No atendés este día');
  });
});
