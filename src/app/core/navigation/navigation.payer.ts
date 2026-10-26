import { MEDICAL_ORGANIZATION_TYPES } from '../data-access/directory/directory.types';

/**
 * Los tipos de organización que **no** ven la cara de aseguradora del menú
 * («Mis productos», «Siniestralidad y analítica», «Solicitudes recibidas»,
 * «Pacientes de la aseguradora», «Campañas preventivas»).
 *
 * La farmacia y el laboratorio, por su menú de mostrador (D3 del 29/09/2026), y
 * las cinco organizaciones médicas, que son prestadoras y no venden seguros: a
 * una clínica, un consultorio o un centro de enfermería esas pantallas sólo le
 * ofrecían puertas que la API cierra. Una aseguradora (`PAYER`) y la
 * plataforma no cambian.
 *
 * «Solicitudes de seguro» no está en esa lista a propósito: es la cara del
 * **prestador** —lo que la organización presentó a cada aseguradora, la que
 * abre la agenda—, y una clínica la necesita. Ocultar no es seguridad: la
 * autoridad sigue siendo la API.
 */
export const SIN_CARA_DE_ASEGURADORA = [
  'PHARMACY',
  'DIAGNOSTIC_CENTER',
  ...MEDICAL_ORGANIZATION_TYPES,
] as const;
