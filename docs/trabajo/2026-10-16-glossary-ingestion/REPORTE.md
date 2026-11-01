# Primera carga S1 del glosario

Estado: lote publicado y verificado en la maqueta de Contabo.

## Resultado

- Entrada: `../docs/progress/evidence/lane-41/F9/s1-medlineplus/output/articles.ndjson`, SHA-256 `7d6e9ac2221449ca253e282ec4ad1cae2029b6b9b242c9beecf36b59cb7bb22d`.
- 1.318 artículos aceptados; 1.311 fichas nuevas y 7 fichas de muestra actualizadas. Se modificaron 251 cubetas; las demás quedaron intactas.
- 342 imágenes importadas quedaron desactivadas por falta de revisión individual de pertinencia. Las fuentes y URL de las secciones se validaron antes de escribir.
- Segunda ejecución: cero artículos nuevos y mismo SHA-256 de salida `7009556893d5c15a3a5bd43148aed7408f138644cde5beb4fcc042b196277752`. Ver `CHECKPOINT-INITIAL.json` y `CHECKPOINT.json`.
- La ficha nueva «Manejo del dolor sin medicamentos» (`medlineplus-es-7108`) muestra el artículo y la procedencia de MedlinePlus; el PDF descargado tiene firma `%PDF-`, 288.974 bytes y ninguna imagen no revisada. Ver `ficha-cargada.png` y `verificacion.json`.

## Ejecución

```sh
node scripts/glossary-ingest-batch.mjs ../docs/progress/evidence/lane-41/F9/s1-medlineplus/output/articles.ndjson --source nlm-medlineplus-es --license 'Dominio público (NLM)' --dry-run
node scripts/glossary-ingest-batch.mjs ../docs/progress/evidence/lane-41/F9/s1-medlineplus/output/articles.ndjson --source nlm-medlineplus-es --license 'Dominio público (NLM)'
```

El script preserva las cubetas existentes y puede reanudarse. Un lote con slug ausente, sección sin HTTPS o licencia distinta se rechaza antes de escribir.

## Comprobaciones

- `corepack yarn install --immutable`: correcto.
- `corepack yarn typecheck`: correcto.
- `corepack yarn build`: correcto (con advertencias de dependencias CommonJS).
- Specs dirigidos de cubetas y artículos: 15 de 15 correctos.
- ESLint de los scripts, `node --check` y `git diff --check`: correctos.
- Navegador local: artículo, fuente y PDF verificados; cero errores de página.
- PR #1124 integrado en `mockup` como `1f7cd8e639e4c596b5b68694841efaf16d934508`; despliegue Coolify `5en9ya7hwcqleyvknn9ouliu` finalizado el 2026-10-16 22:39 UTC.
- URL pública: `https://mockup.62.169.18.132.sslip.io/glossary/b66560fd-8a7b-4eb1-a0c2-1d54e896aabe`; la cubeta responde JSON y el navegador descargó el PDF de 288.974 bytes sin errores. La captura y `verificacion.json` corresponden ahora a Contabo.

## Alcance

Es la primera carga de artículos públicos de una fuente oficial en la maqueta. No modifica la API ni la base clínica real. Ninguna definición alcanza aún el objetivo de 150.000 palabras; esta carga añade contenido verificable sin rellenar texto artificialmente.
