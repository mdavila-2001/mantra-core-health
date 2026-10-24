import { defineConfig } from 'vitest/config';

/**
 * Las muestras de PDF para revisión visual (`yarn pdf:samples`). No son
 * pruebas: generan los documentos con datos ficticios en `artifacts/pdf-samples/`
 * (o en `PDF_SAMPLES_DIR`). Corren en Node, fuera del builder de Angular; el
 * sufijo `*.pdf-sample.ts` las deja fuera de `ng test`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/pdf-samples/**/*.pdf-sample.ts'],
  },
});
