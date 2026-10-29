#!/usr/bin/env node
/**
 * Refresca `scripts/contracts/api-operations.json` desde el `openapi.json` de la
 * API (rama `dev`, `openapi/openapi.json`). Guarda sólo `MÉTODO /ruta`: es lo
 * único que lee el gate y mantiene la copia chica y legible en el diff.
 *
 * Uso: node scripts/refresh-api-contract.mjs <ruta/al/openapi.json> [etiqueta-de-origen]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { CONTRACT_FILE } from './lib/admin-portal-contract.mjs';
import { read } from './lib/scan.mjs';

const [input, label = 'openapi/openapi.json de mantra-core-health-api (dev)'] = process.argv.slice(2);
if (!input) {
  console.error('Uso: node scripts/refresh-api-contract.mjs <ruta/al/openapi.json> [etiqueta]');
  process.exit(1);
}

const document = JSON.parse(read(input));
const methods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const operations = Object.entries(document.paths ?? {})
  .flatMap(([route, item]) =>
    Object.keys(item)
      .filter((key) => methods.has(key))
      .map((key) => `${key.toUpperCase()} ${route}`),
  )
  .sort();

if (operations.length === 0) {
  console.error('El documento no trae operaciones: ¿es un OpenAPI?');
  process.exit(1);
}

mkdirSync(dirname(CONTRACT_FILE), { recursive: true });
writeFileSync(CONTRACT_FILE, `${JSON.stringify({ source: label, operations }, null, 1)}\n`);
console.log(`✓ ${operations.length} operaciones escritas en scripts/contracts/api-operations.json`);
