import type { CenterSchedule, EquipmentStatus, OrderAppointment } from '../../data-access/diagnostic-units/center-schedule.types';
import type { ModalityCode } from '../../data-access/diagnostic-units/modalidades';
import { Coleccion } from '../mock-store';

/* ============================================================================
    Lo que cada centro de diagnóstico configura de su agenda, y los turnos que
    los pacientes reservan desde sus órdenes.

    Tres tablas, las tres con `persistirEn` para que sobrevivan a F5 como el
    resto de la agenda de la maqueta:

      - `horariosDeCentros`: el horario general, los de cada modalidad y las
        excepciones por estudio. Sin fila, el centro usa el horario de fábrica
        de `horarioDeFabrica()`.
      - `estadosDeEquipos`: el estado operativo que el centro le cambió a un
        equipo. Sin fila, el equipo tiene el estado con el que lo genera
        `equipoDe()`.
      - `turnosDeOrdenes`: el turno que resolvió cada orden médica. Su `id` es
        el de la orden: una orden tiene a lo sumo un turno activo.
    ========================================================================== */

export interface HorarioDeCentroSimulado {
  /** El id de la unidad de diagnóstico. */
  readonly id: string;
  readonly schedule: CenterSchedule;
  readonly updatedAt: string;
}

export interface EstadoDeEquipoSimulado {
  /** El id del equipo. */
  readonly id: string;
  readonly status: EquipmentStatus;
  readonly updatedAt: string;
}

export interface TurnoDeOrdenSimulado {
  /** El id de la orden (service request). */
  readonly id: string;
  readonly patientProfileId: string;
  readonly bookingId: string;
  readonly unitId: string;
  readonly studyCode: string;
  readonly modalityCode: ModalityCode;
  readonly startAt: string;
  readonly endAt: string;
  readonly createdAt: string;
}

export const horariosDeCentros = new Coleccion<HorarioDeCentroSimulado>().persistirEn('mock.centros.horarios');
export const estadosDeEquipos = new Coleccion<EstadoDeEquipoSimulado>().persistirEn('mock.centros.estadosDeEquipos');
export const turnosDeOrdenes = new Coleccion<TurnoDeOrdenSimulado>().persistirEn('mock.centros.turnosDeOrdenes');

/** Puestos de extracción de un laboratorio: los que limitan su toma de muestras. */
export const PUESTOS_DE_EXTRACCION = 3;

/**
 * Cómo se arma el turno de una orden para «Mis órdenes». Lo define
 * `registrarCentros()`; vive acá para que el handler de diagnóstico lo use sin
 * importar el de centros, que ya importa al de diagnóstico.
 */
let resolverCitaDeOrden: (orderId: string) => OrderAppointment | null = () => null;

export function definirResolverCitaDeOrden(resolver: (orderId: string) => OrderAppointment | null): void {
  resolverCitaDeOrden = resolver;
}

export function citaDeLaOrden(orderId: string): OrderAppointment | null {
  return resolverCitaDeOrden(orderId);
}
