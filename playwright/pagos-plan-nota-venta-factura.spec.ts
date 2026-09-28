import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * «Pagos» en la consulta: plan de pagos, nota de venta y factura contra el
 * SIAT simulado — evidencia de navegador.
 *
 * 1. Un servicio con reconsultas abre la **tabla del plan**: ítem, monto a
 *    cobrar, monto pagado y la nota de venta de cada pago.
 * 2. Un pago parcial emite una **nota de venta** (no una factura), y la nota
 *    sigue ahí después de recargar: UI → request → response → persistencia →
 *    recarga → UI.
 * 3. Saldado el plan, recién entonces se ofrece la **factura**, que se emite
 *    contra el SIAT simulado (908, CUF).
 * 4. Un servicio de una sola instancia abre **directamente el modal** de la
 *    factura.
 *
 * Contra el backend simulado de `mockup` (`support/simulador.ts`). El
 * simulador responde **dentro** de Angular (un interceptor), así que no hay
 * tráfico de red que esperar: la persistencia se comprueba leyendo lo que el
 * motor guardó en `sessionStorage` y volviendo a leer la UI tras recargar.
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FOTOS = join('docs', 'frontend', 'evidence', 'pagos-plan-nota-venta-factura');
/** Ana Pérez en el simulador: `uuid('pid-paciente')`. Su consulta del 07/09 ya tiene reconsulta agendada. */
const ANA = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';
const ANCHOS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

test.beforeAll(() => mkdirSync(FOTOS, { recursive: true }));

interface CobroGuardado {
  readonly id: string;
  readonly patientProfileId: string;
  readonly description: string;
  readonly payment: unknown;
  readonly plan: { readonly instances: { readonly label: string; readonly salesNotes: { readonly number: string; readonly amount: string }[] }[] } | null;
}

/** Lo que el motor simulado dejó guardado para Ana (`Coleccion` → `sessionStorage`). */
async function guardados(page: Page): Promise<{ cobros: CobroGuardado[]; facturas: { chargeId: string; status: string; cuf: string }[] }> {
  return page.evaluate((ana) => {
    const leer = <T>(clave: string): T[] => {
      const crudo = sessionStorage.getItem(clave);
      return crudo === null ? [] : ((JSON.parse(crudo) as { filas: T[] }).filas ?? []);
    };
    return {
      cobros: leer<{ patientProfileId: string }>('mock.billingSim.mantra.cobros').filter((c) => c.patientProfileId === ana),
      facturas: leer('mock.billingSim.mantra.facturas'),
    };
  }, ANA) as never;
}

async function abrirPagos(page: Page): Promise<void> {
  await page.goto(`${BASE}/medical-records/${ANA}/consultation`);
  await page.getByTestId('consulta-casilla-pagos').click();
  await expect(page.getByTestId('cobros-del-paciente')).toBeVisible();
  await expect(page.getByTestId('cobros-tabla')).toBeVisible();
}

/** Sin scroll lateral en la página, y el modal abierto entero dentro del viewport. */
async function medir(page: Page, nombre: string): Promise<void> {
  for (const ancho of ANCHOS) {
    await page.setViewportSize(ancho);
    await esperarAQueSeAsiente(page);
    const { desborde, modalFuera } = await page.evaluate(() => {
      const dialogos = Array.from(document.querySelectorAll('dialog[open]'));
      const arriba = dialogos.at(-1);
      const caja = arriba?.getBoundingClientRect();
      return {
        desborde: document.documentElement.scrollWidth - window.innerWidth,
        modalFuera: caja === undefined ? false : caja.left < -1 || caja.right > window.innerWidth + 1,
      };
    });
    expect(desborde, `scroll lateral en ${nombre} a ${ancho.width}px`).toBeLessThanOrEqual(0);
    expect(modalFuera, `modal fuera del viewport en ${nombre} a ${ancho.width}px`).toBe(false);
    await page.screenshot({ path: join(FOTOS, `${nombre}-${ancho.width}.png`) });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('plan con reconsultas: nota de venta por pago, persiste al recargar y factura al saldar', async ({ page }) => {
  test.setTimeout(240_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    // El CSP de `ng serve` rechaza los scripts inline de desarrollo: ruido
    // conocido del servidor, filtrado igual en `carga-masiva.spec.ts` y otros.
    if (m.type() === 'error' && !m.text().includes('Content Security Policy')) errores.push(m.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarAlSimulador(page, 'medica', BASE);
  await abrirPagos(page);

  // ─── 1 · La lista de servicios: uno con plan y uno de pago único ────────
  const verPlan = page.getByRole('button', { name: /^Ver plan de pagos: Consulta cardiológica con 2 reconsultas/ });
  const facturar = page.getByRole('button', { name: /^Facturar: Consulta médica/ });
  await expect(verPlan).toBeVisible();
  await expect(facturar).toBeVisible();
  await medir(page, '1-servicios');

  // ─── 2 · La tabla del plan ──────────────────────────────────────────────
  await verPlan.click();
  const plan = page.getByTestId('plan-de-pagos');
  await expect(plan).toBeVisible();
  const tabla = page.getByTestId('plan-tabla');
  for (const item of ['Consulta inicial', 'Reconsulta 1', 'Reconsulta 2']) await expect(tabla).toContainText(item);
  await expect(tabla).toContainText(/NV-\d{6}/);
  await expect(page.getByTestId('plan-generar-factura')).toHaveCount(0);
  await medir(page, '2-plan');

  // ─── 3 · Pago parcial → nota de venta, no factura ───────────────────────
  await page.getByRole('button', { name: 'Registrar pago de Reconsulta 1' }).click();
  await expect(page.getByTestId('plan-formulario-de-pago')).toBeVisible();
  await page.getByTestId('plan-monto').fill('80.00');
  await medir(page, '3-formulario-de-pago');
  await page.getByTestId('plan-confirmar-pago').click();
  await expect(page.getByTestId('plan-formulario-de-pago')).toHaveCount(0);
  // Lo que quedó guardado: una nota de venta de 80,00 y el cobro sin pago ni factura.
  const tras = await guardados(page);
  const conPlan = tras.cobros.find((c) => c.plan !== null)!;
  const reconsulta = conPlan.plan!.instances.find((i) => i.label === 'Reconsulta 1')!;
  expect(reconsulta.salesNotes.map((n) => n.amount)).toEqual(['80.00']);
  const nota = reconsulta.salesNotes[0]!.number;
  expect(nota).toMatch(/^NV-\d{6}$/);
  expect(conPlan.payment).toBeNull();
  expect(tras.facturas.filter((f) => f.chargeId === conPlan.id)).toEqual([]);
  await expect(tabla).toContainText(nota);
  await expect(page.getByTestId('plan-generar-factura')).toHaveCount(0);

  // ─── 4 · Recarga: la nota de venta quedó guardada ───────────────────────
  await page.reload();
  await abrirPagos(page);
  await verPlan.click();
  await expect(page.getByTestId('plan-tabla')).toContainText(nota);
  await expect(page.getByTestId('plan-tabla')).toContainText('Saldo Bs 100,00');
  await page.screenshot({ path: join(FOTOS, '4-plan-tras-recargar-1440.png') });

  // ─── 5 · Saldar el plan → recién ahí, la factura ────────────────────────
  for (const item of ['Reconsulta 1', 'Reconsulta 2']) {
    await page.getByRole('button', { name: `Registrar pago de ${item}` }).click();
    // El monto propuesto es el saldo de la instancia.
    await page.getByTestId('plan-confirmar-pago').click();
    await expect(page.getByTestId('plan-formulario-de-pago')).toHaveCount(0);
  }
  await expect(page.getByTestId('plan-saldado')).toBeVisible();
  await expect(page.getByTestId('plan-saldo')).toContainText('Bs 0,00');
  await medir(page, '5-plan-saldado');

  await page.getByTestId('plan-generar-factura').click();
  await expect(page.getByTestId('factura-formulario')).toBeVisible();
  await expect(page.getByTestId('factura-notas-del-plan')).toContainText(nota);
  await medir(page, '6-modal-factura-del-plan');
  await page.getByTestId('factura-confirmar').click();
  await expect(page.getByTestId('factura-emitida')).toBeVisible();
  const saldado = (await guardados(page)).cobros.find((c) => c.plan !== null)!;
  const factura = (await guardados(page)).facturas.find((f) => f.chargeId === saldado.id)!;
  expect(saldado.payment).not.toBeNull();
  expect(factura.status).toBe('VALIDATED');
  await expect(page.getByTestId('factura-cuf')).toContainText(factura.cuf);
  await expect(page.getByTestId('factura-respuesta-siat')).toContainText('908');
  await medir(page, '7-factura-emitida');

  // ─── 6 · Recarga: el plan quedó facturado ───────────────────────────────
  await page.reload();
  await abrirPagos(page);
  await verPlan.click();
  await expect(page.getByTestId('plan-saldado')).toContainText('facturado');

  expect(errores, 'Consola del navegador').toEqual([]);
});

test('servicio de una sola instancia: abre directamente el modal de la factura', async ({ page }) => {
  test.setTimeout(120_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    // El CSP de `ng serve` rechaza los scripts inline de desarrollo: ruido
    // conocido del servidor, filtrado igual en `carga-masiva.spec.ts` y otros.
    if (m.type() === 'error' && !m.text().includes('Content Security Policy')) errores.push(m.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarAlSimulador(page, 'medica', BASE);
  await abrirPagos(page);

  await page.getByRole('button', { name: /^Facturar: Consulta médica/ }).click();
  await expect(page.getByTestId('factura-formulario')).toBeVisible();
  await expect(page.getByTestId('plan-de-pagos')).toHaveCount(0);
  await medir(page, '8-modal-pago-unico');

  await page.getByTestId('factura-confirmar').click();
  await expect(page.getByTestId('factura-emitida')).toBeVisible();
  // Contexto limpio: la única factura guardada es la que se acaba de emitir.
  expect((await guardados(page)).facturas.map((f) => f.status)).toEqual(['VALIDATED']);
  await medir(page, '9-factura-pago-unico');

  // Recarga: la fila ofrece ver la factura, y el modal abre mostrándola.
  await page.reload();
  await abrirPagos(page);
  await page.getByRole('button', { name: /^Ver factura: Consulta médica/ }).click();
  await expect(page.getByTestId('factura-emitida')).toBeVisible();
  await expect(page.getByTestId('factura-formulario')).toHaveCount(0);

  expect(errores, 'Consola del navegador').toEqual([]);
});
