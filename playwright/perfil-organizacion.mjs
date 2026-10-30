/**
 * Evidencia de «Mi perfil» de una organización (laboratorio y aseguradora):
 * todo lo que registró en el alta se lee en UNA tarjeta centrada y a lo ancho,
 * con pestañas (composition-rules §5).
 *
 * Uso: `node playwright/perfil-organizacion.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SALIDA = fileURLToPath(
  new URL('../evidencias/perfil-organizacion-2026-10-28', import.meta.url),
);

let fallas = 0;
const ok = (nombre, cond, detalle = '') => {
  if (!cond) fallas += 1;
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function recorrer(navegador, usuario, ancho, alto, pestanasEsperadas, textos) {
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: alto } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  const capturar = (nombre) =>
    // Página entera sólo en móvil: en escritorio la captura de página entera
    // cambia el alto de la ventana, el menú lateral reacciona con su transición
    // y la foto lo muestra encogido aunque la pantalla real mida 240 px (lo
    // comprueba `medirGeometria` sin capturar). Ahí basta un alto que entre.
    pagina.screenshot({
      path: `${SALIDA}/${usuario}-${ancho}-${nombre}.png`,
      fullPage: ancho < 1024,
    });

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(`${usuario}@alovida.mock`);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 60_000 },
  );
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }

  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('perfil-organizacion-datos').waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(600);

  const area = await pagina.locator('.app-main__inner').first().boundingBox();
  const tarjeta = await pagina.locator('app-card.perfil-organizacion').first().boundingBox();
  const izq = tarjeta.x - area.x;
  const der = area.x + area.width - (tarjeta.x + tarjeta.width);
  process.stdout.write(
    `  [${usuario} ${ancho}px] área ${Math.round(area.width)} · tarjeta ${Math.round(tarjeta.width)} · izq ${Math.round(izq)} · der ${Math.round(der)}\n`,
  );
  ok(`${usuario} ${ancho}: tarjeta centrada`, Math.abs(izq - der) <= 2);
  ok(`${usuario} ${ancho}: tarjeta a lo ancho (≥ 85 %)`, tarjeta.width >= area.width * 0.85);
  ok(
    `${usuario} ${ancho}: UNA tarjeta de ficha`,
    (await pagina.locator('app-card.perfil-organizacion').count()) === 1,
  );
  ok(
    `${usuario} ${ancho}: sin desplazamiento lateral`,
    await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  );

  const pestanas = pagina.locator('[data-testid="perfil-organizacion-pestanas"] [role="tab"]');
  const rotulos = (await pestanas.allTextContents()).map((t) => t.trim());
  ok(
    `${usuario} ${ancho}: pestañas`,
    rotulos.join(' · ') === pestanasEsperadas.join(' · '),
    rotulos.join(' · '),
  );

  const medirGeometria = async (rotulo) => {
    // Después de cada pestaña, no sólo de la primera: una pestaña ancha podría
    // empujar el menú lateral o la tarjeta, y medir sólo al entrar no lo vería.
    const g = await pagina.evaluate(() => {
      const caja = (sel) => document.querySelector(sel)?.getBoundingClientRect();
      const area = caja('.app-main__inner');
      const ficha = caja('app-card.perfil-organizacion');
      const menu = caja('nav.app-side-nav');
      return {
        izq: ficha.x - area.x,
        der: area.x + area.width - (ficha.x + ficha.width),
        menu: menu ? menu.width : null,
        areaX: area.x,
        scroll: document.documentElement.scrollWidth <= window.innerWidth,
      };
    });
    ok(
      `${usuario} ${ancho} · ${rotulo}: tarjeta centrada`,
      Math.abs(g.izq - g.der) <= 2,
      `${Math.round(g.izq)}/${Math.round(g.der)}`,
    );
    ok(`${usuario} ${ancho} · ${rotulo}: sin desplazamiento lateral`, g.scroll);
    if (ancho >= 1024) {
      ok(
        `${usuario} ${ancho} · ${rotulo}: el menú lateral no se encoge`,
        Math.round(g.menu) === 240,
        `${Math.round(g.menu)}px`,
      );
      ok(
        `${usuario} ${ancho} · ${rotulo}: el contenido no se corre`,
        Math.round(g.areaX) === 240,
        `x=${Math.round(g.areaX)}`,
      );
    }
  };

  // Captura en reposo: el ratón fuera de la tira (si no, se ve el hover y no
  // la pestaña activa) y, tras el cambio de alto de la captura de página
  // entera, tiempo para que la transición del menú termine.
  const capturarEnReposo = async (nombre) => {
    await pagina.mouse.move(2, alto - 2);
    await pagina.waitForTimeout(800);
    await capturar(nombre);
  };

  const textos2 = [
    ['Organización', 'perfil-organizacion-datos', textos.datos],
    ['Representante y gerentes', null, textos.gente, 'app-representative-and-managers'],
    ['Documentos', null, textos.papeles, 'app-legal-documents'],
  ];
  for (const [i, rotulo] of pestanasEsperadas.entries()) {
    await pestanas.nth(i).click();
    await pagina.waitForTimeout(600);
    await medirGeometria(rotulo);
    const esperado = textos2.find(([r]) => r === rotulo);
    if (esperado) {
      const [, testId, lista, selector] = esperado;
      const contenido = await (
        testId ? pagina.getByTestId(testId) : pagina.locator(selector)
      ).textContent();
      for (const texto of lista)
        ok(`${usuario} ${ancho}: «${rotulo}» muestra ${texto}`, contenido.includes(texto));
    }
    if (rotulo === 'Aseguradora') {
      ok(
        `${usuario} ${ancho}: la ficha de la aseguradora vive en su pestaña`,
        (await pagina.locator('app-insurer-profile-card').count()) === 1,
      );
    }
    if (rotulo === 'Logo') {
      ok(
        `${usuario} ${ancho}: el logo vive en su pestaña`,
        (await pagina.getByTestId('logo-organizacion').count()) === 1,
      );
    }
    const slug = rotulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    await capturarEnReposo(`${String(i + 1).padStart(2, '0')}-${slug}`);
  }

  ok(`${usuario} ${ancho}: sin errores de página`, errores.length === 0, errores.join(' | '));
  await contexto.close();
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(
    process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {},
  );
  const laboratorio = {
    datos: [
      'Razón social',
      'Código',
      'Sociedad de Responsabilidad Limitada',
      'Bolivia',
      '1023456029',
      'Zona horaria',
    ],
    gente: [
      'Representante legal',
      'Mariana Siles Rojas',
      '4872190 SC',
      'Gerente General',
      'Carlos Mendoza Paz',
    ],
    papeles: ['NIT N.º 1023456029', 'Licencia de funcionamiento', 'SEDES'],
  };
  for (const [ancho, alto] of [
    [1440, 1400],
    [390, 844],
  ]) {
    await recorrer(
      navegador,
      'laboratorio',
      ancho,
      alto,
      ['Organización', 'Representante y gerentes', 'Documentos', 'Logo'],
      laboratorio,
    );
  }
  await recorrer(
    navegador,
    'aseguradora',
    1440,
    1400,
    ['Organización', 'Representante y gerentes', 'Documentos', 'Aseguradora', 'Logo'],
    {
      datos: ['Sigla', 'APS-0042', 'Av. Arce'],
      gente: ['Jorge Andrade Quiroga', '3344556 LP'],
      papeles: ['N.º 1020304050'],
    },
  );
  await navegador.close();
  process.stdout.write(fallas === 0 ? '\nTODO OK\n' : `\n${fallas} FALLA(S)\n`);
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
