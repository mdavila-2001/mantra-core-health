import type { DynamicEnumOption } from '../../../core/data-access/system-context/system-context.types';

/* ============================================================================
    Casos de demostración de la ficha clínica.

    Una sola fuente para las tres superficies que los ofrecen: la barra del
    bloque de diagnóstico, la de la receta y los escenarios combinados del
    expediente. Los CÓDIGOS de acá abajo no son inventados: cada uno existe en
    el catálogo inicial que siembra el backend (`clinical.concepts.ts` — 12
    diagnósticos CIE-10, 12 fármacos ATC, 6 vías HL7, 6 unidades UCUM), y por
    eso un caso aplicado siempre resuelve a un `conceptId` real. Un código que
    no esté en el catálogo del entorno no se aplica y se avisa: jamás se cae a
    «la primera opción de la lista», porque autocompletar un diagnóstico
    equivocado es peor que no autocompletar nada.

    La visibilidad de las barras la decide `environment.demoPresets`
    (`PUBLIC_DEMO_PRESETS`), no el código: en producción no existen.
   ========================================================================= */

/** Un caso de diagnóstico listo para precargar el formulario. */
export interface CasoDiagnosticoDemo {
  readonly label: string;
  /** Código CIE-10, exacto contra el `code` del enum `condition-code`. */
  readonly code: string;
  /** Código del enum `condition-category`. */
  readonly categoria: string;
  /** Código del enum `condition-severity`. */
  readonly severidad: string;
  /** Código del enum `condition-laterality`; casi nunca aplica en estos casos. */
  readonly lateralidad?: string;
  /** Código del enum `condition-clinical-course`. */
  readonly cursoClinico: string;
  /** Días hasta la resolución esperada; ausente en cursos crónicos. */
  readonly diasResolucion?: number;
  /** Hallazgos y justificación clínica (va a `noteText`). */
  readonly notas: string;
}

/** Un caso de prescripción listo para precargar el formulario. */
export interface CasoRecetaDemo {
  readonly label: string;
  /** Texto con que se busca el medicamento en terminología (display sembrado). */
  readonly medicamentoQuery: string;
  /** Posología en palabras, para `doseText`. */
  readonly dosis: string;
  /** Frecuencia en palabras, para `frequencyText`. */
  readonly frecuencia: string;
  /** Código del enum `medication-route`. */
  readonly viaCodigo: string;
  /** Cantidad a dispensar. */
  readonly cantidad: number;
  /** Código del enum `medication-unit`. */
  readonly unidadCodigo: string;
  /** Días de tratamiento; `null` significa crónico/continuo. */
  readonly diasTratamiento: number | null;
  /** Indicaciones al paciente (van a `patientInstructionsText`). */
  readonly indicaciones: string;
}

/** Un escenario que llena diagnóstico y receta coherentes con un clic. */
export interface EscenarioClinicoDemo {
  readonly label: string;
  readonly diagnostico: CasoDiagnosticoDemo;
  readonly receta: CasoRecetaDemo;
}

export const CASOS_DIAGNOSTICO_DEMO: readonly CasoDiagnosticoDemo[] = [
  {
    label: 'IRA alta',
    code: 'J06.9',
    categoria: 'COND_DIAGNOSIS',
    severidad: 'COND_SEV_MILD',
    cursoClinico: 'COND_COURSE_ACUTE',
    diasResolucion: 7,
    notas:
      'Odinofagia y congestión nasal de 48 horas con febrícula de 37,8 °C. Faringe eritematosa sin exudado.',
  },
  {
    label: 'Hipertensión',
    code: 'I10',
    categoria: 'COND_DIAGNOSIS',
    severidad: 'COND_SEV_MODERATE',
    cursoClinico: 'COND_COURSE_CHRONIC',
    notas:
      'PA 145/92 mmHg en dos tomas en reposo. Sin daño de órgano blanco conocido ni crisis previas.',
  },
  {
    label: 'Diabetes tipo 2',
    code: 'E11.9',
    categoria: 'COND_DIAGNOSIS',
    severidad: 'COND_SEV_MODERATE',
    cursoClinico: 'COND_COURSE_CHRONIC',
    notas:
      'Glucemia en ayunas 138 mg/dL y HbA1c 7,2 %. Sin complicaciones microvasculares al examen.',
  },
  {
    label: 'Lumbalgia',
    code: 'M54.5',
    categoria: 'COND_DIAGNOSIS',
    severidad: 'COND_SEV_MODERATE',
    cursoClinico: 'COND_COURSE_ACUTE',
    diasResolucion: 10,
    notas:
      'Contractura paravertebral L4-L5 tras esfuerzo. Sin irradiación ciática ni signos de alarma.',
  },
  {
    label: 'Infección urinaria',
    code: 'N39.0',
    categoria: 'COND_DIAGNOSIS',
    severidad: 'COND_SEV_MILD',
    cursoClinico: 'COND_COURSE_ACUTE',
    diasResolucion: 7,
    notas: 'Disuria y polaquiuria de 24 horas de evolución, sin fiebre ni dolor lumbar.',
  },
];

export const CASOS_RECETA_DEMO: readonly CasoRecetaDemo[] = [
  {
    label: 'Amoxicilina 500 mg',
    medicamentoQuery: 'Amoxicilina',
    dosis: '500 mg · comprimidos',
    frecuencia: 'Cada 8 horas',
    viaCodigo: 'ROUTE_ORAL',
    cantidad: 21,
    unidadCodigo: 'UNIT_{tablet}',
    diasTratamiento: 7,
    indicaciones:
      'Completar los 7 días de tratamiento aunque los síntomas cedan antes. Tomar con agua.',
  },
  {
    label: 'Enalapril 10 mg',
    medicamentoQuery: 'Enalapril',
    dosis: '10 mg · comprimidos',
    frecuencia: 'Cada 24 horas (1 vez al día)',
    viaCodigo: 'ROUTE_ORAL',
    cantidad: 30,
    unidadCodigo: 'UNIT_{tablet}',
    diasTratamiento: null,
    indicaciones: 'Tomar por la mañana. Control ambulatorio de presión arterial en dos semanas.',
  },
  {
    label: 'Metformina 850 mg',
    medicamentoQuery: 'Metformina',
    dosis: '850 mg · comprimidos',
    frecuencia: 'Cada 12 horas',
    viaCodigo: 'ROUTE_ORAL',
    cantidad: 60,
    unidadCodigo: 'UNIT_{tablet}',
    diasTratamiento: null,
    indicaciones: 'Tomar con el desayuno y la cena para reducir la intolerancia digestiva.',
  },
  {
    label: 'Paracetamol 1 g',
    medicamentoQuery: 'Paracetamol',
    dosis: '1 g · comprimidos',
    frecuencia: 'Cada 8 horas',
    viaCodigo: 'ROUTE_ORAL',
    cantidad: 15,
    unidadCodigo: 'UNIT_{tablet}',
    diasTratamiento: 5,
    indicaciones: 'Tomar si hay dolor o temperatura mayor a 38 °C. No exceder 4 gramos por día.',
  },
  {
    label: 'Cefalexina 500 mg',
    medicamentoQuery: 'Cefalexina',
    dosis: '500 mg · comprimidos',
    frecuencia: 'Cada 6 horas',
    viaCodigo: 'ROUTE_ORAL',
    cantidad: 28,
    unidadCodigo: 'UNIT_{tablet}',
    diasTratamiento: 7,
    indicaciones: 'Tomar con abundante agua y completar los 7 días de tratamiento.',
  },
];

/**
 * Los escenarios combinados: un diagnóstico y su receta coherente. El
 * emparejamiento es clínico, no posicional — se declara explícito para que
 * reordenar una lista no despareje a la otra.
 */
export const ESCENARIOS_CLINICOS_DEMO: readonly EscenarioClinicoDemo[] = [
  { label: 'IRA alta + Amoxicilina', diagnostico: CASOS_DIAGNOSTICO_DEMO[0], receta: CASOS_RECETA_DEMO[0] },
  { label: 'Hipertensión + Enalapril', diagnostico: CASOS_DIAGNOSTICO_DEMO[1], receta: CASOS_RECETA_DEMO[1] },
  { label: 'Diabetes + Metformina', diagnostico: CASOS_DIAGNOSTICO_DEMO[2], receta: CASOS_RECETA_DEMO[2] },
  { label: 'Lumbalgia + Paracetamol', diagnostico: CASOS_DIAGNOSTICO_DEMO[3], receta: CASOS_RECETA_DEMO[3] },
  { label: 'Infección urinaria + Cefalexina', diagnostico: CASOS_DIAGNOSTICO_DEMO[4], receta: CASOS_RECETA_DEMO[4] },
];

/**
 * El `conceptId` cuyo `code` coincide EXACTO, o `null`.
 *
 * Nunca por `display` ni por prefijo: un código parcial que matchee otro
 * concepto escribiría un dato clínico equivocado, y eso es peor que dejar el
 * campo vacío y avisarlo.
 */
export function conceptIdPorCodigo(
  opciones: readonly DynamicEnumOption[],
  code: string,
): string | null {
  return opciones.find((opcion) => opcion.code === code)?.conceptId ?? null;
}
