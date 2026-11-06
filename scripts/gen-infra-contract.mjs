#!/usr/bin/env node
/**
 * Contrato F2/F3 (infraestructura hospitalaria) **contra la API**: genera
 * `src/app/core/mock/contract/infra-f2f3-contract.generated.ts` desde el
 * `openapi.json` de `mantra-core-health-api` (el mismo documento que
 * `openapi.yaml`; la API los regenera juntos).
 *
 * ## Por qué un generador aparte de `gen-mock-contract.mjs`
 *
 * `gen-mock-contract.mjs` sigue a la rama de la API que despliega con la del
 * front (`origin/dev`) y sólo guarda los cuerpos de escritura. F2/F3 vive
 * todavía en la rama de la API de F2–F5, y la revisión pidió comparar también
 * **las respuestas**: por cada operación de F2/F3 que la web usa se guardan
 * método, ruta, esquema del cuerpo y esquema de la respuesta 2xx, y de cada
 * esquema sus claves, sus obligatorias y a qué esquema apunta cada propiedad.
 *
 * Lo consumen `infra-f2f3-contract.spec.ts` (respuestas y cuerpos de la
 * maqueta) e `infra-f2f3-types.check.ts` (los tipos de `core/data-access`,
 * comprobados por `tsc` en `yarn typecheck`).
 *
 * Uso:
 *   git -C ../mantra-core-health-api fetch origin claude/trusting-hawking-q3p12v
 *   node scripts/gen-infra-contract.mjs                 # escribe
 *   node scripts/gen-infra-contract.mjs --check         # falla si quedó viejo
 *   node scripts/gen-infra-contract.mjs --api-ref origin/dev
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { REPO_ROOT } from './lib/scan.mjs';

const OUT = join(REPO_ROOT, 'src/app/core/mock/contract/infra-f2f3-contract.generated.ts');
const DEFAULT_REF = 'origin/claude/trusting-hawking-q3p12v';

/** Las operaciones de F2/F3 que llaman `infrastructure-ops.client.ts` y `adt.client.ts`. */
export const INFRA_OPERATIONS = [
  ['GET', '/practice/infrastructure-access/me'],
  ['GET', '/practice/infrastructure-catalog'],
  ['GET', '/sites/{siteId}/bed-board'],
  ['GET', '/care-spaces/{id}/operational-state'],
  ['POST', '/care-spaces/{id}/availability'],
  ['GET', '/care-spaces/{id}/blocks'],
  ['POST', '/care-space-blocks/{id}/end'],
  ['POST', '/care-space-blocks/{id}/cancel'],
  ['POST', '/care-spaces/{id}/hygiene'],
  ['POST', '/care-spaces/{id}/isolation'],
  ['GET', '/sites/{siteId}/cleaning-orders'],
  ['POST', '/sites/{siteId}/cleaning-orders'],
  ['POST', '/cleaning-orders/{id}/assign'],
  ['POST', '/cleaning-orders/{id}/start'],
  ['POST', '/cleaning-orders/{id}/finish'],
  ['POST', '/cleaning-orders/{id}/inspect'],
  ['POST', '/cleaning-orders/{id}/cancel'],
  ['GET', '/care-spaces/{id}/status-events'],
  ['POST', '/clinical/bed-compatibility'],
  ['POST', '/clinical/encounters/{id}/bed-compatibility'],
  ['POST', '/clinical/admissions'],
  ['POST', '/clinical/encounters/{id}/bed-assignment'],
  ['POST', '/clinical/encounters/{id}/transfer'],
  ['POST', '/clinical/bed-swaps'],
  ['POST', '/clinical/encounters/{id}/discharge'],
  ['POST', '/clinical/encounter-locations/{id}/cancel'],
  ['GET', '/clinical/encounters/{id}/stay'],
  ['PATCH', '/clinical/placement-incidents/{id}'],
  ['GET', '/clinical/patients/{id}/inpatient-stay'],
  ['GET', '/sites/{siteId}/attending-practitioners'],
  ['GET', '/sites/{siteId}/census'],
  ['POST', '/sites/{siteId}/census/{date}/close'],
  ['POST', '/census-days/{id}/adjustments'],
  ['GET', '/sites/{siteId}/inpatient-indicators'],
];

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).trim();

function readOpenapi(apiRef) {
  const apiRepo = resolve(REPO_ROOT, process.env.MANTRA_API_REPO ?? '../mantra-core-health-api');
  if (!existsSync(apiRepo)) throw new Error(`no encuentro el repo de la API en ${apiRepo}`);
  const commit = git(apiRepo, 'rev-parse', '--short', '--verify', `${apiRef}^{commit}`);
  return { doc: JSON.parse(git(apiRepo, 'show', `${apiRef}:openapi/openapi.json`)), origin: `${apiRef} (${commit})` };
}

const refName = (r) => r.split('/').pop();
function schemaRefOf(s) {
  if (!s) return null;
  if (s.$ref) return refName(s.$ref);
  if (s.type === 'array' && s.items?.$ref) return refName(s.items.$ref);
  for (const k of ['allOf', 'oneOf', 'anyOf']) for (const x of s[k] ?? []) if (x.$ref) return refName(x.$ref);
  return null;
}

function build(doc) {
  const operations = [];
  const wanted = new Set();
  for (const [method, path] of INFRA_OPERATIONS) {
    const op = doc.paths?.[path]?.[method.toLowerCase()];
    if (!op) {
      operations.push({ method, path: path.replace(/\{(\w+)\}/g, ':$1'), published: false, body: null, response: null, responseIsArray: false });
      continue;
    }
    const body = schemaRefOf(op.requestBody?.content?.['application/json']?.schema);
    const ok = Object.entries(op.responses ?? {}).find(([k]) => k.startsWith('2'))?.[1];
    const respSchema = ok?.content?.['application/json']?.schema;
    const response = schemaRefOf(respSchema);
    if (body) wanted.add(body);
    if (response) wanted.add(response);
    operations.push({ method, path: path.replace(/\{(\w+)\}/g, ':$1'), published: true, body, response, responseIsArray: respSchema?.type === 'array' });
  }
  const schemas = {};
  const queue = [...wanted];
  while (queue.length > 0) {
    const name = queue.shift();
    if (schemas[name]) continue;
    const s = doc.components?.schemas?.[name];
    if (!s) continue;
    const merged = { properties: { ...(s.properties ?? {}) }, required: [...(s.required ?? [])] };
    for (const part of s.allOf ?? []) {
      const base = part.$ref ? doc.components.schemas[refName(part.$ref)] : part;
      Object.assign(merged.properties, base?.properties ?? {});
      merged.required.push(...(base?.required ?? []));
    }
    const nested = {};
    for (const [k, p] of Object.entries(merged.properties)) {
      const r = schemaRefOf(p);
      if (r) {
        nested[k] = { schema: r, array: p.type === 'array' };
        queue.push(r);
      }
    }
    schemas[name] = { keys: Object.keys(merged.properties).sort(), required: [...new Set(merged.required)].sort(), nested };
  }
  return { operations, schemas };
}

function render({ operations, schemas }, origin) {
  const keyUnion = (xs) => (xs.length === 0 ? 'never' : xs.map((x) => `'${x}'`).join(' | '));
  const types = Object.entries(schemas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([n, s]) => `  readonly ${n}: { readonly keys: ${keyUnion(s.keys)}; readonly required: ${keyUnion(s.required)} };`)
    .join('\n');
  return `// GENERADO por scripts/gen-infra-contract.mjs desde openapi.json de la API: ${origin}.
// No editar a mano. ${operations.length} operaciones de F2/F3 · ${Object.keys(schemas).length} esquemas.

export interface InfraContractOperation {
  readonly method: 'GET' | 'POST' | 'PATCH';
  readonly path: string;
  readonly published: boolean;
  readonly body: string | null;
  readonly response: string | null;
  readonly responseIsArray: boolean;
}

export interface InfraContractSchema {
  readonly keys: readonly string[];
  readonly required: readonly string[];
  readonly nested: Readonly<Record<string, { readonly schema: string; readonly array: boolean }>>;
}

export const INFRA_CONTRACT_ORIGIN = ${JSON.stringify(origin)};

export const INFRA_OPERATIONS: readonly InfraContractOperation[] = ${JSON.stringify(operations, null, 1)};

export const INFRA_SCHEMAS: Readonly<Record<string, InfraContractSchema>> = ${JSON.stringify(schemas, null, 1)};

/** Claves y obligatorias de cada esquema, como tipos (los usa \`infra-f2f3-types.check.ts\`). */
export interface InfraSchemaKeys {
${types}
}
`;
}

const argv = process.argv.slice(2);
const check = argv.includes('--check');
const refIdx = argv.indexOf('--api-ref');
const apiRef = refIdx >= 0 ? argv[refIdx + 1] : DEFAULT_REF;
const { doc, origin } = readOpenapi(apiRef);
const built = build(doc);
// La procedencia no entra en la comparación: sólo el contenido.
const text = render(built, origin);
const strip = (t) => t.replace(/^\/\/ GENERADO.*\n/m, '').replace(/INFRA_CONTRACT_ORIGIN = .*;/, '');
if (check) {
  const actual = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (strip(actual) !== strip(text)) {
    console.error(`✗ infra-f2f3-contract.generated.ts no coincide con ${origin}: regenerá con node scripts/gen-infra-contract.mjs`);
    process.exit(1);
  }
  console.log(`✓ contrato F2/F3 al día con ${origin}`);
} else {
  writeFileSync(OUT, text);
  const faltan = built.operations.filter((o) => !o.published);
  console.log(`✓ ${built.operations.length} operaciones (${faltan.length} sin publicar) y ${Object.keys(built.schemas).length} esquemas desde ${origin}`);
  for (const o of faltan) console.log(`  · sin publicar en la API: ${o.method} ${o.path}`);
}
