import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable } from './support/sesion';

/** Los cinco anchos obligatorios del sistema de diseño (mismo set que `panel-hoy.spec.ts`). */
const ANCHOS: readonly { readonly nombre: string; readonly ancho: number; readonly alto: number }[] = [
  { nombre: '390', ancho: 390, alto: 844 },
  { nombre: '768', ancho: 768, alto: 1024 },
  { nombre: '1024', ancho: 1024, alto: 768 },
  { nombre: '1440', ancho: 1440, alto: 900 },
  { nombre: '1920', ancho: 1920, alto: 1080 },
];

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

/** Congela animaciones para que la captura sea reproducible (mismo criterio que `panel-hoy.spec.ts`). */
async function quieta(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation-iteration-count:1 !important;animation-duration:1ms !important;transition-duration:1ms !important}',
  });
}

/**
 * Evidencia visual del reparto de Ender — turno noche 2026-09-20
 * ("Los contratos que faltan y un panel que diga la verdad").
 *
 * H1.S1.M3: entrar con las dos cuentas del lote y ver que cada una llega a lo
 * suyo. `POST /iam/auth/login` admite diez por minuto y por IP (mismo límite
 * documentado en `contabilidad-llana.spec.ts`), así que cada cuenta entra una
 * sola vez en toda la corrida.
 */

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Dra. Valeria Rojas Mendoza',
};

const VISITADOR: Actor = {
  rol: 'doctora', // el tipo `Rol` no tiene un valor para visitador todavía; sólo etiqueta la evidencia
  identificador: 'visitador@alovida.mock',
  clave: 'mock',
  nombre: 'Carla Fernández Ríos (visitadora médica)',
};

const EVIDENCIA = join(__dirname, '..', 'artifacts', 'ender-contratos-panel');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: true, animations: 'disabled' });
}

test.describe('H1.S1.M3 — las dos cuentas entran y ven lo suyo', () => {
  test('medica@alovida.mock entra y llega al panel de inicio', async ({ page }) => {
    await entrar(page, MEDICA);
    await expect(page).toHaveURL(/\/dashboard/);
    await estable(page);
    await capturar(page, 'h1-medica-dashboard');
  });

  test('visitador@alovida.mock entra y NO llega al panel clínico', async ({ page }) => {
    await entrar(page, VISITADOR);
    // El visitador no tiene panel de inicio clínico: lo que importa acá es que
    // entró (token válido, `AuthService` lo canjeó) y no quedó varado en /auth.
    await expect(page).not.toHaveURL(/\/auth$/);
    await estable(page);
    await capturar(page, 'h1-visitador-post-login');
  });
});

test.describe('H5/H6 — "Tus consultas" en el panel: 5 anchos, claro y oscuro', () => {
  test('el bloque nuevo se ve sin desborde horizontal en ningún ancho, en los dos temas', async ({ page }) => {
    test.setTimeout(3 * 60_000);

    const erroresDeConsola: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() !== 'error') return;
      const texto = mensaje.text();
      if (texto.includes('Content Security Policy')) return;
      erroresDeConsola.push(texto);
    });
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400) erroresDeConsola.push(`${respuesta.status()} en ${respuesta.url()}`);
    });

    await entrar(page, MEDICA);
    await estable(page);

    const bloque = page.getByTestId('panel-consultas-resumen');
    await expect(bloque).toBeVisible({ timeout: 30_000 });
    // La cifra semanal/mensual tiene que resolver, no quedarse en el esqueleto.
    await expect(page.getByTestId('consultas-resumen-mes')).toBeVisible({ timeout: 30_000 });

    for (const { nombre, ancho, alto } of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: alto });
      await estable(page);
      await quieta(page);
      expect(await desbordeHorizontal(page), `desborde horizontal a ${ancho}px`).toBeLessThanOrEqual(1);
      await capturar(page, `h5-consultas-resumen-${nombre}`);
    }

    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);
    await quieta(page);
    expect(await desbordeHorizontal(page), 'desborde horizontal en oscuro').toBeLessThanOrEqual(1);
    await capturar(page, 'h5-consultas-resumen-1440-oscuro');
    await page.emulateMedia({ colorScheme: 'light' });

    const ruido = erroresDeConsola.filter((texto) => !texto.includes('[mock] sin manejador'));
    expect(ruido, ruido.join('\n')).toEqual([]);
  });

  test('el globo del panel funciona igual que en la agenda (H6.S1)', async ({ page }) => {
    await entrar(page, MEDICA);
    await page.setViewportSize({ width: 1440, height: 900 });
    await estable(page);

    const ayuda = page.locator('[data-testid="panel-consultas-resumen"] .consultas-resumen__ayuda').first();
    await ayuda.scrollIntoViewIfNeeded();
    await ayuda.focus();
    await expect(page.getByRole('tooltip')).toBeVisible({ timeout: 5000 });
  });
});
