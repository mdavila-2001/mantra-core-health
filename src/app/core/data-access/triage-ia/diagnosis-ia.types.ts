/* ============================================================================
    Lo que responde el apoyo al diagnóstico de AlovidaAIService
    (`POST /v1/diagnosis/suggest`), reducido a lo que la pantalla usa.

    El contrato completo está en `docs/contracts/openapi.json` de ese
    repositorio. Acá se declara sólo lo que se lee: si el servicio agrega
    campos, esta pantalla no se entera ni se rompe.

    **No es un diagnóstico.** El servicio propone slugs de su glosario, el
    catálogo de acá filtra —sólo se registra lo que resuelve contra el
    catálogo de terminología— y quien atiende confirma o rechaza. Toda
    respuesta trae `disclaimer`, y la pantalla lo muestra siempre.
    ========================================================================== */

/** Con qué categoría se pide una orden: `SRQ-LAB`, `SRQ-IMAGING`, `SRQ-OTHER`. */
export type CategoriaDeOrdenIa = 'LAB' | 'IMAGING' | 'OTHER';

/** Una prueba que el catálogo del servicio relaciona con una enfermedad. */
export interface PruebaSugeridaIa {
  readonly slug: string;
  /** El LOINC de la fila, si lo tiene. */
  readonly code: string | null;
  readonly codeSystem: string | null;
  readonly label: string;
  readonly category: CategoriaDeOrdenIa;
}

/** Un diagnóstico tentativo del glosario del servicio, con su puntaje. */
export interface DiagnosticoTentativoIa {
  readonly slug: string;
  /** El ICD-10-CM de la fila (`J18.9`), si lo tiene. */
  readonly code: string | null;
  readonly codeSystem: string | null;
  readonly label: string;
  /** 0 a 1. */
  readonly score: number;
  /** «Por fiebre, tos y dolor de pecho.» */
  readonly why: string;
  readonly matchedSymptoms: readonly string[];
  readonly suggestedTests: readonly PruebaSugeridaIa[];
}

/** Una orden sugerida, con los diagnósticos que la motivan. */
export interface OrdenSugeridaIa extends PruebaSugeridaIa {
  readonly forDiagnoses: readonly string[];
}

/** La sugerencia completa. */
export interface SugerenciaIa {
  /** `model` si un LLM participó; `catalog` si respondió sólo el catálogo. */
  readonly source: 'model' | 'catalog';
  readonly recognized: boolean;
  readonly symptoms: readonly { readonly code: string; readonly label: string }[];
  readonly tentativeDiagnoses: readonly DiagnosticoTentativoIa[];
  readonly suggestedOrders: readonly OrdenSugeridaIa[];
  readonly disclaimer: string;
  readonly knowledgeVersion: string;
}

/** Una pregunta del formulario con lo que se respondió, en palabras. */
export interface RespuestaDeFormulario {
  readonly question: string;
  readonly answer: string;
}

/**
 * Lo que se le manda al servicio.
 *
 * `patient` admite sólo edad y sexo: el servicio no acepta identificadores y
 * no registra nada. Esta pantalla hoy no lo manda —no tiene de dónde leerlos
 * sin pedir el perfil— y el puntaje no depende de ellos.
 */
export interface PeticionDeSugerencia {
  readonly answers?: readonly RespuestaDeFormulario[];
  readonly symptomCodes?: readonly string[];
  readonly freeText?: string;
  readonly patient?: { readonly ageYears?: number; readonly sex?: 'F' | 'M' | 'X' };
}
