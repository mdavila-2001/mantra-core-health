import type { AvailabilityExceptionType } from '@core/data-access/scheduling/scheduling.types';

/** Un bloqueo que ya existe y se está corrigiendo. */
export interface BloqueoEnEdicion {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly exceptionType: AvailabilityExceptionType;
  readonly descripcion: string | null;
}

/** Lo que el formulario pide bloquear, ya en instantes. */
export interface BloqueoPedido {
  readonly desde: Date;
  readonly hasta: Date;
  /**
   * El motivo del catálogo. Antes no viajaba y quien creaba la excepción
   * ponía `ABSENCE` fijo para todo — vacaciones, feriados y trámites quedaban
   * indistinguibles en la base.
   */
  readonly exceptionType: AvailabilityExceptionType;
  /** El texto libre. Vacío salvo que el motivo elegido lo exija. */
  readonly motivo: string;
  /** Para poder contarlo en el aviso de después. */
  readonly dias: number;
  readonly franjaHoraria: boolean;
}
