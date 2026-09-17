/**
 * Graba los ejercicios completos de AloVida: un video por módulo.
 *
 *   node tools/promo/flujos/grabar.mjs                      # paciente, médico y farmacia
 *   node tools/promo/flujos/grabar.mjs --solo farmacia
 *   node tools/promo/flujos/grabar.mjs --base http://localhost:4300
 *
 * Cada módulo va por separado a propósito: el ejercicio del paciente, el del médico
 * y el de la farmacia se miran solos. Los tres se graban **manejando la aplicación**
 * —se escribe campo por campo, se hace clic y se fotografía lo que responde—, y los
 * tres terminan con la marca, nunca la abren.
 *
 * Exige la maqueta levantada (`yarn start`) y `ffmpeg` con libx264 en el PATH.
 * Salida: `artifacts/promo/alovida-flujo-<modulo>-1080p.mp4` (+ 720p).
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizRepo = join(aqui, '..', '..', '..');
const salida = join(raizRepo, 'artifacts', 'promo', 'flujos');
const FPS = 30;
const arg = (n, pd) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : pd; };
const BASE = arg('--base', 'http://localhost:4200').replace(/\/$/, '');
const solo = arg('--solo', null);
const MODULOS = ['paciente', 'medico', 'farmacia'].filter((m) => !solo || m === solo);
if (!MODULOS.length) throw new Error(`No conozco el módulo «${solo}». Son: paciente, medico, farmacia.`);

try {
  const sonda = await fetch(BASE);
  if (!sonda.ok) throw new Error('respondió ' + sonda.status);
} catch (e) {
  throw new Error(`Los ejercicios se graban contra la maqueta y ${BASE} no responde (${e.message}). Levantala con \`yarn start\` o pasá --base.`);
}

mkdirSync(salida, { recursive: true });
/* el escenario y las tipografías de marca, al lado de lo grabado */
copyFileSync(join(aqui, 'flujo.html'), join(salida, 'flujo.html'));
const activos = join(salida, 'assets');
mkdirSync(activos, { recursive: true });
for (const [origen, destino] of [
  ['node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2', 'poppins-latin-500-normal.woff2'],
  ['node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2', 'poppins-latin-600-normal.woff2'],
  ['node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2', 'poppins-latin-700-normal.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'],
  ['public/alovida/imagenes/alovida-logo-blanco.svg', 'alovida-logo-blanco.svg'],
]) {
  const src = join(raizRepo, origen);
  if (!existsSync(src)) throw new Error(`Falta ${origen}. ¿Corriste \`yarn install\`?`);
  copyFileSync(src, join(activos, destino));
}

const navegador = await chromium.launch();

/* --- 1 · manejar la aplicación y grabar cada ejercicio --- */
for (const modulo of MODULOS) {
  const { grabar } = await import(`./${modulo}.mjs`);
  console.log(`\n== ${modulo}`);
  await grabar({ navegador, base: BASE, dir: salida });
}

/* --- 2 · un servidor mínimo: el escenario lee lo grabado por http --- */
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const servidor = createServer((pedido, respuesta) => {
  const ruta = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
  const archivo = join(salida, ruta === '/' ? 'flujo.html' : ruta);
  if (!archivo.startsWith(salida)) { respuesta.writeHead(403).end(); return; }
  try {
    respuesta.writeHead(200, { 'content-type': tipos[extname(archivo)] ?? 'application/octet-stream' });
    respuesta.end(readFileSync(archivo));
  } catch { respuesta.writeHead(404).end(); }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const puerto = servidor.address().port;

/* --- 3 · pintar el escenario encima, fotograma a fotograma, y codificar --- */
const codificar = (args, nombre) => {
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg falló al escribir ${nombre}.`);
};
for (const modulo of MODULOS) {
  const fotogramas = join(salida, modulo, 'frames');
  rmSync(fotogramas, { recursive: true, force: true });
  mkdirSync(fotogramas, { recursive: true });
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const fallos = [];
  pagina.on('pageerror', (e) => fallos.push(String(e).slice(0, 140)));
  await pagina.goto(`http://127.0.0.1:${puerto}/flujo.html?f=${modulo}`);
  await pagina.evaluate(() => window.__listo);
  const duracion = await pagina.evaluate(() => window.__dur);
  const total = Math.round(duracion * FPS);
  console.log(`\n== ${modulo}: ${duracion.toFixed(1)}s · ${total} fotogramas`);
  const inicio = Date.now();
  for (let i = 0; i < total; i++) {
    await pagina.evaluate((t) => window.__seek(t), i / FPS);
    await pagina.screenshot({ path: join(fotogramas, `f${String(i).padStart(5, '0')}.png`) });
    if (i % 250 === 0) console.log(`  ${i}/${total} · ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
  }
  await pagina.close();
  if (fallos.length) throw new Error(`El escenario de ${modulo} falló: ` + [...new Set(fallos)].join(' | '));
  if (readdirSync(fotogramas).length !== total) throw new Error(`Faltan fotogramas de ${modulo}.`);

  const mp4 = join(salida, `alovida-flujo-${modulo}-1080p.mp4`);
  codificar(['-y', '-framerate', String(FPS), '-i', join(fotogramas, 'f%05d.png'), '-c:v', 'libx264',
    '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], mp4);
  const mp4720 = join(salida, `alovida-flujo-${modulo}-720p.mp4`);
  codificar(['-y', '-i', mp4, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
    '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4720], mp4720);
  if (!process.argv.includes('--conservar-fotogramas')) rmSync(fotogramas, { recursive: true, force: true });
  console.log(`escrito ${mp4}`);
}

servidor.close();
await navegador.close();
console.log('\nListo: ' + salida);
