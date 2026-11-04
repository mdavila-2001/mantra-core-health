import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS, PRACTICE_SANLUCAS } from '../fixtures/agenda';
import { PROCEDIMIENTO } from '../fixtures/concepts';
import { Coleccion, uuid } from '../mock-store';

export interface ServicioSimulado {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly serviceConceptId?: string;
  readonly defaultPrice: string;
  readonly currencyConceptId: string;
  readonly currencyCode: string;
  readonly taxCodeId?: string;
  readonly incomeAccountId?: string;
  readonly isActive: boolean;
  readonly descriptionText?: string;
  readonly imageFileId?: string;
}

export const MONEDA_BOB = uuid('concept-currency-bob');

const SERVICIOS_INICIALES: ServicioSimulado[] = [
  {
    id: uuid(`service-cita-medica-${PRACTICE_OLIVOS}`),
    practiceId: PRACTICE_OLIVOS,
    code: 'CITA_MEDICA',
    name: 'Cita médica',
    defaultPrice: '0.00',
    currencyConceptId: MONEDA_BOB,
    currencyCode: 'BOB',
    isActive: true,
    descriptionText: 'Servicio por defecto de consulta médica presencial o virtual.',
  },
  {
    id: uuid(`service-cita-medica-${PRACTICE_CONSULTORIO}`),
    practiceId: PRACTICE_CONSULTORIO,
    code: 'CITA_MEDICA',
    name: 'Cita médica',
    defaultPrice: '0.00',
    currencyConceptId: MONEDA_BOB,
    currencyCode: 'BOB',
    isActive: true,
    descriptionText: 'Servicio por defecto de consulta médica presencial o virtual.',
  },
  {
    id: uuid(`service-cita-medica-${PRACTICE_SANLUCAS}`),
    practiceId: PRACTICE_SANLUCAS,
    code: 'CITA_MEDICA',
    name: 'Cita médica',
    defaultPrice: '0.00',
    currencyConceptId: MONEDA_BOB,
    currencyCode: 'BOB',
    isActive: true,
    descriptionText: 'Servicio por defecto de consulta médica presencial o virtual.',
  },
  ...([
    ['CONS-CARDIO', 'Consulta cardiológica', '250.00', 'Consulta de primera vez o control con la Dra. Rojas. Incluye electrocardiograma de reposo.'],
    ['CONS-CONTROL', 'Control cardiológico', '180.00', 'Control de seguimiento de pacientes en tratamiento.'],
    ['ECG', 'Electrocardiograma', '120.00', 'Registro de la actividad eléctrica del corazón, 12 derivaciones.'],
    ['ECO-DOPPLER', 'Ecocardiograma Doppler', '480.00', 'Ecografía cardíaca con Doppler color.'],
    ['HOLTER', 'Holter de 24 horas', '350.00', 'Registro continuo del ritmo cardíaco durante un día.'],
    ['MAPA', 'Monitoreo ambulatorio de presión (MAPA)', '320.00', 'Presión arterial medida cada 20 minutos durante 24 horas.'],
    ['TELE-CARDIO', 'Teleconsulta cardiológica', '200.00', 'Consulta por videollamada para controles y lectura de resultados.'],
    ['CERT-APTITUD', 'Certificado de aptitud cardiovascular', '150.00', 'Evaluación para actividad deportiva o laboral.'],
    ['ERGO', 'Prueba de esfuerzo', '520.00', 'Ergometría en cinta con monitoreo continuo.'],
    ['PAQ-PREV', 'Paquete de prevención cardiovascular', '890.00', 'Consulta + ECG + perfil lipídico + ecocardiograma. Se paga en cuotas.'],
  ] as const).map(([code, name, defaultPrice, descriptionText], i) => ({
    id: uuid(`service-${code}`),
    practiceId: i < 8 ? PRACTICE_OLIVOS : PRACTICE_CONSULTORIO,
    code: code!,
    name: name!,
    serviceConceptId: i === 2 ? PROCEDIMIENTO['PROC-ENDOSCOPIA'] : undefined,
    defaultPrice: defaultPrice!,
    currencyConceptId: MONEDA_BOB,
    currencyCode: 'BOB',
    isActive: i !== 7,
    descriptionText: descriptionText!,
    ...(i % 3 === 0 ? { imageFileId: uuid(`service-image-${code}`) } : {}),
  })),
];

export const servicios = new Coleccion<ServicioSimulado>(SERVICIOS_INICIALES);

/**
 * Garantiza que la práctica tenga el servicio `CITA_MEDICA` en su catálogo.
 * Si no existe, lo crea con precio 0.00 BOB y estado activo.
 */
export function asegurarCitaMedica(practiceId: string): ServicioSimulado {
  const existente = servicios.todos().find((s) => s.practiceId === practiceId && s.code === 'CITA_MEDICA');
  if (existente !== undefined) return existente;
  return servicios.agregar({
    id: uuid(`service-cita-medica-${practiceId}`),
    practiceId,
    code: 'CITA_MEDICA',
    name: 'Cita médica',
    defaultPrice: '0.00',
    currencyConceptId: MONEDA_BOB,
    currencyCode: 'BOB',
    isActive: true,
    descriptionText: 'Servicio por defecto de consulta médica presencial o virtual.',
  });
}
