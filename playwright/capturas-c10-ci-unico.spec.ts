import { expect, request, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { urlDeApi } from './support/actores';

/**
 * Capturas de C-10 / MD-01 (CI único por tipo de usuario) contra la API REAL.
 *
 * Tres anchos (1440 · 768 · 390) × dos temas (claro · oscuro) de la página
 * «Su documento de identidad» del alta de médico, en cada estado de la línea
 * de comprobación, y del alta de paciente con el CI de un médico (libre):
 *
 *   1. falta el departamento;
 *   2. documento disponible (otro departamento);
 *   3. documento ya registrado, con el mensaje en el campo;
 *   4. sin respuesta de la consulta — red interceptada (503);
 *   5. sin catálogo de departamentos — red interceptada (500);
 *   6. alta de paciente con el CI del médico: disponible.
 *
 * Los dos interceptados son evidencia de UI, no de integración, y el nombre
 * del archivo lo dice. El CI de las capturas es sintético (`CAPC10…`) y se da
 * de alta una sola vez, fuera del navegador.
 *
 * Variables: E2E_API_REAL=1, E2E_API_URL, E2E_BASE_URL, CAPTURAS_DIR y
 * CAPTURAS_MUNICIPIO (un municipio sembrado, obligatorio en el alta de paciente).
 */
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;
const TEMAS = ['light', 'dark'] as const;
const DIR = process.env['CAPTURAS_DIR'] ?? 'artifacts/capturas-c10';
const CI = 'CAPC10A1';
/** El CI de un paciente ya registrado, para su propio «ya registrado». */
const CI_PACIENTE = 'CAPC10P1';
const DISPONIBILIDAD = '**/iam/auth/document-availability**';
const TITULO = '.paginated-form__titulo';

test.skip(process.env['E2E_API_REAL'] !== '1', 'Sólo contra la API real');
test.use({ contextOptions: { reducedMotion: 'reduce' } });
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

/** Espera a que terminen las animaciones finitas: nada de capturas a mitad de camino. */
async function quieto(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => Number.isFinite(Number(a.effect?.getComputedTiming().endTime ?? 0)))
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
}

/** El tema se fija antes de cargar el alta, no con la página pintada. */
async function abrir(page: Page, ruta: string, tema: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.evaluate((m) => localStorage.setItem('mantra-core-health.theme', m), tema);
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
}

async function documentoDelMedico(page: Page, tema: string): Promise<void> {
  await abrir(page, '/auth/register/practitioner', tema);
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  const continuar = page.getByTestId('paginated-form-continuar').last();
  await expect(continuar).toBeEnabled({ timeout: 20_000 });
  await continuar.click();
  await expect(page.locator(TITULO).first()).toContainText('Su documento', { timeout: 20_000 });
}

async function elegir(page: Page, prefijo: string, departamento: string): Promise<void> {
  await page.getByTestId(`${prefijo}-departamento-ci`).getByRole('combobox').click();
  await page.getByRole('option', { name: departamento, exact: true }).click();
}

async function estado(page: Page, valor: string): Promise<void> {
  await expect(page.getByTestId('documento-disponibilidad')).toHaveAttribute('data-estado', valor, {
    timeout: 20_000,
  });
  await encuadrar(page);
}

/**
 * Encuadra el formulario: elegir del desplegable desplaza la página. En 390 se
 * lleva el título arriba (si no, el campo queda fuera de cuadro); en los
 * anchos que caben enteros se vuelve al principio, con el logo a la vista.
 */
async function encuadrar(page: Page): Promise<void> {
  await page
    .locator(TITULO)
    .first()
    .evaluate((titulo) => {
      const arriba =
        window.innerWidth < 600 ? titulo.getBoundingClientRect().top + window.scrollY - 16 : 0;
      window.scrollTo({ top: arriba });
    });
  await quieto(page);
}

/** El primer departamento de la lista viaja en la consulta: se toma de ahí, no se adivina. */
async function sembrar(
  page: Page,
  ruta: '/iam/auth/register-practitioner' | '/iam/auth/register-patient',
  datos: (issuer: string) => Record<string, unknown>,
  ci: string,
): Promise<void> {
  await documentoDelMedico(page, 'light');
  await page.getByTestId('registro-pro-documento').fill(ci);
  const consulta = page.waitForResponse((r) => r.url().includes('/iam/auth/document-availability'));
  await elegir(page, 'registro-pro', 'La Paz');
  const laPaz = new URL((await consulta).url()).searchParams.get('issuer') ?? '';
  const api = await request.newContext({ baseURL: urlDeApi() });
  const alta = await api.post(ruta, { data: datos(laPaz) });
  // 201 la primera vez; 409 por el CI o el correo si ya se sembró antes.
  expect([201, 409], await alta.text()).toContain(alta.status());
  await api.dispose();
}

test('0 · el CI de las capturas queda registrado: uno para un médico y otro para un paciente', async ({
  page,
}) => {
  await sembrar(
    page,
    '/iam/auth/register-practitioner',
    (issuer) => ({
      nationalId: CI,
      issuerAdministrativeAreaConceptId: issuer,
      email: 'capturas.c10@example.test',
      password: 'S3cret-passw0rd',
      name: 'Capturas',
      lastName: 'C10',
      licenseNumber: 'LIC-CAPC10',
      credentialNumber: 'CRED-CAPC10',
    }),
    CI,
  );
  await sembrar(
    page,
    '/iam/auth/register-patient',
    (issuer) => ({
      nationalId: CI_PACIENTE,
      issuerAdministrativeAreaConceptId: issuer,
      email: 'capturas.c10.paciente@example.test',
      password: 'S3cret-passw0rd',
      name: 'Capturas',
      lastName: 'Paciente',
      birthDate: '1990-01-01',
      phone: '+591 70000000',
      sexAtBirth: 'FEMALE',
      residenceMunicipalityConceptId: process.env['CAPTURAS_MUNICIPIO'] ?? '',
    }),
    CI_PACIENTE,
  );
});

test('1-6 · médico: cada estado de la comprobación', async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  for (const t of TEMAS) {
    for (const a of ANCHOS) {
      await page.setViewportSize({ width: a.width, height: a.height });
      const sufijo = `${a.nombre}-${t}`;

      await documentoDelMedico(page, t);
      await page.getByTestId('registro-pro-documento').fill(CI);
      await page.getByTestId('registro-pro-documento').blur();
      await estado(page, 'falta-departamento');
      await page.screenshot({ path: `${DIR}/medico-falta-departamento-${sufijo}.png` });

      // «Comprobando»: la respuesta real se demora en la red hasta después
      // de la captura. Sin esperas por tiempo: se suelta con una promesa.
      let soltar: () => void = () => undefined;
      const retenida = new Promise<void>((resolver) => (soltar = resolver));
      await page.route(DISPONIBILIDAD, async (ruta) => {
        await retenida;
        await ruta.continue();
      });
      await elegir(page, 'registro-pro', 'Santa Cruz');
      await estado(page, 'comprobando');
      await page.screenshot({ path: `${DIR}/medico-comprobando-interceptado-${sufijo}.png` });
      soltar();
      await estado(page, 'libre');
      await page.unroute(DISPONIBILIDAD);
      await page.screenshot({ path: `${DIR}/medico-disponible-${sufijo}.png` });

      await elegir(page, 'registro-pro', 'La Paz');
      await estado(page, 'tomado');
      await expect(page.getByText('Ya hay un médico registrado con este documento')).toBeVisible();
      await page.screenshot({ path: `${DIR}/medico-ya-registrado-${sufijo}.png` });

      await page.route(DISPONIBILIDAD, (ruta) => ruta.fulfill({ status: 503, body: '' }));
      await elegir(page, 'registro-pro', 'Cochabamba');
      await estado(page, 'sin-respuesta');
      await page.screenshot({ path: `${DIR}/medico-sin-respuesta-interceptado-${sufijo}.png` });
      await page.unroute(DISPONIBILIDAD);

      await page.route('**/terminology/value-sets**', (ruta) =>
        ruta.request().url().includes('VS_BO_DEPARTMENT')
          ? ruta.fulfill({ status: 500, body: '' })
          : ruta.continue(),
      );
      await documentoDelMedico(page, t);
      await expect(page.getByTestId('documento-catalogo-caido')).toBeVisible({ timeout: 20_000 });
      await encuadrar(page);
      await page.screenshot({ path: `${DIR}/medico-sin-catalogo-interceptado-${sufijo}.png` });
      // Con teclado, desde la cédula, el siguiente foco es «Reintentar».
      await page.getByTestId('registro-pro-documento').focus();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Reintentar' })).toBeFocused();
      await quieto(page);
      await page.screenshot({
        path: `${DIR}/medico-sin-catalogo-foco-reintentar-interceptado-${sufijo}.png`,
      });
      await page.unroute('**/terminology/value-sets**');
    }
  }
});

/** El alta de paciente: el documento va en la primera página, con el nombre. */
async function documentoDelPaciente(page: Page, tema: string, ci: string): Promise<void> {
  await abrir(page, '/auth/register/patient', tema);
  await expect(page.locator(TITULO).first()).toContainText('Identidad', { timeout: 20_000 });
  await page.getByTestId('registro-documento').fill(ci);
  await elegir(page, 'registro', 'La Paz');
}

async function encuadrarDocumentoDelPaciente(page: Page): Promise<void> {
  await page.getByTestId('registro-documento').evaluate((campo) => {
    window.scrollTo({ top: campo.getBoundingClientRect().top + window.scrollY - 120 });
  });
  await quieto(page);
}

test('7-8 · paciente: el CI de un médico está libre; el de otro paciente, no', async ({ page }) => {
  for (const t of TEMAS) {
    for (const a of ANCHOS) {
      await page.setViewportSize({ width: a.width, height: a.height });

      await documentoDelPaciente(page, t, CI);
      await expect(page.getByTestId('documento-disponibilidad')).toHaveAttribute(
        'data-estado',
        'libre',
        {
          timeout: 20_000,
        },
      );
      await encuadrarDocumentoDelPaciente(page);
      await page.screenshot({ path: `${DIR}/paciente-disponible-${a.nombre}-${t}.png` });

      await documentoDelPaciente(page, t, CI_PACIENTE);
      await expect(page.getByTestId('documento-disponibilidad')).toHaveAttribute(
        'data-estado',
        'tomado',
        {
          timeout: 20_000,
        },
      );
      await expect(
        page.getByText('Ya hay un paciente registrado con este documento'),
      ).toBeVisible();
      await encuadrarDocumentoDelPaciente(page);
      await page.screenshot({ path: `${DIR}/paciente-ya-registrado-${a.nombre}-${t}.png` });
    }
  }
});
