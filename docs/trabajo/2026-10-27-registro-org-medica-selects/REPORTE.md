# Reporte — Alta de organización médica: desplegables y tipo societario

> **AVANCE: 4 / 4 pedidos.** (Peldaño: verificado contra la maqueta; la API real no se ejercitó de punta a punta.)

- Fecha: 2026-10-27 · Rama: `claude/friendly-volta-p3xhe5` (desde `dev`, `ebc18f88`)
- Pantalla: `/auth/register/medical-center` (`register-medical-center`), página «La organización».
- Pedido del propietario, sobre una captura de esa página:
  1. «Tipo de institución» tiene que ser un desplegable (era un grupo de radios).
  2. «Razón social: lo mismo que los demás. Debe ser un PDF subible.»
  3. «Tipo societario»: el desplegable salía vacío; hay que cargar las opciones.
  4. (28/10) Documentos opcionales según el tipo societario: regla «personas naturales».

## Qué cambió

| Antes | Ahora |
|---|---|
| Tipo de institución: cinco radios en rejilla, a lo ancho | `app-select` como el tipo societario; la página pasa a `tres-columnas` (los tres campos en un renglón desde 1120 px, de a dos por debajo). |
| Tipo societario vacío si el catálogo `directory.tenants.legal_entity_type_concept_id` fallaba o venía vacío | `LegalEntityTypesCatalog.opcionesPorPais` ofrece las figuras del diccionario del front cuando no hay opciones del catálogo. Todas son códigos que la API acepta en `legalEntityType` (`LEGAL_ENTITY_TYPES` del backend). |
| Sin documentos legales | Paso «Documentación legal obligatoria (PDF)» entre la organización y la cuenta, con los cinco papeles obligatorios (escritura de constitución, NIT, matrícula de comercio, licencia municipal, certificado del SEDES). Mismo `app-dropzone-pdf` y misma pre-carga (`/iam/auth/upload-registration-document`) que la aseguradora; viajan en `organization.legalDocuments`. El motor lo parte en «(1 de 2)» y «(2 de 2)». Decisión del propietario: opción a), el bloque completo. |
| Los cinco documentos obligatorios para todo tipo societario | Empresa Unipersonal: escritura opcional. Profesional independiente: escritura y matrícula de comercio opcionales. El resto, los cinco. El front rotula «(opcional)», quita el `required` al cambiar de tipo y no envía lo que no se subió. La API (PR aparte en `mantra-core-health-api`, misma rama) aplica la misma regla: matrícula opcional en el DTO y 422 nombrándola salvo para `PROFESIONAL_INDEPENDIENTE`. |
| El front conocía 8 figuras bolivianas; las 19 que la API sumó el 26/10/2026 se descartaban en silencio | El diccionario declara las 27 (archivo nuevo `legal-entity-types-bo.dictionary.ts`, para no pasar el tope de 600 líneas). El castellano es literal del seed de la API (`terminology-designations.es.ts`). |

## Completado

| Qué | Comando | Resultado |
|---|---|---|
| Typecheck app y playwright | `tsc -p tsconfig.app.json --noEmit` · `tsc -p playwright/tsconfig.json --noEmit` | EXIT 0 · EXIT 0 |
| Lint de lo tocado | `npx eslint <archivos tocados>` | EXIT 0 |
| Pruebas dirigidas | `ng test --include src/app/features/auth/**/*.spec.ts --include src/app/core/**/legal-entity-types*.spec.ts` | 32 archivos, 771 pruebas, todas en verde |
| Tope de líneas | `node scripts/check-max-lines.mjs` | ninguno de los archivos tocados aparece |
| Navegador, maqueta | `playwright test cm-11-medical-center.spec.ts --grep "recorre sus"` contra `ng serve -c development,demo` | PASS en desktop y teléfono, con los cinco PDF subidos y consola sin errores |
| Pruebas dirigidas tras los documentos | `ng test` en `auth/**`, `core/data-access/iam/*` y `legal-entity-types*` | 35 archivos en verde |
| Documentos según el tipo, front | `ng test` en `auth/**`, `core/data-access/iam/*` y `legal-entity-types*` | 35 archivos en verde |
| Documentos según el tipo, API | `jest` sobre `register-organization.dto.spec`, `iam-organization-self-registration.service.spec` y `src/modules/directory` · `tsc --noEmit` · `eslint` | 17 suites, 309 pruebas en verde · EXIT 0 · EXIT 0 (en una copia con `xlsx` desde npm: `cdn.sheetjs.com` está bloqueado en este entorno) |
| Documentos según el tipo, navegador | script propio, `ng serve` sin API, «Siguiente» en el paso 1 de documentos vacío | Independiente: 2 obligatorios (NIT, licencia). Unipersonal: 3. S.R.L.: 4 de 4. Capturas `evidencia/*-documentos.png` |
| Navegador, catálogo caído | script propio, `ng serve` sin API y la lectura del tipo societario forzada a 503 | 5 tipos de institución, 27 tipos societarios; capturas en `evidencia/` |

## A medias

ninguna

## Pendiente

ninguna

## Evidencia

- `evidencia/1024-light-societario-abierto-catalogo-caido.png` — tipo societario abierto con su catálogo en 503: las 27 figuras bolivianas.
- `evidencia/1440-dark-tipo-abierto.png` — el tipo de institución como desplegable, con sus cinco opciones.
- `docs/frontend/evidence/cm-11-medical-center-registration/*-page-1-*.png` — recapturadas por la corrida de la maqueta.
- `evidencia/1440-independiente-documentos.png`, `390-independiente-…`, `1440-unipersonal-…`, `1440-srl-…` — el paso de documentos con lo opcional según el tipo societario.
- `docs/frontend/evidence/cm-11-medical-center-registration/*-04b-*` y `*-04c-*` — el paso de documentos vacío con sus errores, y con los PDF subidos, en desktop y teléfono.

## No cubierto

- `cm-11-organizacion-medica-api-real.spec.ts` no se corrió: necesita la API y Postgres reales.
  Sus pasos de radio se pasaron a combobox, pero esa versión no se ejecutó.
- La subida real a la API (`upload-registration-document` y el reclamo de los cinco `fileId` en el alta) sólo se ejercitó contra la maqueta y en las pruebas unitarias.
- En el teléfono, el indicador de pasos con cuatro pasos se apila en renglones con conectores cortos: es el comportamiento del componente compartido (igual en la aseguradora), no se tocó.
- El alta de un profesional independiente sin escritura ni matrícula contra la API real (pruebas unitarias de ambos lados, sin integración).
- `docs/inventario/endpoints/iam.md` de la API (autogenerado) no se regeneró: su generador reescribe además muchos módulos ajenos (inventario ya desactualizado en `dev`).
- El título del paso sigue diciendo «obligatoria» aunque haya documentos opcionales.
- Tema oscuro: la captura «dark» quedó en tema claro, porque la app usa su propio interruptor de tema y no la preferencia del sistema.
- Dos pruebas de `cm-11-medical-center.spec.ts` («la tarjeta … está en el selector de cuentas» y
  «el hospital verificado configura su práctica y su sede») fallan igual **sin** este cambio
  (corrida sobre `dev` con los cambios guardados en el stash): no son de esta rama.

## Decisiones y ambigüedades

- Pedido 2: el propietario eligió el bloque completo de cinco PDF.
- Pedido 4: el propietario eligió la regla «personas naturales» (Unipersonal sin escritura;
  Profesional independiente sin escritura ni matrícula). Cooperativas, fundaciones, entidades
  públicas y demás no societarias siguen pidiendo los cinco: no se eligió esa variante.
- El respaldo del tipo societario sale del diccionario del front. Si la API dejara de aceptar
  alguno de esos códigos, `legal-entity-types.dictionary.spec.ts` (que fija los 40) es la
  prueba que lo marca.
