#!/usr/bin/env node
/**
 * Genera el catálogo de claves que la API acepta en cada cuerpo de escritura,
 * para que la maqueta emule `forbidNonWhitelisted`.
 *
 * ## Por qué
 *
 * La API valida con `ValidationPipe({ whitelist: true, forbidNonWhitelisted:
 * true })`: una clave que el DTO no declara es un **400** que tira abajo el
 * guardado entero. La maqueta no lo emulaba, así que toda deriva de contrato
 * pasaba verde en `mockup` y aparecía recién contra la API real. El informe B
 * (`docs/progress/evidence/flujo-errores/B-deriva-contratos.md`, 2026-10-08)
 * contó 15 roturas así, 6 de ellas «siempre 400».
 *
 * ## Fuente
 *
 * `openapi/openapi.json` del repo de la API. Lo genera la propia API desde los
 * decoradores de sus controllers y DTO (`yarn docs:openapi:generate`) y su CI
 * corre `git diff --exit-code` sobre él, así que en `dev` está al día con el
 * código. **Leelo de `origin/dev`**, no de un checkout atrasado:
 *
 * ```bash
 * git -C ../mantra-core-health-api show origin/dev:openapi/openapi.json > /tmp/openapi.json
 * node scripts/gen-mock-contract.mjs /tmp/openapi.json
 * ```
 *
 * Sale `src/app/core/mock/contract/api-contract.generated.ts`. No se edita a
 * mano: lo que la maqueta acepta de más va en `simulator-extensions.ts`.
 *
 * ## Qué guarda y qué no
 *
 * - Por cada operación con cuerpo `application/json`: método, ruta (con
 *   `:param`) y el esquema del cuerpo.
 * - Por cada esquema: sus propiedades, cuáles son obligatorias y, para las que
 *   son otro esquema (directo, en `allOf` o como arreglo), cuál.
 * - Los cuerpos `multipart/form-data` no entran: son archivos, no claves.
 * - Los esquemas con `additionalProperties` se marcan abiertos: aceptan todo.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_ROOT } from './lib/scan.mjs';

const OUT = join(REPO_ROOT, 'src/app/core/mock/contract/api-contract.generated.ts');
const source = process.argv[2];
if (!source) {
  console.error('Uso: node scripts/gen-mock-contract.mjs <ruta a openapi.json de origin/dev>');
  process.exit(2);
}

const openapi = JSON.parse(readFileSync(source, 'utf8'));
const VERBS = ['post', 'put', 'patch'];
const refName = (ref) => ref.split('/').pop();

/** El esquema al que apunta una propiedad, si apunta a uno. */
function nestedSchemaOf(prop) {
  if (prop.$ref) return refName(prop.$ref);
  const wrapped = (prop.allOf ?? []).find((s) => s.$ref);
  if (wrapped) return refName(wrapped.$ref);
  if (prop.type === 'array' && prop.items) return nestedSchemaOf(prop.items);
  return null;
}

const routes = [];
const used = new Set();
for (const [path, ops] of Object.entries(openapi.paths)) {
  for (const verb of VERBS) {
    const schema = ops[verb]?.requestBody?.content?.['application/json']?.schema;
    if (!schema?.$ref) continue;
    const name = refName(schema.$ref);
    routes.push([verb.toUpperCase(), path.replace(/\{(\w+)\}/g, ':$1'), name]);
    used.add(name);
  }
}

const all = openapi.components.schemas;
const schemas = {};
const pending = [...used];
while (pending.length > 0) {
  const name = pending.pop();
  if (schemas[name] || !all[name]) continue;
  const s = all[name];
  const nested = {};
  for (const [key, prop] of Object.entries(s.properties ?? {})) {
    const inner = nestedSchemaOf(prop);
    if (inner) {
      nested[key] = inner;
      pending.push(inner);
    }
  }
  schemas[name] = {
    keys: Object.keys(s.properties ?? {}),
    required: s.required ?? [],
    ...(Object.keys(nested).length > 0 ? { nested } : {}),
    ...(s.additionalProperties ? { open: true } : {}),
  };
}

routes.sort((a, b) => (a[1] + a[0]).localeCompare(b[1] + b[0]));
const sortedSchemas = Object.fromEntries(
  Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b)),
);

const banner = `// GENERADO por scripts/gen-mock-contract.mjs desde openapi.json de la API.
// No editar a mano. ${routes.length} operaciones · ${Object.keys(sortedSchemas).length} esquemas.
`;
const body = `${banner}
import type { ContractRoute, ContractSchema } from './contract.types';

export const CONTRACT_ROUTES: readonly ContractRoute[] = ${JSON.stringify(routes)};

export const CONTRACT_SCHEMAS: Readonly<Record<string, ContractSchema>> = ${JSON.stringify(sortedSchemas)};
`;
writeFileSync(OUT, body);
console.log(
  `✓ ${OUT.replace(REPO_ROOT + '/', '')}: ${routes.length} operaciones, ${Object.keys(sortedSchemas).length} esquemas`,
);
