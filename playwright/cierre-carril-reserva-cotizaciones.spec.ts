import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Evidencia final del carril «reserva y Cotizaciones» (H6.S1.M1–M2), sobre el
 * código final: Cotizaciones en tres anchos y dos temas, sus estados, la ficha
 * con los cupos por sede y el recorrido de teclado.
 *
 * Sólo `paciente@alovida.mock` (sintética) y la profesional sintética de
 * `fixtures/personas.ts`: la ficha se abre filtrando por ella para que no
 * entren en cuadro los médicos reales del catálogo de aseguradoras.
 */
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

const PROFESIONAL_SINTETICA = 'Valeria Rojas Mendoza';

const SALIDA = join(
  'docs',
  'trabajo',
  '2026-09-24-cerrar-carril-reserva-cotizaciones',
  'evidencia',
  'h6',
);

const VISTAS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

/** Captura del viewport cuando ya no queda ninguna animación finita en vuelo. */
async function foto(page: Page, archivo: string): Promise<void> {
  await page.evaluate(async () => {
    const finitas = document.getAnimations().filter((animacion) => {
      const iteraciones = animacion.effect?.getComputedTiming().iterations ?? 1;
      return Number.isFinite(iteraciones);
    });
    // Con tope: un aviso emergente (toast) puede quedar con su animación en
    // pausa y su `finished` no resuelve nunca.
    await Promise.race([
      Promise.all(finitas.map((animacion) => animacion.finished.catch(() => undefined))),
      new Promise((resolver) => setTimeout(resolver, 5_000)),
    ]);
  });
  await page.screenshot({ path: join(SALIDA, archivo), animations: 'disabled' });
}

async function buscar(page: Page, termino: string): Promise<void> {
  await page.getByTestId('cotizaciones-busqueda').locator('input').fill(termino);
  await expect(page.locator('.cotizaciones__buscando')).toHaveCount(0, { timeout: 15_000 });
}

test.beforeEach(async ({ page }) => {
  mkdirSync(SALIDA, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, PACIENTE);
});

test('Cotizaciones con resultados en tres anchos y dos temas', async ({ page }) => {
  test.setTimeout(240_000);
  await irA(page, '/my-account/cotizaciones');
  await estable(page);
  await buscar(page, 'paracetamol');
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText('Lista PUBLICO de');

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const vista of VISTAS) {
      await page.setViewportSize(vista);
      await page.getByTestId('cotizaciones-resultados').scrollIntoViewIfNeeded();
      await foto(page, `cotizaciones-paracetamol-${vista.nombre}-${colorScheme}.png`);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
});

test('Cotizaciones: sin término, arancel en UMA, estudio sin distancia y vacío', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await irA(page, '/my-account/cotizaciones');
  await estable(page);

  await expect(page.getByTestId('cotizaciones-sin-termino')).toBeVisible();
  await foto(page, 'cotizaciones-sin-termino-1440-light.png');

  await buscar(page, 'consulta medica general');
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText('UMA');
  await foto(page, 'cotizaciones-arancel-uma-1440-light.png');

  await buscar(page, 'tomografia');
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
    'El centro no publica su ubicación en el directorio',
  );
  await foto(page, 'cotizaciones-estudio-sin-distancia-1440-light.png');

  await page.setViewportSize({ width: 390, height: 844 });
  await buscar(page, 'zzzz sin coincidencias');
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
    'No encontramos cotizaciones',
  );
  await foto(page, 'cotizaciones-vacio-390-light.png');
});

test('estados transitorios y precio no publicado', async ({ page }) => {
  test.setTimeout(240_000);
  await irA(page, '/my-account/cotizaciones');
  await estable(page);

  // «Precio no publicado»: el arancel odontológico trae doce filas sin
  // precio (`referencePrice: null`); se dice, con la procedencia al lado.
  await buscar(page, 'gingivoplastia');
  await expect(page.locator('.cotizaciones__precio--no-publicado').first()).toHaveText(
    'Precio no publicado',
  );
  await foto(page, 'cotizaciones-precio-no-publicado-1440-light.png');

  // Cargando: el doble responde en 40 ms, así que se frena la CPU para que el
  // estado se alcance a ver. La captura se dispara apenas aparece.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await page.getByTestId('cotizaciones-busqueda').locator('input').fill('ibuprofeno');
  await expect(page.locator('.cotizaciones__buscando[role="status"]')).toBeVisible();
  await page.screenshot({ path: join(SALIDA, 'cotizaciones-cargando-1440-light.png') });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await expect(page.locator('.cotizaciones__buscando')).toHaveCount(0, { timeout: 30_000 });

  // La carga por sede de la ficha (H2.S2.M4) no se captura: el bloque está
  // bajo el pliegue y la foto llegaba cuando la carga ya había terminado —una
  // captura rotulada «buscando» que mostraba cupos—. Ese estado lo fija el
  // spec de `practitioner-availability` («cada sede muestra su propia carga»).
});

test('la ficha muestra los cupos por sede, en claro y en oscuro', async ({ page }) => {
  test.setTimeout(240_000);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const vista of [VISTAS[0], VISTAS[2]]) {
      await page.setViewportSize(vista);
      await irA(page, '/directory');
      await estable(page);
      await page
        .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
        .filter({ hasText: 'Cardiología' })
        .first()
        .click();
      await page.getByPlaceholder('Buscar').fill(PROFESIONAL_SINTETICA);
      const tarjeta = page.locator('.tarjeta-resultado__titulo a');
      // Las dos esperas: que no quede nadie más Y que ella esté. Sólo la
      // primera se cumple también con la lista vacía mientras filtra, y el
      // clic caía en un médico real del catálogo de aseguradoras.
      await expect(tarjeta.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0, {
        timeout: 15_000,
      });
      await expect(tarjeta.first()).toHaveText(PROFESIONAL_SINTETICA);
      await tarjeta.first().click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(PROFESIONAL_SINTETICA);
      const disponibilidad = page.locator('app-practitioner-availability');
      await expect(disponibilidad.locator('.disponibilidad__cupos button').first()).toBeVisible();
      await expect(disponibilidad.locator('.disponibilidad__buscando')).toHaveCount(0);
      await disponibilidad.scrollIntoViewIfNeeded();
      await foto(page, `ficha-cupos-por-sede-${vista.nombre}-${colorScheme}.png`);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
});

test('teclado: Directorio y Cotizaciones se usan sin mouse', async ({ page }) => {
  test.setTimeout(240_000);
  const pasos: string[] = [];

  await irA(page, '/directory');
  await estable(page);
  const especialidad = page
    .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
    .first();
  await especialidad.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/directory\?especialidad=/);
  pasos.push(
    'Directorio: foco en la primera especialidad + Enter → abre su lista (una navegación)',
  );

  const primerResultado = page.locator('.tarjeta-resultado__titulo a').first();
  await expect(primerResultado).toBeVisible();
  await primerResultado.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/directory\/[^?]+/);
  pasos.push('Directorio: foco en el título del primer resultado + Enter → abre la ficha');

  await irA(page, '/my-account/cotizaciones');
  await estable(page);
  const campo = page.getByTestId('cotizaciones-busqueda').locator('input');
  await campo.focus();
  await page.keyboard.type('paracetamol');
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText('Lista PUBLICO de');
  pasos.push(
    'Cotizaciones: foco en «Qué querés cotizar», escribir «paracetamol» → resultados con precio y procedencia',
  );

  const vertical = page.getByLabel('Vertical');
  let tabs = 0;
  while (tabs < 5 && !(await vertical.evaluate((nodo) => nodo === document.activeElement))) {
    await page.keyboard.press('Tab');
    tabs += 1;
  }
  await expect(vertical).toBeFocused();
  pasos.push(
    `Tab ×${tabs} → «Vertical» recibe el foco (antes pasa por el control propio del campo de búsqueda)`,
  );

  await page.keyboard.press('Tab');
  const orden = page.getByLabel('Ordenar por');
  await expect(orden).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(orden).toHaveValue('1');
  pasos.push(
    'Tab → «Ordenar por»; Flecha abajo → «Cercanía» (ordena por los km que calculó la API)',
  );

  const accion = page.locator('a.cotizaciones__accion').first();
  await accion.focus();
  await expect(accion).toBeFocused();
  await expect(accion).toContainText('Ver farmacias');
  pasos.push(
    'La acción de la primera fila («Ver farmacias», ícono + texto) es un enlace enfocable',
  );

  writeFileSync(
    join(SALIDA, 'teclado.md'),
    `# Recorrido de teclado — generado por playwright/cierre-carril-reserva-cotizaciones.spec.ts\n\n${pasos
      .map((paso, indice) => `${indice + 1}. ${paso}`)
      .join('\n')}\n`,
  );
});
