# Segunda carga: fichas farmacológicas

Estado: 2.819 artículos publicados en la maqueta de Contabo.

## Procedencia y selección

- Entrada: `../docs/progress/evidence/lane-41/F9/s3-farmacos/out/articles.ndjson`, SHA-256 `a794380f7fe15cfab6a6674a3c312e3c0d0880fd1a0f901ec2004bfeaaaec036`.
- Fuentes admitidas: CIMA de la AEMPS y Wikidata. La política `PHARMA-POLICY.json` exige licencia exacta y dominio HTTPS por fuente. Sólo se incluyen secciones marcadas en español.
- El [aviso legal de la AEMPS](https://www.aemps.gob.es/aviso-legal/) permite reproducir contenido citando el origen y la fecha de actualización del documento. Por eso se excluyeron 254 secciones de AEMPS sin fecha de versión ISO. La cita de cada sección muestra la URL, la fecha de actualización y, cuando existe, el número de registro del producto de referencia; el PDF incluye los mismos datos.
- Catorce entradas sin secciones válidas quedaron fuera. Los 2.819 artículos aceptados son nuevos frente al primer lote. Se desactivaron 4.643 imágenes pendientes de revisión individual.
- Segunda ejecución: cero artículos nuevos y mismo SHA-256 de salida `630440dd95cae99476a7fc256ea9e057686fea8d1a0fae15b1e8e70035008b20`.
- `corepack yarn typecheck`, `corepack yarn build`, `node --check` y `git diff --check`: correctos. La compilación mostró advertencias de dependencias CommonJS.
- PR #1125 integrado en `mockup` como `08e349e3f2019678b97e3168fdd876b0eac56c40`; despliegue Coolify `wvbrotcnvoezu6fxjhwy0ii2` finalizado el 2026-10-16 22:55 UTC.
- Cubeta pública `https://mockup.62.169.18.132.sslip.io/glossary-seed/mock/articles/cc.json`: HTTP 200, JSON; la ficha `Abacavir` (`cc0c33a2-c30a-4a1a-a884-fab8bfc28f5c`) contiene ocho secciones, fuente `aemps-cima`, versión `2024-01-23`, registro `84740` y cero imágenes habilitadas. La interfaz está disponible en `https://mockup.62.169.18.132.sslip.io/glossary/cc0c33a2-c30a-4a1a-a884-fab8bfc28f5c`.

## Alcance clínico

Las secciones de CIMA provienen de fichas técnicas de productos concretos; el número de registro y la URL permiten identificar el producto. No se deben interpretar como indicaciones universales para todas las marcas o formulaciones del principio activo. Tampoco constituyen una revisión médica original ni alcanzan 150.000 palabras por definición.

## Ejecución

```sh
node scripts/glossary-ingest-batch.mjs ../docs/progress/evidence/lane-41/F9/s3-farmacos/out/articles.ndjson --policy docs/trabajo/2026-10-16-glossary-ingestion/PHARMA-POLICY.json --lang es --checkpoint docs/trabajo/2026-10-16-glossary-ingestion/PHARMA-CHECKPOINT.json
```
