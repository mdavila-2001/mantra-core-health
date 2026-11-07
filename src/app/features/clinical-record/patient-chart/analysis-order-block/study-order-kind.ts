import type { TreeSelectGroup } from '../../../../shared/components/organisms/tree-select/tree-select.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/**
 * El tipo de orden que el médico elige primero (06/11/2026): a quién va el
 * pedido y, por lo tanto, qué se le pregunta después.
 *
 * `OTHER` no es un tercer tipo que pidió el cliente: es lo que ya se podía
 * pedir desde esta pantalla —estudios cardiológicos, anatomía patológica,
 * procedimientos— y que dejaría de poder pedirse si el selector tuviera sólo
 * Laboratorio e Imagenología. Un refactor visual preserva comportamiento.
 */
export type OrderKind = 'LAB' | 'IMAGING' | 'OTHER';

export const ORDER_KIND_OPTIONS: readonly SelectOption<OrderKind>[] = [
  {
    value: 'LAB',
    label: 'Laboratorio',
    description: 'Análisis de sangre, orina, heces, fluidos o genéticos.',
  },
  {
    value: 'IMAGING',
    label: 'Imagenología',
    description: 'Rayos X, ecografía, tomografía, resonancia y similares.',
  },
  {
    value: 'OTHER',
    label: 'Otro estudio',
    description: 'Cardiología, anatomía patológica y procedimientos diagnósticos.',
  },
];

/** `clinical:LAB_X` → `LAB_X`, en mayúsculas: el catálogo nombra con y sin módulo. */
export function bareCode(code: string): string {
  const cut = code.indexOf(':');
  return (cut === -1 ? code : code.slice(cut + 1)).toUpperCase();
}

/** Lo mínimo que se necesita saber de una opción del catálogo de estudios. */
export interface StudyOption {
  readonly conceptId: string;
  readonly code: string;
  readonly label: string;
}

/* ============================================================================
   Laboratorio: el árbol por tipo de análisis
   ========================================================================== */

export type LabTypeId = 'BLOOD' | 'URINE' | 'STOOL' | 'FLUIDS' | 'GENETIC' | 'UNCLASSIFIED';

interface LabGroup {
  readonly label: string;
  readonly codes: readonly string[];
}

export interface LabType {
  readonly id: LabTypeId;
  readonly label: string;
  /** Qué reúne, en una frase: es la característica que distingue al tipo. */
  readonly summary: string;
  /**
   * Los códigos de `specimen-type` (HL7 v2-0487) que este tipo admite, o `null`
   * si admite cualquiera (un estudio genético se hace sobre muestras de muchos
   * tipos y esta pantalla no decide cuál).
   */
  readonly specimenCodes: readonly string[] | null;
  readonly groups: readonly LabGroup[];
}

/**
 * Los tipos de análisis de laboratorio y los estudios que cuelgan de cada uno.
 *
 * **Clasificación interna, pendiente de validación clínica.** No viene de una
 * fuente externa: es la que pidió el cliente (06/11/2026: «un árbol por cada
 * tipo de análisis») armada por tipo de muestra y área del laboratorio. Un
 * estudio que no está acá cae en «Otros análisis» — el catálogo puede crecer
 * sin que esta lista lo rompa — y no se inventa ninguno: el tipo «Genético»
 * existe y está vacío porque el catálogo no tiene hoy estudios genéticos.
 */
export const LAB_TYPES: readonly LabType[] = [
  {
    id: 'BLOOD',
    label: 'Sangre',
    summary: 'Análisis sobre sangre, suero o plasma.',
    specimenCodes: ['BLDV', 'SER', 'PLAS', 'BLDC', 'BLDA'],
    groups: [
      {
        label: 'Hematología',
        codes: ['LAB_HEMOGRAMA', 'LAB_VSG', 'LAB_GRUPO_RH', 'LAB_RETICULOCITOS', 'LAB_FERRITINA'],
      },
      {
        label: 'Coagulación',
        codes: ['LAB_TP_INR', 'LAB_TTPA', 'LAB_FIBRINOGENO', 'LAB_DIMERO_D'],
      },
      {
        label: 'Química sanguínea',
        codes: [
          'LAB_GLICEMIA',
          'LAB_CTOG',
          'LAB_HBA1C',
          'LAB_PERFIL_LIPIDICO',
          'LAB_CREATININA',
          'LAB_UREA',
          'LAB_ACIDO_URICO',
          'LAB_PERFIL_HEPATICO',
          'LAB_BILIRRUBINAS',
          'LAB_AMILASA',
          'LAB_LIPASA',
          'LAB_ELECTROLITOS',
          'LAB_CALCIO',
          'LAB_PROTEINAS',
          'LAB_VITAMINA_D',
          'LAB_VITAMINA_B12',
        ],
      },
      {
        label: 'Hormonas y marcadores',
        codes: [
          'LAB_PERFIL_TIROIDEO',
          'LAB_TSH',
          'LAB_PSA',
          'LAB_BETA_HCG',
          'LAB_TESTOSTERONA',
          'LAB_CORTISOL',
        ],
      },
      {
        label: 'Inflamación e inmunología',
        codes: ['LAB_PCR', 'LAB_FACTOR_REUMATOIDEO', 'LAB_ASTO'],
      },
      {
        label: 'Serología e infecciosas',
        codes: [
          'LAB_VIH',
          'LAB_VDRL',
          'LAB_HEPATITIS_B',
          'LAB_HEPATITIS_C',
          'LAB_CHAGAS',
          'LAB_DENGUE',
          'LAB_GOTA_GRUESA',
          'LAB_HEMOCULTIVO',
        ],
      },
    ],
  },
  {
    id: 'URINE',
    label: 'Orina',
    summary: 'Análisis sobre orina: al azar, de chorro medio, por sonda o de 24 horas.',
    specimenCodes: ['UR', 'URC', 'URT', 'UR24'],
    groups: [{ label: 'Orina', codes: ['LAB_ORINA', 'LAB_UROCULTIVO'] }],
  },
  {
    id: 'STOOL',
    label: 'Heces',
    summary: 'Análisis sobre materia fecal: parásitos y cultivo.',
    specimenCodes: ['STL'],
    groups: [{ label: 'Heces', codes: ['LAB_COPROPARASITOLOGICO', 'LAB_COPROCULTIVO'] }],
  },
  {
    id: 'FLUIDS',
    label: 'Fluidos y secreciones',
    summary:
      'Análisis sobre esputo, líquidos de punción, secreciones y otras muestras no sanguíneas.',
    specimenCodes: [
      'SPT',
      'CSF',
      'SNV',
      'PLR',
      'PRT',
      'AMN',
      'SEM',
      'SAL',
      'THRT',
      'NOS',
      'NPSWAB',
      'WND',
      'PUS',
      'GENV',
      'CVX',
      'URTH',
      'EAR',
      'EYE',
      'MILK',
      'GAST',
    ],
    groups: [{ label: 'Esputo y secreciones', codes: ['LAB_BACILOSCOPIA'] }],
  },
  {
    id: 'GENETIC',
    label: 'Genético',
    summary: 'Estudios del material genético de la persona.',
    specimenCodes: null,
    groups: [],
  },
];

const UNCLASSIFIED_TYPE: LabType = {
  id: 'UNCLASSIFIED',
  label: 'Otros análisis',
  summary: 'Análisis del catálogo que todavía no tienen un tipo asignado.',
  specimenCodes: null,
  groups: [],
};

const LAB_TYPE_BY_CODE: ReadonlyMap<string, LabTypeId> = new Map(
  LAB_TYPES.flatMap((type) =>
    type.groups.flatMap((group) => group.codes.map((code) => [code, type.id] as const)),
  ),
);

/** Si el código es de un estudio de laboratorio (`LAB_…`). */
export function isLabStudyCode(code: string): boolean {
  return bareCode(code).startsWith('LAB_');
}

/**
 * Los tipos que se ofrecen: los declarados y, sólo si el catálogo trae análisis
 * sin clasificar, «Otros análisis» al final.
 */
export function labTypesFor(studies: readonly StudyOption[]): readonly LabType[] {
  const labs = studies.filter((s) => isLabStudyCode(s.code));
  const sinTipo = labs.some((s) => !LAB_TYPE_BY_CODE.has(bareCode(s.code)));
  return sinTipo ? [...LAB_TYPES, UNCLASSIFIED_TYPE] : LAB_TYPES;
}

/** El tipo de un análisis, o `UNCLASSIFIED` si no está en la clasificación. */
export function labTypeOfStudy(code: string): LabTypeId {
  return LAB_TYPE_BY_CODE.get(bareCode(code)) ?? 'UNCLASSIFIED';
}

/**
 * El árbol de un tipo: sus ramas y, en cada una, los estudios que el catálogo
 * realmente tiene. Una rama sin estudios en el catálogo no se muestra.
 */
export function labTreeFor(
  typeId: LabTypeId,
  studies: readonly StudyOption[],
): readonly TreeSelectGroup<string>[] {
  const labs = studies.filter((s) => isLabStudyCode(s.code));
  if (typeId === 'UNCLASSIFIED') {
    const sueltos = labs.filter((s) => !LAB_TYPE_BY_CODE.has(bareCode(s.code)));
    return sueltos.length === 0
      ? []
      : [
          {
            label: 'Otros análisis',
            items: sueltos.map((s) => ({ value: s.conceptId, label: s.label })),
          },
        ];
  }
  const type = LAB_TYPES.find((t) => t.id === typeId);
  if (type === undefined) {
    return [];
  }
  const byCode = new Map(labs.map((s) => [bareCode(s.code), s] as const));
  return type.groups
    .map((group) => ({
      label: group.label,
      items: group.codes
        .map((code) => byCode.get(code))
        .filter((s): s is StudyOption => s !== undefined)
        .map((s) => ({ value: s.conceptId, label: s.label })),
    }))
    .filter((group) => group.items.length > 0);
}

/** Si la muestra (por su código HL7) corresponde al tipo de análisis. */
export function specimenFitsLabType(typeId: LabTypeId, specimenCode: string): boolean {
  const type = LAB_TYPES.find((t) => t.id === typeId);
  return (
    type === undefined ||
    type.specimenCodes === null ||
    type.specimenCodes.includes(bareCode(specimenCode))
  );
}

/* ============================================================================
   Imagenología: el tipo de imagen y su ficha
   ========================================================================== */

/** Una modalidad de imagen, por la clave de su concepto en `service-request-imaging-modality` (`RX`, `US`…). */
export interface ImagingModality {
  readonly code: string;
  readonly label: string;
  /** Qué hace este tipo de imagen, en una frase. */
  readonly whatItDoes: string;
  /** Qué conviene que el médico revise antes de pedirlo. */
  readonly review: readonly string[];
  /** Prefijos de los códigos de estudio del catálogo que son de esta modalidad. */
  readonly studyPrefixes: readonly string[];
}

/**
 * Los tipos de imagen y su ficha para el médico.
 *
 * **Borrador interno, sin revisión clínica ni fuente.** Son frases generales
 * redactadas por el equipo de desarrollo el 06/11/2026 a pedido del cliente
 * («qué hace la imagenología, qué debe considerar el doctor»). No son una guía
 * validada y la pantalla lo dice (`IMAGING_GUIDANCE_NOTICE`). Antes de
 * producción las revisa y las aprueba dirección médica (regla 97.5.4).
 */
export const IMAGING_MODALITIES: readonly ImagingModality[] = [
  {
    code: 'RX',
    label: 'Rayos X',
    whatItDoes:
      'Imagen del interior del cuerpo con radiación ionizante: muestra sobre todo huesos y tórax.',
    review: [
      'Si la persona puede estar embarazada, valore si el estudio es necesario antes de pedirlo.',
      'Indique la región y el lado: la proyección depende de eso.',
      'Revise si ya tiene una imagen reciente de la misma región.',
    ],
    studyPrefixes: ['IMG_RX_'],
  },
  {
    code: 'US',
    label: 'Ecografía',
    whatItDoes:
      'Imagen con ondas de sonido, sin radiación: abdomen, pelvis, tiroides, mama, partes blandas y vasos.',
    review: [
      'Algunas ecografías necesitan preparación previa: confirme con el centro que la realiza.',
      'Indique la región y, si corresponde, el lado.',
    ],
    studyPrefixes: ['IMG_ECO_'],
  },
  {
    code: 'TC',
    label: 'Tomografía computarizada',
    whatItDoes:
      'Cortes del cuerpo con rayos X procesados por computadora: detalla huesos, órganos y vasos.',
    review: [
      'Si pide contraste, revise antecedentes de alergia al contraste y la función renal.',
      'Si la persona puede estar embarazada, valore si el estudio es necesario.',
      'Elija «sin contraste», «con contraste» o «sin y con contraste» según lo que busca.',
    ],
    studyPrefixes: ['IMG_TC_'],
  },
  {
    code: 'RM',
    label: 'Resonancia magnética',
    whatItDoes:
      'Imagen con campo magnético y ondas de radio, sin radiación ionizante: cerebro, columna, articulaciones y partes blandas.',
    review: [
      'Revise implantes metálicos, marcapasos y otros dispositivos antes de pedirlo.',
      'Si pide contraste, revise la función renal.',
      'Es un estudio largo y en espacio cerrado: tenga en cuenta si la persona lo tolera.',
    ],
    studyPrefixes: ['IMG_RM_'],
  },
  {
    code: 'MG',
    label: 'Mamografía',
    whatItDoes: 'Radiografía de la mama para detectar o estudiar lesiones.',
    review: [
      'Si la persona puede estar embarazada, valore si el estudio es necesario.',
      'Indique el lado o si es bilateral.',
    ],
    studyPrefixes: ['IMG_MAMOGRAFIA'],
  },
  {
    code: 'DXA',
    label: 'Densitometría ósea',
    whatItDoes: 'Mide la densidad del hueso con una dosis muy baja de rayos X.',
    review: ['Revise si hay una densitometría anterior para comparar.'],
    studyPrefixes: ['IMG_DENSITOMETRIA'],
  },
];

/** Lo que la pantalla dice sobre el origen de la ficha de imagen. */
export const IMAGING_GUIDANCE_NOTICE =
  'Texto informativo interno, pendiente de revisión clínica: no reemplaza su criterio ni una guía validada.';

/** El código de la modalidad de un estudio de imagen, o `null` si no es de ninguna. */
export function imagingModalityCodeOf(studyCode: string): string | null {
  const code = bareCode(studyCode);
  return (
    IMAGING_MODALITIES.find((m) => m.studyPrefixes.some((p) => code.startsWith(p)))?.code ?? null
  );
}

/** Si el código es de un estudio de imagen (`IMG_…`). */
export function isImagingStudyCode(code: string): boolean {
  return bareCode(code).startsWith('IMG_');
}

/** La modalidad por el código de su concepto (con o sin módulo). */
export function imagingModalityOf(code: string | null | undefined): ImagingModality | null {
  return code == null
    ? null
    : (IMAGING_MODALITIES.find((m) => m.code === modalityKey(code)) ?? null);
}

/** `IMG_MODALITY_RX` (o `clinical:IMG_MODALITY_RX`) → `RX`: la clave con que se cruza el catálogo. */
export function modalityKey(code: string): string {
  return bareCode(code).replace(/^IMG_MODALITY_/, '');
}

/** Los estudios de imagen del catálogo, filtrados por la modalidad elegida (o todos). */
export function imagingStudyOptions(
  studies: readonly StudyOption[],
  modalityCode: string | null,
): readonly SelectOption<string>[] {
  return studies
    .filter((s) => isImagingStudyCode(s.code))
    .filter((s) => modalityCode === null || imagingModalityCodeOf(s.code) === modalityCode)
    .map((s) => ({ value: s.conceptId, label: s.label }));
}
