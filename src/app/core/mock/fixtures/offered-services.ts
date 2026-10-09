import { Coleccion, uuid } from '../mock-store';
import { MEDICA } from './people';

/**
 * Cómo ofrece un profesional un servicio de su catálogo (v4.2.40).
 *
 * Es el espejo de `scheduling.practitioner_service_offerings`. El catálogo es **por
 * práctica** y fija nombre y precio; la duración vive acá porque en una misma
 * organización dos médicos hacen el mismo servicio con tiempos distintos.
 */
export interface OfertaSimulada {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly serviceCatalogId: string;
  readonly minDurationMinutes: number;
  readonly maxDurationMinutes: number;
  readonly prepMinutes: number;
  readonly cleanupMinutes: number;
  readonly isPatientBookable: boolean;
  readonly requiresApproval: boolean;
  readonly channel?: 'PRESENCIAL' | 'TELECONSULTA' | 'DOMICILIO';
  readonly isActive: boolean;
}

/**
 * Los estudios de la médica de demostración, con duraciones **de maqueta**: no son
 * valores clínicos de nadie, sólo lo bastante distintos entre sí para que los
 * horarios dinámicos se vean (un ECG corto, un ecocardiograma largo).
 *
 * El catálogo ya tiene estos servicios (`practice.handlers.ts`): acá sólo se
 * declara cómo los ofrece ella. Uno queda sin ofrecer a propósito, para que la
 * pantalla del médico muestre el caso de «todavía no lo declaraste».
 */
const OFERTAS_DE_LA_MEDICA: readonly (readonly [
  string, number, number, number, number, boolean, boolean, boolean,
])[] = [
  // código del catálogo, mín, máx, preparación, limpieza, reservable, requiere aprobación, activa
  ['ECG', 15, 20, 0, 5, true, false, true],
  ['ECO-DOPPLER', 30, 45, 5, 10, true, false, true],
  ['HOLTER', 20, 30, 0, 0, true, true, true],
  ['ERGO', 40, 60, 10, 10, true, true, true],
  ['TELE-CARDIO', 20, 30, 0, 0, true, false, true],
];

export const ofertas = new Coleccion<OfertaSimulada>(
  OFERTAS_DE_LA_MEDICA.map(([code, min, max, prep, limpieza, reservable, aprobacion, activa]) => ({
    id: uuid(`offering-${MEDICA.id}-${code}`),
    practitionerProfileId: MEDICA.id,
    serviceCatalogId: uuid(`service-${code}`),
    minDurationMinutes: min,
    maxDurationMinutes: max,
    prepMinutes: prep,
    cleanupMinutes: limpieza,
    isPatientBookable: reservable,
    requiresApproval: aprobacion,
    ...(code === 'TELE-CARDIO' ? { channel: 'TELECONSULTA' as const } : {}),
    isActive: activa,
  })),
  'ofertas-de-servicio',
);
