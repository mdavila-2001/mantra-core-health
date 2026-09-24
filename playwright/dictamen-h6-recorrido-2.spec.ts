import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * Segunda tanda del recorrido del dictamen (H6.S1.M2), contra los cuatro PRs que
 * se integraron a `mockup` mientras se escribía la primera: #561 (Itzan, perfil),
 * #562 y #563 (contratos y datos del simulador) y #564 (Pablo, consultas).
 *
 * Regla 70.4.8: ninguno de los cuatro lo escribí yo.
 */

const SALIDA = join(
  'docs',
  'trabajo',
  '2026-09-20-notas-cuadricula-e-internacion',
  'evidencia',
  'dictamen',
);

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** Las siete de la ficha, en el orden en que las declara el perfil médico. */
const PESTANAS_DEL_EDITOR = [
  'Datos personales',
  'Contacto',
  'Facturación',
  'Dónde atiendo',
  'Trayectoria',
  'Credenciales',
  'Actividad',
] as const;

async function abrirMiPerfil(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await page.goto('/my-account', { waitUntil: 'commit' });
  await estable(page);
  await expect(page.getByTestId('mi-perfil-pestanas')).toBeVisible({ timeout: 30_000 });
}

async function abrirConsultas(page: Page): Promise<void> {
  await entrar(page, MEDICA);
  await page.goto('/schedule', { waitUntil: 'commit' });
  await estable(page);
}

test.describe('H6 · recorrido de #561 (Itzan, perfil médico)', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(SALIDA, { recursive: true });
    await abrirMiPerfil(page);
  });

  test('C-01 · «Dónde atiendo» ya no tiene la sección «Cómo atendés»', async ({ page }) => {
    await page.getByRole('tab', { name: 'Dónde atiendo' }).click();
    await estable(page);
    await expect(page.getByText('Cómo atendés', { exact: false })).toHaveCount(0);
    await expect(page.getByTestId('perfil-sedes')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: join(SALIDA, 'c01-sin-como-atendes.png') });
  });

  test('C-02 · el consultorio propio es una pestaña del perfil, no un enlace afuera', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Dónde atiendo' }).click();
    await estable(page);
    await expect(page.getByRole('link', { name: /Mi consultorio propio/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Mi organización médica/i })).toHaveCount(0);
    await expect(page.getByTestId('perfil-consultorio')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: join(SALIDA, 'c02-consultorio-en-el-perfil.png') });
  });

  test('C-05 · el editor tiene las siete pestañas de la ficha', async ({ page }) => {
    await page.getByTestId('mi-perfil-editar').click();
    await estable(page);
    for (const nombre of PESTANAS_DEL_EDITOR) {
      await expect(page.getByRole('tab', { name: nombre, exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
    await page.screenshot({ path: join(SALIDA, 'c05-editor-siete-pestanas.png') });
  });

  test('C-09 · las especialidades se ven como una rejilla de insignias', async ({ page }) => {
    const insignias = page.getByTestId('perfil-especialidades-chips');
    await expect(insignias).toBeVisible({ timeout: 15_000 });
    const cada = insignias.locator('app-specialty-badge');
    expect(await cada.count()).toBeGreaterThan(0);
    // No es sólo color: cada insignia dice el nombre de la especialidad.
    expect(((await cada.first().innerText()) ?? '').trim().length).toBeGreaterThan(0);
    await page.screenshot({ path: join(SALIDA, 'c09-insignias-especialidad.png') });
  });

  test('C-21 (parcial, perfil) · ninguna de las siete pestañas del editor elige con radios', async ({
    page,
  }) => {
    await page.getByTestId('mi-perfil-editar').click();
    await estable(page);
    let listas = 0;
    for (const nombre of PESTANAS_DEL_EDITOR) {
      await page.getByRole('tab', { name: nombre, exact: true }).click();
      await estable(page);
      const radios = await page.locator('input[type="radio"]').count();
      const selects = await page.locator('select').count();
      console.log(`C-21 · ${nombre}: radios=${radios} selects=${selects}`);
      expect(radios, `«${nombre}» todavía elige de una lista con radios`).toBe(0);
      listas += selects;
    }
    expect(listas).toBeGreaterThan(0);
    await page.screenshot({ path: join(SALIDA, 'c21-editor-controles.png') });
  });
});

test.describe('H6 · recorrido de #564 (Pablo, consultas)', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(SALIDA, { recursive: true });
    await abrirConsultas(page);
  });

  test('C-08 · la solapa se llama «Consultas» y ya no «Calendario»', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Consultas' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('tab', { name: /^Calendario$/ })).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c08-solapa-consultas.png') });
  });

  test('C-07 · «vista=table» ya no dibuja la tabla y no redirige', async ({ page }) => {
    await page.goto('/schedule?vista=table', { waitUntil: 'commit' });
    await estable(page);
    await expect(page.getByTestId('ver-como-tabla')).toHaveCount(0);
    await expect(page.locator('.agenda__tabla-consultas')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Consultas' })).toBeVisible({ timeout: 30_000 });
    expect(page.url()).toContain('vista=table');
    await page.screenshot({ path: join(SALIDA, 'c07-sin-tabla.png') });
  });

  test('C-10 · sin solapa «Cupos», el alta es un modal y sobre un cupo no se pregunta la hora', async ({
    page,
  }) => {
    await expect(page.getByRole('tab', { name: /Cupos/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Mis horarios' })).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(SALIDA, 'c10-sin-solapa-cupos.png') });

    // Tocar un rato libre abre la tarjeta COMO MODAL, con la franja de dato.
    // El día de hoy puede estar lleno; se avanza hasta encontrar un hueco.
    let hayLibre = false;
    for (let d = 0; d < 6 && !hayLibre; d += 1) {
      if ((await page.locator('.dia__libre').count()) > 0) {
        hayLibre = true;
        break;
      }
      await page.getByTestId('dia-siguiente').click();
      await estable(page);
    }
    expect(hayLibre, 'no hay ningún rato libre en los próximos seis días').toBe(true);

    const libre = page.locator('.dia__libre').first();
    await expect(libre).toBeVisible({ timeout: 30_000 });
    await libre.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByTestId('tarjeta-franja-del-cupo')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByLabel('Desde')).toHaveCount(0);
    await expect(modal.getByLabel('Hasta')).toHaveCount(0);
    await page.screenshot({ path: join(SALIDA, 'c10-modal-sin-preguntar-la-hora.png') });
  });

  test('C-06 · las acciones de la fila del día son un desplegable con icono y texto', async ({
    page,
  }) => {
    const acciones = page.getByTestId('dia-acciones').first();
    await expect(acciones).toBeVisible({ timeout: 30_000 });
    const disparador = acciones.getByRole('button').first();
    await disparador.click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible({ timeout: 15_000 });
    const items = menu.getByRole('menuitem');
    expect(await items.count()).toBeGreaterThan(0);
    for (const item of await items.all()) {
      expect(((await item.textContent()) ?? '').trim().length).toBeGreaterThan(0);
    }
    await page.screenshot({ path: join(SALIDA, 'c06-acciones-desplegable.png') });
  });

  test('C-04 · la tarjeta del día hace lo que la cita admite en su estado', async ({ page }) => {
    const tarjetas = page.getByTestId('dia-ir-a-atender');
    await expect(tarjetas.first()).toBeVisible({ timeout: 30_000 });

    // a) Una cita cerrada no navega: dice por qué no se entra. La tarjeta es
    //    accionable igual — lo que cambia es la respuesta, no si responde.
    const estados = page.locator('.dia__estado');
    const indiceCerrada = (await estados.allInnerTexts()).findIndex((t) =>
      /Atendida/i.test(t.trim()),
    );
    expect(indiceCerrada, 'el día no trae ninguna cita ya atendida').toBeGreaterThanOrEqual(0);
    await tarjetas.nth(indiceCerrada).click();
    const aviso = page.getByRole('dialog');
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(aviso).toContainText(/ya está cerrada/i);
    await page.screenshot({ path: join(SALIDA, 'c04-tarjeta-cita-cerrada.png') });
    await aviso.getByRole('button', { name: /Entendido|Cerrar/i }).first().click();
    await estable(page);

    // b) Una cita en curso sí lleva a atenderla.
    const indiceAbierta = (await estados.allInnerTexts()).findIndex((t) =>
      /En consulta|Paciente llegó/i.test(t.trim()),
    );
    expect(indiceAbierta, 'el día no trae ninguna cita abierta').toBeGreaterThanOrEqual(0);
    await tarjetas.nth(indiceAbierta).click();
    await page.waitForURL(/\/(medical-records|consultation|encounters)/, { timeout: 60_000 });
    await estable(page);
    await page.screenshot({ path: join(SALIDA, 'c04-tarjeta-lleva-a-atender.png') });
  });

  test('C-13 (parcial, médica) · la visita de laboratorio es una tarjeta de «Visitador» sin dato clínico', async ({
    page,
  }) => {
    // La visita sembrada cae dos días adelante; el día de hoy no la tiene.
    let encontrada = false;
    for (let d = 0; d < 6 && !encontrada; d += 1) {
      if ((await page.getByTestId('dia-visitador').count()) > 0) {
        encontrada = true;
        break;
      }
      await page.getByTestId('dia-siguiente').click();
      await estable(page);
    }
    expect(encontrada, 'no hay ninguna visita de laboratorio en los próximos seis días').toBe(true);

    const visitador = page.getByTestId('dia-visitador').first();
    await expect(visitador).toBeVisible({ timeout: 15_000 });
    await expect(visitador).toHaveText(/Visitador/i);

    // Y su bloque no publica nada clínico: ni diagnóstico, ni receta, ni motivo
    // de consulta. Se mira el bloque entero, no sólo la insignia.
    const bloque = page.locator('li', { has: page.getByTestId('dia-visitador') }).first();
    const texto = ((await bloque.innerText()) ?? '').toLowerCase();
    for (const palabra of ['diagnóstico', 'receta', 'medicament', 'alergia']) {
      expect(texto, `la tarjeta del visitador publica «${palabra}»`).not.toContain(palabra);
    }
    await page.screenshot({ path: join(SALIDA, 'c13-tarjeta-visitador.png') });
  });

  test('C-06 (transversal) · D-07: el interruptor de tema del encabezado es sólo-icono y no da globo', async ({
    page,
  }) => {
    const interruptor = page.getByTestId('header-theme-toggle');
    await expect(interruptor).toBeVisible({ timeout: 30_000 });

    // Tiene nombre accesible, que es la mitad de ADR-0012…
    const nombre = await interruptor.getAttribute('aria-label');
    expect(nombre ?? '').toMatch(/modo (claro|oscuro)/i);
    // …y no tiene texto visible.
    expect(((await interruptor.innerText()) ?? '').trim()).toBe('');

    // …pero al apuntarlo y al enfocarlo no aparece ningún globo: la otra mitad
    // de la regla no está. Vive en el marco, así que se repite en toda ruta.
    await interruptor.hover();
    await page.waitForTimeout(1200);
    expect(await page.getByRole('tooltip').count()).toBe(0);
    await interruptor.focus();
    await page.waitForTimeout(1200);
    expect(await page.getByRole('tooltip').count()).toBe(0);
    await page.screenshot({ path: join(SALIDA, 'd07-interruptor-de-tema-sin-globo.png') });
  });

  test('C-12 · «Mis servicios» programa su horario y el rato queda como «Otros servicios»', async ({
    page,
  }) => {
    await page.goto('/my-services', { waitUntil: 'commit' });
    await estable(page);
    await page.getByTestId('my-services-schedule').first().click();
    await estable(page);

    // Recicla la grilla del horario, no dibuja otra.
    await expect(page.getByTestId('my-services-schedule-grid')).toBeVisible({ timeout: 15_000 });
    // Y dice, antes de guardar, con qué razón va a aparecer en la agenda.
    await expect(page.getByTestId('my-services-schedule-reason')).toContainText('Otros servicios');
    await page.screenshot({ path: join(SALIDA, 'c12-programar-horario.png') });

    await page.getByTestId('my-services-schedule-from').fill('14:00');
    await page.getByTestId('my-services-schedule-to').fill('16:00');
    await page.getByTestId('my-services-schedule-save').click();
    await estable(page);

    // El rato bloqueado se ve en la agenda clínica, con su razón.
    await page.goto('/schedule', { waitUntil: 'commit' });
    await estable(page);
    await page.getByRole('tab', { name: 'Mis horarios' }).click();
    await estable(page);
    await expect(page.getByText('Otros servicios').first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(SALIDA, 'c12-agenda-otros-servicios.png') });
  });

  test('C-11 · el encabezado pierde los tres botones y no se abre una segunda consulta', async ({
    page,
  }) => {
    const encabezado = page.getByRole('banner').or(page.locator('app-page-header')).first();
    await expect(page.getByRole('tab', { name: 'Consultas' })).toBeVisible({ timeout: 30_000 });
    const sueltos = encabezado.getByRole('button', {
      name: /Agendar una cita|Ver mis bloqueos|Cambiar mi horario/i,
    });
    expect(await sueltos.count()).toBe(0);
    await page.screenshot({ path: join(SALIDA, 'c11-encabezado-sin-botones.png') });

    // Con una consulta «En consulta» en el día, abrir otra se rechaza diciendo
    // cuál está abierta y ofreciendo ir a ella.
    const estados = await page.locator('.dia__estado').allInnerTexts();
    expect(
      estados.findIndex((t) => /En consulta/i.test(t.trim())),
      'el día no trae ninguna consulta en curso',
    ).toBeGreaterThanOrEqual(0);
    const indiceOtra = estados.findIndex((t) => /Confirmada|Paciente llegó/i.test(t.trim()));
    expect(indiceOtra, 'el día no trae otra cita que se pudiera abrir').toBeGreaterThanOrEqual(0);

    await page.getByTestId('dia-ir-a-atender').nth(indiceOtra).click();
    const aviso = page.getByRole('dialog');
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(aviso).toContainText(/en curso|abierta|ya est/i);
    await page.screenshot({ path: join(SALIDA, 'c11-una-consulta-a-la-vez.png') });
  });
});
