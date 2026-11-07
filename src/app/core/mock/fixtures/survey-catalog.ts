/**
 * The mock's standard survey catalog (06/11/2026), shape of
 * `GET /surveys/standard-catalog`. The real catalog lives in the API
 * (`surveys.standard-catalog.ts`); this is a reduced mirror so «Encuestas por
 * servicio» works with the mock backend. Codes are the contract's; questions
 * are a short Spanish adaptation for the mockup. Cited sources are public-domain
 * or free-use instruments (AHRQ CAHPS, RAND PSQ-18), shown as «Ítems adaptados
 * de …». Common answer types (recommendation = SCALE 0–10, overall = SCALE 1–5);
 * every question optional.
 */

export type ServiceKind =
  | 'CONSULTATION'
  | 'PROCEDURE'
  | 'LAB'
  | 'IMAGING'
  | 'TELEMEDICINE'
  | 'THERAPY'
  | 'HOME_CARE'
  | 'PHARMACY'
  | 'OTHER';

export interface StandardQuestion {
  readonly text: string;
  readonly answerType: 'TEXT' | 'SCALE' | 'BOOLEAN' | 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE';
  readonly required: boolean;
  readonly dimension?: string;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

interface Fuente {
  readonly instrument: string;
  readonly license: string;
  readonly url?: string;
}

export interface StandardTemplate {
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly serviceKinds: readonly ServiceKind[];
  readonly source: Fuente;
  readonly additionalSources?: readonly Fuente[];
  readonly questions: readonly StandardQuestion[];
}

const CG_CAHPS: Fuente = {
  instrument: 'CG-CAHPS 4.0',
  license: 'Dominio público (AHRQ)',
  url: 'https://www.ahrq.gov/cahps/surveys-guidance/cg/index.html',
};

const PSQ_18: Fuente = {
  instrument: 'PSQ-18',
  license: 'Uso libre (RAND Corporation)',
  url: 'https://www.rand.org/health-care/surveys_tools/psq.html',
};

const ESPERA = ['Menos de 15 minutos', 'Entre 15 y 30 minutos', 'Más de 30 minutos'] as const;

function p(
  dimension: string,
  text: string,
  answerType: StandardQuestion['answerType'],
  extra: Partial<StandardQuestion> = {},
): StandardQuestion {
  return { text, answerType, required: false, dimension, ...extra };
}

const ESPERO = p('tiempo_espera', 'Desde la hora acordada, ¿cuánto esperó hasta que le atendieron?', 'SINGLE_CHOICE', { options: ESPERA });
const TRATO = p('trato_respetuoso', '¿Con qué frecuencia el personal le trató con cortesía y respeto? (1 = Nunca, 5 = Siempre)', 'SCALE', { scaleMin: 1, scaleMax: 5 });
const GENERAL = p('satisfaccion_global', 'En general, ¿cómo calificaría su experiencia con este servicio? (1 = Muy mala, 5 = Excelente)', 'SCALE', { scaleMin: 1, scaleMax: 5 });
const RECOMIENDA = p('recomendacion', '¿Qué tan probable es que recomiende este servicio a un familiar o amigo? (0 = Nada probable, 10 = Totalmente probable)', 'SCALE', { scaleMin: 0, scaleMax: 10 });
const COMENTARIO = p('comentario_abierto', 'Si lo desea, cuéntenos qué podríamos hacer mejor.', 'TEXT');

export const STANDARD_SURVEY_CATALOG: readonly StandardTemplate[] = [
  {
    code: 'STD_PROCEDURE_V1',
    title: 'Procedimientos y estudios',
    description: 'Para estudios y procedimientos en consultorio: explicación previa, trato, comodidad y resultados.',
    serviceKinds: ['PROCEDURE'],
    source: CG_CAHPS,
    questions: [
      ESPERO,
      p('claridad_explicacion', 'Antes del procedimiento, ¿le explicaron en qué consistía de una manera fácil de entender?', 'BOOLEAN'),
      TRATO,
      p('entrega_resultados', '¿Le dijeron cuándo y cómo recibiría los resultados?', 'BOOLEAN'),
      GENERAL,
      RECOMIENDA,
      COMENTARIO,
    ],
  },
  {
    code: 'STD_IMAGING_V1',
    title: 'Estudios por imágenes',
    description: 'Ecografías, radiografías y estudios similares: preparación, espera, privacidad y entrega del informe.',
    serviceKinds: ['IMAGING'],
    source: CG_CAHPS,
    questions: [
      p('preparacion', '¿Recibió con anticipación las indicaciones de preparación para el estudio?', 'BOOLEAN'),
      ESPERO,
      p('privacidad', 'Durante el estudio, ¿se respetó su privacidad? (1 = Nada, 5 = Del todo)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('entrega_resultados', '¿Le explicaron cuándo estaría listo el informe?', 'BOOLEAN'),
      GENERAL,
      RECOMIENDA,
      COMENTARIO,
    ],
  },
  {
    code: 'STD_LAB_V1',
    title: 'Toma de muestras de laboratorio',
    description: 'Extracción y entrega de muestras: indicaciones, trato, molestia y tiempos.',
    serviceKinds: ['LAB'],
    source: CG_CAHPS,
    questions: [
      p('preparacion', '¿Le indicaron claramente cómo prepararse (ayuno, horario, recipiente)?', 'BOOLEAN'),
      ESPERO,
      TRATO,
      p('molestia', '¿Cuánta molestia sintió durante la toma? (0 = Ninguna, 10 = Mucha)', 'SCALE', { scaleMin: 0, scaleMax: 10 }),
      GENERAL,
      RECOMIENDA,
      COMENTARIO,
    ],
  },
  {
    code: 'STD_TELEMEDICINE_V1',
    title: 'Teleconsulta',
    description: 'Atención por videollamada: conexión, comunicación con el profesional y claridad de las indicaciones.',
    serviceKinds: ['TELEMEDICINE'],
    source: CG_CAHPS,
    questions: [
      p('conexion', '¿La conexión de audio y video funcionó bien durante toda la atención?', 'BOOLEAN'),
      p('comunicacion', '¿Con qué frecuencia el profesional le escuchó con atención? (1 = Nunca, 5 = Siempre)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('claridad_explicacion', '¿Con qué frecuencia el profesional le explicó las cosas de una manera fácil de entender? (1 = Nunca, 5 = Siempre)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('indicaciones_escritas', '¿Recibió por escrito las indicaciones o recetas después de la llamada?', 'BOOLEAN'),
      GENERAL,
      RECOMIENDA,
      COMENTARIO,
    ],
  },
  {
    code: 'STD_THERAPY_V1',
    title: 'Terapias y rehabilitación',
    description: 'Sesiones de terapia, kinesiología o rehabilitación: trato, tiempo dedicado y avance percibido.',
    serviceKinds: ['THERAPY'],
    source: PSQ_18,
    additionalSources: [CG_CAHPS],
    questions: [
      p('tiempo_suficiente', 'El profesional me dedicó el tiempo suficiente. (1 = Nada de acuerdo, 5 = Muy de acuerdo)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('trato_respetuoso', 'Me trataron de forma amable y cordial. (1 = Nada de acuerdo, 5 = Muy de acuerdo)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('acceso', 'Me resultó fácil conseguir una sesión cuando la necesité. (1 = Nada de acuerdo, 5 = Muy de acuerdo)', 'SCALE', { scaleMin: 1, scaleMax: 5 }),
      p('aspectos_utiles', '¿Qué le resultó más útil de las sesiones?', 'MULTIPLE_CHOICE', { options: ['Los ejercicios', 'Las explicaciones', 'El seguimiento', 'Los horarios'] }),
      GENERAL,
      RECOMIENDA,
      COMENTARIO,
    ],
  },
  {
    code: 'STD_OTHER_V1',
    title: 'Satisfacción general con el servicio',
    description: 'Para servicios que no encajan en los otros tipos: trato, comunicación, espera y valoración general.',
    serviceKinds: ['OTHER', 'CONSULTATION'],
    source: PSQ_18,
    questions: [ESPERO, TRATO, GENERAL, RECOMIENDA, COMENTARIO],
  },
];
