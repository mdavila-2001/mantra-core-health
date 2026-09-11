import { RECURSO_MEDICA, reservas } from './fixtures/agenda';
import { ESTADO_RESERVA } from './fixtures/conceptos';
import { PACIENTE } from './fixtures/personas';
import {
  avisoDeHorarioLiberado,
  esperaUnHueco,
  horariosLiberados,
  MINUTOS_DE_GRACIA,
} from './horario-liberado';

/**
 * La regla del punto 3.4 del registro de procesos, aislada del reloj real.
 *
 * Todo lo que decide acá es tiempo, así que el tiempo se controla: con el reloj
 * de verdad, «pasaron diez minutos» sería una prueba que pasa o falla según la
 * hora a la que alguien la corra.
 */
describe('horariosLiberados', () => {
  const AHORA = new Date('2026-09-09T15:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Una reserva de la médica, a `minutos` de ahora, en el estado que se pida. */
  function sembrar(minutos: number, estado: keyof typeof ESTADO_RESERVA, id = 'prueba'): string {
    const inicio = new Date(AHORA.getTime() + minutos * 60_000).toISOString();
    const fila = reservas.todos()[0]!;
    const nueva = {
      ...fila,
      id: `booking-${id}`,
      bookableSlotId: `slot-${id}`,
      resourceId: RECURSO_MEDICA,
      patientProfileId: 'otro-paciente',
      statusConceptId: ESTADO_RESERVA[estado]!,
      startAt: inicio,
      endAt: new Date(AHORA.getTime() + (minutos + 30) * 60_000).toISOString(),
    };
    reservas.agregar(nueva);
    return nueva.bookableSlotId;
  }

  function liberados(): readonly string[] {
    return horariosLiberados().map((h) => h.bookableSlotId);
  }

  it('un cupo confirmado que pasó los diez minutos queda libre', () => {
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 1), 'BK-CONFIRMED', 'vencido');

    expect(liberados()).toContain(cupo);
  });

  it('a los nueve minutos todavía no: la gracia es la gracia', () => {
    // Es el caso que hace que el aviso **llegue** durante el recorrido en vez
    // de estar desde el primer render.
    const cupo = sembrar(-(MINUTOS_DE_GRACIA - 1), 'BK-CONFIRMED', 'a-punto');

    expect(liberados()).not.toContain(cupo);

    vi.setSystemTime(new Date(AHORA.getTime() + 2 * 60_000));
    expect(liberados()).toContain(cupo);
  });

  it('un cupo que ya terminó deja de ofrecerse: no se puede tomar', () => {
    // Visto en la maqueta el 09/09: a media tarde se apilaban tres avisos de
    // las 09:30, 10:00 y 10:30, todos de horas pasadas enteras. Un aviso que
    // ofrece algo que no se puede tomar enseña que los avisos no valen la pena.
    const cupo = sembrar(-90, 'BK-CONFIRMED', 'terminado-hace-rato');

    expect(liberados()).not.toContain(cupo);
  });

  it('mientras el cupo corre, sí se ofrece', () => {
    // El caso del medio: pasaron los diez de gracia y todavía queda hueco.
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 2), 'BK-CONFIRMED', 'en-ventana');

    expect(liberados()).toContain(cupo);
  });

  it('una consulta ya iniciada no libera nada, por vieja que sea', () => {
    // El cupo se está usando: que la hora haya pasado no lo devuelve.
    const cupo = sembrar(-120, 'BK-IN-PROGRESS', 'en-curso');

    expect(liberados()).not.toContain(cupo);
  });

  it('una consulta terminada tampoco', () => {
    const cupo = sembrar(-120, 'BK-COMPLETED', 'terminada');

    expect(liberados()).not.toContain(cupo);
  });

  it('quien anunció su llegada y no fue atendido sí lo libera', () => {
    // `BK-CHECKED-IN` cuenta: llegó, avisó, y diez minutos después nadie
    // inició. El cupo no se está usando igual.
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 5), 'BK-CHECKED-IN', 'anunciado');

    expect(liberados()).toContain(cupo);
  });

  it('la cita de la propia paciente nunca se le ofrece a ella', () => {
    // Nadie se avisa a sí mismo de que su cupo quedó libre.
    const inicio = new Date(AHORA.getTime() - 60 * 60_000).toISOString();
    const fila = reservas.todos()[0]!;
    reservas.agregar({
      ...fila,
      id: 'booking-propia',
      bookableSlotId: 'slot-propia',
      resourceId: RECURSO_MEDICA,
      patientProfileId: PACIENTE.id,
      statusConceptId: ESTADO_RESERVA['BK-CONFIRMED']!,
      startAt: inicio,
      endAt: inicio,
    });

    expect(liberados()).not.toContain('slot-propia');
  });

  it('el aviso nombra el día, la hora y a quién atiende', () => {
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 1), 'BK-CONFIRMED', 'texto');
    const hueco = horariosLiberados().find((h) => h.bookableSlotId === cupo)!;

    const aviso = avisoDeHorarioLiberado(hueco);

    expect(aviso.subject).toBe('Se liberó un horario');
    expect(aviso.bodyText).toContain('Rojas');
    expect(aviso.category).toBe('SCHEDULING');
    // El destino es el cupo: es lo que hay que poder abrir desde la campana.
    expect(aviso.destination).toEqual({ type: 'APPOINTMENT', id: cupo });
  });

  it('el aviso se distingue por su `kind`, no por su texto', () => {
    // Es lo que mira el anunciador. Si dependiera del asunto, reescribir una
    // frase apagaría el toast sin que nada avisara.
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 1), 'BK-CONFIRMED', 'kind');
    const hueco = horariosLiberados().find((h) => h.bookableSlotId === cupo)!;

    expect(avisoDeHorarioLiberado(hueco).payloadJson.kind).toBe('SLOT_RELEASED');
  });

  it('el mismo cupo da siempre el mismo aviso: no se duplica al releer', () => {
    const cupo = sembrar(-(MINUTOS_DE_GRACIA + 1), 'BK-CONFIRMED', 'estable');
    const hueco = horariosLiberados().find((h) => h.bookableSlotId === cupo)!;

    expect(avisoDeHorarioLiberado(hueco).id).toBe(avisoDeHorarioLiberado(hueco).id);
  });

  it('sólo le interesa a quien tiene una cita futura con la misma médica', () => {
    // La condición del registro: «confirmas para otra fecha». A quien no la
    // espera, un hueco suyo no le dice nada.
    expect(esperaUnHueco(PACIENTE.id)).toBe(true);
    expect(esperaUnHueco('alguien-sin-citas')).toBe(false);
  });
});
