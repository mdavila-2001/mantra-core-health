import type { ReceivedServiceCost } from '../../data-access/received-services/received-services.types';
import { TENANT_CLINICA, TENANT_NAMES } from '../mock-session';
import { uuid } from '../mock-store';
import { conjunto, define, PROCEDIMIENTO, VACCINE } from './concepts';
import { MEDICAL, PACIENTE } from './people';

/* ============================================================================
    «Servicios recibidos»: el escenario canónico de la maqueta.

    Es el MISMO escenario que usan las pruebas del front y el mockup de la app
    móvil (`lib/mockup`): la paciente de demostración recibió dos intervenciones
    y dos vacunas, con estas fechas, estos nombres y estos importes. Dev, test y
    mockup tienen que mostrar lo mismo; si se cambia un dato acá, se cambia allá.

    Lo que NO es un servicio recibido: la consulta (vive en «Atenciones») y el
    laboratorio y la imagenología (viven en «Resultados»).
    ========================================================================== */

conjunto('VS_RECEIVED_SERVICE_TYPE', 'Tipo de servicio recibido', 'Intervención médica realizada o vacunación.');
export const RECEIVED_SERVICE_TYPE = define('VS_RECEIVED_SERVICE_TYPE', [
  ['clinical:RECEIVED_SERVICE_INTERVENTION', 'Intervención médica'],
  ['clinical:RECEIVED_SERVICE_VACCINATION', 'Vacunación'],
]);

conjunto('VS_RECEIVED_SERVICE_STATUS', 'Estado del servicio recibido', 'Cómo terminó el servicio.');
export const RECEIVED_SERVICE_STATUS = define('VS_RECEIVED_SERVICE_STATUS', [
  ['PROC_COMPLETED', 'Realizada'],
  ['IMM_COMPLETED', 'Aplicada'],
]);

const SITE_ID = uuid('site-clinica-los-olivos-central');

/** Un servicio del escenario: lo que el servidor guarda, antes de aplicar quién pregunta. */
export interface SimulatedReceivedService {
  readonly id: string;
  readonly patientProfileId: string;
  readonly type: 'INTERVENTION' | 'VACCINATION';
  readonly typeConceptId: string;
  readonly serviceConceptId: string;
  readonly statusConceptId: string;
  readonly performedAt: string;
  readonly performerProfileId?: string;
  readonly performerName?: string;
  readonly practiceSiteId: string;
  readonly practiceSiteName: string;
  readonly resultText?: string;
  readonly cost: ReceivedServiceCost | null;
}

const SITE = { practiceSiteId: SITE_ID, practiceSiteName: TENANT_NAMES[TENANT_CLINICA] ?? 'Clínica Los Olivos' };

const INTERVENTION = { type: 'INTERVENTION', typeConceptId: RECEIVED_SERVICE_TYPE['clinical:RECEIVED_SERVICE_INTERVENTION']!, statusConceptId: RECEIVED_SERVICE_STATUS['PROC_COMPLETED']! } as const;
const VACCINATION = { type: 'VACCINATION', typeConceptId: RECEIVED_SERVICE_TYPE['clinical:RECEIVED_SERVICE_VACCINATION']!, statusConceptId: RECEIVED_SERVICE_STATUS['IMM_COMPLETED']! } as const;

/**
 * Los cuatro servicios de la paciente de demostración, del más reciente al más
 * antiguo. El orden es parte del contrato: la API ordena por fecha descendente.
 */
export const RECEIVED_SERVICES: readonly SimulatedReceivedService[] = [
  {
    ...INTERVENTION,
    ...SITE,
    id: uuid('received-service-infiltration'),
    patientProfileId: PACIENTE.id,
    serviceConceptId: PROCEDIMIENTO['PROC-INFILTRACION']!,
    performedAt: '2026-08-12T14:30:00.000Z',
    performerProfileId: MEDICAL.id,
    performerName: MEDICAL.displayName,
    resultText: 'Tolerancia adecuada. Control en dos semanas.',
    // Una línea de factura enlazada: el importe sale de ahí.
    cost: { amount: '350.00', currencyCode: 'BOB', source: 'INVOICE_LINE' },
  },
  {
    ...INTERVENTION,
    ...SITE,
    id: uuid('received-service-appendectomy'),
    patientProfileId: PACIENTE.id,
    serviceConceptId: PROCEDIMIENTO['PROC-APENDICECTOMIA']!,
    performedAt: '2026-06-03T15:00:00.000Z',
    performerProfileId: MEDICAL.id,
    performerName: MEDICAL.displayName,
    resultText: 'Sin complicaciones. Alta a las 48 horas.',
    // Sin línea de factura enlazada: es la suma de los cargos del caso.
    cost: { amount: '4200.00', currencyCode: 'BOB', source: 'CHARGE_ITEMS' },
  },
  {
    ...VACCINATION,
    ...SITE,
    id: uuid('received-service-influenza'),
    patientProfileId: PACIENTE.id,
    serviceConceptId: VACCINE['VAC-INFLUENZA']!,
    performedAt: '2026-05-20T09:08:00.000Z',
    // Sin cobro registrado: el costo es null, no cero.
    cost: null,
  },
  {
    ...VACCINATION,
    ...SITE,
    id: uuid('received-service-tetanus'),
    patientProfileId: PACIENTE.id,
    serviceConceptId: VACCINE['VAC-TETANOS']!,
    performedAt: '2026-02-10T10:00:00.000Z',
    cost: null,
  },
];
