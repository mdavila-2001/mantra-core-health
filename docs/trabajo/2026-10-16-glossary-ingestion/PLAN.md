# Primera carga de artículos del glosario

Fecha: 2026-10-16. Destino: glosario público de la rama `mockup` en Contabo.

## Entrada y límites

- Lote S1: 1.318 artículos F9 de MedlinePlus en español, ya vinculados con slugs de la semilla pública de 19.313 términos.
- Se admiten sólo secciones declaradas `Dominio público (NLM)` con fuente y URL HTTPS. Las imágenes del lote quedan desactivadas hasta comprobar pertinencia y derechos por archivo.
- Se conservan los artículos existentes de la semilla. Una segunda ejecución con la misma entrada debe producir los mismos archivos.
- Esta carga amplía cobertura. No satisface todavía las 150.000 palabras exigidas por definición ni constituye revisión médica de texto nuevo.

## Pasos

1. Validar NDJSON, slugs e identificadores contra la semilla; registrar hash de entrada y conteos.
2. Combinar por cubeta con los artículos existentes; escribir sólo las cubetas afectadas mediante reemplazo atómico y checkpoint.
3. Verificar cobertura local, descarga de artículo y PDF en navegador.
4. Publicar rama, integrar en `mockup`, desplegar `alovida-web-mockup` mediante Coolify y comprobar que una ficha del lote responde desde `https://mockup.62.169.18.132.sslip.io`.

## Siguientes lotes

S2 CIE-10-ES, S3 fármacos y S4 anatomía requieren la misma validación de derechos y relevancia antes de promoverse. La ingesta de una fuente no sustituye la redacción original, la revisión profesional ni el objetivo de palabras.
