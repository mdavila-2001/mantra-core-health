/* Los `target` reales de las columnas de `clinical.conditions` que las pantallas de diagnóstico
   piden como catálogo. Viven acá y no en `diagnosis-block.ts` para que el bloque y su formulario de
   alta (`presuntivo-form`) los compartan sin importarse el uno al otro. */

/**
 * La columna que gobierna el diagnóstico.
 *
 * Se mantiene exportada porque es el `target` real de `clinical.conditions.code_concept_id`
 * — `enums-del-diagnostico.spec.ts` verifica contra este valor que el simulador
 * resuelve el catálogo correcto, independientemente de si esta pantalla ofrece
 * o no un selector para él.
 */
export const TARGET_DIAGNOSTICO = 'clinical.conditions.code_concept_id';

/** La categoría del registro (`clinical.conditions.category_concept_id`). Mismo criterio. */
export const TARGET_CATEGORIA = 'clinical.conditions.category_concept_id';

/** La severidad (`clinical.conditions.severity_concept_id`). Mismo criterio. */
export const TARGET_SEVERIDAD = 'clinical.conditions.severity_concept_id';

/** La lateralidad (`clinical.conditions.laterality_concept_id`). Mismo criterio. */
export const TARGET_LATERALIDAD = 'clinical.conditions.laterality_concept_id';

/** El curso clínico (`clinical.conditions.clinical_course_concept_id`). Mismo criterio. */
export const TARGET_CURSO_CLINICO = 'clinical.conditions.clinical_course_concept_id';
