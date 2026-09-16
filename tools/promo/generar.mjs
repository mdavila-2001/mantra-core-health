/**
 * Genera el material de comunicación de AloVida: el **video promocional** y el
 * **mazo de diapositivas de los módulos de paciente y médico**.
 *
 *   node tools/promo/generar.mjs                # las dos cosas
 *   node tools/promo/generar.mjs --solo-deck    # sólo el PDF y los PNG
 *   node tools/promo/generar.mjs --solo-video   # sólo el MP4
 *   node tools/promo/generar.mjs --fps 24 --conservar-fotogramas
 *   node tools/promo/generar.mjs --solo-deck --base http://localhost:4300
 *
 * **El mazo exige la maqueta levantada** (`yarn start`, :4200 por defecto): sus
 * láminas no son pantallas dibujadas a mano sino **capturas de la aplicación
 * andando**, que este script saca entrando como paciente y como médica del
 * simulador. Si el servidor no responde, falla con ese mensaje y no inventa nada.
 *
 * Las dos piezas comparten fuente de diseño: el mazo **hereda los estilos de
 * `promo.html`** (este script los extrae a `heredado.css`), así que los tokens de
 * AloVida se tocan en un solo lugar.
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
const capturas = join(salida, 'capturas');

const arg = (n, pd) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : pd; };
const FPS = Number(arg('--fps', 30));
const BASE = arg('--base', 'http://localhost:4200').replace(/\/$/, '');
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
copyFileSync(join(aqui, 'deck-paciente-y-medico.html'), join(salida, 'deck-paciente-y-medico.html'));

/* el mazo hereda los estilos del video: una sola fuente para los tokens */
const fuente = readFileSync(join(aqui, 'promo.html'), 'utf8');
const bloques = fuente.match(/<style>[\s\S]*?<\/style>/g) ?? [];
if (!bloques.length) throw new Error('No encontré estilos en promo.html.');
writeFileSync(join(salida, 'heredado.css'), bloques.map((b) => b.slice(7, -8)).join('\n'));

const navegador = await chromium.launch();
const fallos = [];

/* --- 2 · las capturas de la maqueta que ilustran el mazo --- */
/** Entra al simulador con una de sus cuentas. Cualquier contraseña no vacía sirve. */
async function sesion(usuario, alto = 1050) {
  const ctx = await navegador.newContext({
    viewport: { width: 1600, height: alto }, deviceScaleFactor: 2,
    locale: 'es-BO', timezoneId: 'America/La_Paz',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fallos.push('maqueta: ' + e));
  await pg.goto(BASE + '/auth', { waitUntil: 'domcontentloaded' });
  await pg.getByTestId('login-identifier').fill(usuario);
  await pg.locator('input[type="password"]').first().fill('demo1234');
  await pg.getByRole('button', { name: 'Entrar' }).click();
  await pg.waitForTimeout(2400);
  return pg;
}

async function capturarPantallas() {
  rmSync(capturas, { recursive: true, force: true });
  mkdirSync(capturas, { recursive: true });
  /* el cartel flotante del simulador no va a una lámina */
  const foto = async (pg, nombre) => {
    await pg.addStyleTag({ content: 'aside.mock{display:none!important}' });
    await pg.screenshot({ path: join(capturas, nombre + '.png') });
    console.log('  captura · ' + nombre);
  };

  const pac = await sesion('paciente@alovida.mock');
  await pac.goto(BASE + '/my-account/appointments', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  await foto(pac, 'paciente-mis-citas');
  /* pedir turno: hay que elegir profesional para que aparezcan los horarios */
  await pac.goto(BASE + '/my-account/appointments?seccion=pedir', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await pac.locator('main input[type="text"], main input:not([type])').first().fill('Rojas');
  await pac.waitForTimeout(2000);
  await pac.locator('main').getByText('Valeria Rojas Mendoza').first().click();
  await pac.waitForTimeout(3000);
  await foto(pac, 'paciente-agendar');
  await pac.goto(BASE + '/my-account/diagnostic-results', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await foto(pac, 'paciente-resultados');

  const med = await sesion('medica@alovida.mock');
  await med.goto(BASE + '/schedule', { waitUntil: 'domcontentloaded' });
  await med.waitForTimeout(2800);
  await foto(med, 'medico-consultas');
  /* el menú de la columna «Pago», abierto */
  await med.locator('tbody').getByRole('button', { name: /pago/i }).first().click();
  await med.waitForTimeout(1600);
  await foto(med, 'medico-pago');
  await med.keyboard.press('Escape');
  await med.waitForTimeout(600);
  /* a la consulta se llega desde la agenda, no por una dirección escrita a mano */
  const seguir = med.getByRole('button', { name: /Continuar consulta|Iniciar consulta/i }).first();
  await seguir.click();
  await med.waitForTimeout(3000);
  await foto(med, 'medico-consulta');
  await med.getByText('Diagnóstico', { exact: true }).first().click();
  await med.waitForTimeout(2200);
  await foto(med, 'medico-diagnostico');
  await med.goto(BASE + '/my-services', { waitUntil: 'domcontentloaded' });
  await med.waitForTimeout(2400);
  await foto(med, 'medico-servicios');
  await med.setViewportSize({ width: 1600, height: 1150 });
  await med.goto(BASE + '/administration/accounting', { waitUntil: 'domcontentloaded' });
  await med.waitForTimeout(2800);
  await foto(med, 'medico-contabilidad');

  /* la red social: muro, perfil público, chats y directorios */
  await med.setViewportSize({ width: 1600, height: 1050 });
  await med.goto(BASE + '/feed', { waitUntil: 'domcontentloaded' });
  await med.waitForTimeout(2800);
  await foto(med, 'social-muro');

  /* al perfil público se llega por el directorio, no por un id escrito a mano */
  await pac.goto(BASE + '/directory', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  await pac.getByText('Cardiología').first().click();
  await pac.waitForTimeout(2600);
  const perfil = await pac.evaluate(
    () => document.querySelector('main a[href^="/directory/"]')?.getAttribute('href') ?? null,
  );
  if (!perfil) throw new Error('No encontré un perfil en el directorio de médicos.');
  await pac.goto(BASE + perfil, { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2800);
  await foto(pac, 'social-perfil');

  await pac.goto(BASE + '/messaging', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  /* con una conversación abierta: la lista sola no muestra el hilo */
  await pac.getByText('Valeria Rojas Mendoza').first().click();
  await pac.waitForTimeout(2600);
  await foto(pac, 'social-chats');

  await pac.goto(BASE + '/directories', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await foto(pac, 'social-directorios');
}

/* --- 3 · el mazo: un PNG por lámina y un PDF --- */
if (!soloVideo) {
  try {
    const sonda = await fetch(BASE, { method: 'GET' });
    if (!sonda.ok) throw new Error('respondió ' + sonda.status);
  } catch (e) {
    throw new Error(`El mazo sale de capturas de la maqueta y ${BASE} no responde (${e.message}). Levantala con \`yarn start\` o pasá --base.`);
  }
  await capturarPantallas();
  rmSync(laminas, { recursive: true, force: true });
  mkdirSync(laminas, { recursive: true });
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  pagina.on('pageerror', (e) => fallos.push('deck: ' + e));
  await pagina.goto('file://' + join(salida, 'deck-paciente-y-medico.html'));
  await pagina.evaluate(() => document.fonts.ready);
  const hojas = await pagina.$$('.lamina');
  for (let i = 0; i < hojas.length; i++) {
    const caja = await hojas[i].boundingBox();
    if (Math.round(caja.width) !== 1920 || Math.round(caja.height) !== 1080)
      console.log(`  ¡ojo! lámina ${i + 1} mide ${Math.round(caja.width)}×${Math.round(caja.height)}`);
    await hojas[i].screenshot({ path: join(laminas, `lamina-${String(i + 1).padStart(2, '0')}.png`) });
  }
  await pagina.pdf({
    path: join(salida, 'AloVida-modulos-paciente-medico.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
  });
  console.log(`mazo: ${hojas.length} láminas · PDF y PNG en ${salida}`);
  await pagina.close();
}

/* --- 4 · el video: fotograma a fotograma y a MP4 --- */
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
