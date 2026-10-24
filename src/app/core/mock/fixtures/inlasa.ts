import { ANALISIS_INLASA, type AnalisisInlasa } from './inlasa-aranceles.generated';

/* ============================================================================
    Equivalencia entre los estudios de laboratorio de la maqueta
    (`VS_DIAGNOSTIC_STUDY`, códigos `STUDY-*`) y el análisis oficial de INLASA.

    Los códigos internos se quedan —las órdenes y los resultados del simulador
    los usan—, pero el nombre y el precio salen de INLASA. La tabla es
    explícita y revisable a mano: no se empareja por nombre parecido. Donde el
    rótulo viejo no tenía un análisis idéntico («Perfil hepático», «Tiempo de
    coagulación») el estudio pasa a ser el análisis de INLASA que se indica, con
    su nombre oficial.

    Los estudios de imagen no están acá: INLASA no hace imagenología.
    ========================================================================== */

export const EQUIVALENCIA_INLASA: Readonly<Record<string, string>> = {
  'STUDY-HEMOGRAMA': 'LAC-030', // Hemograma completo
  'STUDY-GLUCOSA': 'LAC-025', // Glucosa en sangre
  'STUDY-PERFIL-LIPIDICO': 'LAC-039', // Perfil lipídico
  'STUDY-TSH': 'LAC-071', // TSH por quimioluminiscencia
  'STUDY-ORINA': 'LAC-019', // Examen general de orina
  'STUDY-CREATININA': 'LAC-014', // Creatinina sérica
  'STUDY-UREA': 'LAC-038', // Nitrógeno ureico/urea/NUS
  'STUDY-HBA1C': 'LAC-028', // Hemoglobina A1C (glicohemoglobina)
  'STUDY-COAGULACION': 'LAC-008', // Coagulograma
  'STUDY-HEPATICO': 'LAC-053', // Transaminasas GOT y GPT
  'STUDY-COPROLOGICO': 'LEP-015', // Coproparasitológico simple
  'STUDY-CULTIVO': 'LBC-045', // Urocultivo recuento de colonia y antibiograma
  'STUDY-VITAMINA-D': 'LAC-072', // Vitamina D por quimioluminiscencia
};

/** La tarifa con que se publica un precio de INLASA: el rótulo lo distingue de uno del centro. */
export const TARIFA_INLASA = 'REFERENCIA_INLASA_2026';

const POR_CODIGO = new Map(ANALISIS_INLASA.map((a) => [a.code, a]));

/** El análisis de INLASA que corresponde a un estudio de laboratorio de la maqueta. */
export function analisisInlasaDe(studyCode: string): AnalisisInlasa | undefined {
  const codigo = EQUIVALENCIA_INLASA[studyCode];
  return codigo === undefined ? undefined : POR_CODIGO.get(codigo);
}

/** El precio de referencia de INLASA de un estudio con equivalencia; falla si no la tiene. */
export function precioInlasaDe(studyCode: string): string {
  const precio = analisisInlasaDe(studyCode)?.priceBs;
  if (precio === undefined || precio === null) {
    throw new Error(`El estudio ${studyCode} no tiene análisis de INLASA con precio en EQUIVALENCIA_INLASA.`);
  }
  return precio;
}
