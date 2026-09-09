/**
 * Evidencia de los dos pedidos del 09/09/2026 sobre el seguro del paciente,
 * contra la maqueta (rama `mockup`):
 *
 * 1. En el alta, el número de registro de la aseguradora carga los datos solo.
 *    No es obligatorio.
 * 2. Ya con sesión, «Mi seguro» muestra todo el catálogo de la aseguradora
 *    contratada —sus paquetes de servicio—; sin seguro contratado, la misma
 *    rejilla de aseguradoras, y cada tarjeta abre su lista de servicios.
 *
 * Uso: `node playwright/verificacion-seguro-paciente.mjs [urlBase]`
 *
 * Se corre como script suelto y no como spec: el runner de Playwright está
 * roto en este worktree, y `networkidle` contra `ng serve` con HMR nunca
 * llega — de ahí las esperas explícitas.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = new URL('../evidencias/seguro-paciente-2026-09-09', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  const sinManejador = [];
  pagina.on('console', (m) => {
    const texto = m.text();
    if (/\[mock\] sin manejador/i.test(texto)) sinManejador.push(texto);
    if (m.type() !== 'error') return;
    if (RUIDO.some((p) => p.test(texto))) return;
    errores.push(texto);
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));

  let n = 0;
  const capturar = async (nombre, opciones = {}) => {
    n += 1;
    const archivo = `${String(n).padStart(2, '0')}-${nombre}.png`;
    await pagina.screenshot({ path: `${SALIDA}/${archivo}`, ...opciones });
    process.stdout.write(`  · ${archivo}\n`);
  };
  const esperar = (ms) => pagina.waitForTimeout(ms);
  const cuerpo = () => pagina.locator('body').innerText();

  /* ═══ 1 · El alta: el número de asegurado precarga los datos ═════════════ */

  await pagina.goto(`${BASE}/auth/register/patient`);
  await esperar(2500);

  // Ir hasta la página del seguro. El motor valida de a una página, así que se
  // completa lo obligatorio de cada una antes de avanzar.
  const siguiente = pagina.getByRole('button', { name: /siguiente/i });
  let paginasRecorridas = 0;
  while (paginasRecorridas < 12) {
    if ((await pagina.getByTestId('registro-numero-asegurado').count()) > 0) break;
    if ((await siguiente.count()) === 0) break;
    await siguiente.first().click();
    await esperar(500);
    paginasRecorridas += 1;
  }
  const llegoAlSeguro = (await pagina.getByTestId('registro-numero-asegurado').count()) > 0;
  ok('alta: la página del seguro tiene el campo «Número de asegurado»', llegoAlSeguro);

  if (llegoAlSeguro) {
    await capturar('alta-campo-numero-asegurado');

    // No es obligatorio: sin escribirlo, la página se puede pasar.
    const puedeAvanzarSinNumero =
      (await siguiente.count()) > 0 ? await siguiente.first().isEnabled() : true;
    ok('alta: el número de asegurado NO es obligatorio', puedeAvanzarSinNumero);

    // Y con él, la aseguradora devuelve los datos y el alta los carga.
    await pagina.getByTestId('registro-numero-asegurado').fill('AF-20000');
    await pagina.getByTestId('registro-consultar-asegurado').click();
    await esperar(1200);
    const estado = await pagina.getByTestId('registro-asegurado-estado').innerText();
    ok('alta: consultando el número, la aseguradora responde', /te encontramos/i.test(estado), estado.replace(/\s+/g, ' ').trim());
    await capturar('alta-numero-consultado');

    // El plan quedó elegido en el desplegable, sin tocarlo.
    const planPrivado = await pagina
      .getByTestId('registro-seguro-privado')
      .locator('select, input')
      .first()
      .inputValue()
      .catch(() => '');
    ok('alta: el plan de la aseguradora quedó cargado solo', planPrivado !== '');

    // Y los datos personales, en sus páginas.
    const atras = pagina.getByRole('button', { name: /atr[áa]s/i });
    for (let i = 0; i < paginasRecorridas; i += 1) {
      if ((await atras.count()) === 0) break;
      await atras.first().click();
      await esperar(350);
    }
    await esperar(600);
    const nombre = await pagina
      .getByTestId('registro-nombre')
      .inputValue()
      .catch(() => '');
    ok('alta: el nombre se cargó desde la aseguradora', nombre.trim() !== '', nombre);
    await capturar('alta-datos-precargados');
  }

  /* ═══ 2 · Con sesión: «Mi seguro» ══════════════════════════════════════ */

  const entrar = async (correo) => {
    await pagina.goto(`${BASE}/auth`);
    await esperar(900);
    await pagina.getByTestId('login-identifier').fill(correo);
    await pagina.getByTestId('login-password').fill('mockup');
    await pagina.getByTestId('login-submit').click();
    await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
    if (pagina.url().includes('/auth/organization')) {
      await pagina.getByTestId('tenant-opcion').first().click();
      await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
    }
    await esperar(900);
  };

  await entrar('paciente@alovida.mock');

  await pagina.goto(`${BASE}/my-account/insurance`);
  await esperar(2500);
  const texto = await cuerpo();
  ok('mi seguro: la pantalla abre para el paciente', !/no encontramos|404/i.test(texto), pagina.url());
  ok(
    'mi seguro: muestra la aseguradora contratada, no una lista',
    (await pagina.getByTestId('mi-seguro-cobertura').count()) > 0,
  );
  const paquetes = await pagina.getByTestId('mi-seguro-paquete').count();
  ok('mi seguro: muestra los paquetes de servicio de esa aseguradora', paquetes > 0, `${paquetes} paquete(s)`);
  const contratado = await pagina.locator('[data-contratado="si"]').count();
  ok('mi seguro: marca cuál es el plan contratado', contratado === 1, `${contratado} marcado(s)`);
  await capturar('mi-seguro-catalogo-contratado', { fullPage: true });

  // La pestaña de las demás aseguradoras: misma rejilla, cada tarjeta abre su
  // catálogo.
  const pestanaOtras = pagina.getByRole('tab', { name: /otras aseguradoras/i });
  if ((await pestanaOtras.count()) > 0) {
    await pestanaOtras.first().click();
    await esperar(900);
    const tarjetas = await pagina.getByTestId('mi-seguro-aseguradora-tarjeta').count();
    ok('mi seguro: la rejilla de las demás aseguradoras', tarjetas > 0, `${tarjetas} tarjeta(s)`);
    await capturar('mi-seguro-rejilla-otras', { fullPage: true });

    if (tarjetas > 0) {
      await pagina.getByTestId('mi-seguro-aseguradora-tarjeta').first().click();
      await esperar(2200);
      ok(
        'mi seguro: al hacer clic en una aseguradora se abre su catálogo de servicios',
        (await pagina.getByTestId('mi-seguro-paquete').count()) > 0,
        pagina.url(),
      );
      ok(
        'mi seguro: dice que esa no es la contratada, y ofrece volver',
        (await pagina.getByTestId('mi-seguro-sin-contrato').count()) > 0 &&
          (await pagina.getByTestId('mi-seguro-volver').count()) > 0,
      );
      await capturar('mi-seguro-catalogo-de-otra', { fullPage: true });
    }
  } else {
    ok('mi seguro: la pestaña de las demás aseguradoras existe', false);
  }

  /* Sin seguro declarado: la rejilla es lo primero que se ve.
     Se usa la cuenta de administración porque es la única de la maqueta que
     llega a la pantalla sin ninguna cobertura declarada —la de paciente sí
     tiene una—. El caso del paciente con `coverages: []` lo fija el spec
     unitario `my-insurance.spec.ts`. */
  await entrar('admin@alovida.mock');
  await pagina.goto(`${BASE}/my-account/insurance`);
  await esperar(2500);
  const sinSeguro = await pagina.getByTestId('mi-seguro-sin-seguro').count();
  const tarjetasSinSeguro = await pagina.getByTestId('mi-seguro-aseguradora-tarjeta').count();
  ok(
    'mi seguro: sin seguro contratado se ve la rejilla de aseguradoras',
    sinSeguro > 0 && tarjetasSinSeguro > 0,
    `${tarjetasSinSeguro} tarjeta(s)`,
  );
  await capturar('mi-seguro-sin-contratar', { fullPage: true });

  /* ═══ Resumen ═══════════════════════════════════════════════════════════ */
  process.stdout.write(`\nRutas de la maqueta sin manejador: ${sinManejador.length}\n`);
  for (const s of [...new Set(sinManejador)]) process.stdout.write(`  ? ${s}\n`);
  process.stdout.write(`Errores de consola: ${errores.length}\n`);
  for (const e of [...new Set(errores)].slice(0, 15)) process.stdout.write(`  ! ${e.slice(0, 220)}\n`);
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones en verde\n`);
  await navegador.close();
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
