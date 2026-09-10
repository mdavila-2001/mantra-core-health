/**
 * Evidencia de que la ubicación de casa y de trabajo se puede **marcar en el
 * mapa**, y no sólo pedir al navegador (pedido del 09/09/2026).
 *
 * Se corre con el permiso de geolocalización **negado** a propósito: es el
 * caso que antes dejaba a la persona sin ninguna manera de poner su pin.
 *
 * Lo que se afirma, en el alta de paciente:
 * - Sin punto, hay dos botones: «Usar mi ubicación» y «Marcar en el mapa».
 * - «Marcar en el mapa» abre el mapa vacío, con la indicación y sin pin.
 * - Tocar el mapa pone el pin, sin confirmarlo (aparece el aviso y el botón).
 * - Tocar en otro lugar corre el pin.
 * - Confirmar guarda; tocar de nuevo desconfirma (el punto anterior ya no vale).
 * - El lugar de trabajo tiene el mismo selector, independiente.
 *
 * Y en el alta de profesional, que monta el componente compartido
 * `app-ubicacion-picker` DOS veces: el mismo recorrido sobre su domicilio y
 * sobre su consultorio.
 *
 * Uso: `yarn node playwright/registro-ubicacion-en-mapa.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4344';
const SALIDA = new URL('../artifacts/playwright/ubicacion-en-mapa-2026-09-09', import.meta.url)
  .pathname.replace(/^\/([A-Za-z]:)/, '$1');

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function avanzarHasta(pagina, titulo) {
  const encabezado = pagina.getByRole('heading', { name: titulo });
  const boton = pagina.getByTestId('paginated-form-continuar');
  for (let paso = 0; paso < 8; paso += 1) {
    if (await encabezado.isVisible().catch(() => false)) return;
    await boton.click();
    await pagina.waitForTimeout(250);
  }
  if (!(await encabezado.isVisible())) throw new Error(`No se llegó a «${titulo}»`);
}

/**
 * Pulsa «Siguiente» y espera a que aparezca lo que identifica la página que
 * sigue. Reintenta: la página llega renderizada del servidor y el primer clic
 * puede caer antes de que Angular haya hidratado, en cuyo caso no hace nada.
 */
async function siguiente(pagina, testIdEsperado, rellenar = async () => {}) {
  for (let intento = 0; intento < 6; intento += 1) {
    // Se rellena en cada intento: lo escrito antes de hidratar se pierde.
    await rellenar();
    await pagina.getByTestId("paginated-form-continuar").click();
    const llego = await pagina
      .getByTestId(testIdEsperado)
      .waitFor({ timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (llego) return;
  }
  await pagina.screenshot({ path: `${SALIDA}/fallo-${testIdEsperado}.png`, fullPage: true });
  throw new Error(`No apareció ${testIdEsperado} tras pulsar «Siguiente»`);
}

async function empezarElAlta(pagina) {
  await pagina.goto(`${BASE}/auth/register/patient`, { waitUntil: "commit", timeout: 120_000 });
  await pagina.getByTestId('registro-form-paciente').waitFor({ timeout: 90_000 });
  await pagina.waitForTimeout(1_500);
  await siguiente(pagina, 'registro-documento', async () => {
    await pagina.getByTestId('registro-nombre').fill('Ana');
    await pagina.getByTestId('registro-apellido-paterno').fill('Paz');
  });
  await siguiente(pagina, 'registro-genero', async () => {
    await pagina.getByTestId('registro-documento').fill('9876543');
    // El departamento de emisión es obligatorio en esta rama.
    await pagina.getByTestId('registro-departamento-ci').locator('select').selectOption({ index: 1 });
  });
  await siguiente(pagina, 'registro-telefono', async () => {
    await escribirFecha(pagina, '01011990');
    await pagina.getByTestId('registro-genero').locator('select').selectOption({ label: 'Masculino' });
  });
  await pagina.getByTestId('registro-telefono').fill('70012345');
  await pagina.getByTestId('paginated-form-continuar').click();
}

/**
 * Escribe una fecha en el campo enmascarado y comprueba que quedó escrita.
 *
 * La máscara reescribe el valor después de cada tecla, y a 20 ms el tecleo
 * siguiente llegaba mientras reescribía: se perdían dígitos y quedaban fechas
 * como «02/00/2198», que el formulario rechaza. Se teclea más lento y se
 * relee: si lo que quedó no es lo que se quería, se vacía y se reintenta.
 */
async function escribirFecha(pagina, ddmmaaaa) {
  const esperado = `${ddmmaaaa.slice(0, 2)}/${ddmmaaaa.slice(2, 4)}/${ddmmaaaa.slice(4)}`;
  const campo = pagina.getByPlaceholder('DD/MM/AAAA');
  for (let intento = 0; intento < 4; intento += 1) {
    await campo.click();
    await pagina.keyboard.press('Control+A');
    await pagina.keyboard.press('Backspace');
    await pagina.waitForTimeout(150);
    await campo.pressSequentially(ddmmaaaa, { delay: 120 });
    await pagina.waitForTimeout(250);
    if ((await campo.inputValue()) === esperado) return;
  }
  throw new Error(
    `La fecha quedó como «${await campo.inputValue()}» y se quería «${esperado}»`,
  );
}

/** Centro del elemento, desplazado en píxeles. */
async function tocar(pagina, locator, dx = 0, dy = 0) {
  const caja = await locator.boundingBox();
  await pagina.mouse.click(caja.x + caja.width / 2 + dx, caja.y + caja.height / 2 + dy);
}

/** Dónde quedó el plano: cambia cuando el mapa se recentra en un pin nuevo. */
async function desplazamientoDelPlano(mapa) {
  return mapa.locator(".leaflet-map-pane").evaluate((el) => el.style.transform);
}

async function centroDelPin(mapa) {
  const pin = mapa.locator('.leaflet-marker-icon').first();
  await pin.waitFor({ timeout: 15_000 });
  const caja = await pin.boundingBox();
  return { x: Math.round(caja.x + caja.width / 2), y: Math.round(caja.y + caja.height / 2) };
}

/**
 * Recorre el selector de un bloque (casa o trabajo) y deja sus capturas.
 * `ids` son los data-testid de ese bloque.
 */
async function recorrerSelector(pagina, capturar, prefijo, ids) {
  const mapa = pagina.getByTestId(ids.mapa);

  ok(`${prefijo}: sin punto no hay mapa`, (await mapa.count()) === 0);
  ok(`${prefijo}: está «Usar mi ubicación»`, await pagina.getByTestId(ids.usar).isVisible());
  const marcar = pagina.getByTestId(ids.marcar);
  ok(`${prefijo}: está «Marcar en el mapa»`, await marcar.isVisible());
  await capturar(`${prefijo}-1-dos-puertas`);

  await marcar.click();
  await mapa.waitFor({ timeout: 15_000 });
  await mapa.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 20_000 }).catch(() => {});
  ok(`${prefijo}: el mapa se abre vacío`, (await mapa.locator('.leaflet-marker-icon').count()) === 0);
  ok(`${prefijo}: la indicación de tocar el mapa`, await pagina.getByTestId(ids.indicacion).isVisible());
  ok(
    `${prefijo}: el mapa avisa que espera un toque (cursor en cruz)`,
    (await mapa.locator('.mapa--seleccionable').count()) === 1,
  );
  ok(`${prefijo}: sin pin no hay botón de confirmar`, (await pagina.getByTestId(ids.confirmar).count()) === 0);
  await capturar(`${prefijo}-2-mapa-vacio`);

  await tocar(pagina, mapa, -40, -20);
  const pin1 = await centroDelPin(mapa);
  ok(`${prefijo}: tocar el mapa pone el pin`, true, `pin en ${pin1.x},${pin1.y}`);
  await pagina.waitForTimeout(600);
  const plano1 = await desplazamientoDelPlano(mapa);
  ok(`${prefijo}: el pin queda sin confirmar`, await pagina.getByTestId(ids.sinConfirmar).isVisible());
  ok(`${prefijo}: aparece «Confirmar»`, await pagina.getByTestId(ids.confirmar).isVisible());
  await capturar(`${prefijo}-3-pin-marcado`);

  // Correr el pin: después de poner el primero el mapa recentra a zoom 17 en
  // ese punto, así que el pin queda en el centro y un toque desplazado lo mueve.
  await pagina.waitForTimeout(500);
  await tocar(pagina, mapa, 90, 40);
  await pagina.waitForTimeout(500);
  const plano2 = await desplazamientoDelPlano(mapa);
  ok(
    `${prefijo}: tocar en otro lugar corre el pin (el mapa se recentra en el punto nuevo)`,
    plano1 !== plano2 && (await mapa.locator(".leaflet-marker-icon").count()) === 1,
    `plano antes ${plano1} · después ${plano2}`,
  );

  await pagina.getByTestId(ids.confirmar).click();
  ok(
    `${prefijo}: confirmar guarda`,
    await pagina.getByTestId(ids.confirmada).waitFor({ timeout: 5_000 }).then(() => true).catch(() => false),
  );
  await capturar(`${prefijo}-4-confirmado`);

  await pagina.waitForTimeout(400);
  await tocar(pagina, mapa, -70, 30);
  await pagina.waitForTimeout(400);
  ok(
    `${prefijo}: tocar con el punto confirmado lo desconfirma`,
    (await pagina.getByTestId(ids.confirmada).count()) === 0 &&
      (await pagina.getByTestId(ids.sinConfirmar).isVisible()),
  );
  await pagina.getByTestId(ids.confirmar).click();
  await pagina.getByTestId(ids.confirmada).waitFor();
}

/** Llega a «¿Dónde vivís?» del alta de profesional: cinco páginas con obligatorios. */
async function empezarElAltaDeProfesional(pagina) {
  await pagina.goto(`${BASE}/auth/register/practitioner`, { waitUntil: "commit", timeout: 120_000 });
  await pagina.getByTestId("registro-form-profesional").waitFor({ timeout: 90_000 });
  await pagina.waitForTimeout(1_500);
  await siguiente(pagina, "registro-pro-documento", async () => {
    await pagina.getByTestId("registro-pro-nombre").fill("Ana");
    await pagina.getByTestId("registro-pro-apellido-paterno").fill("Rojas");
  });
  await siguiente(pagina, "registration-practitioner-sex", async () => {
    await pagina.getByTestId("registro-pro-documento").fill("7654321");
    await pagina.getByTestId("registro-pro-departamento-ci").locator("select").selectOption({ index: 1 });
  });
  await siguiente(pagina, "registro-pro-celular-personal", async () => {
    await pagina.getByTestId("registration-practitioner-sex").locator("select").selectOption({ index: 1 });
    await escribirFecha(pagina, "02021985");
  });
  await siguiente(pagina, "registro-pro-celular-trabajo", async () => {
    await pagina.getByTestId("registro-pro-celular-personal").fill("70011223");
    await pagina.getByTestId("registro-pro-correo-personal").fill("ana.rojas@example.com");
  });
  // «El contacto de tu trabajo» es todo opcional.
  await siguiente(pagina, "registration-practitioner-home-location-use");
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    viewport: { width: 1280, height: 1100 },
    permissions: [], // geolocalización negada: el caso que antes no tenía salida
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  // La página entera queda recortada por el alto de la ventana; el bloque de
  // la ubicación —mapa, texto y botones— se captura aparte, que es lo que se
  // quiere ver.
  const capturar = async (nombre) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: true });
    const bloque = pagina.locator(".registro__ubicacion").first();
    if ((await bloque.count()) > 0) {
      await bloque.scrollIntoViewIfNeeded();
      await bloque.screenshot({ path: `${SALIDA}/${nombre}-bloque.png` });
    }
  };

  await empezarElAlta(pagina);
  await avanzarHasta(pagina, '¿Dónde vivís?');

  await recorrerSelector(pagina, capturar, 'casa', {
    mapa: 'registro-mapa-domicilio',
    usar: 'registro-usar-ubicacion',
    marcar: 'registration-home-location-pick',
    indicacion: 'registration-home-location-pick-hint',
    confirmar: 'registro-confirmar-direccion',
    sinConfirmar: 'registration-home-location-unconfirmed',
    confirmada: 'registro-direccion-confirmada',
  });

  // La localidad de residencia es obligatoria para pasar de página.
  await pagina.getByTestId('registration-residence-mapa-SC').click();
  const municipio = pagina.getByTestId('registration-residence-municipio').locator('select');
  await municipio.waitFor();
  await municipio.selectOption({ index: 1 });
  await avanzarHasta(pagina, 'El lugar donde trabajás');

  await recorrerSelector(pagina, capturar, 'trabajo', {
    mapa: 'registration-work-map',
    usar: 'registration-work-location-use',
    marcar: 'registration-work-location-pick',
    indicacion: 'registration-work-location-pick-hint',
    confirmar: 'registration-work-location-confirm',
    sinConfirmar: 'registration-work-location-unconfirmed',
    confirmada: 'registration-work-location-confirmed',
  });

  await empezarElAltaDeProfesional(pagina);
  await recorrerSelector(pagina, capturar, "profesional", {
    mapa: "registration-practitioner-home-map",
    usar: "registration-practitioner-home-location-use",
    marcar: "registration-practitioner-home-location-pick",
    indicacion: "registration-practitioner-home-location-pick-indicacion",
    confirmar: "registration-practitioner-home-location-confirm",
    sinConfirmar: "registration-practitioner-home-location-unconfirmed",
    confirmada: "registration-practitioner-home-location-confirmed",
  });

  // «Tu consultorio propio» es la página siguiente y no tiene obligatorios.
  await siguiente(pagina, "registration-practitioner-office-location-use");
  await recorrerSelector(pagina, capturar, "consultorio", {
    mapa: "registration-practitioner-office-map",
    usar: "registration-practitioner-office-location-use",
    marcar: "registration-practitioner-office-location-pick",
    indicacion: "registration-practitioner-office-location-pick-indicacion",
    confirmar: "registration-practitioner-office-location-confirm",
    sinConfirmar: "registration-practitioner-office-location-unconfirmed",
    confirmada: "registration-practitioner-office-location-confirmed",
  });

  ok('sin errores de página', errores.length === 0, errores.join(' | '));

  await navegador.close();
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones · capturas en ${SALIDA}\n`,
  );
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
