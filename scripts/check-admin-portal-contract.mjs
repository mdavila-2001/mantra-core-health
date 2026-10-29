#!/usr/bin/env node
/**
 * Compara las llamadas HTTP de los clientes del portal de administración
 * (`core/data-access/{admin-portal,audit,authz-admin}`) con el contrato OpenAPI
 * de la API, versionado en `scripts/contracts/api-operations.json`.
 *
 * Detecta lo que `check-api-contract-drift` no puede: que un cliente llame una
 * ruta o un método que **la API no expone** (typo, ruta renombrada, endpoint
 * imaginado). Compara método y forma de la ruta; el nombre del parámetro no
 * cuenta (`${id}` y `{tenantId}` son la misma forma).
 *
 * Alcance honesto: verifica que la operación EXISTA, no los tipos del cuerpo ni
 * de la respuesta. El contrato es una copia: se refresca con
 * `yarn contract:refresh <ruta/al/openapi.json>`.
 *
 * Uso: node scripts/check-admin-portal-contract.mjs
 */

import { clientFiles, compare, CONTRACT_FILE, GAPS_FILE, scanPortalOperations } from './lib/admin-portal-contract.mjs';
import { read } from './lib/scan.mjs';

const contract = JSON.parse(read(CONTRACT_FILE));
const files = clientFiles();

if (files.length === 0) {
  console.error('\n✗ check-admin-portal-contract\n  No se encontró ningún cliente: la ruta de escaneo cambió.\n');
  process.exit(1);
}

const scan = scanPortalOperations(files);
const gaps = JSON.parse(read(GAPS_FILE)).gaps;
const { missing, tolerated, stale, unresolved } = compare(scan, contract.operations, gaps);

if (missing.length > 0 || stale.length > 0 || unresolved.length > 0) {
  console.error('\n✗ check-admin-portal-contract\n');

  if (missing.length > 0) {
    console.error(`  ${missing.length} llamada(s) que el contrato OpenAPI no declara:`);
    for (const { file, call } of missing) console.error(`    ${call}   (${file})`);
    console.error('');
  }

  if (stale.length > 0) {
    console.error('  Brecha(s) conocida(s) que el contrato ya declara (borralas de admin-portal-known-gaps.json):');
    for (const { call } of stale) console.error(`    ${call}`);
    console.error('');
  }

  if (unresolved.length > 0) {
    console.error('  Llamadas `this.http` que el gate no pudo leer (ruta no literal):');
    for (const { file, count } of unresolved) console.error(`    ${count} en ${file}`);
    console.error('');
  }

  console.error(`  Contrato: ${contract.source}. Si la API cambió, refrescalo con yarn contract:refresh.\n`);
  process.exit(1);
}

console.log('✓ check-admin-portal-contract');
for (const { call, reason } of tolerated) console.log(`  ! brecha conocida: ${call} — ${reason}`);
console.log(
  `  ${scan.operations.length} llamadas de ${files.length} clientes, ninguna fuera del contrato salvo las brechas conocidas (${contract.operations.length} operaciones)`,
);
