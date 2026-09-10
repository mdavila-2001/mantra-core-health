import type { Booking } from '@core/data-access/scheduling/scheduling.types';

import { aAtenciones, ETIQUETA_DE_ESTADO, mismoDia } from './progress-notes';

/**
 * «Evoluciones» — la sexta de las ocho opciones del panel del médico.
 *
 * Lo que se fija acá es el criterio de qué entra y en qué quedó cada atención:
 * una que no ocurrió listada como si hubiera ocurrido diría que hay una
 * evolución escrita donde no la hay, y eso en una historia clínica no es un
 * detalle de listado.
 */
describe('aAtenciones', () => {
  const ANTES = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const DESPUES = new Date(Date.now() + 3 * 60 * 60 * 1000);

  /** Sin etiquetas: es el estado real mientras el catálogo no contestó. */
  const SIN_CATALOGO = new Map<string, { code: string; display: string }>();

  function conCatalogo(
    entradas: Readonly<Record<string, { code: string; display: string }>>,
  ): ReadonlyMap<string, { code: string; display: string }> {
    return new Map(Object.entries(entradas));
  }

  function cita(parcial: Partial<Booking>): Booking {
    return {
      id: 'b-1',
      statusConceptId: 'st-1',
      patientProfileId: 'per-1',
      patientName: 'Ana Quispe',
      startAt: ANTES,
      endAt: new Date(ANTES.getTime() + 30 * 60 * 1000),
      ...parcial,
    } as Booking;
  }

  /* ---- qué entra ---------------------------------------------------------- */

  it('una cita futura NO cuenta como atención', () => {
    // Todavía no ocurrió: listarla diría que hay una evolución escrita.
    const filas = aAtenciones(
      [cita({ startAt: DESPUES, endAt: new Date(DESPUES.getTime() + 1800000) })],
      SIN_CATALOGO,
    );

    expect(filas).toEqual([]);
  });

  it('una cita futura con llegada registrada SÍ cuenta: la persona ya está', () => {
    const filas = aAtenciones(
      [
        cita({
          startAt: DESPUES,
          endAt: new Date(DESPUES.getTime() + 1800000),
          checkedInAt: new Date(),
        }),
      ],
      SIN_CATALOGO,
    );

    expect(filas).toHaveLength(1);
  });

  it('una reserva sin perfil de paciente no entra: no hay expediente que abrir', () => {
    expect(aAtenciones([cita({ patientProfileId: undefined })], SIN_CATALOGO)).toEqual([]);
  });

  /* ---- una fila por atención ---------------------------------------------- */

  /**
   * El cambio de fondo de la pantalla: antes agrupaba por persona y cada fila
   * llevaba al expediente, o sea al mismo destino que el Archivo clínico.
   */
  it('dos atenciones de la misma persona son dos filas, no una', () => {
    const filas = aAtenciones(
      [
        cita({ id: 'b-1', startAt: new Date(ANTES.getTime() - 86400000) }),
        cita({ id: 'b-2', startAt: ANTES }),
      ],
      SIN_CATALOGO,
    );

    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.id)).toEqual(['b-2', 'b-1']);
  });

  it('ordena por cuándo fue, la más reciente primero', () => {
    const filas = aAtenciones(
      [
        cita({ id: 'b-1', startAt: new Date(ANTES.getTime() - 86400000) }),
        cita({ id: 'b-2', patientProfileId: 'per-2', startAt: ANTES }),
      ],
      SIN_CATALOGO,
    );

    expect(filas.map((f) => f.profileId)).toEqual(['per-2', 'per-1']);
  });

  it('sin nombre no se esconde a nadie: se dice «Paciente»', () => {
    // Ausente no significa «sin nombre», significa «no te corresponde verlo».
    expect(aAtenciones([cita({ patientName: undefined })], SIN_CATALOGO)[0].paciente).toBe(
      'Paciente',
    );
  });

  it('enlaza al expediente de esa persona', () => {
    expect(aAtenciones([cita({})], SIN_CATALOGO)[0].ruta).toBe('/medical-records/per-1');
  });

  /* ---- en qué quedó ------------------------------------------------------- */

  it('la que el backend da por cerrada está completada', () => {
    const filas = aAtenciones(
      [cita({ statusConceptId: 'st-fin', checkedInAt: new Date() })],
      conCatalogo({ 'st-fin': { code: 'BOOKING_COMPLETED', display: 'Completada' } }),
    );

    expect(filas[0].estado).toBe('completada');
    expect(filas[0].estadoLabel).toBe(ETIQUETA_DE_ESTADO.completada);
  });

  it('la que el backend tiene en curso está en curso, aunque su horario haya pasado', () => {
    const filas = aAtenciones(
      [cita({ statusConceptId: 'st-curso' })],
      conCatalogo({ 'st-curso': { code: 'BOOKING_IN_PROGRESS', display: 'En curso' } }),
    );

    expect(filas[0].estado).toBe('en-curso');
  });

  /**
   * El caso que esta pantalla existe para hacer visible: llegó, su horario
   * terminó y nadie cerró la atención. Antes se perdía entre las demás.
   */
  it('llegó, terminó su horario y nadie la cerró: se dice', () => {
    const filas = aAtenciones([cita({ checkedInAt: new Date(ANTES) })], SIN_CATALOGO);

    expect(filas[0].estado).toBe('sin-cerrar');
    expect(filas[0].estadoLabel).toBe('Llegó y no se cerró');
  });

  it('sin llegada registrada y con el horario pasado, se da por completada', () => {
    expect(aAtenciones([cita({})], SIN_CATALOGO)[0].estado).toBe('completada');
  });

  /**
   * El catálogo contesta **después** que la lista. Mientras tanto hay que decir
   * algo, y las marcas de tiempo alcanzan: lo que no puede pasar es que la fila
   * no se pinte o muestre un uuid.
   */
  it('sin catálogo resuelto la fila igual dice en qué quedó', () => {
    const filas = aAtenciones([cita({ checkedInAt: new Date(ANTES) })], SIN_CATALOGO);

    expect(filas[0].estadoLabel).toBe('Llegó y no se cerró');
    expect(filas[0].tipo).toBeNull();
    expect(filas[0].canal).toBeNull();
  });

  it('con catálogo resuelto, el tipo y el canal salen en palabras', () => {
    const filas = aAtenciones(
      [cita({ typeConceptId: 't-1', bookingChannelConceptId: 'c-1' })],
      conCatalogo({
        't-1': { code: 'APPT_CONSULTATION', display: 'Consulta' },
        'c-1': { code: 'CHANNEL_PORTAL', display: 'Portal' },
      }),
    );

    expect(filas[0].tipo).toBe('Consulta');
    expect(filas[0].canal).toBe('Portal');
  });
});

/**
 * Con qué se reconoce que una nota es de esta atención.
 *
 * Es una estimación por día, y está admitida: el contrato no ata una nota a
 * una reserva. Lo que estas pruebas fijan es que la estimación no se pase de
 * generosa —dos días distintos nunca son la misma atención— ni se rompa con
 * los bordes del día.
 */
describe('mismoDia', () => {
  it('dos instantes del mismo día calendario', () => {
    expect(mismoDia(new Date('2026-09-10T00:00:00'), new Date('2026-09-10T23:59:59'))).toBe(true);
  });

  it('un minuto después de medianoche ya es otro día', () => {
    expect(mismoDia(new Date('2026-09-10T23:59:59'), new Date('2026-09-11T00:00:01'))).toBe(false);
  });

  it('el mismo día de otro mes no es el mismo día', () => {
    expect(mismoDia(new Date('2026-09-10T10:00:00'), new Date('2026-10-10T10:00:00'))).toBe(false);
  });
});
