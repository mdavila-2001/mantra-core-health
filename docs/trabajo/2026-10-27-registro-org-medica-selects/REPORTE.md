# Reporte — Alta de organización médica: desplegables y tipo societario

> **AVANCE: 2 / 3 pedidos — el tercero (razón social en PDF) espera una decisión.**

- Fecha: 2026-10-27 · Rama: `claude/friendly-volta-p3xhe5` (desde `dev`, `ebc18f88`)
- Pantalla: `/auth/register/medical-center` (`register-medical-center`), página «La organización».
- Pedido del propietario, sobre una captura de esa página:
  1. «Tipo de institución» tiene que ser un desplegable (era un grupo de radios).
  2. «Razón social: lo mismo que los demás. Debe ser un PDF subible.»
  3. «Tipo societario»: el desplegable salía vacío; hay que cargar las opciones.

## Qué cambió

| Antes | Ahora |
|---|---|
| Tipo de institución: cinco radios en rejilla, a lo ancho | `app-select` como el tipo societario; la página pasa a `tres-columnas` (los tres campos en un renglón desde 1120 px, de a dos por debajo). |
| Tipo societario vacío si el catálogo `directory.tenants.legal_entity_type_concept_id` fallaba o venía vacío | `LegalEntityTypesCatalog.opcionesPorPais` ofrece las figuras del diccionario del front cuando no hay opciones del catálogo. Todas son códigos que la API acepta en `legalEntityType` (`LEGAL_ENTITY_TYPES` del backend). |
| El front conocía 8 figuras bolivianas; las 19 que la API sumó el 26/10/2026 se descartaban en silencio | El diccionario declara las 27 (archivo nuevo `legal-entity-types-bo.dictionary.ts`, para no pasar el tope de 600 líneas). El castellano es literal del seed de la API (`terminology-designations.es.ts`). |

## Completado

| Qué | Comando | Resultado |
|---|---|---|
| Typecheck app y playwright | `tsc -p tsconfig.app.json --noEmit` · `tsc -p playwright/tsconfig.json --noEmit` | EXIT 0 · EXIT 0 |
| Lint de lo tocado | `npx eslint <archivos tocados>` | EXIT 0 |
| Pruebas dirigidas | `ng test --include src/app/features/auth/**/*.spec.ts --include src/app/core/**/legal-entity-types*.spec.ts` | 32 archivos, 771 pruebas, todas en verde |
| Tope de líneas | `node scripts/check-max-lines.mjs` | ninguno de los archivos tocados aparece |
| Navegador, maqueta | `playwright test cm-11-medical-center.spec.ts` contra `ng serve -c development,demo` | «el alta recorre sus dos páginas y termina pendiente de verificación» PASS en desktop y teléfono |
| Navegador, catálogo caído | script propio, `ng serve` sin API y la lectura del tipo societario forzada a 503 | 5 tipos de institución, 27 tipos societarios; capturas en `evidencia/` |

## A medias

### Pedido 2 — Razón social como PDF

- Qué anda: nada todavía; no se tocó.
- Qué no anda: la pantalla no pide ningún documento.
- Qué falta: decidir qué documento es. El contrato `RegisterOrganizationLegalDocumentsDto`
  exige cuatro de los cinco documentos juntos (`taxIdentifierFileId`, `commerceRegistryFileId`,
  `operatingLicenseFileId`, `healthAuthorityCertificateFileId`; sólo `constitutionFileId` es
  opcional), así que subir un único PDF «de la razón social» necesita un cambio en la API, o
  pedir los cinco documentos como hacen la aseguradora y el laboratorio.
- Dónde quedó: sin cambios en `register-medical-center`.

## Pendiente

| Qué | Estado | Qué lo destraba |
|---|---|---|
| Pedido 2 | `DECISION_REQUIRED` | El propietario elige: un PDF (con cambio en la API) o el bloque de cinco documentos. |

## Evidencia

- `evidencia/1024-light-societario-abierto-catalogo-caido.png` — tipo societario abierto con su catálogo en 503: las 27 figuras bolivianas.
- `evidencia/1440-dark-tipo-abierto.png` — el tipo de institución como desplegable, con sus cinco opciones.
- `docs/frontend/evidence/cm-11-medical-center-registration/*-page-1-*.png` — recapturadas por la corrida de la maqueta.

## No cubierto

- `cm-11-organizacion-medica-api-real.spec.ts` no se corrió: necesita la API y Postgres reales.
  Sus pasos de radio se pasaron a combobox, pero esa versión no se ejecutó.
- Tema oscuro: la captura «dark» quedó en tema claro, porque la app usa su propio interruptor de tema y no la preferencia del sistema.
- Dos pruebas de `cm-11-medical-center.spec.ts` («la tarjeta … está en el selector de cuentas» y
  «el hospital verificado configura su práctica y su sede») fallan igual **sin** este cambio
  (corrida sobre `dev` con los cambios guardados en el stash): no son de esta rama.

## Decisiones y ambigüedades

- «Lo mismo que los demás» en el pedido 2 se leyó como «como las otras altas, con su PDF». No
  se adivinó qué documento ni se cambió el contrato: se le pregunta al propietario.
- El respaldo del tipo societario sale del diccionario del front. Si la API dejara de aceptar
  alguno de esos códigos, `legal-entity-types.dictionary.spec.ts` (que fija los 40) es la
  prueba que lo marca.
