import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

/**
 * Escrita a mano en `fixtures/personas.ts` (índice 0): es una persona
 * **sintética**, no un médico real, y es la única cardióloga con agenda
 * publicada en los dos cortes que se comparan.
 *
 * El listado se filtra por ella a propósito. Sin filtrar, la primera pantalla
 * de Cardiología son diez médicos de `insurer-network.generated.ts`, cuya
 * propia cabecera avisa que **son médicos reales** sacados del catálogo que
 * publican las aseguradoras: nombre y dirección de consultorio de gente que
 * existe. Sirven para que la maqueta tenga volumen; no para quedar pegados en
 * una carpeta de evidencia.
 */
const PROFESIONAL_SINTETICA = 'Valeria Rojas Mendoza';

const CORTE = process.env['BASELINE_CORTE'];
const SALIDA = join('docs', 'trabajo', '2026-09-23-baseline-comparable-reserva', 'evidencia', CORTE ?? 'sin-corte');

/**
 * `page.screenshot()` —a diferencia de `toHaveScreenshot()`— **no** congela las
 * animaciones, y `toBeVisible()` se cumple en el primer fotograma pintado. Con
 * `app-empty-state` entrando en 240 ms, eso alcanzaba para fotografiar el mismo
 * componente a 74 % de opacidad en un corte y a 40 % en el otro: dos instantes
 * distintos de la misma transición disfrazados de diferencia entre cortes.
 *
 * `animations: 'disabled'` **no basta**: con el flag puesto en las catorce
 * capturas, una de ellas siguió saliendo a 66,5 % de opacidad y 2 px arriba de
 * su sitio. Así que no se le cree al flag: antes de disparar se espera a que
 * **todas las animaciones finitas de la página hayan terminado**. Las infinitas
 * —un spinner, un esqueleto latiendo— se excluyen a propósito: su `finished` no
 * resuelve nunca, y además, si hay una corriendo, lo correcto es que la captura
 * la muestre, no que la congele fingiendo que la pantalla ya cargó.
 */
async function foto(page: Page, archivo: string): Promise<void> {
  await page.evaluate(async () => {
    const finitas = document.getAnimations().filter((animacion) => {
      const iteraciones = animacion.effect?.getComputedTiming().iterations ?? 1;
      return Number.isFinite(iteraciones);
    });
    await Promise.all(finitas.map((animacion) => animacion.finished.catch(() => undefined)));
  });
  await page.screenshot({ path: join(SALIDA, archivo), animations: 'disabled' });
}

/**
 * Comprueba que el elemento está **asentado**: opaco y sin desplazamiento
 * residual. Es la aserción que hace fallar la prueba si `foto()` volviera a
 * disparar en vuelo, en vez de dejar que el defecto viaje dentro de un PNG.
 */
async function asentado(elemento: ReturnType<Page['locator']>): Promise<void> {
  await expect
    .poll(
      () =>
        elemento.evaluate((nodo) => {
          const estilo = getComputedStyle(nodo);
          // El keyframe lleva `both`, así que al terminar deja aplicada la
          // transformación identidad —`matrix(1, 0, 0, 1, 0, 0)`— en vez de
          // volver a `none`. Lo que importa no es la forma del valor sino que
          // el desplazamiento vertical residual sea cero.
          const desplazamiento = new DOMMatrixReadOnly(estilo.transform).m42;
          return { opacidad: Number(estilo.opacity), desplazamientoY: Math.round(desplazamiento) };
        }),
      { timeout: 15_000 },
    )
    .toEqual({ opacidad: 1, desplazamientoY: 0 });
}

/**
 * `estable()` espera `networkidle`, que con `ng serve` no llega nunca y se
 * abandona en silencio a los 15 s. El encabezado ya está mientras la rejilla
 * sigue en esqueletos, así que hay que esperar una tarjeta de verdad: si no, un
 * corte se fotografía cargando y el otro cargado, y las capturas dejan de ser
 * comparables — que es justamente lo que este baseline tiene que dar.
 */
async function abrirDirectorio(page: Page) {
  await irA(page, '/directory');
  await estable(page);
  await expect(page.getByRole('heading', { name: 'Directorio de médicos' })).toBeVisible();
  const primera = page.locator('[data-testid="portada-especialidades"] .rejilla__tarjeta').first();
  await expect(primera).toBeVisible();
  return primera;
}

test.beforeEach(async ({ page }) => {
  expect(CORTE, 'BASELINE_CORTE identifica la evidencia de cada ejecución').toMatch(/^(antes|despues)$/);
  mkdirSync(SALIDA, { recursive: true });
  // El proyecto `chromium` extiende `devices['Desktop Chrome']`, que trae su
  // propio viewport de 1280x720 y pisa el 1440x900 del config. Sin fijarlo acá,
  // los archivos `-1440` guardaban 1280 px de ancho.
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, PACIENTE);
});

/**
 * Mide el recorrido completo, de la portada del Directorio hasta tener los cupos
 * de un profesional a la vista, y de paso comprueba que cuatro activaciones
 * seguidas de la misma tarjeta producen **una** navegación y no cuatro.
 */
test('mide Directorio hasta los cupos, con cuatro activaciones', async ({ page }) => {
  test.setTimeout(180_000);

  const recursos: string[] = [];
  page.on('request', (solicitud) => recursos.push(new URL(solicitud.url()).pathname));

  // Las capturas son del viewport, no `fullPage`: la barra lateral es
  // `position: fixed` y en captura completa Chromium la pinta una sola vez
  // arriba, encima de la primera columna del resto. El recorte del viewport es
  // además lo que una persona ve de verdad.
  await abrirDirectorio(page);
  await foto(page, '01-directorio-1440.png');

  await page
    .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
    .filter({ hasText: 'Cardiología' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/directory\?especialidad=/);

  await page.getByPlaceholder('Buscar').fill(PROFESIONAL_SINTETICA);
  const tarjeta = page.locator('.tarjeta-resultado__titulo a');
  // La aserción que importa no es cuántas tarjetas quedan —son dos, la misma
  // persona bajo sus dos especialidades— sino que **no quede nadie más**: eso
  // es lo que mantiene fuera de la captura a los médicos reales del catálogo de
  // las aseguradoras. Reintenta, así que además espera al filtro.
  await expect(tarjeta.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0, { timeout: 15_000 });
  await expect(tarjeta.first()).toHaveText(PROFESIONAL_SINTETICA);
  await foto(page, '02-resultados-1440.png');

  const destino = await tarjeta.first().getAttribute('href');
  expect(destino).not.toBeNull();
  recursos.length = 0;
  await page.evaluate(() => {
    const original = window.history.pushState.bind(window.history);
    let llamadas = 0;
    window.history.pushState = ((...argumentos: Parameters<History['pushState']>) => {
      llamadas += 1;
      window.sessionStorage.setItem('baseline-push-state', String(llamadas));
      return original(...argumentos);
    }) as History['pushState'];
  });

  const inicio = performance.now();
  await tarjeta.first().evaluate((elemento) => {
    for (let indice = 0; indice < 4; indice += 1) {
      elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });
  await expect(page).toHaveURL(new RegExp(`${destino!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));

  const disponibilidad = page.locator('app-practitioner-availability');
  // `getByRole('button').first()` caía en «Semana anterior», que está pintado
  // desde el primer frame: el cronómetro paraba antes de que llegara un cupo.
  const cupo = disponibilidad.locator('.disponibilidad__cupos button, .disponibilidad__proximo button').first();
  await expect(cupo).toBeVisible();
  const totalMs = Math.round(performance.now() - inicio);

  const navegacionesTrasCuatroClics = await page.evaluate(() =>
    Number(window.sessionStorage.getItem('baseline-push-state')),
  );
  const solicitudesTrasCuatroClics = [...new Set(recursos)].sort();
  expect(navegacionesTrasCuatroClics, 'cuatro activaciones de una tarjeta sólo cambian de ruta una vez').toBe(1);

  // `toBeVisible()` no exige que el nodo entre en el viewport: sin esto la
  // captura llamada «cupos» guardaba la cabecera de la ficha.
  await disponibilidad.scrollIntoViewIfNeeded();
  await foto(page, '03-cupos-1440.png');

  const sedes = await disponibilidad.locator('.disponibilidad__sede').count();
  const cupos = await disponibilidad.locator('.disponibilidad__cupos button').count();
  const etiquetaDelPrimerCupo = (await cupo.innerText()).trim();

  await page.setViewportSize({ width: 390, height: 844 });
  await abrirDirectorio(page);
  await foto(page, '04-directorio-390.png');
  await page
    .locator('[data-testid="portada-especialidades"] .rejilla__tarjeta')
    .filter({ hasText: 'Cardiología' })
    .first()
    .click();
  await page.getByPlaceholder('Buscar').fill(PROFESIONAL_SINTETICA);
  const tarjetaMovil = page.locator('.tarjeta-resultado__titulo a');
  await expect(tarjetaMovil.filter({ hasNotText: PROFESIONAL_SINTETICA })).toHaveCount(0, { timeout: 15_000 });
  await expect(tarjetaMovil.first()).toHaveText(PROFESIONAL_SINTETICA);
  await foto(page, '05-resultados-390.png');
  await tarjetaMovil.first().click();
  const disponibilidadMovil = page.locator('app-practitioner-availability');
  await expect(disponibilidadMovil.locator('.disponibilidad__cupos button').first()).toBeVisible();
  await disponibilidadMovil.scrollIntoViewIfNeeded();
  await foto(page, '06-cupos-390.png');

  const evidencia = {
    corte: CORTE,
    ruta: 'directorio-cardiologia-profesional-sintetica-cupos',
    profesional: PROFESIONAL_SINTETICA,
    activaciones: 4,
    totalMs,
    navegacionesTrasCuatroClics,
    solicitudesTrasCuatroClics,
    sedes,
    cuposVisibles: cupos,
    etiquetaDelPrimerCupo,
  };
  writeFileSync(join(SALIDA, 'medicion.json'), `${JSON.stringify(evidencia, null, 2)}\n`);
  console.info(JSON.stringify(evidencia));
});

/**
 * El camino que un paciente toma por defecto —primera tarjeta de la primera
 * especialidad— **no llega a un cupo en ninguno de los dos cortes**: es un
 * médico de la red de las aseguradoras, y ésos no tienen agenda a propósito
 * (`fixtures/agenda.ts`: «fabricárselos sería ofrecer turnos que no existen»).
 *
 * La captura encuadra **sólo** el bloque «Sedes y horarios». El nombre del
 * profesional queda deliberadamente fuera: es una persona real, y lo que esta
 * captura tiene que probar es el estado vacío, no de quién es la ficha.
 */
test('mide el camino por defecto, que termina sin horarios publicados', async ({ page }) => {
  test.setTimeout(180_000);

  const primera = await abrirDirectorio(page);
  await primera.click();
  await expect(page).toHaveURL(/\/directory\?especialidad=/);
  const resultado = page.locator('.tarjeta-resultado__titulo a').first();
  await expect(resultado).toBeVisible();

  const inicio = performance.now();
  await resultado.click();
  const disponibilidad = page.locator('app-practitioner-availability');
  const vacio = disponibilidad.locator('app-empty-state, .disponibilidad__vacio').first();
  await expect(vacio).toBeVisible();
  const totalMs = Math.round(performance.now() - inicio);

  await disponibilidad.scrollIntoViewIfNeeded();
  await asentado(vacio);
  await foto(page, '07-sin-horarios-1440.png');

  const evidencia = {
    corte: CORTE,
    ruta: 'directorio-primera-especialidad-primer-resultado-sin-horarios',
    totalMs,
    sedesConCupos: await disponibilidad.locator('.disponibilidad__sede').count(),
    mensaje: (await vacio.innerText()).replace(/\s+/g, ' ').trim(),
  };
  writeFileSync(join(SALIDA, 'medicion-sin-horarios.json'), `${JSON.stringify(evidencia, null, 2)}\n`);
  console.info(JSON.stringify(evidencia));
});
