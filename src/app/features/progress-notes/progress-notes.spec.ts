import { agruparPorPaciente } from './progress-notes';
import type { Booking } from '@core/data-access/scheduling/scheduling.types';

/**
 * «Evoluciones» — la sexta de las ocho opciones del panel del médico.
 *
 * Lo que se fija acá es el criterio de qué entra: una atención que no ocurrió
 * listada como si hubiera ocurrido diría que hay una evolución escrita donde no
 * la hay, y eso en una historia clínica no es un detalle de listado.
 */
describe('agruparPorPaciente', () => {
  const ANTES = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const DESPUES = new Date(Date.now() + 3 * 60 * 60 * 1000);

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

  it('una cita futura NO cuenta como atención', () => {
    // Todavía no ocurrió: listarla diría que hay una evolución escrita.
    const filas = agruparPorPaciente([
      cita({ startAt: DESPUES, endAt: new Date(DESPUES.getTime() + 1800000) }),
    ]);

    expect(filas).toEqual([]);
  });

  it('una cita futura con llegada registrada SÍ cuenta: la persona ya está', () => {
    const filas = agruparPorPaciente([
      cita({
        startAt: DESPUES,
        endAt: new Date(DESPUES.getTime() + 1800000),
        checkedInAt: new Date(),
      }),
    ]);

    expect(filas).toHaveLength(1);
  });

  it('agrupa por persona y cuenta las veces, en vez de repetir el renglón', () => {
    // Alguien con control semanal ocuparía cuatro renglones que llevan todos al
    // mismo expediente. Lo que aportaban de verdad era el número.
    const filas = agruparPorPaciente([
      cita({ id: 'b-1', startAt: new Date(ANTES.getTime() - 86400000) }),
      cita({ id: 'b-2', startAt: ANTES }),
    ]);

    expect(filas).toHaveLength(1);
    expect(filas[0].cuantas).toBe(2);
    expect(filas[0].ultima.getTime()).toBe(ANTES.getTime());
  });

  it('ordena por la última atención, la más reciente primero', () => {
    const filas = agruparPorPaciente([
      cita({ id: 'b-1', patientProfileId: 'per-1', startAt: new Date(ANTES.getTime() - 86400000) }),
      cita({ id: 'b-2', patientProfileId: 'per-2', patientName: 'Beto Mamani', startAt: ANTES }),
    ]);

    expect(filas.map((f) => f.profileId)).toEqual(['per-2', 'per-1']);
  });

  it('una reserva sin perfil de paciente no entra: no hay expediente que abrir', () => {
    const filas = agruparPorPaciente([cita({ patientProfileId: undefined })]);

    expect(filas).toEqual([]);
  });

  it('sin nombre no se esconde a nadie: se dice «Paciente»', () => {
    // Ausente no significa «sin nombre», significa «no te corresponde verlo».
    const filas = agruparPorPaciente([cita({ patientName: undefined })]);

    expect(filas[0].nombre).toBe('Paciente');
  });

  it('enlaza al expediente de esa persona', () => {
    const filas = agruparPorPaciente([cita({})]);

    expect(filas[0].ruta).toBe('/medical-records/per-1');
  });
});
