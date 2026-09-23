/**
 * Evidencia de que «Visitas de laboratorio» se lee como la agenda de pacientes.
 *
 * El pedido del propietario: la bandeja de visitadores mostraba una `<table>`
 * escrita a mano —fechas en `toLocaleString('es-BO')`, estados como texto gris,
 * botones «Aceptar»/«Rechazar» con palabras— mientras la agenda de pacientes usa
 * `app-data-table`, sellos de estado y acciones con ícono. Una visita ocupa
 * lugar en el día igual que una consulta: se lee igual.
 *
 * Lo que se comprueba, con la pantalla abierta y no de memoria:
 *
 *   1. Las tres solapas usan `app-data-table`, la misma tabla que la agenda.
 *   2. La fecha ya no sale como `28/9/2026, 1:00:00 p. m.`, sino con el formato
 *      de la agenda («lunes 28 sept, 13:00») y su rango debajo.
 *   3. El estado va con `app-status-seal` —tono, forma y palabra—, no en gris.
 *   4. Aceptar y rechazar son íconos con su globo, como en la agenda.
 *
 * Un solo navegador, un contexto por vez. Cierra en `finally` y ante señal.
 *
 * Uso: `node playwright/lab-visits-como-la-agenda.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SALIDA = fileURLToPath(new URL('../docs/frontend/evidence/lab-visits-agenda', import.meta.url));

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

let navegador;
async function cerrarNavegador() {
  await navegador?.close().catch(() => {});
  navegador = undefined;
}
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => void cerrarNavegador().then(() => process.exit(130)));
}

async function entrar(pagina) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mock');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

async function abrirPestana(pagina, rotulo) {
  await pagina.locator('app-tabs').getByRole('tab', { name: rotulo, exact: true }).first().click();
  await pagina.waitForTimeout(700);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));

  await entrar(pagina);
  await pagina.goto(`${BASE}/lab-visits`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.locator('app-tabs').first().waitFor({ state: 'visible', timeout: 30_000 });
  await pagina.locator('app-data-table').first().waitFor({ state: 'visible', timeout: 30_000 });
  await pagina.waitForTimeout(600);

  /* 1 · La misma tabla que la agenda de pacientes. */
  const tabla = pagina.locator('[data-testid="requests-table"]');
  ok('[solicitudes] usa app-data-table', (await tabla.count()) === 1);
  ok(
    '[solicitudes] no quedó ninguna <table> escrita a mano',
    (await pagina.locator('table.doctor-visits__table').count()) === 0,
  );

  /* 2 · La fecha con el formato de la agenda, no `toLocaleString`. */
  const textoTabla = (await tabla.first().innerText()).replace(/\s+/g, ' ');
  ok(
    '[solicitudes] la fecha ya no sale como 1:00:00 p. m.',
    !/\d:\d\d:\d\d\s*[ap]\.\s*m\./i.test(textoTabla),
    textoTabla.slice(0, 90),
  );
  ok(
    '[solicitudes] la fecha lleva el formato de la agenda («28 sept, 13:00»)',
    /\d{1,2}\s+\p{L}+,\s+\d{2}:\d{2}/u.test(textoTabla),
  );
  ok('[solicitudes] cada fila dice hasta qué hora ocupa', /hasta\s+\d{2}:\d{2}/.test(textoTabla));

  /* 3 · El estado con sello: tono, forma y palabra. */
  const sellos = pagina.locator('[data-testid="requests-table"] app-status-seal');
  ok('[solicitudes] el estado va con sello', (await sellos.count()) > 0, `${await sellos.count()} sellos`);
  ok(
    '[solicitudes] el sello trae su ícono (la forma, no sólo el color)',
    (await pagina.locator('[data-testid="requests-table"] app-status-seal svg').count()) > 0,
  );

  /* 4 · Las acciones, íconos con globo como en la agenda. */
  const aceptar = pagina.locator('[data-testid^="accept-"]').first();
  ok('[solicitudes] hay una solicitud por responder', (await aceptar.count()) === 1);
  if ((await aceptar.count()) === 1) {
    ok(
      '[solicitudes] «Aceptar» es un ícono con nombre accesible',
      (await aceptar.getAttribute('aria-label')) === 'Aceptar la visita' &&
        (await aceptar.locator('svg').count()) === 1,
    );
  }

  /* 4 bis · El aviso concuerda en singular: «1 solicitud que espera». */
  const aviso = (await pagina.locator('.doctor-visits__aviso').innerText()).replace(/\s+/g, ' ');
  ok(
    '[solicitudes] el aviso concuerda con el número',
    /1 solicitud que espera respuesta/.test(aviso) ||
      /\d+ solicitudes que esperan respuesta/.test(aviso),
    aviso,
  );

  await pagina.screenshot({ path: `${SALIDA}/solicitudes-1440.png`, fullPage: true });

  /* 5 · Las otras dos solapas, también con la tabla del sistema. */
  await abrirPestana(pagina, 'Mi agenda de visitas');
  ok(
    '[mi agenda] usa app-data-table',
    (await pagina.locator('[data-testid="agenda-table"]').count()) === 1 ||
      (await pagina.locator('[data-testid="agenda-empty"]').count()) === 1,
  );
  const franjas = (await pagina.locator('[data-testid="agenda-table"]').innerText()).replace(
    /\s+/g,
    ' ',
  );
  ok(
    '[mi agenda] el horario no sale mayusculizado («13:00 A 14:00»)',
    !/\d{2}:\d{2}\s+A\s+\d{2}:\d{2}/.test(franjas),
    franjas.slice(0, 90),
  );
  ok('[mi agenda] cada franja dice hasta qué hora', /hasta \d{2}:\d{2}/.test(franjas));
  await pagina.screenshot({ path: `${SALIDA}/mi-agenda-1440.png`, fullPage: true });

  await abrirPestana(pagina, 'Visitas realizadas');
  ok('[realizadas] usa app-data-table', (await pagina.locator('[data-testid="records-table"]').count()) === 1);
  await pagina.screenshot({ path: `${SALIDA}/realizadas-1440.png`, fullPage: true });

  /* 6 · En el teléfono, lo secundario se pliega y nada se sale. */
  await pagina.setViewportSize({ width: 390, height: 844 });
  await abrirPestana(pagina, 'Solicitudes');
  const desborde = await pagina.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('[390px] no hay scroll horizontal de página', desborde <= 1, `${desborde}px`);
  await pagina.screenshot({ path: `${SALIDA}/solicitudes-390.png`, fullPage: true });

  ok('sin errores de JavaScript', errores.length === 0, errores.join(' | ').slice(0, 200));

  await contexto.close();
}

try {
  await main();
} finally {
  await cerrarNavegador();
}

const fallos = veredictos.filter((v) => !v.cond);
process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} comprobaciones\n`);
process.stdout.write(`Capturas en ${SALIDA}\n`);
process.exit(fallos.length === 0 ? 0 : 1);
