import { describe, expect, it } from 'vitest';

import {
  capacidadDeModalidad,
  describirHorario,
  horarioDeSemana,
  nombreDelHorarioGeneral,
  resolverHorario,
  turnosDelDia,
  validarHorario,
} from './center-schedule.rules';
import type { CenterEquipment, CenterSchedule } from './center-schedule.types';
import { modalidadDeEquipo, modalidadDeEstudio } from './modalidades';

const GENERAL = horarioDeSemana('08:00', '12:00', 30);
const ECO = horarioDeSemana('14:00', '18:00', 20, [2, 4]);
const OBSTETRICA = horarioDeSemana('09:00', '11:00', 45, [6]);

const soloGeneral: CenterSchedule = { general: GENERAL, modalities: [], studies: [] };
const conEcografia: CenterSchedule = { general: GENERAL, modalities: [{ modalityCode: 'ECO', schedule: ECO }], studies: [] };
const conExcepcion: CenterSchedule = {
  ...conEcografia,
  studies: [{ studyCode: 'STUDY-ECO-OBSTETRICA', schedule: OBSTETRICA }],
};

const equipo = (id: string, modalityCode: CenterEquipment['modalityCode'], status: CenterEquipment['status']): CenterEquipment => ({
  id,
  name: id,
  manufacturer: null,
  model: null,
  modalityCode,
  status,
  glossaryConceptId: null,
});

describe('resolverHorario', () => {
  it('sin horarios propios, todos los estudios usan el general', () => {
    expect(resolverHorario(soloGeneral, 'STUDY-ECO-ABD', 'ECO')).toEqual({ block: GENERAL, origin: 'GENERAL' });
    expect(resolverHorario(soloGeneral, 'STUDY-RX-TORAX', 'RX')).toEqual({ block: GENERAL, origin: 'GENERAL' });
  });

  it('una modalidad con horario propio lo aplica a todos sus estudios y deja al resto en el general', () => {
    expect(resolverHorario(conEcografia, 'STUDY-ECO-ABD', 'ECO').origin).toBe('MODALITY');
    expect(resolverHorario(conEcografia, 'STUDY-ECO-OBSTETRICA', 'ECO').block).toBe(ECO);
    expect(resolverHorario(conEcografia, 'STUDY-RX-TORAX', 'RX').origin).toBe('GENERAL');
  });

  it('la excepción de un estudio gana sobre su modalidad', () => {
    expect(resolverHorario(conExcepcion, 'STUDY-ECO-OBSTETRICA', 'ECO')).toEqual({ block: OBSTETRICA, origin: 'STUDY' });
    expect(resolverHorario(conExcepcion, 'STUDY-ECO-ABD', 'ECO').origin).toBe('MODALITY');
  });
});

describe('nombreDelHorarioGeneral', () => {
  it('es «Horario general» mientras nadie tenga horario propio', () => {
    expect(nombreDelHorarioGeneral(soloGeneral)).toBe('Horario general');
  });

  it('pasa a «Resto de servicios» con una modalidad o un estudio propio', () => {
    expect(nombreDelHorarioGeneral(conEcografia)).toBe('Resto de servicios');
    expect(nombreDelHorarioGeneral({ ...soloGeneral, studies: conExcepcion.studies })).toBe('Resto de servicios');
  });
});

describe('capacidadDeModalidad', () => {
  const parque = [
    equipo('eco-1', 'ECO', 'OPERATIONAL'),
    equipo('eco-2', 'ECO', 'OUT_OF_SERVICE'),
    equipo('eco-3', 'ECO', 'OPERATIONAL'),
    equipo('rm-1', 'RM', 'MAINTENANCE'),
    equipo('centrifuga', null, 'OPERATIONAL'),
  ];

  it('cuenta sólo los equipos operativos de la modalidad', () => {
    expect(capacidadDeModalidad(parque, 'ECO')).toBe(2);
  });

  it('un equipo en mantenimiento deja la modalidad sin cupo', () => {
    expect(capacidadDeModalidad(parque, 'RM')).toBe(0);
  });
});

describe('turnosDelDia', () => {
  it('genera los inicios que entran enteros antes del cierre', () => {
    const martes = new Date(2026, 9, 6);
    const turnos = turnosDelDia(horarioDeSemana('08:00', '09:10', 30, [2]), martes);
    expect(turnos.map((t) => t.inicio.getHours() * 60 + t.inicio.getMinutes())).toEqual([480, 510]);
  });

  it('no da turnos en un día sin franja', () => {
    const domingo = new Date(2026, 9, 11);
    expect(turnosDelDia(GENERAL, domingo)).toEqual([]);
  });
});

describe('validarHorario', () => {
  const nombre = (d: string): string => (d === 'general' ? 'Horario general' : d);

  it('acepta un horario completo', () => {
    expect(validarHorario(conExcepcion, nombre)).toEqual([]);
  });

  it('rechaza un horario propio sin días y una franja al revés', () => {
    const malo: CenterSchedule = {
      general: { windows: [{ dayOfWeek: 1, startTime: '12:00', endTime: '08:00' }], slotMinutes: 30 },
      modalities: [{ modalityCode: 'ECO', schedule: { windows: [], slotMinutes: 20 } }],
      studies: [],
    };
    const problemas = validarHorario(malo, nombre).map((p) => p.donde);
    expect(problemas).toEqual(['general', 'ECO']);
  });
});

describe('describirHorario', () => {
  it('agrupa días consecutivos con la misma franja', () => {
    expect(describirHorario(GENERAL)).toBe('Lun a Vie 08:00–12:00 · citas de 30 min');
    expect(describirHorario(ECO)).toBe('Mar, Jue 14:00–18:00 · citas de 20 min');
  });
});

describe('modalidades', () => {
  it('cada estudio del catálogo de órdenes tiene modalidad', () => {
    expect(modalidadDeEstudio('STUDY-ECO-ABD')).toBe('ECO');
    expect(modalidadDeEstudio('STUDY-ECO-OBSTETRICA')).toBe('ECO');
    expect(modalidadDeEstudio('STUDY-RX-TORAX')).toBe('RX');
    expect(modalidadDeEstudio('STUDY-TSH')).toBe('LAB');
    expect(modalidadDeEstudio('STUDY-INEXISTENTE')).toBeNull();
  });

  it('los equipos del simulador se asignan a su modalidad', () => {
    expect(modalidadDeEquipo('US')).toBe('ECO');
    expect(modalidadDeEquipo('XR')).toBe('RX');
    expect(modalidadDeEquipo('DX')).toBe('DXA');
    expect(modalidadDeEquipo('CENTRIFUGE')).toBeNull();
  });
});
