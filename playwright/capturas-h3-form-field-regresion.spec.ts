import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Regresión visual de H3.S2.M7: el mensaje de error y el asterisco de
 * `app-form-field` pasaron de `--c-error-500` (fijo) a `--text-danger` (con
 * variante de tema), porque en oscuro el mensaje daba ~2,9:1.
 *
 * `form-field` lo usa casi todo formulario: se capturan tres ajenos al alta
 * (ingreso, recuperar contraseña y alta de organización) con sus errores a la
 * vista, en claro y oscuro, 1440 y 390. Se corre dos veces —antes del cambio
 * y después— con `CAPTURAS_DIR` distinto, y se comparan los pares.
 *
 * Contra el simulador (`start:demo`): son pantallas públicas y lo que se mide
 * es color, no integración.
 */
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '390', width: 390, height: 844 },
] as const;
const TEMAS = ['light', 'dark'] as const;
const DIR = process.env['CAPTURAS_DIR'] ?? 'artifacts/capturas-h3-form-field';

test.use({ contextOptions: { reducedMotion: 'reduce' } });
test.setTimeout(240_000);

async function quieto(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime ?? 0)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

async function abrir(page: Page, ruta: string, tema: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.evaluate((m) => localStorage.setItem('mantra-core-health.theme', m), tema);
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
}

/** Toca cada campo de texto visible y lo deja vacío: el motor muestra el error al tocar. */
async function tocarCampos(page: Page): Promise<void> {
  const campos = page.locator('main input:visible');
  await expect(campos.first()).toBeVisible({ timeout: 20_000 });
  const cantidad = await campos.count();
  for (let i = 0; i < cantidad; i++) {
    await campos.nth(i).focus();
    await campos.nth(i).blur();
  }
  await quieto(page);
}

const PANTALLAS = [
  { nombre: 'ingreso', ruta: '/auth' },
  { nombre: 'recuperar-contrasena', ruta: '/auth/forgot-password' },
  { nombre: 'alta-organizacion', ruta: '/auth/register/organization' },
] as const;

test('form-field: errores y asteriscos en tres formularios ajenos al alta', async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  for (const t of TEMAS) {
    for (const a of ANCHOS) {
      await page.setViewportSize({ width: a.width, height: a.height });
      for (const p of PANTALLAS) {
        await abrir(page, p.ruta, t);
        await tocarCampos(page);
        await page.screenshot({ path: `${DIR}/${p.nombre}-${a.nombre}-${t}.png` });
      }
    }
  }
});
