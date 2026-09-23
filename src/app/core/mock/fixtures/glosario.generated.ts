/* ============================================================================
    El glosario médico curado, portado del backend.

    **GENERADO por `scripts/gen-glossary-fixture.mjs`. No editar a mano.**
    La fuente son `glossary-taxonomy.ts` (12 categorías, 15 etiquetas) y
    `glossary-terms.catalog.ts` (69 términos curados) de
    `mantra-core-health-api/src/common/seed/`.

    Regenerar con `yarn mock:glossary`.
    ========================================================================== */

/** Una categoría o etiqueta del glosario: clave corta, código interno y nombre. */
export interface EntradaDeTaxonomia {
  readonly key: string;
  /** `glossary-category-<key>` o `glossary-tag-<key>` — lo que viaja en la URL. */
  readonly internalCode: string;
  readonly name: string;
}

/** Una relación clínica tipada hacia otro término, por su slug. */
export interface RelacionDeTermino {
  readonly type: string;
  readonly targetSlug: string;
}

/** La ficha de medicamento, verbatim del FDA NDC Directory. */
export interface FichaDeMedicamento {
  readonly sourceNdc: string;
  readonly activeIngredients: readonly string[];
  readonly dosageForm: string;
  readonly route: readonly string[];
  readonly manufacturer: string;
}

/** Un término curado, tal como lo declara el seed del backend. */
export interface TerminoDeGlosario {
  readonly key: string;
  readonly slug: string;
  /** Clave de su única categoría. */
  readonly categoryKey: string;
  /** Claves de sus etiquetas clínicas, 0..N. */
  readonly tagKeys: readonly string[];
  readonly enDisplay: string;
  readonly esName: string;
  readonly esSynonyms?: readonly string[];
  readonly clinicalDefinitionEs: string;
  readonly clinicalDefinitionEn?: string;
  readonly plainSummaryEs: string;
  readonly plainSummaryEn?: string;
  readonly relations: readonly RelacionDeTermino[];
  readonly drugFacts?: FichaDeMedicamento;
}

/** Las 12 categorías de la grilla. Pertenencia exclusiva: un término, una categoría. */
export const CATEGORIAS_DE_GLOSARIO: readonly EntradaDeTaxonomia[] = [
  {
    key: "anatomy",
    internalCode: "glossary-category-anatomy",
    name: "Anatomía",
  },
  {
    key: "signs-symptoms",
    internalCode: "glossary-category-signs-symptoms",
    name: "Signos y síntomas",
  },
  {
    key: "disease",
    internalCode: "glossary-category-disease",
    name: "Enfermedades",
  },
  {
    key: "specialty",
    internalCode: "glossary-category-specialty",
    name: "Especialidades médicas",
  },
  {
    key: "diagnostic-test",
    internalCode: "glossary-category-diagnostic-test",
    name: "Pruebas diagnósticas",
  },
  {
    key: "procedure",
    internalCode: "glossary-category-procedure",
    name: "Procedimientos",
  },
  {
    key: "treatment",
    internalCode: "glossary-category-treatment",
    name: "Tratamientos",
  },
  {
    key: "pharmacology",
    internalCode: "glossary-category-pharmacology",
    name: "Farmacología clínica",
  },
  {
    key: "lab",
    internalCode: "glossary-category-lab",
    name: "Laboratorio",
  },
  {
    key: "imaging",
    internalCode: "glossary-category-imaging",
    name: "Imagenología",
  },
  {
    key: "care",
    internalCode: "glossary-category-care",
    name: "Cuidados de enfermería",
  },
  {
    key: "other",
    internalCode: "glossary-category-other",
    name: "Otros términos",
  },
];

/** Las 15 etiquetas clínicas. Un término lleva 0..N. */
export const ETIQUETAS_DE_GLOSARIO: readonly EntradaDeTaxonomia[] = [
  {
    key: "urgency",
    internalCode: "glossary-tag-urgency",
    name: "Urgencia",
  },
  {
    key: "chronic",
    internalCode: "glossary-tag-chronic",
    name: "Crónico",
  },
  {
    key: "pediatric",
    internalCode: "glossary-tag-pediatric",
    name: "Pediatría",
  },
  {
    key: "cardiovascular",
    internalCode: "glossary-tag-cardiovascular",
    name: "Cardiovascular",
  },
  {
    key: "respiratory",
    internalCode: "glossary-tag-respiratory",
    name: "Respiratorio",
  },
  {
    key: "endocrine",
    internalCode: "glossary-tag-endocrine",
    name: "Endocrino",
  },
  {
    key: "infectious",
    internalCode: "glossary-tag-infectious",
    name: "Infeccioso",
  },
  {
    key: "mental-health",
    internalCode: "glossary-tag-mental-health",
    name: "Salud mental",
  },
  {
    key: "musculoskeletal",
    internalCode: "glossary-tag-musculoskeletal",
    name: "Musculoesquelético",
  },
  {
    key: "digestive",
    internalCode: "glossary-tag-digestive",
    name: "Digestivo",
  },
  {
    key: "renal",
    internalCode: "glossary-tag-renal",
    name: "Renal",
  },
  {
    key: "dermatologic",
    internalCode: "glossary-tag-dermatologic",
    name: "Dermatológico",
  },
  {
    key: "oncologic",
    internalCode: "glossary-tag-oncologic",
    name: "Oncológico",
  },
  {
    key: "gyn-ob",
    internalCode: "glossary-tag-gyn-ob",
    name: "Ginecoobstétrico",
  },
  {
    key: "neurologic",
    internalCode: "glossary-tag-neurologic",
    name: "Neurológico",
  },
];

/** El value set paraguas: todo término del glosario es miembro de éste. */
export const GLOSARIO_TODOS_LOS_TERMINOS: EntradaDeTaxonomia = {
  key: "all-terms",
  internalCode: "glossary-all-terms",
  name: "Glosario médico",
};

/** Los 69 términos curados, en el orden del catálogo fuente. */
export const TERMINOS_DE_GLOSARIO: readonly TerminoDeGlosario[] = [
{
    key: "corazon",
    slug: "corazon",
    categoryKey: "anatomy",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Heart",
    esName: "Corazón",
    clinicalDefinitionEs: "Órgano muscular hueco de cuatro cámaras (dos aurículas, dos ventrículos) que impulsa la sangre a través del sistema circulatorio mediante contracciones rítmicas coordinadas por el sistema de conducción eléctrico intrínseco.",
    clinicalDefinitionEn: "Four-chambered hollow muscular organ that pumps blood through the circulatory system via rhythmic contractions coordinated by its intrinsic electrical conduction system.",
    plainSummaryEs: "Es el músculo que bombea la sangre por todo el cuerpo, como una bomba que nunca deja de trabajar.",
    plainSummaryEn: "The muscle that pumps blood around your whole body, like a pump that never stops working.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "insuficiencia-cardiaca",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "electrocardiograma",
      },
    ],
  },
{
    key: "pulmon",
    slug: "pulmon",
    categoryKey: "anatomy",
    tagKeys: [
      "respiratory",
    ],
    enDisplay: "Lung",
    esName: "Pulmón",
    clinicalDefinitionEs: "Órgano par esponjoso del sistema respiratorio donde ocurre el intercambio gaseoso entre el aire inspirado y la sangre capilar, a través de los alvéolos.",
    plainSummaryEs: "Los pulmones son los órganos con los que respiramos; toman el oxígeno del aire y lo pasan a la sangre.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "asma-bronquial",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "neumonia",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "espirometria",
      },
    ],
  },
{
    key: "higado",
    slug: "higado",
    categoryKey: "anatomy",
    tagKeys: [
      "digestive",
    ],
    enDisplay: "Liver",
    esName: "Hígado",
    clinicalDefinitionEs: "Víscera abdominal de mayor tamaño en el cuerpo humano, responsable de la síntesis proteica, la metabolización de fármacos y toxinas, la producción de bilis y el almacenamiento de glucógeno.",
    plainSummaryEs: "Es el órgano que filtra las sustancias dañinas de la sangre y ayuda a digerir los alimentos.",
    relations: [],
  },
{
    key: "rinon",
    slug: "rinon",
    categoryKey: "anatomy",
    tagKeys: [
      "renal",
    ],
    enDisplay: "Kidney",
    esName: "Riñón",
    clinicalDefinitionEs: "Órgano par retroperitoneal cuya unidad funcional es la nefrona; filtra la sangre para regular el balance hidroelectrolítico, el equilibrio ácido-base y excretar productos de desecho nitrogenados en forma de orina.",
    plainSummaryEs: "Los riñones limpian la sangre y producen la orina para eliminar lo que el cuerpo no necesita.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "enfermedad-renal-cronica",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "creatinina-serica",
      },
    ],
  },
{
    key: "encefalo",
    slug: "encefalo",
    categoryKey: "anatomy",
    tagKeys: [
      "neurologic",
    ],
    enDisplay: "Brain",
    esName: "Encéfalo (cerebro)",
    esSynonyms: [
      "Cerebro",
    ],
    clinicalDefinitionEs: "Porción del sistema nervioso central contenida en la cavidad craneal, compuesta por cerebro, cerebelo y tronco encefálico, responsable del procesamiento sensorial, motor y cognitivo.",
    plainSummaryEs: "Es el órgano que controla el pensamiento, el movimiento y las funciones del cuerpo desde la cabeza.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "cefalea",
      },
    ],
  },
{
    key: "columna-vertebral",
    slug: "columna-vertebral",
    categoryKey: "anatomy",
    tagKeys: [
      "musculoskeletal",
    ],
    enDisplay: "Spine",
    esName: "Columna vertebral",
    esSynonyms: [
      "Raquis",
    ],
    clinicalDefinitionEs: "Estructura ósea axial formada por 33 vértebras articuladas que aloja y protege la médula espinal, y provee soporte estructural al tronco.",
    plainSummaryEs: "Es la fila de huesos en la espalda que sostiene el cuerpo y protege los nervios que bajan desde el cerebro.",
    relations: [],
  },
{
    key: "disnea",
    slug: "disnea",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "respiratory",
      "cardiovascular",
      "urgency",
    ],
    enDisplay: "Dyspnea",
    esName: "Disnea",
    esSynonyms: [
      "Dificultad respiratoria",
      "Falta de aire",
    ],
    clinicalDefinitionEs: "Sensación subjetiva de dificultad o incomodidad para respirar, que puede originarse por causas cardíacas, pulmonares, metabólicas o de ansiedad; su inicio súbito y severo constituye una urgencia médica.",
    clinicalDefinitionEn: "Subjective sensation of breathing discomfort that can arise from cardiac, pulmonary, metabolic, or anxiety-related causes; sudden severe onset is a medical emergency.",
    plainSummaryEs: "Es la sensación de que cuesta respirar o de que falta el aire.",
    plainSummaryEn: "The feeling that breathing is hard or that you can't get enough air.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "insuficiencia-cardiaca",
      },
      {
        type: "DISEASE",
        targetSlug: "asma-bronquial",
      },
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
    ],
  },
{
    key: "fiebre",
    slug: "fiebre",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "infectious",
    ],
    enDisplay: "Fever",
    esName: "Fiebre",
    esSynonyms: [
      "Pirexia",
      "Hipertermia",
    ],
    clinicalDefinitionEs: "Elevación de la temperatura corporal central por encima de 38.0 °C, generalmente mediada por pirógenos como respuesta inmunológica a una infección u otro proceso inflamatorio.",
    clinicalDefinitionEn: "Elevation of core body temperature above 38.0 °C, typically pyrogen-mediated as an immune response to infection or another inflammatory process.",
    plainSummaryEs: "Es cuando el cuerpo sube de temperatura, generalmente porque está luchando contra una infección.",
    plainSummaryEn: "When your body temperature rises, usually because it's fighting an infection.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "hemograma-completo",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "proteina-c-reactiva",
      },
    ],
  },
{
    key: "cefalea",
    slug: "cefalea",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "neurologic",
    ],
    enDisplay: "Headache",
    esName: "Cefalea",
    esSynonyms: [
      "Dolor de cabeza",
    ],
    clinicalDefinitionEs: "Dolor localizado en cualquier región de la cabeza, que puede originarse por causas primarias (migraña, tensional) o secundarias a otra condición subyacente.",
    plainSummaryEs: "Es el dolor de cabeza, que puede ser leve o intenso y tener distintas causas.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "encefalo",
      },
    ],
  },
{
    key: "taquicardia",
    slug: "taquicardia",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Tachycardia",
    esName: "Taquicardia",
    clinicalDefinitionEs: "Frecuencia cardíaca en reposo superior a 100 latidos por minuto en un adulto, que puede ser fisiológica (esfuerzo, ansiedad) o patológica (arritmia, hipertiroidismo, fiebre).",
    plainSummaryEs: "Es cuando el corazón late más rápido de lo normal.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "electrocardiograma",
      },
      {
        type: "ANATOMY",
        targetSlug: "corazon",
      },
    ],
  },
{
    key: "ictericia",
    slug: "ictericia",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "digestive",
    ],
    enDisplay: "Jaundice",
    esName: "Ictericia",
    clinicalDefinitionEs: "Coloración amarillenta de piel y mucosas causada por acumulación de bilirrubina sérica, generalmente por disfunción hepática, obstrucción biliar o hemólisis.",
    plainSummaryEs: "Es cuando la piel y los ojos se ponen amarillos, casi siempre por un problema del hígado.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "higado",
      },
    ],
  },
{
    key: "edema",
    slug: "edema",
    categoryKey: "signs-symptoms",
    tagKeys: [
      "cardiovascular",
      "renal",
    ],
    enDisplay: "Edema",
    esName: "Edema",
    esSynonyms: [
      "Hinchazón",
    ],
    clinicalDefinitionEs: "Acumulación anormal de líquido en el espacio intersticial, con frecuencia visible en miembros inferiores; puede deberse a insuficiencia cardíaca, renal, hepática o venosa.",
    plainSummaryEs: "Es la hinchazón que aparece cuando se acumula líquido en el cuerpo, muy común en las piernas.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "insuficiencia-cardiaca",
      },
      {
        type: "DISEASE",
        targetSlug: "enfermedad-renal-cronica",
      },
    ],
  },
{
    key: "hipertension-arterial",
    slug: "hipertension-arterial",
    categoryKey: "disease",
    tagKeys: [
      "cardiovascular",
      "chronic",
    ],
    enDisplay: "Hypertension",
    esName: "Hipertensión arterial",
    esSynonyms: [
      "HTA",
      "Presión alta",
    ],
    clinicalDefinitionEs: "Elevación crónica y sostenida de la presión arterial sistólica ≥140 mmHg y/o diastólica ≥90 mmHg, principal factor de riesgo modificable para enfermedad cardiovascular y renal.",
    clinicalDefinitionEn: "Chronic, sustained elevation of systolic blood pressure ≥140 mmHg and/or diastolic ≥90 mmHg, the leading modifiable risk factor for cardiovascular and renal disease.",
    plainSummaryEs: "Es cuando la presión de la sangre está más alta de lo normal de forma constante.",
    plainSummaryEn: "When your blood pressure stays higher than normal all the time.",
    relations: [
      {
        type: "TREATMENT",
        targetSlug: "terapia-antihipertensiva",
      },
    ],
  },
{
    key: "diabetes-mellitus-tipo-2",
    slug: "diabetes-mellitus-tipo-2",
    categoryKey: "disease",
    tagKeys: [
      "endocrine",
      "chronic",
    ],
    enDisplay: "Type 2 diabetes mellitus",
    esName: "Diabetes mellitus tipo 2",
    esSynonyms: [
      "DM2",
      "Diabetes tipo 2",
    ],
    clinicalDefinitionEs: "Enfermedad metabólica crónica caracterizada por resistencia a la insulina y deficiencia relativa de su secreción, que produce hiperglucemia sostenida y complicaciones micro y macrovasculares a largo plazo.",
    clinicalDefinitionEn: "Chronic metabolic disease characterized by insulin resistance and relative insulin deficiency, producing sustained hyperglycemia and long-term micro- and macrovascular complications.",
    plainSummaryEs: "Es una enfermedad en la que el azúcar en la sangre se mantiene demasiado alto porque el cuerpo no usa bien la insulina.",
    plainSummaryEn: "A disease where blood sugar stays too high because the body doesn't use insulin well.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "hemoglobina-glicosilada",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "glucemia-en-ayunas",
      },
      {
        type: "TREATMENT",
        targetSlug: "insulinoterapia",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "enfermedad-renal-cronica",
      },
    ],
  },
{
    key: "asma-bronquial",
    slug: "asma-bronquial",
    categoryKey: "disease",
    tagKeys: [
      "respiratory",
      "chronic",
      "pediatric",
    ],
    enDisplay: "Bronchial asthma",
    esName: "Asma bronquial",
    esSynonyms: [
      "Asma",
    ],
    clinicalDefinitionEs: "Enfermedad inflamatoria crónica de la vía aérea caracterizada por hiperreactividad bronquial, que produce episodios recurrentes de sibilancias, disnea y tos, reversibles espontáneamente o con tratamiento.",
    plainSummaryEs: "Es una enfermedad de los pulmones que hace que a veces cueste respirar y se produzcan silbidos al respirar.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "espirometria",
      },
      {
        type: "TREATMENT",
        targetSlug: "oxigenoterapia",
      },
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "disnea",
      },
    ],
  },
{
    key: "neumonia",
    slug: "neumonia",
    categoryKey: "disease",
    tagKeys: [
      "respiratory",
      "infectious",
    ],
    enDisplay: "Pneumonia",
    esName: "Neumonía",
    clinicalDefinitionEs: "Infección aguda del parénquima pulmonar, habitualmente de origen bacteriano o viral, que produce inflamación alveolar con consolidación visible en imagen de tórax.",
    plainSummaryEs: "Es una infección de los pulmones que causa tos, fiebre y dificultad para respirar.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "radiografia-de-torax",
      },
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "fiebre",
      },
    ],
  },
{
    key: "insuficiencia-cardiaca",
    slug: "insuficiencia-cardiaca",
    categoryKey: "disease",
    tagKeys: [
      "cardiovascular",
      "chronic",
    ],
    enDisplay: "Heart failure",
    esName: "Insuficiencia cardíaca",
    esSynonyms: [
      "IC",
    ],
    clinicalDefinitionEs: "Síndrome clínico en el que el corazón es incapaz de bombear sangre en volumen suficiente para satisfacer las demandas metabólicas del organismo, o lo logra a expensas de presiones de llenado elevadas.",
    clinicalDefinitionEn: "Clinical syndrome in which the heart is unable to pump enough blood to meet the body's metabolic demands, or does so only at the cost of elevated filling pressures.",
    plainSummaryEs: "Es cuando el corazón no logra bombear la sangre tan bien como debería.",
    plainSummaryEn: "When the heart can't pump blood as well as it should.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "corazon",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "ecocardiograma",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "electrocardiograma",
      },
      {
        type: "TREATMENT",
        targetSlug: "terapia-antihipertensiva",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "disnea",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "edema",
      },
    ],
  },
{
    key: "enfermedad-renal-cronica",
    slug: "enfermedad-renal-cronica",
    categoryKey: "disease",
    tagKeys: [
      "renal",
      "chronic",
    ],
    enDisplay: "Chronic kidney disease",
    esName: "Enfermedad renal crónica",
    esSynonyms: [
      "ERC",
      "Insuficiencia renal crónica",
    ],
    clinicalDefinitionEs: "Pérdida progresiva e irreversible de la función renal a lo largo de al menos tres meses, medida por la tasa de filtración glomerular, con complicaciones metabólicas y cardiovasculares asociadas.",
    plainSummaryEs: "Es cuando los riñones dejan de funcionar bien poco a poco, con el tiempo.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "creatinina-serica",
      },
      {
        type: "TREATMENT",
        targetSlug: "terapia-de-reemplazo-renal",
      },
      {
        type: "PROCEDURE",
        targetSlug: "dialisis",
      },
    ],
  },
{
    key: "cardiologia",
    slug: "cardiologia",
    categoryKey: "specialty",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Cardiology",
    esName: "Cardiología",
    clinicalDefinitionEs: "Especialidad médica dedicada al diagnóstico y tratamiento de las enfermedades del corazón y del sistema circulatorio.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa del corazón.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "corazon",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "insuficiencia-cardiaca",
      },
    ],
  },
{
    key: "neumologia",
    slug: "neumologia",
    categoryKey: "specialty",
    tagKeys: [
      "respiratory",
    ],
    enDisplay: "Pulmonology",
    esName: "Neumología",
    clinicalDefinitionEs: "Especialidad médica que estudia el aparato respiratorio y trata sus enfermedades, incluyendo pulmones, bronquios y pleura.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa de los pulmones y la respiración.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "pulmon",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "asma-bronquial",
      },
    ],
  },
{
    key: "endocrinologia",
    slug: "endocrinologia",
    categoryKey: "specialty",
    tagKeys: [
      "endocrine",
    ],
    enDisplay: "Endocrinology",
    esName: "Endocrinología",
    clinicalDefinitionEs: "Especialidad médica que estudia el sistema endocrino y sus hormonas, y trata enfermedades como la diabetes y los trastornos tiroideos.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa de las hormonas, como en la diabetes.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
    ],
  },
{
    key: "nefrologia",
    slug: "nefrologia",
    categoryKey: "specialty",
    tagKeys: [
      "renal",
    ],
    enDisplay: "Nephrology",
    esName: "Nefrología",
    clinicalDefinitionEs: "Especialidad médica dedicada al estudio y tratamiento de las enfermedades del riñón, incluyendo la enfermedad renal crónica y los trastornos electrolíticos.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa de los riñones.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "rinon",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "enfermedad-renal-cronica",
      },
    ],
  },
{
    key: "neurologia",
    slug: "neurologia",
    categoryKey: "specialty",
    tagKeys: [
      "neurologic",
    ],
    enDisplay: "Neurology",
    esName: "Neurología",
    clinicalDefinitionEs: "Especialidad médica que diagnostica y trata las enfermedades del sistema nervioso central y periférico.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa del cerebro y los nervios.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "encefalo",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "cefalea",
      },
    ],
  },
{
    key: "pediatria",
    slug: "pediatria",
    categoryKey: "specialty",
    tagKeys: [
      "pediatric",
    ],
    enDisplay: "Pediatrics",
    esName: "Pediatría",
    clinicalDefinitionEs: "Especialidad médica dedicada a la atención integral de la salud de niños y adolescentes, desde el nacimiento hasta el final de la adolescencia.",
    plainSummaryEs: "Es la parte de la medicina que se ocupa de la salud de los niños.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "asma-bronquial",
      },
    ],
  },
{
    key: "electrocardiograma",
    slug: "electrocardiograma",
    categoryKey: "diagnostic-test",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Electrocardiogram",
    esName: "Electrocardiograma",
    esSynonyms: [
      "ECG",
      "EKG",
    ],
    clinicalDefinitionEs: "Registro gráfico no invasivo de la actividad eléctrica del corazón obtenido mediante electrodos cutáneos, utilizado para detectar arritmias, isquemia e hipertrofia.",
    clinicalDefinitionEn: "Non-invasive graphic recording of the heart's electrical activity obtained via skin electrodes, used to detect arrhythmias, ischemia, and hypertrophy.",
    plainSummaryEs: "Es un examen rápido e indoloro que registra cómo late el corazón usando electrodos en la piel.",
    plainSummaryEn: "A quick, painless test that records your heartbeat using electrodes on your skin.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "corazon",
      },
      {
        type: "DISEASE",
        targetSlug: "insuficiencia-cardiaca",
      },
      {
        type: "DISEASE",
        targetSlug: "taquicardia",
      },
    ],
  },
{
    key: "hemograma-completo",
    slug: "hemograma-completo",
    categoryKey: "diagnostic-test",
    tagKeys: [],
    enDisplay: "Complete blood count",
    esName: "Hemograma completo",
    esSynonyms: [
      "CBC",
      "Biometría hemática",
    ],
    clinicalDefinitionEs: "Análisis de sangre que cuantifica y caracteriza glóbulos rojos, glóbulos blancos y plaquetas, utilizado ampliamente para detectar anemia, infección y trastornos hematológicos.",
    plainSummaryEs: "Es un examen de sangre que revisa los glóbulos rojos, blancos y las plaquetas.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "fiebre",
      },
    ],
  },
{
    key: "glucemia-en-ayunas",
    slug: "glucemia-en-ayunas",
    categoryKey: "diagnostic-test",
    tagKeys: [
      "endocrine",
    ],
    enDisplay: "Fasting blood glucose",
    esName: "Glucemia en ayunas",
    esSynonyms: [
      "Glicemia basal",
    ],
    clinicalDefinitionEs: "Medición de la concentración de glucosa en sangre venosa tras un ayuno de al menos 8 horas, utilizada para el tamizaje y diagnóstico de diabetes mellitus.",
    plainSummaryEs: "Es un examen de sangre en ayunas que mide el azúcar para detectar diabetes.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
    ],
  },
{
    key: "radiografia-de-torax",
    slug: "radiografia-de-torax",
    categoryKey: "diagnostic-test",
    tagKeys: [
      "respiratory",
    ],
    enDisplay: "Chest X-ray",
    esName: "Radiografía de tórax",
    esSynonyms: [
      "Rx de tórax",
    ],
    clinicalDefinitionEs: "Estudio de imagen que utiliza radiación ionizante para visualizar pulmones, corazón y estructuras óseas del tórax, de primera línea ante sospecha de neumonía o patología cardiopulmonar.",
    plainSummaryEs: "Es una radiografía del pecho que muestra los pulmones y el corazón.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
      {
        type: "DISEASE",
        targetSlug: "neumonia",
      },
    ],
  },
{
    key: "espirometria",
    slug: "espirometria",
    categoryKey: "diagnostic-test",
    tagKeys: [
      "respiratory",
      "chronic",
    ],
    enDisplay: "Spirometry",
    esName: "Espirometría",
    clinicalDefinitionEs: "Prueba funcional respiratoria que mide los volúmenes y flujos de aire movilizados durante una maniobra inspiratoria y espiratoria forzada, esencial para el diagnóstico y seguimiento del asma y la EPOC.",
    plainSummaryEs: "Es un examen en el que soplas fuerte en un aparato para medir qué tan bien funcionan tus pulmones.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
      {
        type: "DISEASE",
        targetSlug: "asma-bronquial",
      },
    ],
  },
{
    key: "creatinina-serica",
    slug: "creatinina-serica",
    categoryKey: "diagnostic-test",
    tagKeys: [
      "renal",
    ],
    enDisplay: "Serum creatinine",
    esName: "Creatinina sérica",
    clinicalDefinitionEs: "Análisis de sangre que mide el producto de degradación de la creatina muscular, usado como marcador indirecto de la tasa de filtración glomerular y de la función renal.",
    plainSummaryEs: "Es un examen de sangre que muestra qué tan bien están funcionando los riñones.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
      {
        type: "DISEASE",
        targetSlug: "enfermedad-renal-cronica",
      },
    ],
  },
{
    key: "cateterismo-cardiaco",
    slug: "cateterismo-cardiaco",
    categoryKey: "procedure",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Cardiac catheterization",
    esName: "Cateterismo cardíaco",
    clinicalDefinitionEs: "Procedimiento invasivo en el que se introduce un catéter a través de un vaso periférico hasta las cavidades cardíacas o las arterias coronarias, con fines diagnósticos (coronariografía) o terapéuticos (angioplastia).",
    plainSummaryEs: "Es un procedimiento en el que se pasa un tubo delgado por una arteria hasta el corazón para revisarlo o tratarlo.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "corazon",
      },
      {
        type: "DISEASE",
        targetSlug: "insuficiencia-cardiaca",
      },
    ],
  },
{
    key: "endoscopia-digestiva-alta",
    slug: "endoscopia-digestiva-alta",
    categoryKey: "procedure",
    tagKeys: [
      "digestive",
    ],
    enDisplay: "Upper gastrointestinal endoscopy",
    esName: "Endoscopía digestiva alta",
    esSynonyms: [
      "Gastroscopía",
    ],
    clinicalDefinitionEs: "Procedimiento diagnóstico y/o terapéutico que permite la visualización directa del esófago, estómago y duodeno mediante un endoscopio flexible con cámara.",
    plainSummaryEs: "Es un examen en el que se introduce una cámara flexible por la boca para ver el estómago.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "higado",
      },
    ],
  },
{
    key: "biopsia",
    slug: "biopsia",
    categoryKey: "procedure",
    tagKeys: [
      "oncologic",
    ],
    enDisplay: "Biopsy",
    esName: "Biopsia",
    clinicalDefinitionEs: "Extracción de una muestra de tejido para su análisis histopatológico, procedimiento clave para el diagnóstico definitivo de neoplasias y otras enfermedades.",
    plainSummaryEs: "Es tomar un pequeño trozo de tejido del cuerpo para estudiarlo en el laboratorio.",
    relations: [],
  },
{
    key: "dialisis",
    slug: "dialisis",
    categoryKey: "procedure",
    tagKeys: [
      "renal",
      "chronic",
    ],
    enDisplay: "Dialysis",
    esName: "Diálisis",
    esSynonyms: [
      "Hemodiálisis",
    ],
    clinicalDefinitionEs: "Procedimiento de depuración extracorpórea o peritoneal que suple la función excretora del riñón en pacientes con enfermedad renal avanzada, removiendo solutos y exceso de líquido.",
    plainSummaryEs: "Es un tratamiento que limpia la sangre cuando los riñones ya no pueden hacerlo bien.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
      {
        type: "DISEASE",
        targetSlug: "enfermedad-renal-cronica",
      },
      {
        type: "TREATMENT",
        targetSlug: "terapia-de-reemplazo-renal",
      },
    ],
  },
{
    key: "intubacion-endotraqueal",
    slug: "intubacion-endotraqueal",
    categoryKey: "procedure",
    tagKeys: [
      "respiratory",
      "urgency",
    ],
    enDisplay: "Endotracheal intubation",
    esName: "Intubación endotraqueal",
    clinicalDefinitionEs: "Colocación de un tubo a través de la tráquea para asegurar y proteger la vía aérea y permitir la ventilación mecánica en pacientes con insuficiencia respiratoria grave o bajo anestesia general.",
    plainSummaryEs: "Es poner un tubo por la garganta hasta la tráquea para ayudar a respirar a alguien muy grave.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
      {
        type: "TREATMENT",
        targetSlug: "oxigenoterapia",
      },
    ],
  },
{
    key: "terapia-de-reemplazo-renal",
    slug: "terapia-de-reemplazo-renal",
    categoryKey: "treatment",
    tagKeys: [
      "renal",
      "chronic",
    ],
    enDisplay: "Renal replacement therapy",
    esName: "Terapia de reemplazo renal",
    esSynonyms: [
      "TRR",
    ],
    clinicalDefinitionEs: "Conjunto de tratamientos (hemodiálisis, diálisis peritoneal o trasplante renal) que sustituyen la función excretora del riñón cuando la enfermedad renal alcanza un estadio avanzado.",
    plainSummaryEs: "Son los tratamientos que reemplazan el trabajo de los riñones cuando ya no funcionan bien.",
    relations: [
      {
        type: "PROCEDURE",
        targetSlug: "dialisis",
      },
      {
        type: "DISEASE",
        targetSlug: "enfermedad-renal-cronica",
      },
    ],
  },
{
    key: "insulinoterapia",
    slug: "insulinoterapia",
    categoryKey: "treatment",
    tagKeys: [
      "endocrine",
      "chronic",
    ],
    enDisplay: "Insulin therapy",
    esName: "Insulinoterapia",
    clinicalDefinitionEs: "Administración exógena de insulina, subcutánea o intravenosa, para el control glucémico en diabetes tipo 1 y en diabetes tipo 2 avanzada o descompensada.",
    plainSummaryEs: "Es aplicarse insulina para controlar el azúcar en la sangre.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "metformina",
      },
    ],
  },
{
    key: "quimioterapia",
    slug: "quimioterapia",
    categoryKey: "treatment",
    tagKeys: [
      "oncologic",
    ],
    enDisplay: "Chemotherapy",
    esName: "Quimioterapia",
    clinicalDefinitionEs: "Tratamiento sistémico con fármacos citotóxicos o antineoplásicos destinado a destruir células cancerosas o inhibir su proliferación.",
    plainSummaryEs: "Es un tratamiento con medicamentos fuertes para combatir el cáncer.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "biopsia",
      },
    ],
  },
{
    key: "oxigenoterapia",
    slug: "oxigenoterapia",
    categoryKey: "treatment",
    tagKeys: [
      "respiratory",
      "urgency",
    ],
    enDisplay: "Oxygen therapy",
    esName: "Oxigenoterapia",
    clinicalDefinitionEs: "Administración terapéutica de oxígeno suplementario para corregir o prevenir la hipoxemia en pacientes con insuficiencia respiratoria.",
    plainSummaryEs: "Es dar oxígeno extra a una persona que tiene dificultad para respirar.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "asma-bronquial",
      },
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
    ],
  },
{
    key: "fisioterapia-respiratoria",
    slug: "fisioterapia-respiratoria",
    categoryKey: "treatment",
    tagKeys: [
      "respiratory",
    ],
    enDisplay: "Respiratory physiotherapy",
    esName: "Fisioterapia respiratoria",
    clinicalDefinitionEs: "Conjunto de técnicas manuales e instrumentales orientadas a mejorar la ventilación, movilizar secreciones bronquiales y optimizar la mecánica respiratoria.",
    plainSummaryEs: "Son ejercicios y técnicas para ayudar a respirar mejor y sacar las flemas.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "pulmon",
      },
    ],
  },
{
    key: "terapia-antihipertensiva",
    slug: "terapia-antihipertensiva",
    categoryKey: "treatment",
    tagKeys: [
      "cardiovascular",
      "chronic",
    ],
    enDisplay: "Antihypertensive therapy",
    esName: "Terapia antihipertensiva",
    clinicalDefinitionEs: "Tratamiento farmacológico y no farmacológico dirigido a reducir y mantener controladas las cifras de presión arterial, disminuyendo el riesgo cardiovascular y renal a largo plazo.",
    plainSummaryEs: "Es el tratamiento para bajar y controlar la presión arterial alta.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "hipertension-arterial",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "losartan",
      },
    ],
  },
{
    key: "metformina",
    slug: "metformina",
    categoryKey: "pharmacology",
    tagKeys: [
      "endocrine",
    ],
    enDisplay: "Metformin",
    esName: "Metformina",
    clinicalDefinitionEs: "Biguanida de primera línea en el tratamiento de la diabetes tipo 2, que reduce la producción hepática de glucosa y mejora la sensibilidad periférica a la insulina.",
    plainSummaryEs: "Es el medicamento más usado para controlar el azúcar en la diabetes tipo 2.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
    ],
    drugFacts: {
      sourceNdc: "0378-6001",
      activeIngredients: [
        "METFORMIN HYDROCHLORIDE 1000 mg/1",
      ],
      dosageForm: "TABLET, FILM COATED, EXTENDED RELEASE",
      route: [
        "ORAL",
      ],
      manufacturer: "Mylan Pharmaceuticals Inc.",
    },
  },
{
    key: "losartan",
    slug: "losartan",
    categoryKey: "pharmacology",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Losartan",
    esName: "Losartán",
    clinicalDefinitionEs: "Antagonista del receptor de angiotensina II (ARA-II) indicado en el tratamiento de la hipertensión arterial y en la nefroprotección de pacientes diabéticos.",
    plainSummaryEs: "Es un medicamento para bajar la presión arterial.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "hipertension-arterial",
      },
    ],
    drugFacts: {
      sourceNdc: "0615-7958",
      activeIngredients: [
        "LOSARTAN POTASSIUM 25 mg/1",
      ],
      dosageForm: "TABLET, FILM COATED",
      route: [
        "ORAL",
      ],
      manufacturer: "NCS HealthCare of KY, LLC dba Vangard Labs",
    },
  },
{
    key: "salbutamol",
    slug: "salbutamol",
    categoryKey: "pharmacology",
    tagKeys: [
      "respiratory",
    ],
    enDisplay: "Salbutamol (albuterol)",
    esName: "Salbutamol",
    esSynonyms: [
      "Albuterol",
    ],
    clinicalDefinitionEs: "Agonista beta-2 adrenérgico de acción corta, broncodilatador de rescate de primera línea en las crisis de asma y broncoespasmo agudo.",
    plainSummaryEs: "Es el inhalador que se usa para abrir rápido los bronquios cuando cuesta respirar.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "asma-bronquial",
      },
    ],
    drugFacts: {
      sourceNdc: "0054-0742",
      activeIngredients: [
        "ALBUTEROL SULFATE 90 ug/1",
      ],
      dosageForm: "AEROSOL, METERED",
      route: [
        "RESPIRATORY (INHALATION)",
      ],
      manufacturer: "Hikma Pharmaceuticals USA Inc.",
    },
  },
{
    key: "amoxicilina",
    slug: "amoxicilina",
    categoryKey: "pharmacology",
    tagKeys: [
      "infectious",
    ],
    enDisplay: "Amoxicillin",
    esName: "Amoxicilina",
    clinicalDefinitionEs: "Antibiótico betalactámico de amplio espectro, de primera línea para infecciones respiratorias, urinarias y de tejidos blandos por gérmenes susceptibles.",
    plainSummaryEs: "Es un antibiótico muy usado para tratar infecciones bacterianas.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "neumonia",
      },
    ],
    drugFacts: {
      sourceNdc: "0093-2263",
      activeIngredients: [
        "AMOXICILLIN 500 mg/1",
      ],
      dosageForm: "TABLET, FILM COATED",
      route: [
        "ORAL",
      ],
      manufacturer: "Teva Pharmaceuticals USA, Inc.",
    },
  },
{
    key: "paracetamol",
    slug: "paracetamol",
    categoryKey: "pharmacology",
    tagKeys: [],
    enDisplay: "Acetaminophen (paracetamol)",
    esName: "Paracetamol",
    esSynonyms: [
      "Acetaminofén",
    ],
    clinicalDefinitionEs: "Analgésico y antipirético de primera línea, de mecanismo central, ampliamente utilizado para dolor leve a moderado y fiebre.",
    plainSummaryEs: "Es el medicamento más común para bajar la fiebre y calmar el dolor.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "fiebre",
      },
    ],
    drugFacts: {
      sourceNdc: "0121-0657",
      activeIngredients: [
        "ACETAMINOPHEN 160 mg/5mL",
      ],
      dosageForm: "SOLUTION",
      route: [
        "ORAL",
      ],
      manufacturer: "PAI Holdings, LLC dba PAI Pharma",
    },
  },
{
    key: "warfarina",
    slug: "warfarina",
    categoryKey: "pharmacology",
    tagKeys: [
      "cardiovascular",
      "chronic",
    ],
    enDisplay: "Warfarin",
    esName: "Warfarina",
    clinicalDefinitionEs: "Anticoagulante oral antagonista de la vitamina K, utilizado en la prevención de eventos tromboembólicos, que requiere monitoreo periódico del tiempo de protrombina/INR.",
    plainSummaryEs: "Es un medicamento que hace la sangre más líquida para evitar coágulos.",
    relations: [
      {
        type: "DIAGNOSTIC_TEST",
        targetSlug: "tiempo-de-protrombina",
      },
    ],
    drugFacts: {
      sourceNdc: "0093-1712",
      activeIngredients: [
        "WARFARIN SODIUM 1 mg/1",
      ],
      dosageForm: "TABLET",
      route: [
        "ORAL",
      ],
      manufacturer: "Teva Pharmaceuticals USA, Inc.",
    },
  },
{
    key: "hemoglobina-glicosilada",
    slug: "hemoglobina-glicosilada",
    categoryKey: "lab",
    tagKeys: [
      "endocrine",
      "chronic",
    ],
    enDisplay: "Glycated hemoglobin (HbA1c)",
    esName: "Hemoglobina glicosilada",
    esSynonyms: [
      "HbA1c",
    ],
    clinicalDefinitionEs: "Análisis de sangre que refleja el promedio de glucemia de los últimos 2 a 3 meses, utilizado para el diagnóstico y seguimiento del control glucémico en diabetes.",
    plainSummaryEs: "Es un examen de sangre que muestra cómo ha estado el azúcar en los últimos meses.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
    ],
  },
{
    key: "perfil-lipidico",
    slug: "perfil-lipidico",
    categoryKey: "lab",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Lipid panel",
    esName: "Perfil lipídico",
    clinicalDefinitionEs: "Panel de análisis de sangre que mide colesterol total, LDL, HDL y triglicéridos, utilizado para evaluar el riesgo cardiovascular.",
    plainSummaryEs: "Es un examen de sangre que mide el colesterol y las grasas en la sangre.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "hipertension-arterial",
      },
    ],
  },
{
    key: "proteina-c-reactiva",
    slug: "proteina-c-reactiva",
    categoryKey: "lab",
    tagKeys: [
      "infectious",
    ],
    enDisplay: "C-reactive protein (CRP)",
    esName: "Proteína C reactiva",
    esSynonyms: [
      "PCR",
    ],
    clinicalDefinitionEs: "Reactante de fase aguda producido por el hígado en respuesta a la inflamación sistémica, utilizado como marcador inespecífico de infección o inflamación.",
    plainSummaryEs: "Es un examen de sangre que muestra si hay inflamación o infección en el cuerpo.",
    relations: [
      {
        type: "DISEASE",
        targetSlug: "fiebre",
      },
    ],
  },
{
    key: "tiempo-de-protrombina",
    slug: "tiempo-de-protrombina",
    categoryKey: "lab",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Prothrombin time (INR)",
    esName: "Tiempo de protrombina",
    esSynonyms: [
      "INR",
      "TP",
    ],
    clinicalDefinitionEs: "Prueba de coagulación que mide el tiempo que tarda el plasma en coagular por la vía extrínseca, estandarizada como INR, esencial para el monitoreo de la terapia con warfarina.",
    plainSummaryEs: "Es un examen de sangre para ver qué tan rápido coagula la sangre.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "warfarina",
      },
    ],
  },
{
    key: "urocultivo",
    slug: "urocultivo",
    categoryKey: "lab",
    tagKeys: [
      "renal",
      "infectious",
    ],
    enDisplay: "Urine culture",
    esName: "Urocultivo",
    clinicalDefinitionEs: "Cultivo microbiológico de una muestra de orina utilizado para identificar el microorganismo causante de una infección del tracto urinario y su sensibilidad antibiótica.",
    plainSummaryEs: "Es un examen de orina que busca bacterias que causan infecciones urinarias.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
    ],
  },
{
    key: "electrolitos-sericos",
    slug: "electrolitos-sericos",
    categoryKey: "lab",
    tagKeys: [
      "renal",
    ],
    enDisplay: "Serum electrolytes",
    esName: "Electrolitos séricos",
    clinicalDefinitionEs: "Panel de análisis de sangre que mide sodio, potasio, cloro y bicarbonato, esencial en la evaluación de la función renal y el equilibrio ácido-base.",
    plainSummaryEs: "Es un examen de sangre que mide las sales del cuerpo, como el sodio y el potasio.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
    ],
  },
{
    key: "tomografia-computarizada",
    slug: "tomografia-computarizada",
    categoryKey: "imaging",
    tagKeys: [],
    enDisplay: "Computed tomography (CT)",
    esName: "Tomografía computarizada",
    esSynonyms: [
      "TAC",
      "TC",
    ],
    clinicalDefinitionEs: "Técnica de imagen que utiliza rayos X procesados por computadora para generar imágenes transversales detalladas de estructuras internas del cuerpo.",
    plainSummaryEs: "Es un examen que toma muchas radiografías para armar una imagen detallada por dentro del cuerpo.",
    relations: [],
  },
{
    key: "resonancia-magnetica",
    slug: "resonancia-magnetica",
    categoryKey: "imaging",
    tagKeys: [
      "neurologic",
    ],
    enDisplay: "Magnetic resonance imaging (MRI)",
    esName: "Resonancia magnética",
    esSynonyms: [
      "RM",
      "RMN",
    ],
    clinicalDefinitionEs: "Técnica de imagen no ionizante que utiliza campos magnéticos y ondas de radiofrecuencia para generar imágenes de alta resolución de tejidos blandos, especialmente útil en patología neurológica y musculoesquelética.",
    plainSummaryEs: "Es un examen que usa imanes para tomar fotos muy detalladas del interior del cuerpo, sin radiación.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "encefalo",
      },
    ],
  },
{
    key: "ecografia-abdominal",
    slug: "ecografia-abdominal",
    categoryKey: "imaging",
    tagKeys: [
      "digestive",
    ],
    enDisplay: "Abdominal ultrasound",
    esName: "Ecografía abdominal",
    esSynonyms: [
      "Ecosonografía abdominal",
    ],
    clinicalDefinitionEs: "Estudio de imagen no invasivo que utiliza ultrasonido para visualizar órganos abdominales como hígado, vesícula biliar, riñones y páncreas.",
    plainSummaryEs: "Es un examen con ondas de sonido que muestra los órganos del abdomen sin usar radiación.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "higado",
      },
      {
        type: "ANATOMY",
        targetSlug: "rinon",
      },
    ],
  },
{
    key: "mamografia",
    slug: "mamografia",
    categoryKey: "imaging",
    tagKeys: [
      "oncologic",
      "gyn-ob",
    ],
    enDisplay: "Mammography",
    esName: "Mamografía",
    clinicalDefinitionEs: "Estudio radiológico de la glándula mamaria utilizado como método de tamizaje y diagnóstico para la detección temprana del cáncer de mama.",
    plainSummaryEs: "Es una radiografía de las mamas que ayuda a detectar el cáncer de mama a tiempo.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "biopsia",
      },
    ],
  },
{
    key: "ecocardiograma",
    slug: "ecocardiograma",
    categoryKey: "imaging",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Echocardiogram",
    esName: "Ecocardiograma",
    esSynonyms: [
      "Eco cardíaco",
    ],
    clinicalDefinitionEs: "Estudio de ultrasonido que evalúa la estructura y función cardíaca en tiempo real, incluyendo la fracción de eyección y la función valvular.",
    plainSummaryEs: "Es un examen con ondas de sonido que muestra cómo funciona el corazón por dentro.",
    relations: [
      {
        type: "ANATOMY",
        targetSlug: "corazon",
      },
      {
        type: "DISEASE",
        targetSlug: "insuficiencia-cardiaca",
      },
    ],
  },
{
    key: "angiografia",
    slug: "angiografia",
    categoryKey: "imaging",
    tagKeys: [
      "cardiovascular",
    ],
    enDisplay: "Angiography",
    esName: "Angiografía",
    clinicalDefinitionEs: "Estudio de imagen que visualiza el interior de vasos sanguíneos mediante la inyección de un medio de contraste, utilizado para diagnosticar obstrucciones o malformaciones vasculares.",
    plainSummaryEs: "Es un examen que muestra los vasos sanguíneos usando un contraste inyectado.",
    relations: [
      {
        type: "PROCEDURE",
        targetSlug: "cateterismo-cardiaco",
      },
    ],
  },
{
    key: "signos-vitales",
    slug: "signos-vitales",
    categoryKey: "care",
    tagKeys: [],
    enDisplay: "Vital signs",
    esName: "Signos vitales",
    clinicalDefinitionEs: "Conjunto de parámetros fisiológicos básicos —frecuencia cardíaca, frecuencia respiratoria, presión arterial, temperatura y saturación de oxígeno— que reflejan el estado funcional del organismo y se monitorizan de forma rutinaria en la práctica clínica.",
    plainSummaryEs: "Son las mediciones básicas del cuerpo, como el pulso, la presión y la temperatura.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "fiebre",
      },
      {
        type: "RELATED_TERM",
        targetSlug: "taquicardia",
      },
    ],
  },
{
    key: "plan-de-cuidados-de-enfermeria",
    slug: "plan-de-cuidados-de-enfermeria",
    categoryKey: "care",
    tagKeys: [],
    enDisplay: "Nursing care plan",
    esName: "Plan de cuidados de enfermería",
    clinicalDefinitionEs: "Documento estructurado que guía la atención de enfermería, formulado a partir de la valoración, diagnóstico, planificación, ejecución y evaluación de las necesidades del paciente.",
    plainSummaryEs: "Es el plan que sigue el personal de enfermería para cuidar a un paciente de forma ordenada.",
    relations: [],
  },
{
    key: "prevencion-de-ulceras-por-presion",
    slug: "prevencion-de-ulceras-por-presion",
    categoryKey: "care",
    tagKeys: [
      "chronic",
    ],
    enDisplay: "Pressure ulcer prevention",
    esName: "Prevención de úlceras por presión",
    clinicalDefinitionEs: "Conjunto de intervenciones de enfermería —cambios posturales, superficies especiales, cuidado de la piel— orientadas a evitar la lesión tisular localizada causada por presión sostenida, frecuente en pacientes con movilidad reducida.",
    plainSummaryEs: "Son los cuidados para evitar que se formen heridas en la piel por estar mucho tiempo en la misma posición.",
    relations: [],
  },
{
    key: "administracion-de-medicamentos",
    slug: "administracion-de-medicamentos",
    categoryKey: "care",
    tagKeys: [],
    enDisplay: "Medication administration",
    esName: "Administración de medicamentos",
    clinicalDefinitionEs: "Proceso clínico de enfermería que garantiza la entrega segura de un fármaco al paciente correcto, en la dosis, vía y horario correctos, verificando alergias e interacciones previas.",
    plainSummaryEs: "Es el proceso de dar los medicamentos a un paciente de forma segura y en el momento correcto.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "insulinoterapia",
      },
    ],
  },
{
    key: "educacion-al-paciente",
    slug: "educacion-al-paciente",
    categoryKey: "care",
    tagKeys: [
      "chronic",
    ],
    enDisplay: "Patient education",
    esName: "Educación al paciente",
    clinicalDefinitionEs: "Proceso planificado de enseñanza dirigido al paciente y su familia sobre su condición de salud, tratamiento y autocuidado, orientado a mejorar la adherencia y los resultados clínicos.",
    plainSummaryEs: "Es cuando el personal de salud explica al paciente y su familia cómo cuidarse.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "diabetes-mellitus-tipo-2",
      },
    ],
  },
{
    key: "consentimiento-informado",
    slug: "consentimiento-informado",
    categoryKey: "other",
    tagKeys: [],
    enDisplay: "Informed consent",
    esName: "Consentimiento informado",
    esSynonyms: [
      "Consentimiento del paciente",
    ],
    clinicalDefinitionEs: "Proceso por el cual una persona autoriza un procedimiento, estudio o tratamiento después de haber recibido información comprensible sobre su naturaleza, beneficios, riesgos y alternativas, y de haber tenido oportunidad de resolver sus dudas.",
    plainSummaryEs: "Es cuando el equipo de salud te explica bien un estudio o tratamiento, y vos decidís si lo aceptás después de entenderlo.",
    relations: [],
  },
{
    key: "historia-clinica",
    slug: "historia-clinica",
    categoryKey: "other",
    tagKeys: [],
    enDisplay: "Medical record",
    esName: "Historia clínica",
    esSynonyms: [
      "Expediente clínico",
      "Ficha clínica",
    ],
    clinicalDefinitionEs: "Documento —físico o electrónico— que reúne de forma cronológica los datos clínicos, diagnósticos, tratamientos y evolución de una persona a lo largo de su atención en salud.",
    plainSummaryEs: "Es el registro donde queda anotado todo lo que te atendieron: consultas, diagnósticos y tratamientos.",
    relations: [],
  },
{
    key: "alta-medica",
    slug: "alta-medica",
    categoryKey: "other",
    tagKeys: [],
    enDisplay: "Medical discharge",
    esName: "Alta médica",
    clinicalDefinitionEs: "Decisión clínica que da por finalizada una internación o un episodio de atención, porque el estado del paciente ya no requiere ese nivel de cuidado.",
    plainSummaryEs: "Es cuando el médico determina que ya podés irte del hospital o terminar un tratamiento.",
    relations: [],
  },
{
    key: "receta-medica",
    slug: "receta-medica",
    categoryKey: "other",
    tagKeys: [],
    enDisplay: "Medical prescription",
    esName: "Receta médica",
    esSynonyms: [
      "Prescripción médica",
    ],
    clinicalDefinitionEs: "Documento emitido por un profesional habilitado que indica el medicamento, la dosis y la duración del tratamiento que una persona debe seguir.",
    plainSummaryEs: "Es el papel (o mensaje digital) donde el médico te indica qué medicamento tomar y cómo.",
    relations: [
      {
        type: "RELATED_TERM",
        targetSlug: "paracetamol",
      },
    ],
  },
{
    key: "interconsulta",
    slug: "interconsulta",
    categoryKey: "other",
    tagKeys: [],
    enDisplay: "Referral (specialist consultation)",
    esName: "Interconsulta",
    esSynonyms: [
      "Referencia médica",
      "Segunda opinión médica",
    ],
    clinicalDefinitionEs: "Solicitud que hace un profesional de salud para que otra especialidad evalúe a un paciente y aporte su criterio sobre el diagnóstico o el tratamiento.",
    plainSummaryEs: "Es cuando tu médico te deriva a otro especialista para que también te revise.",
    relations: [],
  },
];
