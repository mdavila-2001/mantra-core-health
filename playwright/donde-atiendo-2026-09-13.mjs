/**
 * Evidencia del pedido del cliente del 13/09/2026 sobre «Dónde atiendo»:
 *
 *   1. El bloque **sale de Trayectoria**. Esa pestaña vuelve a ser lo que su
 *      nombre dice: dónde ejerciste antes.
 *   2. La pestaña «Dónde atiendo» de la ficha **muestra y no da de alta**: la
 *      ficha es para mirar tus datos.
 *   3. El alta vive en «Editar tu info», en su propia pestaña.
 *   4. Y ahí hay **dos puertas distintas**: crear tu consultorio propio —uno
 *      solo, y se corrige— o decir que atendés en un establecimiento del padrón
 *      oficial, que ya existe.
 *
 * Un solo navegador, un contexto por vez: serie estricta, como exige
 * `.claude/rules/20-resource-control.md`. Cierra en `finally` y ante señal.
 *
 * Uso: `node playwright/donde-atiendo-2026-09-13.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4334';
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/donde-atiendo-2026-09-13', import.meta.url),
);

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

/** Abre una pestaña de la tarjeta por su rótulo. */
async function abrirPestana(pagina, rotulo) {
  await pagina.locator('app-tabs').getByRole('tab', { name: rotulo, exact: true }).first().click();
  await pagina.waitForTimeout(700);
}

async function laFicha(pagina) {
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.locator('app-tabs').first().waitFor({ state: 'visible', timeout: 30_000 });

  /* 1 · Trayectoria ya no trae los consultorios. */
  await abrirPestana(pagina, 'Trayectoria');
  ok(
    '[ficha] Trayectoria ya no trae «Dónde atiendo»',
    (await pagina.locator('[data-testid="sedes-propias"]').count()) === 0,
  );
  ok(
    '[ficha] …ni el botón de agregar un consultorio',
    (await pagina.locator('[data-testid="sede-agregar"]').count()) === 0,
  );
  ok(
    '[ficha] pero conserva su historial laboral',
    (await pagina.getByText('Historial laboral').count()) > 0 ||
      (await pagina.getByText('Agregar un vínculo').count()) > 0,
  );
  await pagina.screenshot({
    path: `${SALIDA}/ficha-trayectoria.png`,
    fullPage: true,
    animations: 'disabled',
  });

  /* 2 · «Dónde atiendo» muestra, y no da de alta. */
  await abrirPestana(pagina, 'Dónde atiendo');
  const sedes = await pagina.locator('[data-testid="perfil-sede"]').count();
  ok('[ficha] «Dónde atiendo» sigue listando las sedes', sedes > 0, `${sedes} sedes`);
  ok(
    '[ficha] y NO ofrece agregar: sólo muestra',
    (await pagina.locator('[data-testid="sede-agregar"]').count()) === 0 &&
      (await pagina.locator('[data-testid="sede-padron"]').count()) === 0,
  );
  ok(
    '[ficha] el camino se dice, no se esconde',
    (await pagina.getByText('Editar tu info', { exact: false }).count()) > 0,
  );
  await pagina.screenshot({
    path: `${SALIDA}/ficha-donde-atiendo.png`,
    fullPage: true,
    animations: 'disabled',
  });
}

async function elEditor(pagina) {
  await pagina.goto(`${BASE}/my-account/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await pagina.locator('app-tabs').first().waitFor({ state: 'visible', timeout: 30_000 });

  const rotulos = await pagina.locator('app-tabs').getByRole('tab').allInnerTexts();
  ok(
    '[editor] gana la pestaña «Dónde atiendo»',
    rotulos.map((r) => r.trim()).includes('Dónde atiendo'),
    rotulos.map((r) => r.trim()).join(' · '),
  );

  await abrirPestana(pagina, 'Dónde atiendo');
  await pagina.locator('[data-testid="sedes-propias"]').waitFor({ state: 'visible', timeout: 20_000 });

  /* 3 · Las dos puertas, y son distintas. */
  ok(
    '[editor] la segunda puerta existe: buscar uno del padrón',
    (await pagina.locator('[data-testid="sede-padron"]').count()) === 1,
  );

  /* 4 · El consultorio propio es uno solo. La maqueta siembra uno, así que el
         botón de alta NO debe estar y sí el aviso de que ya tiene el suyo. */
  const tieneAlta = await pagina.locator('[data-testid="sede-agregar"]').count();
  const avisoUnico = await pagina.locator('[data-testid="sede-propia-unica"]').count();
  ok(
    '[editor] con un consultorio propio ya cargado, no ofrece crear otro',
    tieneAlta === 0 && avisoUnico === 1,
    `alta=${tieneAlta} aviso=${avisoUnico}`,
  );

  /* 5 · Y el propio se distingue del ajeno, con su «Editar». */
  const filas = pagina.locator('[data-testid="sede-propia"]');
  const cuantas = await filas.count();
  ok('[editor] lista las sedes', cuantas > 1, `${cuantas} sedes`);
  const conEditar = await sedesQueOfrecen(pagina, 'editar');
  ok(
    '[editor] sólo el propio se puede editar',
    conEditar === 1,
    `${conEditar} de ${cuantas} con «Editar»`,
  );
  const texto = await pagina.locator('[data-testid="sedes-propias"]').innerText();
  ok('[editor] el propio está marcado', texto.includes('Tu consultorio'));
  ok('[editor] y el ajeno también, distinto', texto.includes('Trabajás acá'));

  /* 6 · El historial NO se cuela acá: es la otra pestaña. */
  ok(
    '[editor] «Dónde atiendo» no trae el historial laboral',
    !texto.includes('Agregar un vínculo'),
  );

  await pagina.screenshot({
    path: `${SALIDA}/editor-donde-atiendo.png`,
    fullPage: true,
    animations: 'disabled',
  });

  /* 7 · Editar abre el formulario con lo que el consultorio ya tiene. */
  await accionarSede(pagina, 0, 'editar');
  await pagina.waitForTimeout(600);
  const nombre = await pagina.locator('[data-testid="sede-nombre"] input').inputValue();
  ok('[editor] «Editar» abre con el nombre cargado', nombre.trim() !== '', nombre);
  ok(
    '[editor] y el formulario dice que corrige, no que crea',
    (await pagina.getByText('Corregir tu consultorio').count()) > 0,
  );
  await pagina.screenshot({
    path: `${SALIDA}/editor-corregir.png`,
    fullPage: true,
    animations: 'disabled',
  });

  const desborda = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok('[editor] sin desborde horizontal', !desborda);
}

async function recorrer(errores, fallidas) {
  for (const vp of [
    { nombre: 'escritorio', width: 1440, height: 1000 },
    { nombre: 'movil', width: 375, height: 812 },
  ]) {
    const contexto = await navegador.newContext({
      viewport: { width: vp.width, height: vp.height },
      locale: 'es-BO',
    });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (e) => errores.push(`${vp.nombre}: ${e}`));
    pagina.on('response', (r) => {
      if (r.status() >= 400 && !r.url().includes('favicon'))
        fallidas.push(`${vp.nombre} ${r.status()} ${r.url()}`);
    });
    await entrar(pagina, 'medica@alovida.mock');
    if (vp.nombre === 'escritorio') {
      await laFicha(pagina);
      await elEditor(pagina);
    } else {
      /* En teléfono alcanza con comprobar que la pestaña nueva es alcanzable y
         que nada desborda: el resto ya se midió arriba. */
      await pagina.goto(`${BASE}/my-account/edit`, {
        waitUntil: 'domcontentloaded',
        timeout: 180_000,
      });
      await pagina.locator('app-tabs').first().waitFor({ state: 'visible', timeout: 30_000 });
      await abrirPestana(pagina, 'Dónde atiendo');
      ok(
        '[móvil] la pestaña nueva se alcanza y dibuja',
        (await pagina.locator('[data-testid="sedes-propias"]').count()) === 1,
      );
      ok(
        '[móvil] sin desborde horizontal',
        !(await pagina.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth + 1,
        )),
      );
      await pagina.screenshot({
        path: `${SALIDA}/editor-donde-atiendo-375.png`,
        fullPage: true,
        animations: 'disabled',
      });
    }
    await contexto.close();
  }
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const errores = [];
  const fallidas = [];
  navegador = await chromium.launch();
  try {
    await recorrer(errores, fallidas);
  } finally {
    await cerrarNavegador();
  }

  ok('sin errores de consola', errores.length === 0, errores.slice(0, 4).join(' | '));
  ok('sin respuestas 4xx/5xx', fallidas.length === 0, fallidas.slice(0, 4).join(' | '));

  const malos = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - malos.length}/${veredictos.length} comprobaciones en verde\n` +
      `capturas en ${SALIDA}\n`,
  );
  process.exit(malos.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  await cerrarNavegador();
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(2);
});

/**
 * Cuántas sedes de la lista ofrecen esa acción.
 *
 * Desde ADR-0012 las acciones de una fila no son botones sueltos con su
 * `data-testid`: son una lista, y la forma sale de cuántas hay. Con tres o más
 * se pliegan en un desplegable cuyo panel se muda al `<body>`, así que
 * buscarlas dentro de la fila no las encuentra; con dos quedan en la fila. El
 * recorrido pregunta por la acción y no por la forma.
 */
async function sedesQueOfrecen(pagina, code) {
  const filas = pagina.locator('[data-testid="sede-propia"]');
  const total = await filas.count();
  let cuantas = 0;
  for (let i = 0; i < total; i += 1) {
    const fila = filas.nth(i);
    const disparador = fila.locator('[data-testid="row-actions-trigger"]');
    if ((await disparador.count()) > 0) {
      await disparador.click();
      /* `count()` NO espera: preguntado en el instante del clic devuelve 0
         siempre, y el recorrido informaba «0 de 4 con Editar» con la pantalla
         andando. Primero se espera a que el panel exista. */
      await pagina.locator('app-menu [role="menuitem"]').first().waitFor({ timeout: 10_000 });
      cuantas += await pagina.locator(`app-menu [data-action="${code}"]`).count();
      await pagina.keyboard.press('Escape');
      await pagina
        .locator('app-menu [role="menuitem"]')
        .first()
        .waitFor({ state: 'detached', timeout: 10_000 });
    } else {
      cuantas += await fila.locator(`app-row-actions [data-action="${code}"]`).count();
    }
  }
  return cuantas;
}

/** Ejecuta esa acción en la fila n de la lista de sedes. */
async function accionarSede(pagina, indice, code) {
  const fila = pagina.locator('[data-testid="sede-propia"]').nth(indice);
  const disparador = fila.locator('[data-testid="row-actions-trigger"]');
  if ((await disparador.count()) > 0) {
    await disparador.click();
    await pagina.locator('app-menu [role="menuitem"]').first().waitFor({ timeout: 10_000 });
    await pagina.locator(`app-menu [data-action="${code}"]`).click();
    return;
  }
  await fila.locator(`app-row-actions [data-action="${code}"]`).click();
}
