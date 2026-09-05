import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, estable, irA } from './support/sesion';

/**
 * Carril P8 — evidencia visual de los avisos de agenda.
 *
 * ## Qué afirma y qué no
 *
 * Estas capturas se toman **sobre datos que ya existen**, creados por
 * `tools/alovida/p8-avisos-agenda.mjs` (repositorio de la API) contra la API
 * viva: una reserva real, una demora informada de verdad y una lista de espera
 * con su fila. No se simula ninguna respuesta ni se escribe estado a mano para
 * que una pantalla se vea bien.
 *
 * Lo que **no** afirma es la campana de notificaciones: el centro in-app y su
 * badge son el entregable del carril **P1** y todavía no existen en el
 * frontend. Lo que P8 puede mostrar en pantalla es lo suyo: la demora en el
 * detalle del turno —que llega con la cita y no depende de que el aviso se
 * entregue—, la lista de espera del paciente y la acción de demora del
 * profesional.
 *
 * ## Cómo se corre
 *
 * ```bash
 * E2E_BASE_URL=http://localhost:4300 \
 * P8_PACIENTE_ID=P8… P8_PACIENTE_CLAVE='P8-passw0rd!' \
 * P8_DOCTORA_ID=doctora.demo@redesa.test P8_DOCTORA_CLAVE='D3mo-passw0rd!' \
 *   yarn pw playwright/carril-p8-avisos-agenda.spec.ts
 * ```
 *
 * Sin esas variables la suite se salta a sí misma en vez de fallar: la
 * evidencia se produce cuando hay un entorno con datos, no en cada CI.
 */

/** Dónde se guardan las capturas. Dentro del repositorio, como el resto. */
const EVIDENCIAS = join(__dirname, '..', 'evidencias', 'p8-avisos-agenda');

const PACIENTE_ID = process.env['P8_PACIENTE_ID'] ?? '';
const PACIENTE_CLAVE = process.env['P8_PACIENTE_CLAVE'] ?? '';
/**
 * Quién muestra la espera abierta.
 *
 * Es **otro** paciente y no el de la demora: al que estaba en la lista se le
 * liberó el cupo, así que su espera quedó cubierta y ya no es una espera. El
 * que sí espera es el que acaba de quedarse sin turno — el caso 3.4 del
 * registro del cliente. Sin variable, se cae al mismo.
 */
const ESPERA_ID = process.env['P8_ESPERA_ID'] ?? PACIENTE_ID;
const ESPERA_CLAVE = process.env['P8_ESPERA_CLAVE'] ?? PACIENTE_CLAVE;

const DOCTORA_ID = process.env['P8_DOCTORA_ID'] ?? '';
const DOCTORA_CLAVE = process.env['P8_DOCTORA_CLAVE'] ?? '';

const hayPaciente = PACIENTE_ID !== '' && PACIENTE_CLAVE !== '';
const hayDoctora = DOCTORA_ID !== '' && DOCTORA_CLAVE !== '';

const paciente: Actor = {
  rol: 'paciente',
  identificador: PACIENTE_ID,
  clave: PACIENTE_CLAVE,
  nombre: 'Paciente del recorrido P8',
};

const enEspera: Actor = {
  rol: 'paciente',
  identificador: ESPERA_ID,
  clave: ESPERA_CLAVE,
  nombre: 'Paciente en lista de espera P8',
};

const doctora: Actor = {
  rol: 'doctora',
  identificador: DOCTORA_ID,
  clave: DOCTORA_CLAVE,
  nombre: 'Profesional del recorrido P8',
};

/** Guarda la captura de la página completa con nombre estable. */
async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIAS, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIAS, `${nombre}.png`), fullPage: true });
}

test.describe('P8 · avisos de agenda — evidencia visual', () => {
  test('el paciente ve la demora de su profesional en el detalle del turno', async ({ page }) => {
    test.skip(!hayPaciente, 'Faltan P8_PACIENTE_ID / P8_PACIENTE_CLAVE');

    await entrar(page, paciente);
    await irA(page, '/my-account/appointments');
    await esperarAplicacionLista(page);
    await estable(page);

    // La demora llega **con la cita**: el aviso in-app puede no haberse abierto
    // y el turno tiene que explicarse solo.
    const demora = page.getByTestId('turnos-motivo-demora').first();
    await expect(demora).toBeVisible({ timeout: 30_000 });
    await expect(demora).toContainText('se demora');

    await capturar(page, 'paciente-turno-con-demora');
  });

  test('el paciente ve en qué lista de espera está', async ({ page }) => {
    test.skip(!hayPaciente, 'Faltan P8_PACIENTE_ID / P8_PACIENTE_CLAVE');

    await entrar(page, enEspera);
    await irA(page, '/my-account/appointments');
    await esperarAplicacionLista(page);
    await estable(page);

    const esperas = page.getByTestId('turnos-esperas');
    await expect(esperas).toBeVisible({ timeout: 30_000 });

    await capturar(page, 'paciente-lista-de-espera');
  });

  test('el profesional puede avisar que se demora desde su agenda', async ({ page }) => {
    test.skip(!hayDoctora, 'Faltan P8_DOCTORA_ID / P8_DOCTORA_CLAVE');

    await entrar(page, doctora);
    await irA(page, '/schedule');
    await esperarAplicacionLista(page);
    await estable(page);

    const avisar = page.getByTestId('agenda-avisar-demora');
    await expect(avisar).toBeVisible({ timeout: 30_000 });
    await avisar.click();

    const panel = page.getByTestId('agenda-demora-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('El turno no se mueve');

    await capturar(page, 'profesional-panel-de-demora');
  });
});
