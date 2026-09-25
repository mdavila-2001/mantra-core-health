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

const TEMAS = ['light', 'dark'] as const;

const VISTAS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

/** Captura del viewport cuando ya no queda ninguna animación finita en vuelo. */
async function foto(page: Page, archivo: string): Promise<void> {
  // El puntero fuera del contenido: sin fila resaltada por hover en la foto.
  await page.mouse.move(0, 0);
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

/**
 * Con el reloj de Playwright en pausa, avanza de a 10 ms hasta que el
 * elemento aparece. Los timers del doble (latencia) y del buscador (debounce)
 * vencen en orden; el que queda pendiente es el que se quiere fotografiar.
 */
async function avanzarHastaVer(page: Page, elemento: ReturnType<Page['locator']>): Promise<void> {
  for (let paso = 0; paso < 300; paso++) {
    if (await elemento.isVisible()) return;
    await page.clock.runFor(10);
  }
  await expect(elemento).toBeVisible({ timeout: 1 });
}

/** Abre la ficha de la profesional sintética, sin dejar entrar a nadie más en cuadro. */
async function abrirFichaSintetica(page: Page): Promise<void> {
  await irA(page, '/directory');
  await estable(page);
  await page
    .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
    .filter({ hasText: 'Cardiología' })
    .first()
    .click();
  await page.getByPlaceholder('Buscar').fill(PROFESIONAL_SINTETICA);
  const tarjeta = page.locator('.tarjeta-resultado__titulo a');
  await expect(tarjeta.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(tarjeta.first()).toHaveText(PROFESIONAL_SINTETICA);
  await tarjeta.first().click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(PROFESIONAL_SINTETICA);
}

/**
 * Contraste del indicador de foco del elemento activo contra el fondo que lo
 * rodea (WCAG 1.4.11, 3:1). Toma el `outline` si lo hay; si no, el primer
 * color del `box-shadow`.
 */
async function contrasteDelFoco(elemento: ReturnType<Page['locator']>): Promise<string> {
  const medido = await elemento.evaluate((nodo) => {
    const estilo = getComputedStyle(nodo);
    const anillo =
      estilo.outlineStyle !== 'none' && estilo.outlineWidth !== '0px'
        ? estilo.outlineColor
        : (estilo.boxShadow.match(/rgba?\([^)]+\)/u)?.[0] ?? '');
    let padre: Element | null = nodo.parentElement;
    let fondo = 'rgba(0, 0, 0, 0)';
    while (padre && (fondo === 'rgba(0, 0, 0, 0)' || fondo === 'transparent')) {
      fondo = getComputedStyle(padre).backgroundColor;
      padre = padre.parentElement;
    }
    return { anillo, fondo };
  });
  const canales = (rgb: string): number[] =>
    (rgb.match(/\d+(\.\d+)?/gu) ?? ['0', '0', '0']).map(Number);
  // El anillo puede ser translúcido: se compone sobre el fondo antes de medir,
  // que es el color que de verdad llega al ojo.
  const [ar, ag, ab, alfa = 1] = canales(medido.anillo);
  const [fr, fg, fb] = canales(medido.fondo);
  const compuesto = [ar!, ag!, ab!].map(
    (canal, i) => canal * alfa + [fr!, fg!, fb!][i]! * (1 - alfa),
  );
  const luminancia = ([r, g, b]: number[]): number => {
    const [lr, lg, lb] = [r!, g!, b!].map((valor) => {
      const canal = valor / 255;
      return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
  };
  const [claro, oscuro] = [luminancia(compuesto), luminancia([fr!, fg!, fb!])].sort(
    (a, b) => b - a,
  );
  const razon = (claro! + 0.05) / (oscuro! + 0.05);
  return `anillo ${medido.anillo} sobre ${medido.fondo} → ${razon.toFixed(2)}:1`;
}

async function buscar(page: Page, termino: string): Promise<void> {
  await page.getByTestId('cotizaciones-busqueda').locator('input').fill(termino);
  await expect(page.locator('.cotizaciones__buscando')).toHaveCount(0, { timeout: 15_000 });
}

/** Lleva el inicio del elemento justo debajo de la barra superior fija. */
async function encuadrar(elemento: ReturnType<Page['locator']>): Promise<void> {
  await elemento.evaluate((nodo) => {
    const barra = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    window.scrollTo(0, nodo.getBoundingClientRect().top + window.scrollY - barra - 16);
  });
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
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
    'de ejemplo de la maqueta',
  );

  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const vista of VISTAS) {
      await page.setViewportSize(vista);
      // Tarjetas por debajo de 780 px, tabla desde ahí: se lleva a la vista la que se ve.
      await encuadrar(
        page
          .locator('.cotizaciones__tarjetas, app-data-table.cotizaciones__tabla--con-filas')
          .filter({ visible: true })
          .first(),
      );
      await foto(page, `cotizaciones-paracetamol-${vista.nombre}-${colorScheme}.png`);
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
});

for (const tema of TEMAS) {
  test(`Cotizaciones (${tema}): sin término, arancel en UMA, estudio sin distancia y vacío`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: tema });
    await irA(page, '/my-account/cotizaciones');
    await estable(page);

    await expect(page.getByTestId('cotizaciones-sin-termino')).toBeVisible();
    await foto(page, `cotizaciones-sin-termino-1440-${tema}.png`);

    await buscar(page, 'consulta medica general');
    await expect(page.getByTestId('cotizaciones-resultados')).toContainText('UMA');
    await foto(page, `cotizaciones-arancel-uma-1440-${tema}.png`);

    await buscar(page, 'tomografia');
    await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
      'el directorio de centros no trae su ubicación',
    );
    await foto(page, `cotizaciones-estudio-sin-distancia-1440-${tema}.png`);

    await page.setViewportSize({ width: 390, height: 844 });
    await buscar(page, 'zzzz sin coincidencias');
    await expect(page.getByTestId('cotizaciones-sin-resultados')).toContainText(
      'No encontramos cotizaciones',
    );
    await foto(page, `cotizaciones-vacio-390-${tema}.png`);
  });

  test(`Cotizaciones (${tema}): estados transitorios y precio no publicado`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: tema });
    await irA(page, '/my-account/cotizaciones');
    await estable(page);

    // «Precio no publicado»: el arancel odontológico trae doce filas sin
    // precio (`referencePrice: null`); se dice, con la procedencia al lado.
    await buscar(page, 'gingivoplastia');
    await expect(page.locator('.cotizaciones__precio--no-publicado').first()).toHaveText(
      'Precio no publicado',
    );
    await foto(page, `cotizaciones-precio-no-publicado-1440-${tema}.png`);

    // Cargando. El doble responde con un `timer` de rxjs (120 ms): con el reloj
    // de Playwright en pausa ese timer no vence, y el estado de carga queda
    // quieto para la foto. Se avanza de a 10 ms sólo hasta que aparece. Una
    // corrida anterior, sin esto, guardó con este nombre una foto con los
    // resultados ya pintados: por eso además se asevera DESPUÉS de la foto.
    await page.clock.install();
    await page.reload();
    await estable(page);
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await page.getByTestId('cotizaciones-busqueda').locator('input').fill('ibuprofeno');
    const buscando = page.locator('.cotizaciones__buscando[role="status"]');
    await avanzarHastaVer(page, buscando);
    await page.screenshot({ path: join(SALIDA, `cotizaciones-cargando-1440-${tema}.png`) });
    await expect(buscando, 'la foto de «cargando» tiene que mostrar la carga').toBeVisible();

    // La carga por sede de la ficha (H2.S2.M4), con el mismo reloj en pausa.
    await page.clock.resume();
    await irA(page, '/directory');
    await estable(page);
    await page
      .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
      .filter({ hasText: 'Cardiología' })
      .first()
      .click();
    await page.getByPlaceholder('Buscar').fill(PROFESIONAL_SINTETICA);
    const tarjeta = page.locator('.tarjeta-resultado__titulo a');
    await expect(tarjeta.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0, {
      timeout: 15_000,
    });
    await expect(tarjeta.first()).toHaveText(PROFESIONAL_SINTETICA);
    await page.clock.pauseAt(new Date(Date.now() + 120_000));
    await tarjeta.first().click();
    const porSede = page.locator(
      'app-practitioner-availability .disponibilidad__buscando[role="status"]',
    );
    await avanzarHastaVer(page, porSede.first());
    await page.locator('app-practitioner-availability .disponibilidad').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(SALIDA, `ficha-buscando-turnos-por-sede-1440-${tema}.png`),
    });
    await expect(porSede.first(), 'la foto tiene que mostrar la carga por sede').toBeVisible();
    await page.clock.resume();
  });

  test(`Cotizaciones (${tema}): error, fuente caída y sin ubicación`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: tema });
    const fallar = (fallos: readonly { patron: string; modo: string }[]) =>
      page.evaluate(
        (valor) => sessionStorage.setItem('mock:fallos', JSON.stringify(valor)),
        fallos,
      );

    // Sin ubicación: si el perfil no responde no hay lugares guardados, el
    // selector no arranca con origen y ordenar por cercanía no tiene desde
    // dónde. El fallo va ANTES de montar la pantalla: navegar a la misma ruta
    // reusa el componente y no vuelve a pedir el perfil.
    await irA(page, '/directory');
    await estable(page);
    await fallar([{ patron: '/profiles/patients/me', modo: 'error' }]);
    await irA(page, '/my-account/cotizaciones');
    await estable(page);
    await buscar(page, 'paracetamol');
    await page.getByLabel('Ordenar por').selectOption({ label: 'Cercanía' });
    await expect(page.getByTestId('cotizaciones-sin-ubicacion')).toBeVisible();
    await foto(page, `cotizaciones-sin-ubicacion-1440-${tema}.png`);
    await page.setViewportSize({ width: 390, height: 844 });
    await encuadrar(page.getByTestId('cotizaciones-sin-ubicacion'));
    await foto(page, `cotizaciones-sin-ubicacion-390-${tema}.png`);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByTestId('cotizaciones-sin-ubicacion')
      .getByRole('button', { name: 'Ordenar por precio' })
      .click();
    await fallar([]);

    // Error (con una sola vertical, su fallo es el de la pantalla).
    await fallar([{ patron: '/pharmacy/products', modo: 'error' }]);
    await page.getByLabel('Vertical').selectOption({ label: 'Medicamentos' });
    await buscar(page, 'amoxicilina');
    const reintentar = page.getByRole('button', { name: /Reintentar|Volver a intentar/u });
    await expect(reintentar.first()).toBeVisible();
    await foto(page, `cotizaciones-error-1440-${tema}.png`);
    await page.setViewportSize({ width: 390, height: 844 });
    await foto(page, `cotizaciones-error-390-${tema}.png`);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Fuente caída: con «Todas», el diagnóstico no responde y el resto sí.
    // El fallo se declara ANTES de cambiar la vertical, y con otro término:
    // cambiar la vertical ya dispara la consulta.
    await fallar([{ patron: '/diagnostic-units', modo: 'error' }]);
    await page.getByLabel('Vertical').selectOption({ label: 'Todas' });
    await buscar(page, 'ibuprofeno');
    await expect(page.getByTestId('cotizaciones-fuente-caida')).toContainText('Análisis');
    await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
      'de ejemplo de la maqueta',
    );
    await foto(page, `cotizaciones-fuente-caida-1440-${tema}.png`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('cotizaciones-fuente-caida').scrollIntoViewIfNeeded();
    await foto(page, `cotizaciones-fuente-caida-390-${tema}.png`);
    await page.setViewportSize({ width: 1440, height: 900 });

    await fallar([]);
  });
}

for (const tema of TEMAS) {
  test(`Cotizaciones (${tema}): tarjetas en angosto con UMA, precio no publicado y sin distancia`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.emulateMedia({ colorScheme: tema });
    await irA(page, '/my-account/cotizaciones');
    await estable(page);
    const casos = [
      { termino: 'consulta medica general', archivo: 'arancel-uma', espera: 'UMA' },
      { termino: 'gingivoplastia', archivo: 'precio-no-publicado', espera: 'Precio no publicado' },
      { termino: 'tomografia', archivo: 'estudio-sin-distancia', espera: 'no trae su ubicación' },
    ] as const;
    for (const caso of casos) {
      for (const vista of [VISTAS[0], VISTAS[1]]) {
        await page.setViewportSize(vista);
        await buscar(page, caso.termino);
        const tarjetas = page.locator('.cotizaciones__tarjetas');
        await expect(tarjetas).toBeVisible();
        await expect(tarjetas).toContainText(caso.espera);
        await encuadrar(tarjetas);
        await foto(page, `cotizaciones-${caso.archivo}-${vista.nombre}-${tema}.png`);
        // Otro término en el medio: el mismo término no vuelve a consultar.
        await buscar(page, 'zz');
      }
    }
  });
}

test('la ficha muestra los cupos por sede, en claro y en oscuro', async ({ page }) => {
  test.setTimeout(240_000);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    for (const vista of VISTAS) {
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

  // Error por sede, en los dos temas: la lectura de cupos falla y cada sede
  // lo dice con su «Reintentar», sin tumbar la ficha.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() =>
    sessionStorage.setItem(
      'mock:fallos',
      JSON.stringify([{ patron: '/scheduling/slots', modo: 'error' }]),
    ),
  );
  for (const colorScheme of TEMAS) {
    await page.emulateMedia({ colorScheme });
    await abrirFichaSintetica(page);
    const errorPorSede = page.locator('app-practitioner-availability .disponibilidad__error');
    await expect(errorPorSede.first()).toBeVisible();
    await page.locator('app-practitioner-availability .disponibilidad').scrollIntoViewIfNeeded();
    await foto(page, `ficha-error-por-sede-1440-${colorScheme}.png`);
  }
  await page.emulateMedia({ colorScheme: 'light' });
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
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
  await expect(page.getByTestId('cotizaciones-resultados')).toContainText(
    'de ejemplo de la maqueta',
  );
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

  // Con Tab y no con `.focus()`: el anillo sólo se pinta con `:focus-visible`,
  // que es lo que ve quien navega con teclado.
  const accion = page.locator('app-data-table a.cotizaciones__accion').first();
  let saltos = 0;
  while (saltos < 40 && !(await accion.evaluate((nodo) => nodo === document.activeElement))) {
    await page.keyboard.press('Tab');
    saltos += 1;
  }
  await expect(accion).toBeFocused();
  await expect(accion).toContainText('Directorio de farmacias');
  const focoAccion = await contrasteDelFoco(accion);
  await foto(page, 'teclado-foco-accion-1440-light.png');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/pharmacies-directory/);
  pasos.push(
    'La acción de la primera fila («Directorio de farmacias», ícono + texto) recibe el foco visible y Enter la abre → `/pharmacies-directory` (captura `teclado-foco-accion-1440-light.png`; ' +
      focoAccion +
      ')',
  );

  await abrirFichaSintetica(page);
  const cupo = page.locator('app-practitioner-availability .disponibilidad__cupos button').first();
  await expect(cupo).toBeVisible();
  await page.getByRole('button', { name: 'Semana siguiente' }).focus();
  await page.keyboard.press('Tab');
  await expect(cupo).toBeFocused();
  await cupo.scrollIntoViewIfNeeded();
  const focoCupo = await contrasteDelFoco(cupo);
  await foto(page, 'teclado-foco-cupo-1440-light.png');
  await page.emulateMedia({ colorScheme: 'dark' });
  const focoCupoOscuro = await contrasteDelFoco(cupo);
  await foto(page, 'teclado-foco-cupo-1440-dark.png');
  await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/my-account\/appointments\/book\//);
  pasos.push(
    'Ficha: foco visible en el primer cupo y Enter → abre la reserva con ese cupo (`/my-account/appointments/book/<cupo>`; captura `teclado-foco-cupo-1440-light.png`; claro: ' +
      focoCupo +
      '; oscuro (`teclado-foco-cupo-1440-dark.png`): ' +
      focoCupoOscuro +
      ')',
  );

  writeFileSync(
    join(SALIDA, 'teclado.md'),
    `# Recorrido de teclado — generado por playwright/cierre-carril-reserva-cotizaciones.spec.ts\n\n${pasos
      .map((paso, indice) => `${indice + 1}. ${paso}`)
      .join('\n')}\n`,
  );
});
