/**
 * Genera el video promocional de AloVida a partir de `promo.html`.
 *
 * `promo.html` no usa animaciones de CSS: cada fotograma es función pura de `t`
 * (`window.__seek(t)`). Este script abre la página en Chromium, la mueve fotograma
 * a fotograma, fotografía cada uno y los encadena con ffmpeg. Determinista: dos
 * corridas producen el mismo video, y no depende de la velocidad de la máquina.
 *
 *   node tools/promo/generar.mjs            # 1080p, 30 fps
 *   node tools/promo/generar.mjs --fps 24   # otra cadencia
 *   node tools/promo/generar.mjs --conservar-fotogramas
 *
 * Necesita `ffmpeg` con libx264 en el PATH (en macOS: `brew install ffmpeg`).
 * El ffmpeg que trae Playwright NO sirve: sólo compila VP8/WebM.
 *
 * Salida: `artifacts/promo/promo-alovida-1080p.mp4` (+ 720p) — `artifacts/` no se versiona.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const salida = join(raiz, 'artifacts', 'promo');
const fotogramas = join(salida, 'fotogramas');

const arg = (n, pd) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : pd; };
const FPS = Number(arg('--fps', 30));
const conservar = process.argv.includes('--conservar-fotogramas');

/* --- 1 · las fuentes y el logotipo salen del propio repositorio --- */
const activos = join(salida, 'assets');
mkdirSync(activos, { recursive: true });
const copias = [
  ['node_modules/@fontsource/poppins/files/poppins-latin-500-normal.woff2', 'poppins-latin-500-normal.woff2'],
  ['node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2', 'poppins-latin-600-normal.woff2'],
  ['node_modules/@fontsource/poppins/files/poppins-latin-700-normal.woff2', 'poppins-latin-700-normal.woff2'],
  ['node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', 'inter-latin-wght-normal.woff2'],
  ['public/alovida/imagenes/alovida-logo.svg', 'alovida-logo.svg'],
  ['public/alovida/imagenes/alovida-logo-blanco.svg', 'alovida-logo-blanco.svg'],
];
for (const [origen, destino] of copias) {
  const src = join(raiz, origen);
  if (!existsSync(src)) throw new Error(`Falta ${origen}. ¿Corriste \`yarn install\`?`);
  copyFileSync(src, join(activos, destino));
}
copyFileSync(join(aqui, 'promo.html'), join(salida, 'promo.html'));

/* --- 2 · fotograma a fotograma --- */
rmSync(fotogramas, { recursive: true, force: true });
mkdirSync(fotogramas, { recursive: true });
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const fallos = [];
pagina.on('pageerror', (e) => fallos.push(String(e)));
await pagina.goto('file://' + join(salida, 'promo.html'));
await pagina.evaluate(() => document.fonts.ready);
const duracion = await pagina.evaluate(() => window.__dur);
const total = Math.round(duracion * FPS);
console.log(`AloVida · ${duracion}s · ${total} fotogramas a ${FPS} fps`);
const inicio = Date.now();
for (let i = 0; i < total; i++) {
  await pagina.evaluate((t) => window.__seek(t), i / FPS);
  await pagina.screenshot({ path: join(fotogramas, `f${String(i).padStart(5, '0')}.png`) });
  if (i % 150 === 0) console.log(`  ${i}/${total} · ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
}
await navegador.close();
if (fallos.length) throw new Error('La página falló durante la captura: ' + fallos.join(' | '));
if (readdirSync(fotogramas).length !== total) throw new Error('Faltan fotogramas en disco.');

/* --- 3 · a MP4 --- */
const codificar = (args, nombre) => {
  const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error(`ffmpeg falló al escribir ${nombre}.`);
  console.log('escrito ' + nombre);
};
const patron = join(fotogramas, 'f%05d.png');
const mp4 = join(salida, 'promo-alovida-1080p.mp4');
codificar(['-y', '-framerate', String(FPS), '-i', patron, '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], mp4);
const mp4720 = join(salida, 'promo-alovida-720p.mp4');
codificar(['-y', '-i', mp4, '-vf', 'scale=1280:720:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
  '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4720], mp4720);
const portada = join(salida, 'portada.png');
codificar(['-y', '-i', mp4, '-ss', '00:00:02.6', '-frames:v', '1', portada], portada);

if (!conservar) rmSync(fotogramas, { recursive: true, force: true });
console.log('Listo: ' + salida);
