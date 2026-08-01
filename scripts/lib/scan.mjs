/**
 * Lectura del árbol de fuentes, compartida por los generadores y los
 * verificadores documentales.
 *
 * Es análisis de texto, no de AST: no se agrega ninguna dependencia al proyecto
 * para leerlo. El alcance de lo que hace falta extraer —selector, entradas,
 * salidas, endpoints— cabe en expresiones regulares acotadas, y cada una está
 * anclada a la forma que el código realmente usa (entradas de señal, clientes
 * con `this.url('/…')`). Si el código cambiara de forma, estas funciones
 * devolverían menos, y los verificadores de cobertura lo denunciarían: el modo
 * de fallo es «falta documentación», nunca «se documentó algo que no existe».
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Raíz del repositorio, deducida desde este archivo. */
export const REPO_ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');

export const SRC_ROOT = join(REPO_ROOT, 'src');
export const DOCS_ROOT = join(REPO_ROOT, 'docs');

/** Rutas relativas al repo, siempre con `/`, para que el informe sea estable. */
export function repoPath(absolute) {
  return relative(REPO_ROOT, absolute).split(sep).join('/');
}

/** Todos los archivos bajo `root` que terminan en alguna de las extensiones. */
export function walk(root, extensions) {
  const found = [];
  const pending = [root];

  while (pending.length > 0) {
    const current = pending.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(full);
      } else if (extensions.some((extension) => entry.name.endsWith(extension))) {
        found.push(full);
      }
    }
  }

  return found.sort();
}

export function read(file) {
  return readFileSync(file, 'utf8');
}

export function exists(file) {
  try {
    statSync(file);
    return true;
  } catch {
    return false;
  }
}

/**
 * Nivel de atomic design de un componente, deducido de dónde vive.
 *
 * La carpeta es la fuente: el proyecto ordena `shared/components/{atoms,
 * molecules,organisms}` y no declara el nivel en el código. Lo que no está en
 * esa jerarquía no es del sistema de diseño y se rotula por su capa.
 */
export function levelOf(path) {
  if (path.includes('/shared/components/atoms/')) return 'átomo';
  if (path.includes('/shared/components/molecules/')) return 'molécula';
  if (path.includes('/shared/components/organisms/')) return 'organismo';
  if (path.includes('/features/')) return 'feature';
  if (path.includes('/core/')) return 'core';
  return 'otro';
}

/** Todos los `@Component` del árbol, con selector, entradas y salidas. */
export function scanComponents() {
  return walk(SRC_ROOT, ['.ts'])
    .filter((file) => !file.endsWith('.spec.ts'))
    .map((file) => ({ file, source: read(file) }))
    .filter(({ source }) => /@Component\(/.test(source))
    .map(({ file, source }) => {
      const path = repoPath(file);
      return {
        path,
        level: levelOf(`/${path}`),
        className: /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)',
        selector: /selector:\s*'([^']+)'/.exec(source)?.[1] ?? '(sin selector)',
        standalone: !/standalone:\s*false/.test(source),
        onPush: /ChangeDetectionStrategy\.OnPush/.test(source),
        inputs: signalMembers(source, 'input'),
        outputs: signalMembers(source, 'output'),
        models: signalMembers(source, 'model'),
        hasSpec: exists(file.replace(/\.ts$/, '.spec.ts')),
        hasStyles: /styleUrl:/.test(source),
        summary: leadingDoc(source),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

/** Todos los `@Injectable` del árbol. */
export function scanServices() {
  return walk(SRC_ROOT, ['.ts'])
    .filter((file) => !file.endsWith('.spec.ts'))
    .map((file) => ({ file, source: read(file) }))
    .filter(({ source }) => /@Injectable\(/.test(source))
    .map(({ file, source }) => ({
      path: repoPath(file),
      className: /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)',
      providedInRoot: /providedIn:\s*'root'/.test(source),
      hasSpec: exists(file.replace(/\.ts$/, '.spec.ts')),
      summary: leadingDoc(source),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

/**
 * Operaciones HTTP declaradas en los clientes de `core/data-access`.
 *
 * Se extrae el verbo de la llamada a `HttpClient` y la ruta del literal que la
 * acompaña. Solo se miran los archivos `*.client.ts`: es donde el proyecto
 * concentra el acceso a la API, y buscar en todo el árbol invitaría a que una
 * URL suelta en un componente pasara por operación documentada en vez de por
 * infracción de la arquitectura.
 */
export function scanEndpoints() {
  const operations = [];

  for (const file of walk(join(SRC_ROOT, 'app/core/data-access'), ['.client.ts'])) {
    if (file.endsWith('.spec.ts')) continue;
    const source = read(file);
    const path = repoPath(file);
    const client = /export class (\w+)/.exec(source)?.[1] ?? '(sin clase)';

    // `this.http.get<Tipo>(this.url('/ruta')` y sus variantes con `apiUrl(...)`.
    // Los `\s*` no son decorativos: los clientes encadenan `this.http` y el
    // verbo en líneas distintas para que quepa el `.pipe(map(...))` de abajo.
    const call =
      /this\.http\s*\.\s*(get|post|put|patch|delete)\s*(?:<[\s\S]*?>)?\(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(?:this\.url|apiUrl)\(\s*(?:this\.baseUrl,\s*)?[`']([^`']+)[`']/g;
    let match;
    while ((match = call.exec(source)) !== null) {
      operations.push({
        client,
        path,
        method: match[1].toUpperCase(),
        endpoint: normalizeEndpoint(match[2]),
      });
    }
  }

  return operations.sort(
    (a, b) => a.endpoint.localeCompare(b.endpoint) || a.method.localeCompare(b.method),
  );
}

/**
 * `${id}` interpolado → `:id`, para que la ruta se lea como la publica la API.
 *
 * El último identificador de la interpolación es el que nombra el parámetro:
 * `${encodeURIComponent(valueSetId)}` es `:valueSetId`, no `:encodeURIComponent`.
 */
function normalizeEndpoint(raw) {
  return raw.replace(/\$\{([^}]*)\}/g, (_, expression) => {
    const names = expression.match(/\w+/g) ?? [];
    return `:${names.at(-1) ?? 'param'}`;
  });
}

/**
 * Rutas declaradas en `app.routes.ts`, con su modo de render del servidor.
 *
 * Se leen los `path:` de primer y segundo nivel junto al `component`,
 * `loadComponent`, `title`, `canActivate` y `redirectTo` que los acompañan
 * dentro del mismo objeto literal.
 */
export function scanRoutes() {
  const source = read(join(SRC_ROOT, 'app/app.routes.ts'));
  const serverSource = read(join(SRC_ROOT, 'app/app.routes.server.ts'));

  const renderModes = new Map();
  const serverEntry = /path:\s*'([^']*)',\s*\n?\s*renderMode:\s*RenderMode\.(\w+)/g;
  let serverMatch;
  while ((serverMatch = serverEntry.exec(serverSource)) !== null) {
    renderModes.set(serverMatch[1], serverMatch[2]);
  }

  const array = balanced(source, source.indexOf('export const routes'), '[', ']');
  const routes = [];

  /** Cada objeto de un array de rutas, con su prefijo de URL heredado. */
  const collect = (body, parentPath, parentGuard) => {
    for (const object of objectsOf(body)) {
      const childrenAt = object.indexOf('children:');
      const children = childrenAt === -1 ? '' : balanced(object, childrenAt, '[', ']');

      // Los campos propios se leen del objeto **sin** sus hijas: de lo
      // contrario el `redirectTo` y el `title` de la primera hija se le
      // atribuirían al layout que las contiene.
      const own = childrenAt === -1 ? object : object.slice(0, childrenAt);

      const path = /path:\s*'([^']*)'/.exec(own)?.[1] ?? '';
      const url = joinPath(parentPath, path);
      const guard = /canActivate:\s*\[\s*(\w+)/.exec(own)?.[1] ?? parentGuard;

      routes.push({
        path,
        url,
        parentPath,
        component:
          /component:\s*(\w+)/.exec(own)?.[1] ??
          /\.then\(\s*\(m\)\s*=>\s*m\.(\w+)/.exec(own)?.[1] ??
          null,
        lazy: /loadComponent:/.test(own),
        title: /title:\s*'([^']+)'/.exec(own)?.[1] ?? null,
        guard,
        ownGuard: /canActivate:/.test(own),
        redirectTo: /redirectTo:\s*'([^']*)'/.exec(own)?.[1] ?? null,
        pathMatchFull: /pathMatch:\s*'full'/.test(own),
        // `serverRoutes` declara las rutas sin barra inicial (`'auth/registro'`)
        // y acá se compone la URL con ella: se compara sin la barra.
        renderMode: renderModes.get(url.replace(/^\//, '')) ?? renderModes.get('**') ?? null,
      });

      if (children !== '') {
        collect(children, url, guard);
      }
    }
  };

  collect(array, '', null);
  return routes;
}

/** Contenido entre el primer `open` a partir de `from` y su cierre pareado. */
function balanced(source, from, open, close) {
  const start = source.indexOf(open, from);
  if (start === -1) return '';

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === open) depth += 1;
    else if (character === close) {
      depth -= 1;
      if (depth === 0) return source.slice(start + 1, index);
    }
  }
  return '';
}

/** Los objetos literales de primer nivel de un cuerpo de array. */
function objectsOf(body) {
  const objects = [];
  let depth = 0;
  let start = -1;

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        objects.push(body.slice(start + 1, index));
        start = -1;
      }
    }
  }

  return objects;
}

/** URL completa de una ruta hija. La raíz se representa como `/`. */
function joinPath(parent, path) {
  const joined = [parent, path].filter((part) => part !== '').join('/');
  return joined === '' ? '/' : `/${joined.replace(/^\/+/, '')}`;
}

// ---------------------------------------------------------------------------
// Grafo de módulos
// ---------------------------------------------------------------------------

/** Alias de `tsconfig.json`, para resolver `@shared`, `@core/*` y `@features/*`. */
const ALIASES = [
  ['@shared/', 'src/app/shared/'],
  ['@core/', 'src/app/core/'],
  ['@features/', 'src/app/features/'],
];

/**
 * Grafo dirigido de importaciones entre archivos `.ts` de `src/`.
 *
 * Es el sustituto reproducible de Graphify para este repositorio: mismos nodos
 * (archivos), mismas aristas (imports), y de él salen las tres preguntas que el
 * plan exige responder —ciclos, huérfanos y centralidad— sin depender de una
 * herramienta externa que no está instalada.
 *
 * Solo se resuelven los imports **internos**: los de paquetes (`@angular/core`,
 * `rxjs`) se cuentan aparte, porque el grafo que interesa es el del código
 * propio.
 */
export function scanModuleGraph() {
  const files = walk(SRC_ROOT, ['.ts']).map(repoPath);
  const known = new Set(files);
  const edges = [];
  const external = new Map();
  /** Imports internos que no resuelven: archivos que faltan o rutas mal escritas. */
  const dangling = [];

  for (const file of files) {
    const source = read(join(REPO_ROOT, file));
    const importPattern = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g;
    let match;
    while ((match = importPattern.exec(source)) !== null) {
      const specifier = match[1];
      const resolved = resolveSpecifier(file, specifier, known);

      if (resolved === null) {
        // Un import relativo que no resuelve **no es un paquete externo**: es
        // un import colgado, o un archivo que todavía no existe. Contarlo como
        // paquete producía entradas absurdas —`.` y `..` figurando como
        // dependencias— y, peor, inflaba el recuento de superficie externa,
        // que es justo la cifra que este inventario existe para vigilar.
        if (specifier.startsWith('.') || specifier.startsWith('@core/') ||
            specifier.startsWith('@shared') || specifier.startsWith('@features/')) {
          dangling.push({ from: file, specifier });
          continue;
        }

        const packageName = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        external.set(packageName, (external.get(packageName) ?? 0) + 1);
        continue;
      }

      if (resolved !== file) {
        edges.push({ from: file, to: resolved });
      }
    }
  }

  return { files, edges, external, dangling };
}

/** Ruta de archivo del import, o `null` si es un paquete externo. */
function resolveSpecifier(fromFile, specifier, known) {
  let candidate = null;

  if (specifier.startsWith('.')) {
    const base = fromFile.split('/').slice(0, -1);
    for (const part of specifier.split('/')) {
      if (part === '.') continue;
      else if (part === '..') base.pop();
      else base.push(part);
    }
    candidate = base.join('/');
  } else if (specifier === '@shared') {
    candidate = 'src/app/shared/index';
  } else {
    const alias = ALIASES.find(([prefix]) => specifier.startsWith(prefix));
    if (alias === undefined) return null;
    candidate = specifier.replace(alias[0], alias[1]);
  }

  for (const suffix of ['.ts', '/index.ts', '']) {
    const attempt = `${candidate}${suffix}`;
    if (known.has(attempt)) return attempt;
  }
  return null;
}

/**
 * Ciclos de importación, como listas de archivos.
 *
 * Recorrido en profundidad con pila explícita; cada ciclo se reporta una sola
 * vez, normalizado por su archivo menor para que dos recorridos del mismo ciclo
 * no cuenten como dos.
 */
export function findCycles({ files, edges }) {
  const out = new Map(files.map((file) => [file, []]));
  for (const { from, to } of edges) {
    out.get(from)?.push(to);
  }

  const cycles = new Map();
  const state = new Map();
  const stack = [];

  const visit = (node) => {
    state.set(node, 'open');
    stack.push(node);

    for (const next of out.get(node) ?? []) {
      if (state.get(next) === 'open') {
        const cycle = stack.slice(stack.indexOf(next));
        const key = [...cycle].sort().join(' → ');
        if (!cycles.has(key)) cycles.set(key, cycle);
      } else if (state.get(next) === undefined) {
        visit(next);
      }
    }

    stack.pop();
    state.set(node, 'done');
  };

  for (const file of files) {
    if (state.get(file) === undefined) visit(file);
  }

  return [...cycles.values()];
}

/** Cuántos archivos importan a cada archivo. Es la centralidad que interesa. */
export function fanIn({ files, edges }) {
  const counts = new Map(files.map((file) => [file, 0]));
  for (const { to } of edges) {
    counts.set(to, (counts.get(to) ?? 0) + 1);
  }
  return counts;
}

/**
 * Archivos que nadie importa y que tampoco son un punto de entrada.
 *
 * Los puntos de entrada se declaran acá y no se deducen: `main.ts`, el servidor
 * y las rutas los carga el framework, y las pruebas las carga el corredor.
 */
export const ENTRY_POINTS = [
  'src/main.ts',
  'src/main.server.ts',
  'src/server.ts',
  'src/test-setup.ts',
  'src/app/app.config.ts',
  'src/app/app.config.server.ts',
  'src/app/app.routes.ts',
  'src/app/app.routes.server.ts',
];

export function findOrphans(graph) {
  const counts = fanIn(graph);
  return graph.files.filter(
    (file) =>
      counts.get(file) === 0 &&
      !ENTRY_POINTS.includes(file) &&
      !file.endsWith('.spec.ts'),
  );
}

/**
 * Primera línea útil del comentario de bloque que encabeza la declaración.
 *
 * Sirve de resumen sin obligar a mantener una tabla paralela: el proyecto
 * documenta cada componente en su propio archivo, y esto lo cosecha.
 */
function leadingDoc(source) {
  const blocks = [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)];
  const last = blocks.at(-1);
  if (last === undefined) return '';

  const lines = last[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*ted?\s?/, '').replace(/^\s*\*\s?/, '').trim())
    .filter((line) => line !== '');

  return (lines[0] ?? '').replace(/\|/g, '\\|');
}

/** Nombres de las entradas/salidas/modelos declarados como señal. */
function signalMembers(source, kind) {
  const pattern = new RegExp(
    `readonly\\s+(\\w+)\\s*=\\s*${kind}(?:\\.required)?[<(]`,
    'g',
  );
  const names = [];
  let match;
  while ((match = pattern.exec(source)) !== null) {
    names.push(match[1]);
  }
  return names;
}
