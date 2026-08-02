/**
 * Reporte navegable de una corrida de Selenium.
 *
 * Toma el JSON que deja Vitest y lo convierte en una página que se abre en el
 * navegador, con las capturas de los fallos incrustadas. No agrega ninguna
 * dependencia —ni Allure, ni Mochawesome, ni su cadena de paquetes— porque lo
 * único que hacía falta era esto: qué falló, por qué y qué se veía.
 *
 * El JUnit para CI lo emite Vitest por su cuenta, en la misma carpeta.
 *
 *   node scripts/generate-e2e-report.mjs [ruta/a/resultados.json]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

function rutaDeResultados() {
  const explicita = process.argv[2];
  if (explicita !== undefined) {
    return resolve(RAIZ, explicita);
  }

  // Sin argumento, la corrida más reciente: es lo que quiere quien lo invoca a
  // mano después de una ejecución.
  const base = resolve(RAIZ, process.env.E2E_ARTIFACTS_DIR ?? 'artifacts/selenium');
  if (!existsSync(base)) {
    console.error(`No hay artefactos en ${base}. ¿Corriste la suite?`);
    process.exit(1);
  }
  const corridas = readdirSync(base, { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name)
    .sort();
  const ultima = corridas.at(-1);
  if (ultima === undefined) {
    console.error(`No hay ninguna corrida en ${base}.`);
    process.exit(1);
  }
  return join(base, ultima, 'resultados.json');
}

const rutaJson = rutaDeResultados();
if (!existsSync(rutaJson)) {
  console.error(`No existe ${rutaJson}.`);
  process.exit(1);
}

const carpeta = dirname(rutaJson);
const datos = JSON.parse(readFileSync(rutaJson, 'utf8'));

/** Capturas de la corrida, indexadas por el nombre de prueba saneado. */
function capturas() {
  const dir = join(carpeta, 'capturas');
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir).filter((archivo) => archivo.endsWith('.png'));
}

const imagenes = capturas();

/** Empareja una prueba fallida con su captura por el prefijo del nombre. */
function capturaDe(nombre) {
  const clave = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 120);
  return imagenes.find((archivo) => archivo.startsWith(clave)) ?? null;
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const pruebas = [];
for (const archivo of datos.testResults ?? []) {
  for (const caso of archivo.assertionResults ?? []) {
    pruebas.push({
      archivo: basename(archivo.name ?? 'desconocido'),
      suite: (caso.ancestorTitles ?? []).join(' › '),
      titulo: caso.title ?? caso.fullName ?? '(sin nombre)',
      estado: caso.status ?? 'unknown',
      duracion: caso.duration ?? 0,
      errores: caso.failureMessages ?? [],
    });
  }
}

const total = pruebas.length;
const pasadas = pruebas.filter((p) => p.estado === 'passed').length;
const fallidas = pruebas.filter((p) => p.estado === 'failed').length;
const omitidas = total - pasadas - fallidas;
const duracion = pruebas.reduce((suma, p) => suma + p.duracion, 0);

const filas = pruebas
  .map((prueba) => {
    const captura = prueba.estado === 'failed' ? capturaDe(prueba.titulo) : null;
    const detalle =
      prueba.errores.length === 0
        ? ''
        : `<pre class="error">${escapar(prueba.errores.join('\n\n'))}</pre>`;
    const imagen =
      captura === null
        ? ''
        : `<a href="capturas/${captura}"><img src="capturas/${captura}" alt="Captura de ${escapar(prueba.titulo)}" /></a>`;

    return `<tr class="${prueba.estado}">
      <td class="estado">${prueba.estado === 'passed' ? '✓' : prueba.estado === 'failed' ? '✗' : '–'}</td>
      <td>
        <div class="suite">${escapar(prueba.suite)}</div>
        <div class="titulo">${escapar(prueba.titulo)}</div>
        <div class="archivo">${escapar(prueba.archivo)}</div>
        ${detalle}
        ${imagen}
      </td>
      <td class="duracion">${Math.round(prueba.duracion)} ms</td>
    </tr>`;
  })
  .join('\n');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Selenium E2E · ${escapar(basename(carpeta))}</title>
<style>
  :root { color-scheme: light dark; --ok: #15803d; --mal: #b91c1c; --tenue: #6b7280; }
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; padding: 2rem; max-width: 70rem; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .corrida { color: var(--tenue); margin-bottom: 1.5rem; }
  .resumen { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
  .tarjeta { border: 1px solid #8883; border-radius: .5rem; padding: .75rem 1.25rem; min-width: 7rem; }
  .tarjeta b { display: block; font-size: 1.75rem; line-height: 1.2; }
  .tarjeta.ok b { color: var(--ok); }
  .tarjeta.mal b { color: var(--mal); }
  table { border-collapse: collapse; width: 100%; }
  td { border-top: 1px solid #8883; padding: .6rem .5rem; vertical-align: top; }
  .estado { width: 2rem; font-size: 1.1rem; text-align: center; }
  tr.passed .estado { color: var(--ok); }
  tr.failed .estado { color: var(--mal); }
  .suite { color: var(--tenue); font-size: .85rem; }
  .titulo { font-weight: 600; }
  .archivo { color: var(--tenue); font-size: .8rem; font-family: ui-monospace, monospace; }
  .duracion { text-align: right; color: var(--tenue); white-space: nowrap; font-variant-numeric: tabular-nums; }
  pre.error { background: #b91c1c14; border-left: 3px solid var(--mal); padding: .75rem; overflow-x: auto; white-space: pre-wrap; font-size: .8rem; }
  img { max-width: 100%; border: 1px solid #8883; border-radius: .375rem; margin-top: .5rem; }
</style>
</head>
<body>
  <h1>Pruebas de extremo a extremo · Selenium</h1>
  <p class="corrida">Corrida <code>${escapar(basename(carpeta))}</code> · ${escapar(new Date().toISOString())}</p>

  <div class="resumen">
    <div class="tarjeta"><b>${total}</b> pruebas</div>
    <div class="tarjeta ok"><b>${pasadas}</b> pasaron</div>
    <div class="tarjeta ${fallidas > 0 ? 'mal' : ''}"><b>${fallidas}</b> fallaron</div>
    <div class="tarjeta"><b>${omitidas}</b> omitidas</div>
    <div class="tarjeta"><b>${(duracion / 1000).toFixed(1)} s</b> en total</div>
  </div>

  <table>${filas}</table>
</body>
</html>
`;

const destino = join(carpeta, 'reporte.html');
writeFileSync(destino, html, 'utf8');

const relativo = destino.startsWith(RAIZ) ? destino.slice(RAIZ.length + 1) : destino;
console.log(`[e2e] Reporte: ${relativo} (${pasadas}/${total} en verde)`);
