import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Contabilidad para quien no lleva libros — evidencia del 19/09/2026.
 *
 * ## Qué demuestra
 *
 * Que `/administration/accounting` contesta, **sin tocar nada**, las cuatro
 * preguntas que el propietario dijo que la pantalla no contestaba:
 *
 * 1. cuánto se hizo **hoy, esta semana y este mes** —y que los tres son
 *    números distintos, que es lo que fallaba: la pantalla vieja mostraba el
 *    resultado del ejercicio entero—;
 * 2. **en qué se gasta**, con los nombres traducidos y ordenados de mayor a
 *    menor;
 * 3. **qué pagos hay pendientes** (quién te debe);
 * 4. **qué cuentas hay que pagar**.
 *
 * Más las dos cosas que la acompañan: que **activos y pasivos quedó adentro**
 * de Contabilidad y salió del menú, y que **nada se borró** —el cockpit y los
 * libros siguen ahí, a un clic—.
 *
 * ## Contra qué corre
 *
 * Contra la maqueta (`mock-backend.interceptor`), que es el entorno autorizado
 * de esta rama y el que sirve `mockup.*`. La compensación de una partida se
 * comprueba **con recarga dura**: un toast no prueba nada, así que se lee el
 * total, se salda, se recarga la página entera y se vuelve a leer.
 *
 * ## Un solo ingreso
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Todo esto es una
 * sola prueba que entra una vez, igual que el resto de la suite.
 */

/**
 * La médica **de la maqueta**, no la de la API viva.
 *
 * `doctora()` de `support/actores` entra con las credenciales sembradas por
 * `tools/alovida/cuenta-doctor-demo.mjs`, que sólo existen contra el backend
 * real. Esta suite corre contra el interceptor, donde el usuario se busca por
 * la clave del fixture (`mock-session.ts: buscarUsuario`) y la contraseña sólo
 * tiene que no estar vacía. Mismas cuentas que usa `mockup-barrido.spec.ts`.
 */
const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Dra. Valeria Rojas Mendoza',
};

const EVIDENCIA = join(__dirname, '..', 'artifacts', 'contabilidad-llana');

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({
    path: join(EVIDENCIA, `${nombre}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

/** Un importe en bolivianos como número, sólo para comparar en la prueba. */
function aNumero(texto: string | null): number {
  return Number((texto ?? '').replace(/[^\d,]/g, '').replace(/\s/g, '').replace(',', '.'));
}

test.describe('Contabilidad en cristiano', () => {
  test('contesta las cuatro preguntas del doctor y guarda activos y pasivos adentro', async ({
    page,
  }) => {
    await entrar(page, MEDICA);
    await irA(page, '/administration/accounting');
    await estable(page);

    /* ---- 1 · cuánto hiciste hoy, esta semana y este mes -------------------- */

    await expect(page.getByRole('heading', { name: '¿Cuánto hiciste?' })).toBeVisible();

    const tramos = page.locator('.tramo');
    await expect(tramos).toHaveCount(3);
    // En minúscula: las versales son `text-transform`, y el texto que el DOM
    // —y el lector de pantalla— tiene es «Hoy», no «HOY».
    await expect(tramos.nth(0)).toContainText('Hoy');
    await expect(tramos.nth(1)).toContainText('Esta semana');
    await expect(tramos.nth(2)).toContainText('Este mes');

    // Los tres son **distintos**. Es el corazón del pedido: la pantalla vieja
    // mostraba el resultado del ejercicio entero como si fuera el del día.
    const cifras = await page.locator('.tramo__cifra').allTextContents();
    expect(new Set(cifras).size).toBe(3);

    // Y crecen: lo del día cabe en la semana, y la semana en el mes.
    const [hoy, semana, mes] = cifras.map(aNumero);
    expect(hoy).toBeLessThanOrEqual(semana!);
    expect(semana!).toBeLessThanOrEqual(mes!);

    // Cada tramo dice también lo que salió y lo que quedó.
    await expect(tramos.nth(0)).toContainText('Se fue en gastos');
    await expect(tramos.nth(0)).toContainText('Te quedó');

    /* ---- 2 · en qué se te va la plata -------------------------------------- */

    await expect(page.getByRole('heading', { name: '¿En qué se te va la plata?' })).toBeVisible();

    // Acotado al panel de gastos: el de ingresos usa las mismas clases de
    // barra, y sin acotar las dos listas se mezclan en un solo orden que no
    // existe en pantalla.
    const panelGastos = page.getByTestId('panel-gastos');
    expect(await panelGastos.locator('.barra').count()).toBeGreaterThan(0);

    // Traducidos: el plan dice «Depreciación», la pantalla dice de qué se
    // trata. Un médico no tiene por qué saber la palabra.
    await expect(panelGastos.getByText('Desgaste de los equipos')).toBeVisible();
    await expect(panelGastos.getByText(/No sale plata de tu cuenta/)).toBeVisible();

    // De mayor a menor: la primera barra es la más grande.
    const gastos = (await panelGastos.locator('.barra__importe').allTextContents()).map(aNumero);
    for (let i = 1; i < gastos.length; i += 1) {
      expect(gastos[i - 1]!).toBeGreaterThanOrEqual(gastos[i]!);
    }

    /* ---- 3 y 4 · quién te debe, a quién le debés --------------------------- */

    await expect(page.getByRole('heading', { name: 'Te deben' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tenés que pagar' })).toBeVisible();

    // El plazo va escrito, no sólo en color: la regla de la casa es no
    // depender de distinguir rojo.
    await expect(page.locator('.pendiente').first()).toContainText(/Venció hace|Vence/);

    await capturar(page, '01-resumen-completo');

    /* ---- la mutación, con recarga dura ------------------------------------- */

    const totalAntes = aNumero(await page.locator('.panel--cobrar .panel__total').textContent());
    const cuantasAntes = await page.locator('.panel--cobrar .pendiente').count();

    await page.locator('.panel--cobrar .pendiente__accion').first().click();
    await expect(page.locator('.panel--cobrar .pendiente')).toHaveCount(cuantasAntes - 1);

    // Un toast no prueba nada: se recarga la página entera y se vuelve a leer.
    await page.reload();
    await estable(page);
    await expect(page.getByRole('heading', { name: 'Te deben' })).toBeVisible();

    const totalDespues = aNumero(await page.locator('.panel--cobrar .panel__total').textContent());
    expect(totalDespues).toBeLessThan(totalAntes);
    await expect(page.locator('.panel--cobrar .pendiente')).toHaveCount(cuantasAntes - 1);

    /* ---- activos y pasivos: adentro, no al lado ---------------------------- */

    await expect(
      page.getByRole('heading', { name: 'Lo que tenés y lo que debés' }),
    ).toBeVisible();

    // Fuera del menú lateral: era la undécima entrada y el propietario pidió
    // integrarla. Se comprueba que no está, no sólo que la nueva sí.
    const menu = page.locator('.app-side-nav');
    await expect(menu.getByRole('link', { name: 'Activos y pasivos' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Contabilidad' })).toBeVisible();

    // Y se llega desde acá.
    await page.getByTestId('go-to-assets-liabilities').click();
    await expect(page).toHaveURL(/\/administration\/accounting\/assets-liabilities$/);
    await expect(page.getByRole('heading', { name: 'Activos y pasivos', level: 1 })).toBeVisible();
    await capturar(page, '02-assets-liabilities-dentro');

    /* ---- nada se borró: el cockpit y los libros siguen ahí ----------------- */

    await irA(page, '/administration/accounting');
    await estable(page);

    await page.getByRole('link', { name: 'Vista contable' }).click();
    await expect(page).toHaveURL(/\/administration\/accounting\/cockpit$/);
    await expect(
      page.getByRole('heading', { name: 'Contabilidad · vista contable', level: 1 }),
    ).toBeVisible();
    await capturar(page, '03-vista-contable-intacta');

    await page.getByTestId('volver-al-resumen').click();
    await expect(page).toHaveURL(/\/administration\/accounting$/);
    await expect(page.getByRole('heading', { name: '¿Cuánto hiciste?' })).toBeVisible();
  });

  test('en teléfono se apila sin scroll horizontal', async ({ page }) => {
    // La regla de la casa: fondo blanco, ancho completo y centrado, en móvil
    // y en escritorio. Acá se mide, no se mira.
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, MEDICA);
    await irA(page, '/administration/accounting');
    await estable(page);

    await expect(page.getByRole('heading', { name: '¿Cuánto hiciste?' })).toBeVisible();

    const desborde = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      visible: document.documentElement.clientWidth,
    }));
    expect(desborde.scroll).toBeLessThanOrEqual(desborde.visible);

    await capturar(page, '04-telefono');
  });

  test('a lo ancho del área y centrado, como pide la regla de composición', async ({ page }) => {
    // `composition-rules.md` §5: las holguras izquierda y derecha respecto de
    // `.app-main__inner` difieren en ≤ 2 px, y el bloque mide ≥ 85 % del área.
    await entrar(page, MEDICA);
    await irA(page, '/administration/accounting');
    await estable(page);
    await expect(page.locator('.tramos')).toBeVisible();

    const medida = await page.evaluate(() => {
      const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
      const bloque = document.querySelector('.tramos')!.getBoundingClientRect();
      return {
        izquierda: bloque.x - area.x,
        derecha: area.x + area.width - (bloque.x + bloque.width),
        proporcion: bloque.width / area.width,
      };
    });

    expect(Math.abs(medida.izquierda - medida.derecha)).toBeLessThanOrEqual(2);
    expect(medida.proporcion).toBeGreaterThanOrEqual(0.85);
  });
});
