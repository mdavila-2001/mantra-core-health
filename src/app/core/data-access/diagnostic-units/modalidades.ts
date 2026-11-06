/* ============================================================================
    Modalidades de un centro de diagnóstico.

    Una modalidad agrupa los estudios que se hacen con el mismo tipo de equipo:
    «Ecografía» reúne la abdominal y la obstétrica porque las hace el mismo
    ecógrafo. Es el nivel en el que un centro piensa su horario y su capacidad:
    configura Ecografía una vez, con sus ecógrafos, y vale para todas las
    ecografías.

    Los códigos de equipo son los de `equipoDe()` del simulador (DICOM: `US`,
    `XR`, `MR`, `CT`, `MG`, `DX`). Los de estudio son los `STUDY-*` del conjunto
    `VS_DIAGNOSTIC_STUDY`, los mismos que llevan las órdenes del médico.

    `LAB` es la toma de muestras de un laboratorio de análisis: allí no se
    reserva una máquina sino un puesto de extracción, y los analizadores no
    limitan el turno del paciente.
    ========================================================================== */

export const CODIGOS_DE_MODALIDAD = ['ECO', 'RX', 'RM', 'TC', 'MG', 'DXA', 'ECG', 'LAB'] as const;
export type ModalityCode = (typeof CODIGOS_DE_MODALIDAD)[number];

export interface ModalityDefinition {
  readonly code: ModalityCode;
  /** Cómo la nombra el centro y el paciente. */
  readonly label: string;
  /** Cómo se llama el equipo que la atiende, en singular y en plural. */
  readonly equipmentLabel: readonly [singular: string, plural: string];
  /** Códigos de tipo de equipo que cuentan como capacidad de esta modalidad. */
  readonly equipmentCodes: readonly string[];
  /** El término de la modalidad en el glosario. */
  readonly glossarySlug: string;
}

export const MODALIDADES: readonly ModalityDefinition[] = [
  {
    code: 'ECO',
    label: 'Ecografía',
    equipmentLabel: ['ecógrafo', 'ecógrafos'],
    equipmentCodes: ['US'],
    glossarySlug: 'modalidad-ecografia',
  },
  {
    code: 'RX',
    label: 'Radiografía',
    equipmentLabel: ['equipo de rayos X', 'equipos de rayos X'],
    equipmentCodes: ['XR'],
    glossarySlug: 'modalidad-radiografia',
  },
  {
    code: 'RM',
    label: 'Resonancia magnética',
    equipmentLabel: ['resonador', 'resonadores'],
    equipmentCodes: ['MR'],
    glossarySlug: 'modalidad-resonancia-magnetica',
  },
  {
    code: 'TC',
    label: 'Tomografía computarizada',
    equipmentLabel: ['tomógrafo', 'tomógrafos'],
    equipmentCodes: ['CT'],
    glossarySlug: 'modalidad-tomografia-computarizada',
  },
  {
    code: 'MG',
    label: 'Mamografía',
    equipmentLabel: ['mamógrafo', 'mamógrafos'],
    equipmentCodes: ['MG'],
    glossarySlug: 'modalidad-mamografia',
  },
  {
    code: 'DXA',
    label: 'Densitometría ósea',
    equipmentLabel: ['densitómetro', 'densitómetros'],
    equipmentCodes: ['DX'],
    glossarySlug: 'modalidad-densitometria-osea',
  },
  {
    code: 'ECG',
    label: 'Electrocardiografía',
    equipmentLabel: ['electrocardiógrafo', 'electrocardiógrafos'],
    equipmentCodes: ['ECG'],
    glossarySlug: 'modalidad-electrocardiografia',
  },
  {
    code: 'LAB',
    label: 'Toma de muestras',
    equipmentLabel: ['puesto de extracción', 'puestos de extracción'],
    equipmentCodes: ['SAMPLING_STATION'],
    glossarySlug: 'modalidad-toma-de-muestras',
  },
];

const POR_CODIGO = new Map(MODALIDADES.map((m) => [m.code, m]));

export function modalidad(code: ModalityCode): ModalityDefinition {
  return POR_CODIGO.get(code)!;
}

export function esCodigoDeModalidad(code: string): code is ModalityCode {
  return POR_CODIGO.has(code as ModalityCode);
}

/**
 * La modalidad de cada estudio del catálogo `VS_DIAGNOSTIC_STUDY`. Es la misma
 * clasificación que `MODALIDAD_DE_ESTUDIO` del simulador (CR → RX, US → ECO,
 * MR → RM, CT → TC, BMD → DXA), con los análisis en `LAB`.
 */
const MODALIDAD_DE_ESTUDIO: Readonly<Record<string, ModalityCode>> = {
  'STUDY-RX-TORAX': 'RX',
  'STUDY-RX-COLUMNA': 'RX',
  'STUDY-ECO-ABD': 'ECO',
  'STUDY-ECO-OBSTETRICA': 'ECO',
  'STUDY-ECG': 'ECG',
  'STUDY-RMN-RODILLA': 'RM',
  'STUDY-RMN-CEREBRO': 'RM',
  'STUDY-TAC-CRANEO': 'TC',
  'STUDY-TAC-ABDOMEN': 'TC',
  'STUDY-MAMOGRAFIA': 'MG',
  'STUDY-DENSITOMETRIA': 'DXA',
  'STUDY-HEMOGRAMA': 'LAB',
  'STUDY-GLUCOSA': 'LAB',
  'STUDY-PERFIL-LIPIDICO': 'LAB',
  'STUDY-TSH': 'LAB',
  'STUDY-ORINA': 'LAB',
  'STUDY-CREATININA': 'LAB',
  'STUDY-UREA': 'LAB',
  'STUDY-HBA1C': 'LAB',
  'STUDY-COAGULACION': 'LAB',
  'STUDY-HEPATICO': 'LAB',
  'STUDY-COPROLOGICO': 'LAB',
  'STUDY-CULTIVO': 'LAB',
  'STUDY-VITAMINA-D': 'LAB',
};

/** La modalidad de un estudio, o `null` si el código no es del catálogo. */
export function modalidadDeEstudio(studyCode: string): ModalityCode | null {
  return MODALIDAD_DE_ESTUDIO[studyCode] ?? null;
}

/** La modalidad que atiende un tipo de equipo, o `null` si no limita turnos. */
export function modalidadDeEquipo(equipmentTypeCode: string): ModalityCode | null {
  return MODALIDADES.find((m) => m.equipmentCodes.includes(equipmentTypeCode))?.code ?? null;
}
