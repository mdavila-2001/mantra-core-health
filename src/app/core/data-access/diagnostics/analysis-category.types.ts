/**
 * Clasificación de la orden de análisis (C2, P40). La API la deriva de
 * `categoryConceptId` (laboratorio, imagen; cualquier otra categoría declarada
 * es `OTHER`) y la acepta en el alta; ausente = la orden no declara categoría.
 */
export type AnalysisCategory = 'LAB' | 'IMAGING' | 'OTHER';
