/**
 * Evidencia del pedido del cliente del 13/09/2026 sobre la barra del médico:
 *
 *   «Atención» y «Facturación» dejan de ser categorías plegables. Lo que tenían
 *   adentro sale suelto, al mismo nivel que «Chats» y «Directorios», porque
 *   abrir un desplegable para llegar a las pantallas donde se pasa el día es
 *   caro cuando hay un paciente delante.
 *
 * Lo que se mide, no lo que se ve: que en la barra de quien ejerce no quede un
 * solo `<details>`, que los destinos que colgaban de los dos dominios sigan
 * estando, y que cada uno esté a un clic del borde de la barra.
 *
 * Un solo navegador, un contexto por vez: serie estricta, como exige
 * `.claude/rules/20-resource-control.md`. El navegador se cierra en `finally` y
 * ante señal, para no dejar procesos vivos si esto se corta.
 *
 * Uso: `node playwright/nav-sin-categorias-2026-09-13.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4334';
/* `fileURLToPath` y no `.pathname`: el repositorio vive bajo «Mantra Core
   Technologies», con espacios, y `pathname` los devuelve como `%20`. */
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/nav-sin-categorias-2026-09-13', import.meta.url),
);

/* Lo que el médico tenía adentro del desplegable de «Atención» y ahora tiene
   suelto. Sale del registro de secciones, filtrado por lo que ve quien ejerce:
   `interventions` pide rol quirúrgico y `my-visits` es del visitador médico, así
   que ninguno de los dos estaba en esa barra ni antes ni después —esperarlos acá
   sería exigirle al menú algo que el registro no le pide—. `diagnostics`,
   `lab-visits` y `questionnaires` salen por `fueraDelMenuPara: ['PRACTITIONER']`,
   por la misma razón. */
const DESTINOS_DE_ATENCION = [
  '/schedule',
  '/medical-records',
  '/progress-notes',
  '/glossary',
  '/form-builder',
  '/my-services',
  '/my-quotations',
];

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
  process.on(senal, () => {
    void cerrarNavegador().then(() => process.exit(130));
  });
}

async function entrar(pagina, correo) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(correo);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Lo que la barra ofrece, tal como lo ve quien la mira. */
function leerLaBarra(pagina) {
  return pagina.locator('#app-side-nav').evaluate((nav) => ({
    plegables: nav.querySelectorAll('details').length,
    grupos: [...nav.querySelectorAll('[data-testid="nav-grupo"]')].map((g) =>
      g.getAttribute('data-grupo'),
    ),
    rotulos: [...nav.querySelectorAll('.app-side-nav__eyebrow')].map((e) => e.textContent?.trim()),
    destinos: [...nav.querySelectorAll('[data-testid="nav-enlace"]')].map((a) =>
      a.getAttribute('data-route'),
    ),
    /* Cuántos `<details>` hay entre cada enlace y el borde de la barra: es la
       cuenta de clics que cuesta llegar, dicha desde el DOM. */
    clicsDeMas: [...nav.querySelectorAll('[data-testid="nav-enlace"]')].map((a) => {
      let n = 0;
      for (let nodo = a.parentElement; nodo !== null && nodo !== nav; nodo = nodo.parentElement) {
        if (nodo.tagName === 'DETAILS') n += 1;
      }
      return n;
    }),
  }));
}

async function recorrer(pagina, tema) {
  await pagina.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.locator('#app-side-nav').waitFor({ state: 'visible', timeout: 30_000 });
  await pagina.waitForTimeout(400);

  const barra = await leerLaBarra(pagina);

  ok(
    `[${tema}] la barra del médico no tiene un solo desplegable`,
    barra.plegables === 0,
    `${barra.plegables} <details> · grupos: ${barra.grupos.join(', ') || 'ninguno'}`,
  );
  ok(
    `[${tema}] «Atención» y «Facturación» ya no se dibujan como rótulo`,
    !barra.rotulos.includes('Atención') && !barra.rotulos.includes('Facturación'),
    barra.rotulos.join(', ') || 'sin rótulos',
  );
  const faltan = DESTINOS_DE_ATENCION.filter((ruta) => !barra.destinos.includes(ruta));
  ok(
    `[${tema}] y no se perdió ningún destino de los que colgaban`,
    faltan.length === 0,
    faltan.length ? `faltan ${faltan.join(', ')}` : `${barra.destinos.length} destinos`,
  );
  ok(
    `[${tema}] todos a un clic: ninguno cuelga de un plegable`,
    barra.clicsDeMas.every((n) => n === 0),
    `máximo ${Math.max(0, ...barra.clicsDeMas)}`,
  );

  await pagina.screenshot({
    path: `${SALIDA}/barra-medico-${tema}.png`,
    animations: 'disabled',
    fullPage: true,
  });
}

try {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();

  for (const tema of ['claro', 'oscuro']) {
    const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1024 } });
    const pagina = await contexto.newPage();
    const errores = [];
    /* Dónde ocurrió cada error, no sólo qué decía: es lo que separa un error de
       la barra de uno que la página ya traía antes de que nadie entrara. */
    pagina.on(
      'console',
      (m) =>
        m.type() === 'error' && errores.push(`${new URL(pagina.url()).pathname} · ${m.text()}`),
    );
    await entrar(pagina, 'medica@alovida.mock');
    /* La pantalla de ingreso ya trae los suyos —el servidor de desarrollo sirve
       un script en línea que la CSP de `/auth` no tiene en su lista de hashes—
       y son de antes de este cambio: no se cuentan como propios, pero tampoco
       se esconden. Lo que se exige limpio es lo que pasa con la barra en
       pantalla, que es lo que este cambio toca. */
    const previos = errores.splice(0, errores.length);
    await recorrer(pagina, tema);
    ok(`[${tema}] sin errores de consola en el armazón`, errores.length === 0, errores.slice(0, 2).join(' · '));
    if (previos.length > 0) {
      process.stdout.write(`  · preexistentes en el ingreso: ${previos.length} (CSP, ajenos)\n`);
    }
    await contexto.close();
  }
} finally {
  await cerrarNavegador();
}

const fallaron = veredictos.filter((v) => !v.cond);
process.stdout.write(
  `\n${fallaron.length === 0 ? 'PASS' : 'FAIL'} — ${veredictos.length - fallaron.length}/${veredictos.length}\nEvidencia: ${SALIDA}\n`,
);
process.exit(fallaron.length === 0 ? 0 : 1);
