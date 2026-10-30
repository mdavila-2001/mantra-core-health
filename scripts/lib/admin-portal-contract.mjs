/**
 * Lectura de las llamadas HTTP de los clientes del portal de administración y
 * comparación contra el contrato OpenAPI versionado.
 *
 * Es análisis de texto, como `scan.mjs`: sin dependencias nuevas. A diferencia
 * de `scanEndpoints()`, esta lectura **se niega a callar**: si un cliente tiene
 * más llamadas `this.http.<verbo>` de las que logra resolver a una ruta
 * literal, lo informa como «sin resolver» y el gate falla. Un gate que no mira
 * lo que no entiende aprobaría justo lo que debía impedir.
 */

import { join } from 'node:path';

import { read, repoPath, REPO_ROOT, walk } from './scan.mjs';

/** Carpetas de `core/data-access` que hablan con el backend del portal. */
export const CLIENT_DIRECTORIES = ['admin-portal', 'audit', 'authz-admin'];

/** Llamadas que dev aún no declara, con su motivo. */
export const GAPS_FILE = join(REPO_ROOT, 'scripts/contracts/admin-portal-known-gaps.json');

/** Contrato versionado: operaciones `MÉTODO /ruta` del OpenAPI de la API. */
export const CONTRACT_FILE = join(REPO_ROOT, 'scripts/contracts/api-operations.json');

const VERBS = 'get|post|put|patch|delete';

/** Interpolaciones y llaves → `{}`: se compara la forma de la ruta, no el nombre del parámetro. */
export function shapeOf(route) {
  return route
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, '{}')
    .replace(/\{[^}]*\}/g, '{}')
    .replace(/(.)\/+$/, '$1');
}

/** `${encodeURIComponent(userId)}` → `{userId}`: la forma legible para el informe. */
export function readable(route) {
  return route
    .split('?')[0]
    .replace(/\$\{([^}]*)\}/g, (_, expression) => `{${(expression.match(/\w+/g) ?? ['param']).at(-1)}}`);
}

/** `${base}/resto` → el valor del `const base = '…'` declarado antes en el archivo. */
function expandBase(raw, index, bases) {
  const head = /^\$\{(\w+)\}/.exec(raw);
  if (!head) return raw;
  const declared = bases.filter((base) => base.name === head[1] && base.index < index).at(-1);
  return declared ? declared.value + raw.slice(head[0].length) : raw;
}

/**
 * Operaciones de un cliente: `{ method, route }` y la cuenta de llamadas
 * `this.http.<verbo>` que no se pudieron resolver.
 */
export function extractOperations(source) {
  const operations = [];

  const bases = [];
  for (const match of source.matchAll(/const (\w+) = [`']([^`']+)[`'];/g)) {
    bases.push({ index: match.index, name: match[1], value: match[2] });
  }

  // Ayudantes privados que reciben la ruta: `private get<T>(path: string, …)`.
  const helpers = new Map();
  const helperPattern = new RegExp(
    String.raw`private\s+(\w+)\s*(?:<[^>]*>)?\s*\(\s*path:\s*string[\s\S]{0,400}?this\.http\s*\.\s*(${VERBS})\s*(?:<[\s\S]*?>)?\(\s*(?:this\.url|apiUrl)\(\s*(?:this\.baseUrl,\s*)?path\b`,
    'g',
  );
  for (const match of source.matchAll(helperPattern)) {
    helpers.set(match[1], match[2].toUpperCase());
  }

  for (const [name, method] of helpers) {
    const call = new RegExp(String.raw`this\.${name}\s*(?:<[\s\S]*?>)?\(\s*([\x60'])((?:(?!\1)[\s\S])*)\1`, 'g');
    for (const match of source.matchAll(call)) {
      operations.push({ method, route: expandBase(match[2], match.index, bases) });
    }
  }

  const direct = new RegExp(
    String.raw`this\.http\s*\.\s*(${VERBS})\s*(?:<(?:(?!this\.http)[\s\S])*?>)?\(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(?:this\.url|apiUrl)\(\s*(?:this\.baseUrl,\s*)?([\x60'])((?:(?!\2)[\s\S])*)\2`,
    'g',
  );
  const directMatches = [...source.matchAll(direct)];
  for (const match of directMatches) {
    operations.push({ method: match[1].toUpperCase(), route: expandBase(match[3], match.index, bases) });
  }

  // Toda llamada `this.http.<verbo>` debe haber caído en una de las dos formas.
  const total = [...source.matchAll(new RegExp(String.raw`this\.http\s*\.\s*(?:${VERBS})\b`, 'g'))].length;
  const unresolved = total - helpers.size - directMatches.length;

  return { operations, unresolved };
}

/** Clientes (`*.client.ts`) de las carpetas del portal que existan. */
export function clientFiles(directories = CLIENT_DIRECTORIES) {
  return directories
    .flatMap((directory) => walk(join(REPO_ROOT, 'src/app/core/data-access', directory), ['.client.ts']))
    .sort();
}

/** Todas las operaciones de los clientes, con su archivo de origen. */
export function scanPortalOperations(files = clientFiles()) {
  const operations = [];
  const unresolved = [];

  for (const file of files) {
    const result = extractOperations(read(file));
    const path = repoPath(file);
    for (const operation of result.operations) {
      operations.push({ ...operation, file: path, key: `${operation.method} ${shapeOf(operation.route)}` });
    }
    if (result.unresolved !== 0) unresolved.push({ file: path, count: result.unresolved });
  }

  return { operations, unresolved };
}

/** `MÉTODO /ruta` del contrato → conjunto de `MÉTODO forma`. */
export function contractShapes(entries) {
  return new Set(
    entries.map((entry) => {
      const [method, ...route] = entry.split(' ');
      return `${method} ${shapeOf(route.join(' '))}`;
    }),
  );
}

/**
 * Diferencias: llamadas que el contrato no declara (menos las brechas conocidas
 * y motivadas), brechas vencidas —el contrato ya las declara— y clientes con
 * llamadas ilegibles.
 */
export function compare(scan, contractEntries, knownGaps = []) {
  const known = contractShapes(contractEntries);
  const calls = scan.operations.map((operation) => ({
    file: operation.file,
    call: `${operation.method} ${readable(operation.route)}`,
    key: operation.key,
  }));

  const gapKeys = new Map(knownGaps.map((gap) => [contractShapes([gap.call]).values().next().value, gap]));
  const absent = calls.filter((call) => !known.has(call.key));

  return {
    missing: absent.filter((call) => !gapKeys.has(call.key)),
    tolerated: absent.filter((call) => gapKeys.has(call.key)).map((call) => ({ ...call, reason: gapKeys.get(call.key).reason })),
    stale: knownGaps.filter((gap) => known.has(contractShapes([gap.call]).values().next().value)),
    unresolved: scan.unresolved,
  };
}
