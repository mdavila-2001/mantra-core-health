import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrar, esperarAplicacionLista, irA, estable } from '../support/sesion';
import type { Actor } from '../support/actores';

/**
 * Referencia web de una microtarea de paridad mobile (A.H1.S1.M5).
 *
 * Parametrizado por entorno —lo inyecta `tools/qa/verify-microtask.ps1` del
 * repo mobile—:
 *   ALOVIDA_TASK_ID        id de la microtarea (obligatorio; sin id no hay prueba)
 *   ALOVIDA_TASK_CARD      JSON con la ficha: { taskId, webRoute, requiresSession,
 *                          actor: { identificador }, assertions: [{ kind, value }] }
 *   ALOVIDA_FIXTURE_PASSWORD  contraseña del fixture (sólo en memoria; nunca se escribe)
 *   ALOVIDA_EVIDENCE_DIR   carpeta del paquete de evidencia (web-reference.png,
 *                          playwright-trace.zip, web-network-sanitized.json)
 *   ALOVIDA_WEB_BASE_URL   base de la web (por defecto la del config)
 *
 * Lo que NO hace: no intercepta rutas, no simula respuestas y no aprueba si la
 * web no responde. Una web caída falla; eso es el borde de la fila.
 */

interface Assertion {
  readonly kind: 'url' | 'text' | 'testid' | 'heading';
  readonly value: string;
}
interface TaskCard {
  readonly taskId: string;
  readonly webRoute: string;
  readonly requiresSession: boolean;
  readonly actor?: { readonly identificador: string; readonly nombre?: string };
  readonly assertions?: readonly Assertion[];
  readonly note?: string;
}

const taskId = process.env['ALOVIDA_TASK_ID'];
const cardPath = process.env['ALOVIDA_TASK_CARD'];
const evidenceDir = process.env['ALOVIDA_EVIDENCE_DIR'];
const baseURL = process.env['ALOVIDA_WEB_BASE_URL'];

function leerFicha(): TaskCard {
  if (!taskId) throw new Error('ALOVIDA_TASK_ID es obligatorio: la referencia web pertenece a una microtarea');
  if (!cardPath || !existsSync(cardPath)) throw new Error(`ALOVIDA_TASK_CARD no apunta a una ficha legible (${cardPath ?? 'vacío'})`);
  // Windows PowerShell 5.1 escribe UTF-8 con BOM: se quita antes de parsear.
  const card = JSON.parse(readFileSync(cardPath, 'utf8').replace(/^﻿/, '')) as TaskCard;
  if (card.taskId !== taskId) throw new Error(`La ficha es de ${card.taskId}, no de ${taskId}`);
  if (!card.webRoute) throw new Error(`La ficha de ${taskId} no declara webRoute`);
  return card;
}

/** Redacta identificadores en rutas y descarta query strings: nada del cuerpo viaja al reporte. */
function redactar(url: string): string {
  return url
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '{id}')
    .replace(/QA-[A-Za-z0-9-]+/g, '{fixture}')
    .replace(/\?.*$/, '');
}

// La traza la gestiona este spec (siempre, al paquete de evidencia); se apaga la
// del config (retain-on-failure) para no arrancarla dos veces. Va a nivel de
// archivo porque `use({ trace })` dentro de un describe fuerza otro worker.
test.use({ trace: 'off', ...(baseURL ? { baseURL } : {}) });

test.describe('mobile-parity · referencia web', () => {
  test(`referencia web de ${taskId ?? '(sin ALOVIDA_TASK_ID)'}`, async ({ page, context }) => {
    const card = leerFicha();
    if (!evidenceDir) throw new Error('ALOVIDA_EVIDENCE_DIR es obligatorio');
    mkdirSync(evidenceDir, { recursive: true });

    const red: { method: string; url: string; status: number }[] = [];
    page.on('response', (r) => {
      const url = r.url();
      // Solo llamadas de datos: los assets del dev-server (js/css/fuentes/imágenes) no son contrato.
      if (!/\.(m?js|css|map|png|jpe?g|svg|ico|woff2?|ttf|json)(\?|$)/.test(url) && !url.includes('/@') && !url.includes('/node_modules/')) {
        red.push({ method: r.request().method(), url: redactar(url.replace(/^https?:\/\/[^/]+/, '')), status: r.status() });
      }
    });

    // Trazas sin cuerpos: snapshots sí (DOM), red sin contenido.
    await context.tracing.start({ screenshots: true, snapshots: true, sources: false });

    try {
      // Una web desconectada NO aprueba con un mock: si no responde, esto falla acá.
      const inicio = await page.goto('/auth', { waitUntil: 'load', timeout: 30_000 });
      expect(inicio, 'la web de referencia no respondió').not.toBeNull();
      expect(inicio!.status(), 'la web de referencia respondió con error').toBeLessThan(400);
      await esperarAplicacionLista(page);

      if (card.requiresSession) {
        const clave = process.env['ALOVIDA_FIXTURE_PASSWORD'];
        if (!card.actor?.identificador || !clave) throw new Error('La ficha exige sesión y no hay fixture inyectado');
        const actor: Actor = { rol: 'paciente', identificador: card.actor.identificador, clave, nombre: card.actor.nombre ?? 'Fixture' };
        await entrar(page, actor);
        await irA(page, card.webRoute);
      } else {
        await page.goto(card.webRoute, { waitUntil: 'load' });
        await esperarAplicacionLista(page);
      }
      await estable(page);

      for (const a of card.assertions ?? []) {
        if (a.kind === 'url') await expect(page).toHaveURL(new RegExp(a.value));
        else if (a.kind === 'text') await expect(page.getByText(a.value, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
        else if (a.kind === 'testid') await expect(page.getByTestId(a.value).first()).toBeVisible({ timeout: 20_000 });
        else if (a.kind === 'heading') await expect(page.getByRole('heading', { name: a.value }).first()).toBeVisible({ timeout: 20_000 });
      }

      await capturar(page, join(evidenceDir, 'web-reference.png'));
    } finally {
      await context.tracing.stop({ path: join(evidenceDir, 'playwright-trace.zip') });
      writeFileSync(
        join(evidenceDir, 'web-network-sanitized.json'),
        JSON.stringify({ taskId, webRoute: card.webRoute, baseURL: baseURL ?? null, finalUrl: redactar(page.url().replace(/^https?:\/\/[^/]+/, '')), requests: red }, null, 2),
      );
    }
  });
});

async function capturar(page: Page, destino: string): Promise<void> {
  await page.screenshot({ path: destino, fullPage: true });
}
