/**
 * Reporte navegable del recorrido visual.
 *
 * Toma el manifiesto que deja la suite de `cypress/e2e/recorrido/` y lo convierte en una
 * sola página con todas las capturas, agrupadas por pantalla y en el orden en
 * que se tomaron. Sin dependencias: lo único que hacía falta era una galería con
 * índice, y para eso alcanza con generar HTML.
 *
 * Las imágenes se enlazan, no se incrustan. Un recorrido son cientos de PNG y en
 * base64 el archivo pesaría cientos de megabytes, que ningún navegador abre con
 * gusto — y como el reporte vive junto a las capturas, las rutas relativas
 * funcionan igual.
 *
 *   node scripts/generate-recorrido-report.mjs
 */

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Raíz del repositorio.
 *
 * `import.meta.dirname` y no `new URL('..', import.meta.url).pathname`: el
 * `pathname` de una URL viene **percent-encoded**, así que una ruta con espacios
 * —como la de este repositorio— llegaba con `%20` y no existía ningún
 * directorio con ese nombre. El reporte decía «no hay capturas» con las capturas
 * ahí al lado, y solo pasaba en Windows.
 */
const RAIZ = resolve(import.meta.dirname, '..');

/**
 * Carpeta de evidencias a reportar.
 *
 * Se puede mover con `EVIDENCIAS_DIR` porque hay **dos** corridas que producen
 * este manifiesto: el recorrido visual, con la red simulada, y el recorrido con
 * usuarios reales contra la API viva. Un solo destino haría que la segunda
 * pisara el reporte de la primera, y el resultado sería una galería en la que no
 * se sabe qué captura salió de datos inventados.
 */
const CARPETA = process.env.EVIDENCIAS_DIR ?? 'recorrido';
const BASE = resolve(RAIZ, 'artifacts', CARPETA);
const DESTINO = join(BASE, 'reporte.html');

/** El rótulo del reporte, que cambia con la carpeta. */
const TITULO = CARPETA === 'real' ? 'Recorrido con usuarios reales' : 'Recorrido visual';

/** Lee un archivo de líneas JSON. Ausente equivale a vacío, no a error. */
function leerJsonl(ruta) {
  if (!existsSync(ruta)) {
    return [];
  }
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea));
}

function escapar(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Agrupa las capturas por pantalla, conservando el orden de captura.
 *
 * El manifiesto ya viene en orden —se escribe agregando líneas— así que agrupar
 * no necesita ordenar nada, sólo repartir.
 */
function agrupar(anotaciones) {
  const grupos = new Map();
  for (const anotacion of anotaciones) {
    const grupo = grupos.get(anotacion.pantalla);
    if (grupo === undefined) {
      grupos.set(anotacion.pantalla, {
        carpeta: anotacion.pantalla,
        titulo: anotacion.titulo,
        capturas: [anotacion],
      });
    } else {
      grupo.capturas.push(anotacion);
    }
  }
  return [...grupos.values()].sort((a, b) => a.carpeta.localeCompare(b.carpeta));
}

function pesoTotal(anotaciones) {
  let bytes = 0;
  for (const anotacion of anotaciones) {
    const absoluta = resolve(RAIZ, anotacion.archivo);
    if (existsSync(absoluta)) {
      bytes += statSync(absoluta).size;
    }
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ESTILOS = `
  :root {
    color-scheme: light dark;
    --fondo: #ffffff;
    --texto: #14181f;
    --tenue: #5a6472;
    --borde: #dfe4ea;
    --panel: #f6f8fa;
    --acento: #1f6feb;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --fondo: #0f1319;
      --texto: #e6e9ef;
      --tenue: #97a1b0;
      --borde: #262d38;
      --panel: #161b23;
      --acento: #5a9bff;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--fondo);
    color: var(--texto);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  header {
    padding: 32px 40px 24px;
    border-bottom: 1px solid var(--borde);
    position: sticky; top: 0; background: var(--fondo); z-index: 10;
  }
  h1 { margin: 0 0 6px; font-size: 22px; letter-spacing: -0.01em; }
  .meta { color: var(--tenue); font-size: 13px; }
  .contenido { display: grid; grid-template-columns: 250px 1fr; gap: 0; align-items: start; }
  nav {
    position: sticky; top: 104px; padding: 24px 16px 40px;
    max-height: calc(100vh - 104px); overflow-y: auto;
    border-right: 1px solid var(--borde);
  }
  nav a {
    display: block; padding: 6px 10px; border-radius: 6px;
    color: var(--texto); text-decoration: none; font-size: 13px;
  }
  nav a:hover { background: var(--panel); color: var(--acento); }
  nav .cuenta { color: var(--tenue); font-variant-numeric: tabular-nums; }
  main { padding: 24px 40px 80px; min-width: 0; }
  section { margin-bottom: 48px; scroll-margin-top: 116px; }
  section h2 { font-size: 17px; margin: 0 0 4px; }
  section .ruta { color: var(--tenue); font-size: 13px; font-family: ui-monospace, monospace; margin-bottom: 16px; }
  .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
  figure {
    margin: 0; border: 1px solid var(--borde); border-radius: 10px;
    overflow: hidden; background: var(--panel);
  }
  figure img { display: block; width: 100%; height: auto; background: #fff; }
  figcaption { padding: 10px 12px; font-size: 12.5px; color: var(--tenue); }
  figcaption strong { color: var(--texto); font-weight: 600; }
  .omisiones {
    margin: 12px 0 0; padding: 12px 14px; border-radius: 8px;
    background: color-mix(in srgb, orange 12%, transparent);
    border: 1px solid color-mix(in srgb, orange 35%, transparent);
    font-size: 13px;
  }
  .omisiones ul { margin: 6px 0 0; padding-left: 18px; }
  .problemas {
    margin: 0 40px 32px; padding: 16px 18px; border-radius: 10px;
    background: color-mix(in srgb, crimson 12%, transparent);
    border: 1px solid color-mix(in srgb, crimson 40%, transparent);
    font-size: 13.5px;
  }
  .problemas h2 { margin: 0 0 8px; font-size: 15px; }
  .problemas table { width: 100%; border-collapse: collapse; }
  .problemas th, .problemas td {
    text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--borde);
    vertical-align: top;
  }
  .problemas td.detalle { font-family: ui-monospace, monospace; word-break: break-all; }
  .limpio {
    margin: 0 40px 32px; padding: 14px 18px; border-radius: 10px;
    background: color-mix(in srgb, seagreen 12%, transparent);
    border: 1px solid color-mix(in srgb, seagreen 40%, transparent);
    font-size: 13.5px;
  }
`;

/**
 * El bloque de problemas del recorrido real.
 *
 * Va **arriba de las capturas** y no al final: un reporte que esconde los fallos
 * debajo de doscientas imágenes es un reporte que se lee como si todo estuviera
 * bien. Cuando no hay ninguno, lo dice igual — el silencio no se distingue de no
 * haber mirado.
 */
function bloqueDeProblemas(problemas, esReal) {
  if (!esReal) {
    return '';
  }
  if (problemas.length === 0) {
    return `<div class="limpio"><strong>Sin errores de consola, excepciones ni respuestas inesperadas.</strong>
      Los <code>403</code> que el producto convierte en una salida —identidad sin verificar, rol sin
      alcance— no cuentan como hallazgo: son el comportamiento correcto.</div>`;
  }
  const filas = problemas
    .map(
      (p) => `<tr>
        <td>${escapar(p.actor)}</td>
        <td>${escapar(p.pantalla)}</td>
        <td>${escapar(p.tipo)}</td>
        <td class="detalle">${escapar(p.detalle)}</td>
      </tr>`,
    )
    .join('\n');
  return `<div class="problemas">
    <h2>${problemas.length} hallazgo${problemas.length === 1 ? '' : 's'} durante el recorrido</h2>
    <table>
      <thead><tr><th>Actor</th><th>Pantalla</th><th>Tipo</th><th>Detalle</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
  </div>`;
}

function main() {
  const anotaciones = leerJsonl(join(BASE, 'manifiesto.jsonl'));
  if (anotaciones.length === 0) {
    console.error(
      `No hay capturas en ${relative(RAIZ, BASE)}. Corré la suite que las produce antes que esto.`,
    );
    process.exit(1);
  }

  const omisiones = leerJsonl(join(BASE, 'omisiones.jsonl'));
  const porPantalla = new Map();
  for (const omision of omisiones) {
    porPantalla.set(omision.pantalla, [...(porPantalla.get(omision.pantalla) ?? []), omision.motivo]);
  }

  const problemas = leerJsonl(join(BASE, 'problemas.jsonl'));
  const grupos = agrupar(anotaciones);

  const indice = grupos
    .map(
      (grupo) =>
        `<a href="#${escapar(grupo.carpeta)}">${escapar(grupo.titulo)} ` +
        `<span class="cuenta">(${grupo.capturas.length})</span></a>`,
    )
    .join('\n');

  const secciones = grupos
    .map((grupo) => {
      const notas = porPantalla.get(grupo.carpeta) ?? [];
      const aviso =
        notas.length === 0
          ? ''
          : `<div class="omisiones"><strong>No capturado en esta pantalla</strong>` +
            `<ul>${notas.map((n) => `<li>${escapar(n)}</li>`).join('')}</ul></div>`;

      const figuras = grupo.capturas
        .map(
          (captura) => `
        <figure>
          <a href="${escapar(relative(BASE, resolve(RAIZ, captura.archivo)))}" target="_blank">
            <img loading="lazy"
                 src="${escapar(relative(BASE, resolve(RAIZ, captura.archivo)))}"
                 alt="${escapar(`${grupo.titulo}: ${captura.accion}`)}">
          </a>
          <figcaption>
            <strong>${String(captura.orden).padStart(2, '0')}</strong> · ${escapar(captura.accion)}
            <br>${escapar(captura.url)}
          </figcaption>
        </figure>`,
        )
        .join('\n');

      return `
      <section id="${escapar(grupo.carpeta)}">
        <h2>${escapar(grupo.titulo)}</h2>
        <div class="ruta">${escapar(grupo.capturas[0].url)} · ${grupo.capturas.length} capturas</div>
        ${aviso}
        <div class="rejilla">${figuras}</div>
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapar(TITULO)} · Mantra Core Health</title>
  <style>${ESTILOS}</style>
</head>
<body>
  <header>
    <h1>${escapar(TITULO)}</h1>
    <div class="meta">
      ${grupos.length} pantallas · ${anotaciones.length} capturas · ${pesoTotal(anotaciones)}
      ${omisiones.length === 0 ? '' : ` · ${omisiones.length} notas de cobertura`}
    </div>
  </header>
  ${bloqueDeProblemas(problemas, CARPETA === 'real')}
  <div class="contenido">
    <nav>${indice}</nav>
    <main>${secciones}</main>
  </div>
</body>
</html>`;

  writeFileSync(DESTINO, html, 'utf8');

  console.log(`Reporte: ${relative(RAIZ, DESTINO)}`);
  if (problemas.length > 0) {
    console.log(`  ${problemas.length} hallazgos registrados durante el recorrido.`);
  }
  console.log(`  ${grupos.length} pantallas, ${anotaciones.length} capturas.`);
  if (omisiones.length > 0) {
    console.log(`  ${omisiones.length} notas de cobertura (controles no accionados).`);
  }
}

main();
