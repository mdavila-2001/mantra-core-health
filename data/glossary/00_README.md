# Corpus del glosario médico — capas, procedencia y esquema

Este directorio es **la fuente de verdad del glosario ampliado** que consumen tres cosas:

1. el simulador del front (`scripts/gen-glossary-fixture.mjs` → `src/app/core/mock/fixtures/glosario.generated.ts`, `yarn mock:glossary`);
2. el servicio de IA (`AlovidaAIService`, `yarn catalog:sync <front>` lo copia pinneado a SHA — no se edita allá);
3. la API real, cuando se quiera: cada archivo es **NDJSON compatible con el perfil `conceptos`** del motor de carga masiva (`code`, `display`, `definition`; el resto de columnas las ignora).

Los 69 términos **curados y revisados médicamente** siguen viviendo en el seed del backend
(`mantra-core-health-api/src/common/seed/glossary-terms.catalog.ts`) y el generador los lee de ahí.
Acá viven las **capas adicionales**. Ningún archivo de acá reemplaza un término curado: si una fila
trae el `slug` de un curado, el generador la trata como **enriquecimiento** (agrega `externalCode`,
`symptomIds`, relaciones nuevas) y **nunca pisa** definición, resumen ni sinónimos revisados.

## Las capas

| Archivo                                 | Qué es                                                                                                                                                                                                                                            | Fuente                                                                                                                                                                                                                                                                                                                                           | Licencia / condición                                                                                                                                                         | `lang` | `reviewStatus`           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------ |
| `cie10cm-categorias.generated.ndjson`   | Las **1 918 categorías de 3 caracteres** de ICD-10-CM FY2026 (código + título oficial en inglés). **Sin definición**: la fuente no la trae y no se fabrica.                                                                                       | CMS, «2026 Code Descriptions in Tabular Order» — `https://www.cms.gov/files/zip/2026-code-descriptions-tabular-order.zip`, archivo `icd10cm_order_2026.txt` (layout en `icd10OrderFiles.pdf` del mismo ZIP). Obtenido el 2026-09-25 por `scripts/fetch-icd10cm-categories.mjs`; metadatos y SHA-256 en `cie10cm-categorias.generated.meta.json`. | Obra del gobierno federal de EE. UU. (CMS/NCHS), dominio público.                                                                                                            | `en`   | `external-source`        |
| `enfermedades-atencion-primaria.ndjson` | Enfermedades y condiciones frecuentes en atención primaria, con código ICD-10-CM, nombre en castellano, sinónimos, definición clínica, resumen llano, etiquetas, **síntomas del motor** (`symptomIds`) y **relaciones** a pruebas y tratamientos. | Código y título en inglés (`enDisplay`): ICD-10-CM FY2026 (misma fuente de arriba), verificados con `scripts/verify-external-codes.mjs` contra el NLM Clinical Table Search Service. Nombre ES, sinónimos, definición y resumen: **texto original escrito por el equipo de desarrollo el 2026-09-25**, no extraído de otra fuente.               | Código/título: dominio público. Texto ES: propio del proyecto.                                                                                                               | `es`   | `pending-medical-review` |
| `analisis-frecuentes.ndjson`            | Análisis de laboratorio, imagen y pruebas funcionales que se piden con frecuencia, con código LOINC, nombre ES, definición, resumen y la categoría de orden (`LAB` / `IMAGING` / `OTHER`).                                                        | Código y nombre oficial (`enDisplay`): LOINC, vía NLM Clinical Table Search Service `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search`, verificados con `scripts/verify-external-codes.mjs`. Texto ES: propio, 2026-09-25.                                                                                                           | LOINC® es propiedad de Regenstrief Institute, Inc.; uso gratuito bajo la licencia LOINC (`https://loinc.org/license/`), con atribución. Se guardan **sólo** código y nombre. | `es`   | `pending-medical-review` |

### Qué significa `pending-medical-review` — leer antes de usar en producción

Las definiciones, los resúmenes y, sobre todo, las **relaciones enfermedad → síntoma y enfermedad →
prueba** de las capas ES **no tienen revisión médica ni un dataset fuente detrás**: son orientación
curada por desarrollo para que el servicio de IA tenga vocabulario y para que la maqueta muestre
fichas completas. Es el mismo estatus que declara la tabla de síntomas del front
(`src/app/features/symptom-check/sintomas.datos.ts`: «falta que el equipo médico las revise»). Antes de
promover una fila a un catálogo real hay que revisarla y cambiar su `reviewStatus` a
`medically-reviewed`. El servicio de IA no decide con esto: propone, el catálogo filtra y **el médico
confirma o rechaza** (decisión P4-4 del plan del paquete).

### Lo que **no** está acá, a propósito

- Definiciones para las 1 918 categorías ICD-10-CM: la fuente no las publica y escribirlas sin fuente
  ni revisión sería fabricar un catálogo (regla 97.4).
- Dosis, contraindicaciones, interacciones o valores de referencia: requieren fuente con procedencia y
  revisión humana (regla 97.5.4). Las filas de análisis no traen rangos.
- Códigos ICD-10-CM completos (74 719 hojas): están en la API por `tools/terminology-import/import-icd10cm.mjs`;
  acá alcanza con las categorías para que la IA nunca invente un código fuera del espacio real.

## Esquema de fila

Una fila por línea, JSON válido, sin comentarios. Las tres primeras columnas son las del perfil
`conceptos` del motor de carga masiva; el resto son extensiones que lee `gen-glossary-fixture.mjs`.

| Campo              | Obligatorio  | Qué es                                                                                                                                                                                                            |
| ------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `code`             | sí           | Código dentro de su sistema (`J45`, `58410-2`). Único dentro del archivo.                                                                                                                                         |
| `display`          | sí           | Nombre que se muestra: en castellano en las capas ES, el título oficial en la capa ICD.                                                                                                                           |
| `definition`       | no           | Definición clínica en castellano. Ausente en la capa ICD.                                                                                                                                                         |
| `slug`             | sí           | Identificador estable kebab-case, único en **todo** el corpus (curados incluidos). Si coincide con un curado, la fila es enriquecimiento. La capa ICD usa `icd10cm-<código>`.                                     |
| `codeSystem`       | sí           | `icd10cm` o `loinc`.                                                                                                                                                                                              |
| `categoryKey`      | sí           | Una de las 12 claves de `glossary-taxonomy.ts` (`disease`, `lab`, `imaging`, `diagnostic-test`, …).                                                                                                               |
| `tagKeys`          | no           | Claves de las 15 etiquetas clínicas (`respiratory`, `chronic`, …).                                                                                                                                                |
| `lang`             | sí           | `es` o `en`. Con `en`, el término viaja como `translated: false`.                                                                                                                                                 |
| `enDisplay`        | sí           | Título oficial en inglés de la fuente. Lo escribe/verifica `verify-external-codes.mjs`.                                                                                                                           |
| `esSynonyms`       | no           | Otras formas de nombrarlo en castellano, sin tildes ni variantes gramaticales (mismo criterio que la tabla de síntomas).                                                                                          |
| `plainSummaryEs`   | ES: sí       | Resumen en lenguaje llano.                                                                                                                                                                                        |
| `symptomIds`       | no           | Ids de `sintomas.datos.ts` que orientan a esta enfermedad. El checker falla si uno no existe.                                                                                                                     |
| `relations`        | no           | `[{ "type": "DIAGNOSTIC_TEST" \| "TREATMENT" \| "PROCEDURE" \| "ANATOMY" \| "RELATED_TERM" \| "DISEASE", "targetSlug": "…" }]`. El destino debe existir en el corpus completo; las huérfanas se omiten con aviso. |
| `analysisCategory` | análisis: sí | `LAB`, `IMAGING` u `OTHER`: la categoría con la que se pide la orden (`SRQ-LAB`, `SRQ-IMAGING`, `SRQ-OTHER`).                                                                                                     |
| `reviewStatus`     | sí           | `external-source` · `pending-medical-review` · `medically-reviewed`.                                                                                                                                              |
| `source`           | sí           | Identificador corto de la fuente (`cms-icd10cm-fy2026-order-file`, `alovida-curated-2026-09-25`).                                                                                                                 |

## Cómo se regenera y se valida

```sh
node scripts/fetch-icd10cm-categories.mjs        # baja el ZIP oficial y reescribe la capa ICD (red)
node scripts/verify-external-codes.mjs           # verifica ICD y LOINC de las capas ES contra el NLM (red); --write completa enDisplay
node scripts/check-glossary-corpus.mjs           # validación estructural sin red: slugs, taxonomía, síntomas, relaciones
corepack yarn mock:glossary                      # regenera el fixture del simulador
```
