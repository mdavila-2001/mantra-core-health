#!/usr/bin/env node
/**
 * Verifica que ninguna ruta del router empiece con un prefijo de la API.
 *
 * ## El defecto que esto impide
 *
 * El proxy compara **por inicio de ruta**. Agregar `/admin` para
 * `GET /admin/tenants` desvió `/administracion/pacientes` —una ruta de la
 * aplicación— hacia la API, que respondió `Cannot GET /administracion/pacientes`
 * y dejó la sección en blanco. Lo encontró el recorrido con usuarios reales, no
 * una prueba: el modo de fallo es una pantalla vacía, no una excepción.
 *
 * `proxy.conf.json` ya deja escrita la regla en un comentario. Un comentario no
 * la hace cumplir, y la migración del router a inglés (2026-08-11) multiplicó
 * las ocasiones de romperla: los nombres en castellano eran seguros por
 * accidente —el proxy está en inglés— y al traducir aparecieron tres colisiones
 * de golpe (`clinical-record` contra `/clinical`, `identity/*` contra
 * `/identity`, `scheduling` contra `/scheduling`). Por eso existe este archivo.
 *
 * ## Qué compara
 *
 * Los prefijos, de `proxy.conf.json` —la misma fuente que ya usa
 * `check-api-prefixes.mjs` para las otras dos declaraciones— contra las rutas
 * declaradas en:
 *
 *   - `core/navigation/navigation.map.ts`  las secciones del armazón
 *   - `app/app.routes.ts`                  raíz, pantallas hijas y redirecciones
 *   - los helpers `pantallaDe*(subpath, …)`, recompuestos con su base
 *
 * Uso: node scripts/check-route-prefixes.mjs
 */

import { join } from 'node:path';

import { read, REPO_ROOT, SRC_ROOT } from './lib/scan.mjs';

/** El bloque de la API, no el de telemetría: `/otel` va al colector, no al backend. */
function prefijosDeLaApi() {
  const bloques = JSON.parse(read(join(REPO_ROOT, 'proxy.conf.json')));
  return bloques
    .filter((bloque) => bloque.pathRewrite === undefined)
    .flatMap((bloque) => bloque.context ?? []);
}

const rutasApp = read(join(SRC_ROOT, 'app/app.routes.ts'));
const rutasNav = read(join(SRC_ROOT, 'app/core/navigation/navigation.map.ts'));

/**
 * Toda ruta declarada, sin barra inicial.
 *
 * El comodín y la raíz se descartan: no son rutas que el proxy pueda capturar.
 */
function rutasDeclaradas() {
  const rutas = new Set();

  for (const fuente of [rutasApp, rutasNav]) {
    for (const [, ruta] of fuente.matchAll(/path:\s*'([^']*)'/g)) {
      if (ruta !== '' && ruta !== '**') rutas.add(ruta);
    }
  }

  // Las redirecciones heredadas y las nuevas viven en tablas, no en `path:`.
  for (const [, ruta] of rutasApp.matchAll(/^\s{2}'?([a-z][\w/-]*)'?:\s*'\//gm)) {
    rutas.add(ruta);
  }

  // Los helpers: `function pantallaDeX(…) { return pantallaDeOperacion('base', …`
  const bases = new Map();
  const declaracion =
    /function\s+(pantallaDe\w+)\([\s\S]*?return\s+pantallaDeOperacion\(\s*'([^']+)'/g;
  for (const [, helper, base] of rutasApp.matchAll(declaracion)) {
    bases.set(helper, base);
  }

  for (const [helper, base] of bases) {
    const llamada = new RegExp(String.raw`${helper}\(\s*'([^']+)'`, 'g');
    for (const [, subpath] of rutasApp.matchAll(llamada)) {
      rutas.add(`${base}/${subpath}`);
    }
  }

  return [...rutas].sort((a, b) => a.localeCompare(b));
}

/**
 * Colisiona si la ruta empieza con el prefijo, **carácter a carácter**.
 *
 * No es por segmento, y esa precisión es el corazón del verificador.
 * `http-proxy-middleware` —el que usa `ng serve`— compara un contexto de texto
 * con `pathname.indexOf(context) === 0`: sin límite de segmento. Por eso
 * `/admin` capturó `/administracion/pacientes`, que no cuelga de `/admin` sino
 * que apenas **empieza igual**.
 *
 * Comprobarlo por segmento dejaría pasar exactamente el defecto histórico, y
 * también a `clinical-record` frente a `/clinical` o a `geolocation` frente a
 * `/geo`.
 */
function colisiona(ruta, prefijo) {
  return `/${ruta}`.startsWith(prefijo);
}

/**
 * Rutas que **no** son de primer nivel, con su padre escrito.
 *
 * El lector junta todo `path:` del archivo sin saber de quién cuelga —con una
 * expresión regular no hay árbol—, así que una ruta anidada se denuncia como si
 * viviera en la raíz. El proxy nunca la ve: lo que viaja es la ruta completa.
 *
 * La excepción se declara acá, con el padre, y no se afloja la comparación:
 * bajar la exigencia dejaría pasar el defecto histórico que este archivo existe
 * para impedir. Si alguna de éstas se promueve a primer nivel, hay que sacarla
 * de esta tabla y renombrarla.
 */
const ANIDADAS = new Map([
  ['practitioners', "cuelga de 'search': la URL real es /search/practitioners"],
]);

const prefijos = prefijosDeLaApi();
const rutas = rutasDeclaradas();
const problemas = [];

for (const ruta of rutas) {
  if (ANIDADAS.has(ruta)) continue;
  for (const prefijo of prefijos) {
    if (colisiona(ruta, prefijo)) {
      problemas.push(`la ruta '/${ruta}' empieza con el prefijo de la API '${prefijo}'`);
    }
  }
}

if (rutas.length === 0) {
  problemas.push('no se leyó ninguna ruta: el lector quedó desincronizado del código');
}

if (problemas.length > 0) {
  console.error(`\n✗ check-route-prefixes — ${problemas.length} colisión(es)\n`);
  for (const problema of problemas) console.error(`  ${problema}`);
  console.error('\n  El proxy compara por inicio de ruta: esa ruta se iría a la API y la');
  console.error('  pantalla quedaría en blanco. Renombrá la ruta, no el prefijo.\n');
  process.exit(1);
}

console.log('✓ check-route-prefixes');
console.log(`  ${rutas.length} rutas del router, ninguna colisiona con los ${prefijos.length} prefijos de la API`);
for (const [ruta, motivo] of ANIDADAS) {
  console.log(`  excepción declarada: '${ruta}' — ${motivo}`);
}
