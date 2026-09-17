/**
 * Genera el material de comunicación de AloVida: el **video promocional** y el
 * **mazo de diapositivas de los módulos de paciente y médico**.
 *
 * Los **videos** son tres, uno por módulo —paciente, médico y farmacia—, y cada uno
 * graba el **ejercicio completo** manejando la aplicación de verdad: se escribe campo
 * por campo, se hace clic y se fotografía lo que responde. Los hace
 * `flujos/grabar.mjs`; acá sólo se los invoca.
 *
 * El **mazo** son capturas quietas de esa misma maqueta, y `extraer-pantallas.mjs`
 * congela las pantallas que alimentan el canvas de Claude Design (`a-canvas.mjs`).
 *
 *   node tools/promo/generar.mjs                # las dos cosas
 *   node tools/promo/generar.mjs --solo-deck    # sólo el PDF y los PNG
 *   node tools/promo/generar.mjs --solo-video   # sólo el MP4
 *   node tools/promo/generar.mjs --fps 24 --conservar-fotogramas
 *   node tools/promo/generar.mjs --solo-deck --base http://localhost:4300
 *
 * **Las dos exigen la maqueta levantada** (`yarn start`, :4200 por defecto): este
 * script entra como paciente, como médica y como plataforma, fotografía trece
 * pantallas y **mide dónde está lo que el video resalta** (`regiones.js`). Si el
 * servidor no responde, falla con ese mensaje y no inventa nada.
 *
 * Los tokens de marca viven en `marca.css`, compartido por las dos piezas.
 *
 * El video necesita `ffmpeg` con libx264 en el PATH (macOS: `brew install ffmpeg`).
 * El ffmpeg que trae Playwright NO sirve: sólo compila VP8/WebM. El mazo no lo necesita.
 *
 * Salida: `artifacts/promo/` — no se versiona.
 */
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
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
for (const archivo of ['deck-paciente-y-medico.html', 'marca.css']) {
  copyFileSync(join(aqui, archivo), join(salida, archivo));
}

const navegador = await chromium.launch();
const fallos = [];
/** Dónde está, en % de cada captura, lo que el video resalta. Lo llena `foto()`. */
const regiones = {};

/* --- 2 · las capturas de la maqueta que ilustran el mazo --- */
/** Entra al simulador con una de sus cuentas. Cualquier contraseña no vacía sirve. */
async function sesion(usuario, alto = 1050) {
  const ctx = await navegador.newContext({
    viewport: { width: 1600, height: alto }, deviceScaleFactor: 2,
    locale: 'es-BO', timezoneId: 'America/La_Paz',
  });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => fallos.push('maqueta: ' + e));
  if (!usuario) return pg;
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
  /* El cartel flotante del simulador no va ni a una lámina ni al video.
     `marcas` son los elementos que el video resalta: se miden acá, en % de la
     imagen, para que los recuadros no sean coordenadas escritas a ojo. */
  const foto = async (pg, nombre, marcas = {}) => {
    await pg.addStyleTag({ content: 'aside.mock{display:none!important}' });
    const vp = pg.viewportSize();
    const medidas = {};
    for (const [clave, loc] of Object.entries(marcas)) {
      const b = await loc.boundingBox().catch(() => null);
      if (!b) throw new Error(`No pude medir ${nombre}.${clave}: la pantalla cambió.`);
      medidas[clave] = {
        x: +((b.x / vp.width) * 100).toFixed(2), y: +((b.y / vp.height) * 100).toFixed(2),
        w: +((b.width / vp.width) * 100).toFixed(2), h: +((b.height / vp.height) * 100).toFixed(2),
      };
    }
    regiones[nombre] = { alto: vp.height, marcas: medidas };
    await pg.screenshot({ path: join(capturas, nombre + '.png') });
    console.log('  captura · ' + nombre + (Object.keys(medidas).length ? ' (' + Object.keys(medidas).join(', ') + ')' : ''));
  };

  /* el registro, sin sesión: es la puerta de entrada del video */
  const pub = await sesion(null);
  await pub.goto(BASE + '/auth/register', { waitUntil: 'domcontentloaded' });
  await pub.waitForTimeout(2200);
  await foto(pub, 'reg-tipos', {
    medico: pub
      .locator('main')
      .getByText('Médico', { exact: true })
      .first()
      .locator('xpath=ancestor::*[self::a or self::button or self::article][1]'),
  });
  await pub.goto(BASE + '/auth/register/practitioner', { waitUntil: 'domcontentloaded' });
  await pub.waitForTimeout(2400);
  await foto(pub, 'reg-medico', { paso: pub.getByText(/Paso 1 de 13/).first() });

  const pac = await sesion('paciente@alovida.mock');
  await pac.goto(BASE + '/my-account/appointments', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  await foto(pac, 'paciente-mis-citas', { lista: pac.locator('main').locator('table, ul').first() });
  /* pedir turno: hay que elegir profesional para que aparezcan los horarios */
  await pac.goto(BASE + '/my-account/appointments?seccion=pedir', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await pac.locator('main input[type="text"], main input:not([type])').first().fill('Rojas');
  await pac.waitForTimeout(2000);
  await pac.locator('main').getByText('Valeria Rojas Mendoza').first().click();
  await pac.waitForTimeout(3000);
  await foto(pac, 'paciente-agendar', {
    buscador: pac.locator('main input[type="text"], main input:not([type])').first(),
    turno: pac.getByRole('link', { name: /Pedir este horario/i }).first(),
  });
  await pac.goto(BASE + '/my-account/diagnostic-results', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await foto(pac, 'paciente-resultados');

  const med = await sesion('medica@alovida.mock');
  await med.goto(BASE + '/schedule', { waitUntil: 'domcontentloaded' });
  await med.waitForTimeout(2800);
  await foto(med, 'medico-consultas', {
    aviso: med.getByText(/consultas que esperan respuesta/).first(),
    fila: med.locator('tbody tr').nth(3),
    pago: med.locator('thead th').nth(5),
  });
  /* el menú de la columna «Pago», abierto */
  await med.locator('tbody').getByRole('button', { name: /pago/i }).first().click();
  await med.waitForTimeout(1600);
  await foto(med, 'medico-pago', { menu: med.locator('app-menu.menu--open').first() });
  await med.keyboard.press('Escape');
  await med.waitForTimeout(600);
  /* a la consulta se llega desde la agenda, no por una dirección escrita a mano */
  const seguir = med.getByRole('button', { name: /Continuar consulta|Iniciar consulta/i }).first();
  await seguir.click();
  await med.waitForTimeout(3000);
  await foto(med, 'medico-consulta', { registrar: med.getByText('Qué vas a registrar').first() });
  await med.getByText('Diagnóstico', { exact: true }).first().click();
  await med.waitForTimeout(2200);
  await foto(med, 'medico-diagnostico', { cie: med.getByText(/catálogo de terminología \(CIE-10\)/).first() });
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
  /* Se publica de verdad, con la propia pantalla: el texto sale de los catálogos
     de `markdown_convertidos/` (el arancel odontológico y sus especialidades),
     nunca de los archivos de personas. */
  await med
    .locator('main textarea')
    .first()
    .fill(
      'Ya está cargado el arancel odontológico 2026 en el catálogo de servicios: endodoncia, ' +
        'periodoncia, ortodoncia y odontopediatría tienen su precio de referencia. #aranceles #odontología',
    );
  await med.waitForTimeout(800);
  await med.getByRole('button', { name: /^Publicar$/ }).first().click();
  await med.waitForTimeout(2800);
  await foto(med, 'social-muro', {
    privacidad: med.getByText('Quién puede leerla').first(),
    reacciones: med.getByText('Me sirve').first(),
  });

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
  await foto(pac, 'social-perfil', {
    verificado: pac.getByText('Verificado').first(),
    actividad: pac.getByText('Actividad en la plataforma').first(),
  });

  await pac.goto(BASE + '/messaging', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  /* con una conversación abierta: la lista sola no muestra el hilo */
  await pac.getByText('Valeria Rojas Mendoza').first().click();
  await pac.waitForTimeout(2600);
  await foto(pac, 'social-chats');

  await pac.goto(BASE + '/directories', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2400);
  await foto(pac, 'social-directorios');

  await pac.goto(BASE + '/directory', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2600);
  await foto(pac, 'directorio-medicos', {
    especialidad: pac.locator('main').getByText('Cardiología').first(),
  });

  await pac.goto(BASE + '/clinics-directory', { waitUntil: 'domcontentloaded' });
  await pac.waitForTimeout(2800);
  await foto(pac, 'directorio-clinicas', {
    mapa: pac.locator('main svg').first(),
    /* la ficha del establecimiento, no el subtítulo de la página */
    ficha: pac.locator('main a, main article, main li').filter({ hasText: /Verificado/ }).first(),
  });

  /* lo presentado a cada aseguradora: hoy sólo lo alcanza la cuenta de plataforma */
  const adm = await sesion('superadmin@alovida.mock');
  if (adm.url().includes('/auth/organization')) {
    await adm.getByText('AloVida Plataforma').first().click();
    await adm.waitForTimeout(2400);
  }
  await adm.goto(BASE + '/administration/insurance-claims', { waitUntil: 'domcontentloaded' });
  await adm.waitForTimeout(2600);
  await foto(adm, 'seguros-solicitudes', { tabla: adm.locator('table').first() });

  writeFileSync(join(salida, 'regiones.js'), 'window.__regiones = ' + JSON.stringify(regiones, null, 2) + ';\n');
}

/* --- 3 · las capturas: las usan el mazo y el video --- */
try {
  const sonda = await fetch(BASE, { method: 'GET' });
  if (!sonda.ok) throw new Error('respondió ' + sonda.status);
} catch (e) {
  throw new Error(`Las dos piezas salen de capturas de la maqueta y ${BASE} no responde (${e.message}). Levantala con \`yarn start\` o pasá --base.`);
}
await capturarPantallas();

/* --- 4 · el mazo: un PNG por lámina y un PDF --- */
if (!soloVideo) {
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

/* --- 5 · los videos: un ejercicio completo por módulo --- */
if (!soloDeck) {
  /* Cada módulo se graba manejando la aplicación de verdad y va en su propio
     archivo: paciente, médico y farmacia se miran por separado. */
  const r = spawnSync('node', [join(aqui, 'flujos', 'grabar.mjs'), '--base', BASE], { stdio: 'inherit' });
  if (r.error || r.status !== 0) throw new Error('Falló la grabación de los ejercicios.');
}

await navegador.close();
if (fallos.length) throw new Error('Falló una página durante la captura: ' + fallos.join(' | '));
console.log('Listo: ' + salida);
