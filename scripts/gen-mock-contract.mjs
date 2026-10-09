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
 * git -C ../mantra-core-health-api fetch origin dev test
 * node scripts/gen-mock-contract.mjs              # regenera desde la rama de la API que toca
 * node scripts/gen-mock-contract.mjs --check      # falla si el catálogo quedó viejo
 * node scripts/gen-mock-contract.mjs --api-ref origin/test
 * node scripts/gen-mock-contract.mjs /tmp/openapi.json   # un archivo suelto
 * ```
 *
 * Sale `src/app/core/mock/contract/api-contract.generated.ts`. No se edita a
 * mano: lo que la maqueta acepta de más va en `simulator-extensions.ts`.
 *
 * ## De qué rama de la API
 *
 * Cada rama del front se contrasta con la de la API que despliega junto a ella
 * (`API_REF_BY_FRONT_BRANCH`): `mockup` y `dev` con `origin/dev`, `test` con
 * `origin/test`. La rama del front se toma de `GITHUB_BASE_REF` (un PR en CI)
 * o, en local, de la rama que sigue la de trabajo (`justin/x` → `origin/mockup`
 * → `mockup`). El repo de la API se busca al lado (`../mantra-core-health-api`)
 * o en `MANTRA_API_REPO`. No hace `fetch`: con una copia vieja de la rama, el
 * chequeo compara contra esa — el script dice qué commit leyó.
 *
 * ## `--check`
 *
 * Genera en memoria y compara con el archivo versionado. Si difieren, sale en
 * 1 y dice cuántas operaciones y esquemas cambiaron: la maqueta está validando
 * contra un contrato que la API ya no tiene. No escribe nada.
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

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { REPO_ROOT } from './lib/scan.mjs';

const OUT = join(REPO_ROOT, 'src/app/core/mock/contract/api-contract.generated.ts');
const OPENAPI_PATH = 'openapi/openapi.json';

/** La rama de la API que se despliega con cada rama del front. */
const API_REF_BY_FRONT_BRANCH = {
  mockup: 'origin/dev',
  dev: 'origin/dev',
  test: 'origin/test',
};

const git = (cwd, ...args) =>
  execFileSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();

function fail(message, code = 2) {
  console.error(`✗ ${message}`);
  process.exit(code);
}

/** La rama base del front: la del PR en CI, o la que sigue la rama local. */
function frontBaseBranch() {
  if (process.env.GITHUB_BASE_REF) return process.env.GITHUB_BASE_REF;
  try {
    const upstream = git(REPO_ROOT, 'rev-parse', '--abbrev-ref', '@{upstream}');
    return upstream.replace(/^origin\//, '');
  } catch {
    return git(REPO_ROOT, 'rev-parse', '--abbrev-ref', 'HEAD');
  }
}

function parseArgs(argv) {
  const args = { check: false, apiRef: null, file: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--check') args.check = true;
    else if (argv[i] === '--api-ref')
      args.apiRef = argv[++i] ?? fail('--api-ref necesita una rama, p. ej. origin/dev');
    else if (argv[i].startsWith('--')) fail(`opción desconocida: ${argv[i]}`);
    else args.file = argv[i];
  }
  return args;
}

/** El `openapi.json` a leer y de dónde salió, para decirlo en la salida. */
function readOpenapi({ file, apiRef }) {
  if (file) return { text: readFileSync(file, 'utf8'), origin: file };
  const apiRepo = resolve(REPO_ROOT, process.env.MANTRA_API_REPO ?? '../mantra-core-health-api');
  if (!existsSync(apiRepo)) {
    fail(`no encuentro el repo de la API en ${apiRepo}: pasá MANTRA_API_REPO o un openapi.json`);
  }
  const branch = frontBaseBranch();
  const ref = apiRef ?? API_REF_BY_FRONT_BRANCH[branch];
  if (!ref) fail(`la rama «${branch}» del front no tiene rama de API asignada: usá --api-ref`);
  let commit;
  let text;
  try {
    commit = git(apiRepo, 'rev-parse', '--short', '--verify', `${ref}^{commit}`);
    text = git(apiRepo, 'show', `${ref}:${OPENAPI_PATH}`);
  } catch {
    fail(
      `no pude leer ${OPENAPI_PATH} en ${ref} del repo de la API (${apiRepo}). ¿Falta un git fetch?`,
    );
  }
  return { text, origin: `${ref} (${commit}) de la API, para la rama ${branch} del front` };
}

const args = parseArgs(process.argv.slice(2));
const { text, origin } = readOpenapi(args);
const openapi = JSON.parse(text);
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
const relativeOut = OUT.replace(REPO_ROOT + '/', '');

if (args.check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current === body) {
    console.log(`✓ ${relativeOut} está al día con ${origin}`);
    process.exit(0);
  }
  const before = exportedJson(current);
  const changedRoutes = diffCount(
    before.routes,
    routes.map((r) => r.join(' ')),
  );
  const changedSchemas = Object.keys({ ...before.schemas, ...sortedSchemas }).filter(
    (name) => JSON.stringify(before.schemas[name]) !== JSON.stringify(sortedSchemas[name]),
  );
  console.error(
    `✗ ${relativeOut} quedó viejo respecto de ${origin}: ` +
      `${changedRoutes} operaciones y ${changedSchemas.length} esquemas distintos` +
      `${changedSchemas.length > 0 ? ` (${changedSchemas.slice(0, 8).join(', ')}${changedSchemas.length > 8 ? '…' : ''})` : ''}.\n` +
      '  La maqueta valida contra un contrato que la API ya no tiene. Regenerá con: node scripts/gen-mock-contract.mjs',
  );
  process.exit(1);
}

writeFileSync(OUT, body);
console.log(
  `✓ ${relativeOut}: ${routes.length} operaciones, ${Object.keys(sortedSchemas).length} esquemas, desde ${origin}`,
);

/** Las rutas y esquemas de un catálogo ya generado, para contar qué cambió. */
function exportedJson(source) {
  const grab = (name, fallback) => {
    const start = source.indexOf(`export const ${name}`);
    if (start === -1) return fallback;
    const from = source.indexOf('=', start) + 1;
    return JSON.parse(source.slice(from, source.indexOf(';\n', from)));
  };
  return {
    routes: grab('CONTRACT_ROUTES', []).map((r) => r.join(' ')),
    schemas: grab('CONTRACT_SCHEMAS', {}),
  };
}

/** Cuántos elementos están en una lista y no en la otra, en las dos direcciones. */
function diffCount(a, b) {
  const left = new Set(a);
  const right = new Set(b);
  return (
    [...left].filter((x) => !right.has(x)).length + [...right].filter((x) => !left.has(x)).length
  );
}
