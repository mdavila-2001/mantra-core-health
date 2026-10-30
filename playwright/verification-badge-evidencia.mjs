/**
 * Evidencia de la insignia de verificación: cada punto de uso con los estados
 * VERIFIED / IN_REVIEW / UNVERIFIED, en claro y oscuro, a 390, 768 y 1440, más
 * el popover abierto con teclado y un contacto a 400 % de zoom con fuente grande.
 *
 * Uso: `node playwright/verification-badge-evidencia.mjs` con el front en mocks
 * levantado (`BASE`, por omisión http://localhost:4200). Nunca espera
 * `networkidle`: con HMR no llega.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4200';
const OUT = process.env.OUT ?? 'docs/frontend/evidence/verification-badge';
mkdirSync(OUT, { recursive: true });

const ANCHOS = (process.env.ANCHOS ?? '390,768,1440').split(',').map(Number);
const TEMAS = (process.env.TEMAS ?? 'claro,oscuro').split(',');
const SOLO = process.env.SOLO?.split(',') ?? null;
const informe = [];

// `CHROME`: el Chromium preinstalado cuando la revisión que pide esta versión de Playwright no está.
const nav = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});

async function contexto(ancho, tema, extra = {}) {
  const ctx = await nav.newContext({
    viewport: { width: ancho, height: ancho >= 1000 ? 900 : 844 },
    colorScheme: tema === 'oscuro' ? 'dark' : 'light',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    ...extra,
  });
  // El tema se elige como lo hace la persona: por el almacenamiento de la aplicación.
  await ctx.addInitScript((modo) => {
    try { localStorage.setItem('mantra-core-health.theme', modo); } catch { /* sin almacenamiento */ }
  }, tema === 'oscuro' ? 'dark' : 'light');
  ctx.setDefaultTimeout(45000);
  return ctx;
}

async function entrar(pg, correo) {
  await pg.goto(`${BASE}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill(correo).catch(() => {});
    await pg.getByTestId('login-password').fill('mockup').catch(() => {});
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

async function foto(pg, nombre) {
  // La primera insignia visible al centro de la ventana, sea cual sea el contenedor que se desplaza.
  await pg
    .evaluate(() => {
      const b = document.querySelector('app-verification-badge:not(.vb-host--hidden)');
      b?.scrollIntoView({ block: 'center' });
    })
    .catch(() => {});
  await pg.waitForTimeout(300);
  const ruta = `${OUT}/${nombre}.png`;
  await pg.screenshot({ path: ruta });
  informe.push(ruta);
  return ruta;
}

/** Cuántas insignias hay por estado y si alguna rompe la línea o desborda. */
async function medir(pg, etiqueta) {
  const datos = await pg.evaluate(() => {
    const caras = [...document.querySelectorAll('app-verification-badge [role="img"]')];
    const porEstado = {};
    for (const c of caras) {
      const k = c.getAttribute('aria-label') ?? '?';
      porEstado[k] = (porEstado[k] ?? 0) + 1;
    }
    const svg = [...document.querySelectorAll('app-verification-badge svg')].map((s) => s.getBoundingClientRect());
    return {
      total: caras.length,
      porEstado: Object.fromEntries(Object.entries(porEstado).slice(0, 6)),
      tamMin: svg.length ? Math.min(...svg.map((r) => Math.round(r.width))) : null,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    };
  });
  informe.push(`${etiqueta}: ${JSON.stringify(datos)}`);
  return datos;
}

async function esperar(pg, selector) {
  await pg.locator(selector).first().waitFor({ state: 'attached', timeout: 90000 });
  await pg.waitForTimeout(700);
}

/** Visita una URL, espera a que haya una insignia y saca la captura de la ventana. */
const visitar = (url, esperarA = 'app-verification-badge:not(.vb-host--hidden)') =>
  async (pg, etiqueta) => {
    await pg.goto(`${BASE}${url}`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, esperarA);
    await foto(pg, etiqueta);
    await medir(pg, etiqueta);
  };

const ID_RAMIRO = 'fce5f0f9-0049-40cb-a021-5ef201c22e74'; // en verificación (semilla del simulador)
const ID_CARLOS = 'd321ef8d-d4ad-4bff-a5c9-7e12f2a72b7c'; // sin verificar

const escenarios = {
  // El showroom del sistema de diseño: todos los estados, tamaños y variantes.
  async showroom(pg, etiqueta) {
    await pg.goto(`${BASE}/design-system`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, '[data-testid="showroom-verification-badge"]');
    await pg.locator('[data-testid="showroom-verification-badge"]').scrollIntoViewIfNeeded();
    await pg.locator('[data-testid="showroom-verification-badge"]').screenshot({ path: `${OUT}/${etiqueta}.png` });
    informe.push(`${OUT}/${etiqueta}.png`);
    await medir(pg, etiqueta);
  },
  // Tres tarjetas del buscador público, una por estado: la verificada, la que está en
  // verificación y una sin verificar (sin ninguna marca).
  async busqueda(pg, etiqueta) {
    await pg.goto(`${BASE}/search/practitioners`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, 'li[app-result-card] app-verification-badge:not(.vb-host--hidden)');
    const tarjetas = pg.locator('li[app-result-card]');
    const cual = {
      verificado: tarjetas.filter({ hasText: 'Valeria Rojas' }).first(),
      'en-verificacion': tarjetas.filter({ hasText: 'Ramiro Céspedes' }).first(),
      'sin-verificar': tarjetas.filter({ has: pg.locator('app-verification-badge.vb-host--hidden') }).first(),
    };
    for (const [estado, tarjeta] of Object.entries(cual)) {
      try {
        await tarjeta.scrollIntoViewIfNeeded();
        await pg.waitForTimeout(300);
        const ruta = `${OUT}/${etiqueta.replace('busqueda', `busqueda-${estado}`)}.png`;
        await tarjeta.screenshot({ path: ruta });
        informe.push(ruta);
      } catch (e) {
        informe.push(`FALLO ${etiqueta}/${estado}: ${String(e).slice(0, 120)}`);
      }
    }
    await medir(pg, etiqueta);
  },
  async tendencias(pg, etiqueta) {
    await pg.goto(`${BASE}/posts`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, 'app-feed-tendencias app-verification-badge:not(.vb-host--hidden)');
    const panel = pg.locator('app-feed-tendencias').first();
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: `${OUT}/${etiqueta}.png` });
    informe.push(`${OUT}/${etiqueta}.png`);
    await medir(pg, etiqueta);
  },
  'perfil-publico-verificado': visitar('/p/valeria-rojas'),
  'perfil-publico-en-verificacion': visitar('/p/ramiro-cespedes'),
  'guia-verificado': visitar('/directory?q=Valeria'),
  'guia-en-verificacion-y-sin-verificar': visitar('/directory?q=Ramiro'),
  async 'ficha-verificada'(pg, etiqueta) {
    await pg.goto(`${BASE}/directory?q=Valeria`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, 'a[href^="/directory/"]');
    await pg.getByRole('link', { name: 'Valeria Rojas Mendoza' }).first().click();
    await esperar(pg, '.profesional__nombre app-verification-badge:not(.vb-host--hidden)');
    await foto(pg, etiqueta);
    await medir(pg, etiqueta);
  },
  'ficha-en-verificacion': visitar(`/directory/${ID_RAMIRO}`, '.profesional__nombre'),
  'ficha-sin-verificar': visitar(`/directory/${ID_CARLOS}`, '.profesional__nombre'),
  'mi-perfil-medico': visitar('/account/profile', '.mi-perfil__nombre app-verification-badge:not(.vb-host--hidden)'),
  'mensajeria-lista': visitar('/messaging', '.conversaciones__item app-verification-badge:not(.vb-host--hidden)'),
  async 'mensajeria-hilo'(pg, etiqueta) {
    await pg.goto(`${BASE}/messaging`, { waitUntil: 'commit', timeout: 180000 });
    await esperar(pg, '.conversaciones__item');
    await pg.locator('.conversaciones__item').first().click();
    await esperar(pg, '.hilo__nombre-fila app-verification-badge:not(.vb-host--hidden)');
    await foto(pg, etiqueta);
    await medir(pg, etiqueta);
  },
};

const PACIENTE = 'paciente@alovida.mock';
const MEDICA = 'medica@alovida.mock';
const corridas = [
  ['showroom', null],
  ['busqueda', null],
  ['tendencias', null],
  ['perfil-publico-verificado', null],
  ['perfil-publico-en-verificacion', null],
  ['guia-verificado', PACIENTE],
  ['guia-en-verificacion-y-sin-verificar', PACIENTE],
  ['ficha-verificada', PACIENTE],
  ['ficha-en-verificacion', PACIENTE],
  ['ficha-sin-verificar', PACIENTE],
  ['mi-perfil-medico', MEDICA],
  ['mensajeria-lista', PACIENTE],
  ['mensajeria-hilo', PACIENTE],
];

for (const [nombre, correo] of corridas) {
  if (SOLO && !SOLO.includes(nombre)) continue;
  for (const ancho of ANCHOS) {
    for (const tema of TEMAS) {
      // FALTANTES=1: no repite lo que ya tiene captura (útil tras un corte del contenedor).
      if (process.env.FALTANTES && existsSync(`${OUT}/${nombre}-${ancho}-${tema}.png`)) continue;
      const ctx = await contexto(ancho, tema);
      const pg = await ctx.newPage();
      const errores = [];
      pg.on('pageerror', (e) => errores.push(String(e).slice(0, 160)));
      pg.on('console', (m) => m.type() === 'error' && errores.push(m.text().slice(0, 160)));
      try {
        if (correo) await entrar(pg, correo);
        await escenarios[nombre](pg, `${nombre}-${ancho}-${tema}`);
      } catch (e) {
        informe.push(`FALLO ${nombre}-${ancho}-${tema}: ${String(e).slice(0, 200)}`);
      }
      if (errores.length) informe.push(`  errores de consola (${nombre}-${ancho}-${tema}): ${errores.slice(0, 3).join(' | ')}`);
      await ctx.close();
    }
  }
}

// ---- extras: popover abierto con teclado y contacto a 400 % / fuente grande ---
if (process.env.EXTRA) {
  const URLS_POPOVER = [
    ['popover-perfil-publico', '/p/valeria-rojas', null, '.vb'],
    ['popover-guia', '/directory?q=Valeria', 'paciente@alovida.mock', '.tarjeta-resultado__titulo .vb'],
  ];
  for (const tema of TEMAS) {
    for (const [nombre, url, correo, selector] of URLS_POPOVER) {
      const ctx = await contexto(1440, tema);
      const pg = await ctx.newPage();
      try {
        if (correo) await entrar(pg, correo);
        await pg.goto(`${BASE}${url}`, { waitUntil: 'commit', timeout: 180000 });
        await esperar(pg, `${selector}`);
        const boton = pg.locator(selector).first();
        await boton.scrollIntoViewIfNeeded();
        await pg.keyboard.press('Shift'); // modalidad de teclado: se ve el anillo de foco
        await boton.focus();
        await pg.locator('.vb-pop').waitFor({ timeout: 5000 });
        await pg.waitForTimeout(400);
        const caja = await boton.boundingBox();
        const clip = {
          x: Math.max(0, caja.x - 260),
          y: Math.max(0, caja.y - 190),
          width: 560,
          height: 300,
        };
        await pg.screenshot({ path: `${OUT}/${nombre}-${tema}.png`, clip });
        informe.push(`${OUT}/${nombre}-${tema}.png`);
        // Esc lo descarta y devuelve el foco sin perderlo.
        await pg.keyboard.press('Escape');
        await pg.waitForTimeout(200);
        informe.push(`${nombre}-${tema}: tras Esc popover=${await pg.locator('.vb-pop').count()} foco-en-boton=${await boton.evaluate((e) => document.activeElement === e)}`);
      } catch (e) {
        informe.push(`FALLO ${nombre}-${tema}: ${String(e).slice(0, 200)}`);
      }
      await ctx.close();
    }
  }

  // 400 % de zoom de un navegador de 1440 px = 360 px CSS a 4 de densidad; y fuente grande.
  const CASOS_ZOOM = [
    ['zoom400-guia', '/directory?q=Valeria', 'paciente@alovida.mock', '.tarjeta-resultado__titulo'],
    ['zoom400-perfil-publico', '/p/valeria-rojas', null, '.perfil__nombre'],
    ['zoom400-chat-lista', '/messaging', 'paciente@alovida.mock', '.conversaciones__nombre-fila'],
  ];
  for (const [modo, css] of [['zoom400', null], ['fuente-grande', 'html { font-size: 150% !important; }']]) {
    for (const [nombre, url, correo, selector] of CASOS_ZOOM) {
      const ctx = await contexto(modo === 'zoom400' ? 360 : 768, 'claro', modo === 'zoom400' ? { deviceScaleFactor: 4 } : {});
      const pg = await ctx.newPage();
      try {
        if (correo) await entrar(pg, correo);
        await pg.goto(`${BASE}${url}`, { waitUntil: 'commit', timeout: 180000 });
        await esperar(pg, `${selector} app-verification-badge:not(.vb-host--hidden)`);
        if (css) await pg.addStyleTag({ content: css });
        await pg.waitForTimeout(500);
        // La fila que SÍ lleva la insignia (otras con el mismo nombre parcial no la llevan).
        const fila = pg.locator(selector).filter({ has: pg.locator('app-verification-badge:not(.vb-host--hidden)') }).first();
        await fila.scrollIntoViewIfNeeded();
        const caja = await fila.boundingBox();
        const clip = { x: Math.max(0, caja.x - 12), y: Math.max(0, caja.y - 12), width: Math.min(caja.width + 24, 340), height: caja.height + 24 };
        await pg.screenshot({ path: `${OUT}/${nombre.replace('zoom400', modo)}.png`, clip });
        informe.push(`${OUT}/${nombre.replace('zoom400', modo)}.png`);
        informe.push(`${modo}/${nombre}: ${JSON.stringify(await medir(pg, nombre))}`);
      } catch (e) {
        informe.push(`FALLO ${modo}/${nombre}: ${String(e).slice(0, 200)}`);
      }
      await ctx.close();
    }
  }
}

await nav.close();
console.log(informe.join('\n'));
