#!/usr/bin/env node
/**
 * Genera los inventarios que se leen del código, no a mano.
 *
 * Salida: `docs/reports/generated/`. Todo lo que hay en esa carpeta se
 * **regenera**: no se edita a mano, y por eso cada archivo lo dice en su
 * encabezado. Lo que sí se escribe a mano es la interpretación —por qué existe
 * una ruta, qué significa un estado— y vive en el resto de `docs/`.
 *
 * No toca ningún archivo fuera de esa carpeta. No modifica código.
 *
 * Uso:
 *   node scripts/generate-inventory.mjs           # escribe
 *   node scripts/generate-inventory.mjs --check   # falla si hay deriva
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DOCS_ROOT,
  fanIn,
  findCycles,
  findOrphans,
  scanComponents,
  scanEndpoints,
  scanModuleGraph,
  scanRoutes,
  scanServices,
} from './lib/scan.mjs';

const OUT_DIR = join(DOCS_ROOT, 'reports/generated');
const checkOnly = process.argv.includes('--check');

const AVISO = [
  '<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->',
  '',
].join('\n');

const routes = scanRoutes();
const components = scanComponents();
const services = scanServices();
const endpoints = scanEndpoints();
const graph = scanModuleGraph();

const files = {
  'route-inventory.md': routeInventory(),
  'component-inventory.md': componentInventory(),
  'api-inventory.md': apiInventory(),
  'module-graph.md': moduleGraph(),
};

mkdirSync(OUT_DIR, { recursive: true });

let drifted = 0;
for (const [name, content] of Object.entries(files)) {
  const target = join(OUT_DIR, name);
  const previous = safeRead(target);

  if (previous === content) continue;

  if (checkOnly) {
    console.error(`✗ desactualizado: docs/reports/generated/${name}`);
    drifted += 1;
  } else {
    writeFileSync(target, content, 'utf8');
    console.log(`✓ docs/reports/generated/${name}`);
  }
}

if (checkOnly) {
  if (drifted > 0) {
    console.error(
      `\n${drifted} inventario(s) no reflejan el código. Ejecutá: node scripts/generate-inventory.mjs`,
    );
    process.exit(1);
  }
  console.log('✓ los inventarios generados coinciden con el código');
}

// ---------------------------------------------------------------------------

function safeRead(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function routeInventory() {
  const rows = routes.map((route) => {
    const acceso = route.guard === null ? 'Pública' : `Protegida (\`${route.guard}\`)`;
    const destino =
      route.redirectTo !== null
        ? `redirige a \`${route.redirectTo === '' ? '/' : route.redirectTo}\``
        : route.component !== null
          ? `\`${route.component}\`${route.lazy ? ' (diferida)' : ''}`
          : '—';

    return `| \`${route.url}\` | ${destino} | ${acceso} | ${route.renderMode ?? '—'} | ${route.title ?? '—'} |`;
  });

  return [
    AVISO,
    '# Inventario de rutas',
    '',
    `Leído de \`src/app/app.routes.ts\` y \`src/app/app.routes.server.ts\`. ${routes.length} entradas declaradas.`,
    '',
    '| URL | Destino | Acceso | Render en servidor | Título |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    '## Modo de render',
    '',
    'El modo sale de `serverRoutes`. `Prerender` significa que el HTML se genera',
    'en el build; `Client` que el servidor manda el cascarón y el navegador pinta.',
    '',
  ].join('\n');
}

function componentInventory() {
  const byLevel = new Map();
  for (const component of components) {
    if (!byLevel.has(component.level)) byLevel.set(component.level, []);
    byLevel.get(component.level).push(component);
  }

  const order = ['átomo', 'molécula', 'organismo', 'feature', 'core', 'otro'];
  const sections = order
    .filter((level) => byLevel.has(level))
    .map((level) => {
      const list = byLevel.get(level);
      const rows = list.map(
        (component) =>
          `| \`${component.selector}\` | \`${component.className}\` | ${list_(component.inputs)} | ${list_(component.outputs)} | ${list_(component.models)} | ${component.onPush ? 'OnPush' : 'Default'} | ${component.hasSpec ? 'sí' : '**no**'} |`,
      );

      return [
        `## ${capitalize(level)} (${list.length})`,
        '',
        '| Selector | Clase | Entradas | Salidas | Modelos | Detección | Prueba |',
        '|---|---|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n');
    });

  const sinPrueba = components.filter((component) => !component.hasSpec);
  const serviceRows = services.map(
    (service) =>
      `| \`${service.className}\` | \`${service.path}\` | ${service.providedInRoot ? 'root' : 'local'} | ${service.hasSpec ? 'sí' : '**no**'} |`,
  );

  return [
    AVISO,
    '# Inventario de componentes y servicios',
    '',
    `${components.length} componentes y ${services.length} servicios inyectables, leídos de \`src/\`.`,
    '',
    ...sections,
    `## Servicios (${services.length})`,
    '',
    '| Clase | Archivo | Ámbito | Prueba |',
    '|---|---|---|---|',
    ...serviceRows,
    '',
    '## Componentes sin prueba',
    '',
    sinPrueba.length === 0
      ? 'Ninguno.'
      : sinPrueba.map((component) => `- \`${component.className}\` — \`${component.path}\``).join('\n'),
    '',
  ].join('\n');
}

function apiInventory() {
  const byClient = new Map();
  for (const operation of endpoints) {
    if (!byClient.has(operation.client)) byClient.set(operation.client, []);
    byClient.get(operation.client).push(operation);
  }

  const sections = [...byClient.entries()].map(([client, operations]) => {
    const rows = operations.map(
      (operation) => `| \`${operation.method}\` | \`${operation.endpoint}\` |`,
    );
    return [
      `## \`${client}\``,
      '',
      `Archivo: \`${operations[0].path}\``,
      '',
      '| Método | Ruta |',
      '|---|---|',
      ...rows,
      '',
    ].join('\n');
  });

  return [
    AVISO,
    '# Inventario de operaciones HTTP',
    '',
    `${endpoints.length} operaciones declaradas en \`src/app/core/data-access/**/*.client.ts\`.`,
    'Ningún componente arma URLs por su cuenta: si esta lista está completa, la',
    'superficie de red de la aplicación está completa.',
    '',
    ...sections,
  ].join('\n');
}

function moduleGraph() {
  const cycles = findCycles(graph);
  const orphans = findOrphans(graph);
  const counts = [...fanIn(graph)]
    .filter(([file]) => !file.endsWith('.spec.ts'))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20);

  const externals = [...graph.external]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, uses]) => `| \`${name}\` | ${uses} |`);

  return [
    AVISO,
    '# Grafo de módulos',
    '',
    `${graph.files.length} archivos TypeScript bajo \`src/\` y ${graph.edges.length} importaciones internas.`,
    'Los alias `@shared`, `@core/*` y `@features/*` se resuelven contra `tsconfig.json`.',
    '',
    '## Dependencias circulares',
    '',
    cycles.length === 0
      ? '**Ninguna.**'
      : cycles.map((cycle) => `- ${cycle.map((file) => `\`${file}\``).join(' → ')}`).join('\n'),
    '',
    '## Archivos que nadie importa',
    '',
    'Se excluyen los puntos de entrada del framework y las pruebas.',
    '',
    orphans.length === 0
      ? 'Ninguno.'
      : orphans.map((file) => `- \`${file}\``).join('\n'),
    '',
    '## Mayor centralidad (fan-in)',
    '',
    'Cuántos archivos de producción importan a cada uno. Un número alto no es un',
    'problema: es una advertencia de que cambiarlo se paga en muchos lugares.',
    '',
    '| Archivo | Lo importan |',
    '|---|---:|',
    ...counts.map(([file, uses]) => `| \`${file}\` | ${uses} |`),
    '',
    '## Paquetes externos',
    '',
    '| Paquete | Importaciones |',
    '|---|---:|',
    ...externals,
    '',
  ].join('\n');
}

function list_(names) {
  return names.length === 0 ? '—' : names.map((name) => `\`${name}\``).join(', ');
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
