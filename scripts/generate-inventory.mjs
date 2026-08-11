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
import { join, sep } from 'node:path';

import {
  DOCS_ROOT,
  fanIn,
  REPO_ROOT,
  findCycles,
  findOrphans,
  scanComponents,
  scanEndpoints,
  scanModuleGraph,
  scanRoutes,
  scanServices,
  walk,
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
  'e2e-inventory.md': e2eInventory(),
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

// --- Suite de extremo a extremo ---------------------------------------------

/**
 * Inventario de la suite de extremo a extremo.
 *
 * Existe por la misma razón que los otros cuatro: **la documentación de lo que
 * se puede leer del código no se escribe a mano**, porque se desactualiza el
 * día que alguien agrega una pantalla y se olvida del README.
 *
 * Y hace algo más que enumerar: cruza los `data-testid` que la suite usa con
 * los que las plantillas declaran. Si alguien quita un atributo de una
 * plantilla, la prueba que se apoyaba en él fallaría recién al correr con
 * navegador —minutos— mientras que acá se ve en segundos y con nombre propio.
 */
function e2eInventory() {
  const suite = join(REPO_ROOT, 'cypress');
  const specs = walk(join(suite, 'e2e'), ['.cy.ts']).sort();
  const pages = walk(join(suite, 'support/pages'), ['.ts']).sort();

  // Las pruebas de Cypress se declaran con `it(`, y las hay a dos niveles de
  // sangría: dentro de un `describe` y dentro de un `for` que genera varias.
  const contarPruebas = (source) => (source.match(/\n\s+it\(/g) ?? []).length;

  const filasSpecs = specs.map((file) => {
    const source = safeRead(file) ?? '';
    // Un archivo puede declarar más de un bloque —`responsive.cy.ts` tiene uno
    // por resolución— y quedarse con el primero escondería los otros.
    const bloques = [...source.matchAll(/describe\(\s*'([^']+)'/g)].map((m) => m[1]);
    const suiteNombre = bloques.length === 0 ? '—' : bloques.join(' · ');
    const carpeta = repoRelative(file).split('/').at(-2) ?? '—';
    return `| \`${carpeta}\` | ${suiteNombre} | ${contarPruebas(source)} | \`${repoRelative(file)}\` |`;
  });

  const totalPruebas = specs.reduce(
    (suma, file) => suma + contarPruebas(safeRead(file) ?? ''),
    0,
  );

  const filasPages = pages.map((file) => {
    const source = safeRead(file) ?? '';
    // Los Page Objects son objetos de funciones, no clases: en Cypress el sujeto
    // es `cy`, que es global, así que una clase sería un envoltorio vacío.
    const nombre = /export const (\w+)\s*=/.exec(source)?.[1] ?? '—';
    // La ruta está en la propiedad, o en la constante que la propiedad usa
    // cuando además es el valor por defecto de `abrir()`.
    const ruta =
      /ruta:\s*'([^']*)'/.exec(source)?.[1] ??
      /const RUTA = '([^']*)'/.exec(source)?.[1] ??
      '—';
    const acciones = (source.match(/\n {2}[a-zA-Z]\w*\(/g) ?? []).length;
    return `| \`${nombre}\` | \`${ruta}\` | ${acciones} | \`${repoRelative(file)}\` |`;
  });

  const escenarios = escenariosDeclarados();
  const filasEscenarios = escenarios.map(
    ({ nombre, descripcion }) => `| \`${nombre}\` | ${descripcion} |`,
  );

  const usados = testIdsUsados(suite);
  const declarados = testIdsDeclarados();
  const huerfanos = usados.filter((id) => !declarados.includes(id));

  const coherencia =
    huerfanos.length === 0
      ? `Los ${usados.length} identificadores que la suite localiza están declarados en las plantillas.`
      : `**${huerfanos.length} identificador(es) que la suite usa ya no existen en ninguna plantilla:** ` +
        huerfanos.map((id) => `\`${id}\``).join(', ') +
        '. Las pruebas que los usan van a fallar.';

  return [
    AVISO,
    '# Inventario de la suite de extremo a extremo (Cypress)',
    '',
    `Leído de \`cypress/\`. ${specs.length} archivos de prueba, ${totalPruebas} pruebas, ` +
      `${pages.length} Page Objects y ${escenarios.length} escenarios de API.`,
    '',
    'La guía de uso —cómo correrla, cómo agregar una prueba, qué variables acepta—',
    'está en [`cypress/README.md`](../../../cypress/README.md).',
    '',
    '## Pruebas por suite',
    '',
    '| Suite | Bloque | Pruebas | Archivo |',
    '| --- | --- | --- | --- |',
    ...filasSpecs,
    '',
    '## Page Objects',
    '',
    '| Objeto | Ruta | Métodos | Archivo |',
    '| --- | --- | --- | --- |',
    ...filasPages,
    '',
    '## Escenarios de la API simulada',
    '',
    '| Escenario | Qué provoca |',
    '| --- | --- |',
    ...filasEscenarios,
    '',
    '## Coherencia de los selectores',
    '',
    coherencia,
    '',
  ].join('\n');
}

/** Los escenarios y su descripción, leídos del catálogo tipado. */
function escenariosDeclarados() {
  const source = safeRead(join(REPO_ROOT, 'cypress/support/fixtures/escenarios.ts')) ?? '';
  const bloque = source.slice(source.indexOf('export const ESCENARIOS'));
  const encontrados = [];
  const patron = /'([a-z-]+)':\s*\{\s*\n\s*descripcion: '([^']+)'/g;

  let coincidencia;
  while ((coincidencia = patron.exec(bloque)) !== null) {
    encontrados.push({ nombre: coincidencia[1], descripcion: coincidencia[2] });
  }
  return encontrados;
}

/** Identificadores que la suite localiza, sin repetir. */
function testIdsUsados(suite) {
  const ids = new Set();
  for (const file of walk(suite, ['.ts'])) {
    const source = safeRead(file) ?? '';
    for (const m of source.matchAll(/porTestId\('([^']+)'\)/g)) ids.add(m[1]);
    for (const m of source.matchAll(/data-testid="([^"]+)"/g)) {
      // `[data-testid="${…}"]` es el localizador genérico de `porTestId`, no un
      // identificador: contarlo denunciaría un huérfano que no existe.
      if (!m[1].includes('${')) ids.add(m[1]);
    }
  }
  return [...ids].sort();
}

/** Identificadores que las plantillas declaran, sin repetir. */
function testIdsDeclarados() {
  const ids = new Set();
  for (const file of walk(join(REPO_ROOT, 'src'), ['.html'])) {
    const source = safeRead(file) ?? '';
    for (const m of source.matchAll(/data-testid="([^"]+)"/g)) ids.add(m[1]);
    // `testId="…"` es la pasarela del átomo `app-input` hacia su `<input>`.
    for (const m of source.matchAll(/\btestId="([^"]+)"/g)) ids.add(m[1]);
  }
  return [...ids].sort();
}

/**
 * Ruta relativa al repositorio, con barras normales.
 *
 * La normalización es lo que hace cierta la frase de arriba: `join()` compone
 * con el separador del sistema, así que en Windows esto devolvía
 * `e2e\selenium\specs\…`. Dos consecuencias, las dos silenciosas:
 *
 * - el inventario quedaba distinto según quién lo regenerara, y CI lo marcaba
 *   como desactualizado sin que el código hubiera cambiado;
 * - la suite de cada spec se deduce partiendo por `/` (ver `e2eInventory`), así
 *   que en Windows salía `—` para todas.
 */
function repoRelative(absolute) {
  const relativa = absolute.startsWith(REPO_ROOT)
    ? absolute.slice(REPO_ROOT.length + 1)
    : absolute;
  return relativa.split(sep).join('/');
}
