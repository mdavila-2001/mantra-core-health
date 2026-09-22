/**
 * Verificación del directorio público de hospitales contra la maqueta.
 *
 * Lo que comprueba es el pedido del cliente: que el lugar se elija en **dos
 * pasos** —primero el departamento en el mapa, y recién ahí las ciudades—, que
 * el departamento acote la lista de verdad, y que cambiar de departamento
 * suelte la ciudad del anterior en vez de dejar un filtro invisible.
 *
 * Se elige La Paz para los chips y Santa Cruz para el corte: en los datos de
 * prueba La Paz tiene dos ciudades publicadas —La Paz y El Alto— y Santa Cruz
 * una sola, que es justamente el caso en el que el renglón **no** se dibuja.
 *
 * Uso: `node playwright/verificacion-hospitales.mjs [urlBase]`
 * El runner de Playwright sigue roto en este worktree; por eso es un script.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = fileURLToPath(new URL('../evidencias/hospitales-departamento-2026-09-09', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await (await navegador.newContext({ viewport: { width: 1440, height: 1200 } })).newPage();
  const errores = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !RUIDO.some((p) => p.test(m.text()))) errores.push(m.text());
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));
  const capturar = async (nombre) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: false });
    process.stdout.write(`  · ${nombre}.png\n`);
  };
  const chips = () => pagina.locator('[data-testid="hospitales-chip-ciudad"]').allTextContents();
  const tarjetas = () => pagina.locator('[data-testid="facility-profile"]').count();
  const resumen = async () =>
    (await pagina.locator('[data-testid="hospitales-mapa-resumen"]').textContent().catch(() => '')) ?? '';
  const recuento = async () =>
    (await pagina.locator('.centros__recuento').last().textContent().catch(() => '')) ?? '';

  await pagina.goto(`${BASE}/search/hospitals`);
  // El mapa sólo se dibuja cuando llegó el catálogo geográfico, que se pide ya
  // hidratada la página: esperarlo evita medir el HTML del servidor, donde la
  // lista todavía no pasó por los filtros del navegador.
  await pagina.locator('[data-testid="hospitales-mapa-LP"]').waitFor({ timeout: 60_000 });
  await pagina.locator('[data-testid="facility-profile"]').first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(1200);

  const delPais = await tarjetas();
  const departamentos = await pagina.locator('[data-testid^="hospitales-mapa-"]').count();
  ok('el mapa de Bolivia está arriba de la lista', departamentos >= 9, `${departamentos} departamentos`);
  ok('sin departamento elegido no hay ningún chip de ciudad',
    (await chips()).length === 0, `${(await chips()).length} chips`);
  ok('la lista arranca con el país entero', delPais > 0, `${delPais} centros`);
  await capturar('01-sin-departamento');

  // La Paz: dos ciudades publicadas, así que el renglón de chips aparece.
  await pagina.locator('[data-testid="hospitales-mapa-LP"]').click();
  await pagina.waitForTimeout(800);
  const deLaPaz = await chips();
  const tarjetasLp = await tarjetas();
  ok('al elegir un departamento aparecen sus ciudades', deLaPaz.length >= 2, deLaPaz.join(' · '));
  ok('y sólo las suyas', !deLaPaz.some((c) => /Santa Cruz|Sucre|Cochabamba|Tarija/.test(c)), deLaPaz.join(' · '));
  ok('el departamento acota la lista', tarjetasLp > 0 && tarjetasLp < delPais, `${delPais} → ${tarjetasLp}`);
  ok('el resumen dice cuántos hay en ese departamento', /La Paz/.test(await resumen()), (await resumen()).trim());
  await capturar('02-la-paz');

  // Una ciudad del departamento acota más, y los otros chips siguen.
  const primeraCiudad = deLaPaz[0]?.trim() ?? '';
  await pagina.locator('[data-testid="hospitales-chip-ciudad"]').first().click();
  await pagina.waitForTimeout(800);
  const tarjetasCiudad = await tarjetas();
  ok('elegir una ciudad acota dentro del departamento',
    tarjetasCiudad > 0 && tarjetasCiudad < tarjetasLp, `${tarjetasLp} → ${tarjetasCiudad} en ${primeraCiudad}`);
  ok('los chips de las otras ciudades siguen dibujados',
    (await chips()).length === deLaPaz.length, (await chips()).join(' · '));
  ok('el recuento nombra la ciudad elegida', new RegExp(primeraCiudad).test(await recuento()), (await recuento()).trim());
  ok('la URL lleva los dos cortes, para poder compartirla',
    /departamento=/.test(pagina.url()) && /ciudad=/.test(pagina.url()), pagina.url().split('?')[1] ?? '');
  await capturar('03-ciudad-del-departamento');

  // Cambiar de departamento suelta la ciudad anterior.
  await pagina.locator('[data-testid="hospitales-mapa-SC"]').click();
  await pagina.waitForTimeout(800);
  ok('cambiar de departamento suelta la ciudad del anterior',
    !/ciudad=/.test(pagina.url()), pagina.url().split('?')[1] ?? '');
  ok('la lista es la del departamento nuevo', (await tarjetas()) > 0, `${await tarjetas()} centros`);
  ok('un departamento con una sola ciudad publicada no dibuja el renglón',
    (await chips()).length === 0, `${(await chips()).length} chips`);
  await capturar('04-santa-cruz');

  // Volver al país entero tocando otra vez el mismo departamento.
  await pagina.locator('[data-testid="hospitales-mapa-SC"]').click();
  await pagina.waitForTimeout(800);
  ok('tocar otra vez el departamento vuelve a todo el país',
    (await tarjetas()) === delPais, `${await tarjetas()} centros`);

  // Angosto.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(700);
  const desborde = await pagina.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('móvil: sin desborde horizontal', desborde === 0, `${desborde}px`);
  await capturar('05-movil');

  process.stdout.write(`Errores de consola: ${errores.length}\n`);
  for (const e of [...new Set(errores)].slice(0, 8)) process.stdout.write(`  ! ${e.slice(0, 200)}\n`);
  const rojos = veredictos.filter((v) => !v.cond).length;
  process.stdout.write(`${veredictos.length - rojos}/${veredictos.length} en verde\n`);
  await navegador.close();
  process.exit(rojos === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
