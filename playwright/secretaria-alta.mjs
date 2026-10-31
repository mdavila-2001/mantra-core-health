/**
 * Evidencia del alta de la secretaria (personal de apoyo) contra la maqueta:
 *
 * - La tarjeta «Secretaria o personal de apoyo» en «Crear cuenta» y el alta (`/auth/register/support-staff`).
 * - La tarjeta del alta está centrada (holgura izquierda ≈ derecha, ≤ 2 px), a lo ancho (≥ 85 % del área) y sin
 *   desborde horizontal (composition-rules §5).
 *
 * Pedir y aceptar vínculos con hospitales y doctores es de `support-access` y tiene su propia evidencia.
 *
 * Nunca espera `networkidle`. Uso: `yarn node playwright/secretaria-alta.mjs` con el front levantado en `BASE`
 * (por omisión http://localhost:4231). Capturas en `SALIDA`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4231';
const SALIDA = process.env.SALIDA ?? 'test-results/secretaria';
mkdirSync(SALIDA, { recursive: true });
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push(Boolean(cond));
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const nav = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function geometria(pg, selector, etiqueta) {
  const g = await pg.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner') ?? document.body;
    const caja = document.querySelector(sel);
    if (!caja) return null;
    const a = area.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    return {
      izq: Math.round(c.left - a.left),
      der: Math.round(a.right - c.right),
      ancho: c.width / a.width,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  }, selector);
  ok(`${etiqueta}: tarjeta presente`, g !== null);
  if (g === null) return;
  ok(`${etiqueta}: centrada`, Math.abs(g.izq - g.der) <= 2, `izq ${g.izq}px · der ${g.der}px`);
  ok(`${etiqueta}: a lo ancho`, g.ancho >= 0.85, `${Math.round(g.ancho * 100)} %`);
  ok(`${etiqueta}: sin desborde horizontal`, !g.desborde);
}

for (const [nombre, ancho] of [['escritorio', 1440], ['celular', 390]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } });
  const pg = await ctx.newPage();

  // 1. Crear cuenta: la tarjeta y el alta.
  await pg.goto(`${B}/auth/register`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('tipo-personal-apoyo').waitFor({ timeout: 60000 });
  ok(`${nombre}: «Crear cuenta» ofrece la secretaria`, await pg.getByTestId('tipo-personal-apoyo').isVisible());
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-01-crear-cuenta.png`, fullPage: true });
  await pg.getByTestId('tipo-personal-apoyo').click();
  await pg.getByTestId('alta-apoyo-form').waitFor({ timeout: 60000 });
  await pg.waitForTimeout(800);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-02-alta.png`, fullPage: true });

  await geometria(pg, '[data-testid="alta-apoyo-form"]', `${nombre} alta de la secretaria`);
  await ctx.close();
}

await nav.close();
const fallas = veredictos.filter((v) => !v).length;
process.stdout.write(`\n${veredictos.length - fallas}/${veredictos.length} comprobaciones\n`);
process.exit(fallas === 0 ? 0 : 1);
