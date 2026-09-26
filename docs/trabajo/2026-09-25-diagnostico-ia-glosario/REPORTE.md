# Reporte — D1: corpus masivo del glosario (front)

> **AVANCE: 9 / 11 microtareas — 81,8 %.** Faltan H1.S3.M2 (build con presupuesto) y H1.S3.M3
> (capturas de `/glossary` con doble revisión): las dos van en una corrida aparte con la máquina
> libre, por decisión del usuario del 2026-09-25. Peldaño: `TESTED` · visual `UNKNOWN`.
> D3 y D4 quedaron para otra tanda (misma decisión). D2 vive en el AI service: PR #2.

- Rama: `justin/diagnostico-ia-glosario-2026-09-25` desde `origin/mockup` @ `381ce773` · commit `dec04cff` · PR [#704](https://github.com/mdavila-2001/mantra-core-health/pull/704) a `mockup` (`MERGEABLE`; `UNSTABLE` sólo por checks en cola: el CI está caído y ninguno falló).
- Plan con estados por microtarea: [`PLAN.md`](PLAN.md). Plan del paquete: `AlovidaPromptManager/docs/trabajo/2026-09-25-diagnostico-ia-glosario/PLAN.md`.

## Qué se entregó

- `data/glossary/`: `00_README.md` (tres capas, fuente/URL/fecha/licencia por archivo, esquema de fila, `reviewStatus`), `enfermedades-atencion-primaria.ndjson` (201 filas, 6 enriquecen un curado), `analisis-frecuentes.ndjson` (122 filas, 15 enriquecen un curado), `cie10cm-categorias.generated.ndjson` (1 918 categorías FY2026, CMS, con `.meta.json` y SHA-256 del ZIP).
- `scripts/`: `lib/glosario-corpus.mjs` (lectura compartida), `check-glossary-corpus.mjs` (validación sin red), `fetch-icd10cm-categories.mjs` (descarga oficial), `verify-external-codes.mjs` (ICD y LOINC contra el NLM; `--write` completa `enDisplay`), `gen-glossary-fixture.mjs` (lee seed + capas, valida taxonomía/síntomas/relaciones, escribe los campos nuevos).
- `fixtures/glosario.generated.ts` regenerado (2 289 términos) · `fixtures/glosario.ts` (`translated` según `lang`, `properties` con `external_code`, `code_system`, `lang`, `review_status`, `source`, `symptom_ids`, `analysis_category`; los términos en inglés dicen «Sin definición cargada» en vez de mostrar un párrafo vacío o inventado) · `fixtures/glosario.spec.ts` (12 pruebas).

## Comandos (uno por vez, sin suite completa ni build ni navegador)

| Comando                                                                                 | Resultado                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `node scripts/verify-external-codes.mjs --write`                                        | 323 códigos existen · 0 faltantes · 7 `enDisplay` completados (además `M26.60` → `M26.609`, que sí existe)                                                                                             |
| `node scripts/check-glossary-corpus.mjs`                                                | 0 problemas                                                                                                                                                                                            |
| `corepack yarn mock:glossary`                                                           | 2 289 términos (69 curados + 2 220 de las capas: 195 + 107 + 1 918; 21 enriquecen un curado) · 1 relación huérfana preexistente del seed omitida (`hipertension-arterial → control-de-signos-vitales`) |
| `corepack yarn typecheck`                                                               | exit 0                                                                                                                                                                                                 |
| `npx ng test --include=src/app/core/mock/fixtures/glosario.spec.ts --watch=false`       | 12 passed                                                                                                                                                                                              |
| `npx ng test --include=src/app/features/glossary/**/*.spec.ts --watch=false`            | 75 passed (4 archivos)                                                                                                                                                                                 |
| `npx ng test --include=src/app/core/mock/fixtures/anatomia-atlas.spec.ts --watch=false` | 14 passed                                                                                                                                                                                              |
| spec de `core/mock/handlers/terminology.handlers`                                       | 29 passed                                                                                                                                                                                              |
| prettier + eslint sobre los 7 archivos tocados                                          | exit 0                                                                                                                                                                                                 |

Tres defectos encontrados y corregidos antes del PR: el generador escribía mal los números y las claves con guion de `CONTEO_DE_CAPAS` (lo destapó el typecheck); la spec suponía que `neumonia` era de la capa nueva (es un curado enriquecido: se separó el caso); eslint prohíbe que `core/` importe de `features/`, así que la spec lee los ids de síntomas del archivo fuente.

## Lo que NO cubre, y hay que saberlo

- **Bundle:** `glosario.generated.ts` pasa de 58 KB a ~1,08 MB. El simulador se carga con `import()` diferido en `mock-backend.interceptor.ts`, así que probablemente no toca el bundle inicial, **pero no se midió**: se mide con `corepack yarn build` en la corrida aparte. Si excede, la capa ICD pasa a carga diferida en el handler.
- **Pantalla:** ni capturas ni doble revisión de `/glossary`. La lista y la ficha de un término en inglés se afirman por spec, no por navegador.
- **Revisión médica:** definiciones, síntomas por enfermedad y pruebas relacionadas están `pending-medical-review`; no entran a producción sin revisión.
- **Archivos sobrantes en disco, fuera del commit:** `data/glossary/enfermedades-atencion-primaria.part2.ndjson` y `.part3.ndjson`, ya fusionados en el archivo principal. Borrarlos a mano.
- **El AI service** tiene el corpus pinneado a `381ce773` (PR #2): cuando este PR entre a `mockup`, correr allá `yarn catalog:sync` contra el SHA mergeado.
