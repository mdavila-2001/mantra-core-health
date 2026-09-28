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
 * 4. Un servicio de una sola instancia (el electrocardiograma, sin cobrar)
 *    abre **directamente el modal** de la factura, que cobra y emite.
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

/**
 * En cada ancho: sin scroll lateral en la página, el modal de arriba entero
 * dentro del viewport, **ninguna tabla desbordando su caja** dentro del modal
 * (la columna de acción fija tapaba importes a 1024 px) y el plan dentro del
 * margen de «Pagos». `foco` lleva a la vista lo que la foto tiene que mostrar.
 */
async function medir(page: Page, nombre: string, foco?: string): Promise<void> {
  for (const ancho of ANCHOS) {
    await page.setViewportSize(ancho);
    await esperarAQueSeAsiente(page);
    if (foco !== undefined) await page.getByTestId(foco).scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const dialogos = Array.from(document.querySelectorAll('dialog[open]'));
      const caja = dialogos.at(-1)?.getBoundingClientRect();
      const tablas = Array.from(document.querySelectorAll<HTMLElement>('dialog[open] .data-table__scroll'));
      const contenedor = document.querySelector('[data-testid="cobros-del-paciente"]')?.getBoundingClientRect();
      const plan = document.querySelector('[data-testid="plan-de-pagos"]')?.getBoundingClientRect();
      return {
        desborde: document.documentElement.scrollWidth - window.innerWidth,
        modalFuera: caja === undefined ? false : caja.left < -1 || caja.right > window.innerWidth + 1,
        tablaDesbordada: tablas.filter((t) => t.offsetParent !== null).some((t) => t.scrollWidth > t.clientWidth + 1),
        planFuera: contenedor === undefined || plan === undefined ? false : plan.right > contenedor.right + 1,
      };
    });
    expect(m.desborde, `scroll lateral en ${nombre} a ${ancho.width}px`).toBeLessThanOrEqual(0);
    expect(m.modalFuera, `modal fuera del viewport en ${nombre} a ${ancho.width}px`).toBe(false);
    expect(m.tablaDesbordada, `tabla más ancha que su caja en ${nombre} a ${ancho.width}px`).toBe(false);
    expect(m.planFuera, `plan fuera del margen en ${nombre} a ${ancho.width}px`).toBe(false);
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
  const facturar = page.getByRole('button', { name: /^Cobrar y facturar: Electrocardiograma/ });
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
  // Primero lo que no sale: más que el saldo se dice antes de enviar.
  await page.getByTestId('plan-monto').fill('999.00');
  await page.getByTestId('plan-confirmar-pago').click();
  await expect(page.getByTestId('plan-formulario-de-pago')).toContainText('No puede superar el saldo');
  await medir(page, '3a-monto-excedido', 'plan-formulario-de-pago');
  await page.getByTestId('plan-monto').fill('80.00');
  await medir(page, '3-formulario-de-pago', 'plan-formulario-de-pago');
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
  await expect(page.getByTestId('plan-ultima-nota')).toContainText(nota);
  await expect(page.getByTestId('plan-ultima-nota')).toBeFocused();
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
  await medir(page, '5-plan-saldado', 'plan-generar-factura');

  await page.getByTestId('plan-generar-factura').click();
  await expect(page.getByTestId('factura-formulario')).toBeVisible();
  await expect(page.getByTestId('factura-notas-del-plan')).toContainText(nota);
  await medir(page, '6-modal-factura-del-plan', 'factura-formulario');
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

test('servicio de una sola instancia sin cobrar: el modal cobra y factura', async ({ page }) => {
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

  await page.getByRole('button', { name: /^Cobrar y facturar: Electrocardiograma/ }).click();
  await expect(page.getByTestId('factura-formulario')).toBeVisible();
  await expect(page.getByTestId('plan-de-pagos')).toHaveCount(0);
  await expect(page.getByTestId('factura-confirmar')).toHaveText(/Cobrar y emitir factura/);
  await medir(page, '8-modal-pago-unico', 'factura-formulario');

  // Sin medio de pago no sale nada: lo pide.
  await page.getByTestId('factura-confirmar').click();
  await expect(page.getByTestId('factura-formulario')).toContainText('Elegí cómo pagó');
  await medir(page, '8a-falta-medio-de-pago', 'factura-formulario');
  await page.getByTestId('factura-formulario').getByLabel('Medio de pago').selectOption({ index: 1 });

  await page.getByTestId('factura-confirmar').click();
  await expect(page.getByTestId('factura-emitida')).toBeVisible();
  // Contexto limpio: el ECG quedó pagado y su factura es la única guardada.
  const ecg = (await guardados(page)).cobros.find((c) => c.description.startsWith('Electrocardiograma'))!;
  expect(ecg.payment).not.toBeNull();
  expect((await guardados(page)).facturas.map((f) => [f.chargeId, f.status])).toEqual([[ecg.id, 'VALIDATED']]);
  await medir(page, '9-factura-pago-unico');

  // Recarga: la fila ofrece ver la factura, y el modal abre mostrándola.
  await page.reload();
  await abrirPagos(page);
  await page.getByRole('button', { name: /^Ver factura: Electrocardiograma/ }).click();
  await expect(page.getByTestId('factura-emitida')).toBeVisible();
  await expect(page.getByTestId('factura-formulario')).toHaveCount(0);

  expect(errores, 'Consola del navegador').toEqual([]);
});

test('/billing: un cobro con plan se paga por instancia y, saldado, ofrece la factura', async ({ page }) => {
  test.setTimeout(180_000);
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Content Security Policy')) errores.push(m.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await entrarAlSimulador(page, 'admin', BASE);
  await page.goto(`${BASE}/billing`);
  const fila = page.getByTestId('fila-de-cobro').filter({ hasText: 'Pago parcial' }).first();
  await expect(fila).toBeVisible();
  const cobroId = await fila.locator('[data-charge-id]').getAttribute('data-charge-id');
  await fila.locator('[data-charge-id]').click();

  const plan = page.getByTestId('plan-de-pagos');
  await expect(plan).toBeVisible();
  await expect(page.getByTestId('formulario-de-pago')).toHaveCount(0);
  await expect(page.getByTestId('formulario-de-factura')).toHaveCount(0);
  await expect(page.getByTestId('plan-generar-factura')).toHaveCount(0);
  await medir(page, '10-billing-plan', 'plan-de-pagos');

  // Cada instancia con saldo, por su saldo.
  for (let i = 0; i < 3; i++) {
    const pendiente = plan.getByRole('button', { name: /^Registrar pago de / }).first();
    if ((await pendiente.count()) === 0) break;
    await pendiente.click();
    await page.getByTestId('plan-confirmar-pago').click();
    await expect(page.getByTestId('plan-formulario-de-pago')).toHaveCount(0);
  }
  await expect(page.getByTestId('plan-saldado')).toBeVisible();
  await expect(page.getByTestId('formulario-de-factura')).toBeVisible();

  // Recarga: el plan sigue saldado y el cobro ofrece su formulario de factura.
  await page.reload();
  await page.locator(`[data-charge-id="${cobroId}"]`).click();
  await expect(page.getByTestId('plan-saldado')).toBeVisible();
  await expect(page.getByTestId('formulario-de-factura')).toBeVisible();
  await medir(page, '11-billing-plan-saldado', 'formulario-de-factura');

  expect(errores, 'Consola del navegador').toEqual([]);
});
