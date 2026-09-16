/**
 * Genera el material de comunicación de AloVida: el **video promocional** y el
 * **mazo de diapositivas para aseguradoras**.
 *
 *   node tools/promo/generar.mjs                # las dos cosas
 *   node tools/promo/generar.mjs --solo-deck    # sólo el PDF y los PNG
 *   node tools/promo/generar.mjs --solo-video   # sólo el MP4
 *   node tools/promo/generar.mjs --fps 24 --conservar-fotogramas
 *
 * Las dos piezas comparten fuente de diseño: `deck-aseguradoras.html` **hereda los
 * estilos de `promo.html`** (este script los extrae a `heredado.css`), así que los
 * tokens de AloVida se tocan en un solo lugar.
 *
 * El video necesita `ffmpeg` con libx264 en el PATH (macOS: `brew install ffmpeg`).
 * El ffmpeg que trae Playwright NO sirve: sólo compila VP8/WebM. El mazo no lo necesita.
 *
 * Salida: `artifacts/promo/` — no se versiona.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const salida = join(raiz, 'artifacts', 'promo');
const fotogramas = join(salida, 'fotogramas');
const laminas = join(salida, 'laminas');

const arg = (n, pd) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : pd; };
const FPS = Number(arg('--fps', 30));
const conservar = process.argv.includes('--conservar-fotogramas');
const soloDeck = process.argv.includes('--solo-deck');
const soloVideo = process.argv.includes('--solo-video');

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
copyFileSync(join(aqui, 'deck-aseguradoras.html'), join(salida, 'deck-aseguradoras.html'));

/* el mazo hereda los estilos del video: una sola fuente para los tokens */
const fuente = readFileSync(join(aqui, 'promo.html'), 'utf8');
const bloques = fuente.match(/<style>[\s\S]*?<\/style>/g) ?? [];
if (!bloques.length) throw new Error('No encontré estilos en promo.html.');
writeFileSync(join(salida, 'heredado.css'), bloques.map((b) => b.slice(7, -8)).join('\n'));

const navegador = await chromium.launch();
const fallos = [];

/* --- 2 · el mazo: un PNG por lámina y un PDF de 17 páginas --- */
if (!soloVideo) {
  rmSync(laminas, { recursive: true, force: true });
  mkdirSync(laminas, { recursive: true });
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  pagina.on('pageerror', (e) => fallos.push('deck: ' + e));
  await pagina.goto('file://' + join(salida, 'deck-aseguradoras.html'));
  await pagina.evaluate(() => document.fonts.ready);
  const hojas = await pagina.$$('.lamina');
  for (let i = 0; i < hojas.length; i++) {
    const caja = await hojas[i].boundingBox();
    if (Math.round(caja.width) !== 1920 || Math.round(caja.height) !== 1080)
      console.log(`  ¡ojo! lámina ${i + 1} mide ${Math.round(caja.width)}×${Math.round(caja.height)}`);
    await hojas[i].screenshot({ path: join(laminas, `lamina-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await pagina.pdf({
    path: join(salida, 'AloVida-para-aseguradoras.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log(`mazo: ${hojas.length} láminas · PDF y PNG en ${salida}`);
  await pagina.close();
}

/* --- 3 · el video: fotograma a fotograma y a MP4 --- */
if (!soloDeck) {
  rmSync(fotogramas, { recursive: true, force: true });
  mkdirSync(fotogramas, { recursive: true });
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  pagina.on('pageerror', (e) => fallos.push('video: ' + e));
  await pagina.goto('file://' + join(salida, 'promo.html'));
  await pagina.evaluate(() => document.fonts.ready);
  const duracion = await pagina.evaluate(() => window.__dur);
  const total = Math.round(duracion * FPS);
  console.log(`video: ${duracion}s · ${total} fotogramas a ${FPS} fps`);
  const inicio = Date.now();
  for (let i = 0; i < total; i++) {
    await pagina.evaluate((t) => window.__seek(t), i / FPS);
    await pagina.screenshot({ path: join(fotogramas, `f${String(i).padStart(5, '0')}.png`) });
    if (i % 150 === 0) console.log(`  ${i}/${total} · ${((Date.now() - inicio) / 1000).toFixed(0)}s`);
  }
  await pagina.close();
  if (readdirSync(fotogramas).length !== total) throw new Error('Faltan fotogramas en disco.');

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
}

await navegador.close();
if (fallos.length) throw new Error('Falló una página durante la captura: ' + fallos.join(' | '));
console.log('Listo: ' + salida);
