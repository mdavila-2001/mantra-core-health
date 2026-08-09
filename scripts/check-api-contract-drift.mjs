#!/usr/bin/env node
/**
 * Compara las operaciones HTTP que el código llama con las declaradas en
 * `docs/integrations/backend-api.md`.
 *
 * ## Qué detecta y qué no
 *
 * Detecta que alguien **agregue una llamada sin documentarla**, o que la
 * documentación declare una operación que ya no existe. Es la deriva entre el
 * código y esta documentación.
 *
 * **No detecta que el backend cambie el contrato.** Esa mitad exige el OpenAPI
 * de la API, que no es alcanzable desde este repositorio; los tipos de
 * `core/data-access/**` se escribieron a mano contra el contrato, con la
 * referencia anotada en comentarios. Es trazabilidad, no verificación, y está
 * registrado como brecha en el análisis correspondiente.
 *
 * Uso: node scripts/check-api-contract-drift.mjs
 */

import { join } from 'node:path';

import { DOCS_ROOT, read, scanEndpoints } from './lib/scan.mjs';

const DOC = join(DOCS_ROOT, 'integrations/backend-api.md');

const declared = new Set();
const doc = read(DOC);

// Las tablas del catálogo declaran `| `POST` | `/iam/auth/login` | …`.
const row = /\|\s*`(GET|POST|PUT|PATCH|DELETE)`\s*\|\s*`([^`]+)`\s*\|/g;
let match;
while ((match = row.exec(doc)) !== null) {
  declared.add(`${match[1]} ${match[2]}`);
}

const actual = new Set(scanEndpoints().map((op) => `${op.method} ${op.endpoint}`));

const undocumented = [...actual].filter((op) => !declared.has(op)).sort();
const phantom = [...declared].filter((op) => !actual.has(op)).sort();

if (undocumented.length > 0 || phantom.length > 0) {
  console.error('\n✗ check-api-contract-drift\n');

  if (undocumented.length > 0) {
    console.error(`  ${undocumented.length} operación(es) que el código llama y la documentación no declara:`);
    for (const op of undocumented) console.error(`    ${op}`);
    console.error('');
  }

  if (phantom.length > 0) {
    console.error(`  ${phantom.length} operación(es) declarada(s) que el código no llama:`);
    for (const op of phantom) console.error(`    ${op}`);
    console.error('');
  }

  console.error('  Actualizá docs/integrations/backend-api.md.\n');
  process.exit(1);
}

console.log('✓ check-api-contract-drift');
console.log(`  ${actual.size} operaciones HTTP, todas declaradas en docs/integrations/backend-api.md`);
console.log('  (no verifica el contrato del backend: su OpenAPI no es alcanzable desde acá)');
