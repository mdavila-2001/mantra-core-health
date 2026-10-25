import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page, type Request } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi, type Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 38 · CORR-08 — «Editar perfil» del médico con las reglas del alta y
 * guardado por pestaña, contra la API real.
 *
 * Una médica nueva (`register-practitioner`) entra, escribe en dos pestañas y
 * guarda una: el `PATCH` lleva sólo lo de la pestaña abierta, y al recargar lo
 * guardado está y lo no guardado no. Después se ejercitan las reglas que el
 * editor toma del alta (celular y correo personal obligatorios y bien formados).
 *
 * Exige el front en modo `real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4207
 */
const API_REAL = process.env['E2E_API_REAL'] === '1';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-38');
const PATCH_DEL_PERFIL = /\/profiles\/practitioners\/me$/;

test.skip(!API_REAL, 'Omitido: hace falta E2E_API_REAL=1 y la API viva. No es un verde.');
test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let medica: Actor;

async function registrar(): Promise<Actor> {
  const corrida = Date.now().toString(36);
  const actor: Actor = {
    rol: 'doctora',
    identificador: `medica.l38.${corrida}@alovida.test`,
    clave: `Perfil-${corrida}-2026!`,
    nombre: 'Lucía Paredes',
  };
  const respuesta = await api.post('/iam/auth/register-practitioner', {
    data: {
      email: actor.identificador,
      password: actor.clave,
      name: 'Lucía',
      lastName: 'Paredes',
      licenseNumber: `MP-L38-${corrida}`,
      sedesLicenseNumber: `SEDES-L38-${corrida}`,
      professionalTitle: 'Médico',
      nationalId: `L38${corrida}`,
      issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
      residenceMunicipalityConceptId: MUNICIPIO,
    },
  });
  expect(respuesta.ok(), `alta: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return actor;
}

/** Los `PATCH` al perfil propio que salen mientras corre `accion`. */
async function patchesDurante(page: Page, accion: () => Promise<void>): Promise<Request[]> {
  const vistos: Request[] = [];
  const anotar = (req: Request): void => {
    if (req.method() === 'PATCH' && PATCH_DEL_PERFIL.test(req.url())) vistos.push(req);
  };
  page.on('request', anotar);
  try {
    await accion();
  } finally {
    page.off('request', anotar);
  }
  return vistos;
}

async function abrirEditor(page: Page, pestana = 0): Promise<void> {
  await irA(page, `/my-account/edit?pestana=${pestana}`);
  await estable(page);
  await expect(page.getByTestId('edicion-pestanas')).toBeVisible();
}

function campo(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"] input, input[data-testid="${testId}"]`).first();
}

function guardar(page: Page) {
  return page.getByTestId('presentacion-acciones').getByRole('button', { name: 'Guardar cambios' });
}

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  medica = await registrar();
});

test.afterAll(async () => {
  await api.dispose();
});

test('guardar una pestaña manda sólo lo suyo y lo de la otra no se pierde ni viaja', async ({
  page,
}) => {
  const consola: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consola.push(m.text());
  });

  await entrar(page, medica);
  await abrirEditor(page, 0);

  // Los rótulos son los del alta, con su marca de obligatorio.
  const personales = page.getByRole('tabpanel');
  await expect(personales.getByText('Apellido paterno', { exact: false }).first()).toBeVisible();

  // En «Facturación» se escribe un NIT y NO se guarda.
  await page.getByRole('tab', { name: 'Facturación' }).click();
  await campo(page, 'edicion-nit').fill('5414404011');

  // En «Datos personales» se corrige la biografía y se guarda.
  await page.getByRole('tab', { name: 'Datos personales' }).click();
  const bio = `Biografía de prueba ${Date.now()}`;
  await page.getByLabel('Biografía').fill(bio);

  // La médica se dio de alta por API sin fecha de nacimiento, que el alta de la
  // pantalla exige: el editor tampoco deja guardar la pestaña sin ella.
  const bloqueados = await patchesDurante(page, async () => {
    await guardar(page).click();
    await expect(page.getByText('Indique su fecha de nacimiento.')).toBeVisible();
  });
  expect(bloqueados).toHaveLength(0);

  const nacimiento = page.locator('[data-testid="edicion-nacimiento"] input').first();
  await nacimiento.focus();
  await nacimiento.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
  await nacimiento.pressSequentially('14051988');
  await nacimiento.press('Tab');

  const patches = await patchesDurante(page, async () => {
    const respuesta = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && PATCH_DEL_PERFIL.test(r.url()),
    );
    await guardar(page).click();
    expect((await respuesta).status()).toBe(200);
  });
  expect(patches).toHaveLength(1);
  const cuerpo = patches[0]!.postDataJSON() as Record<string, unknown>;
  expect(cuerpo['professionalBio']).toBe(bio);
  expect(cuerpo['birthDate']).toBe('1988-05-14');
  expect(cuerpo).not.toHaveProperty('taxId');
  await expect(page.getByText('Su perfil quedó actualizado.')).toBeVisible();

  // El NIT a medio escribir sigue en su pestaña.
  await page.getByRole('tab', { name: 'Facturación' }).click();
  await expect(campo(page, 'edicion-nit')).toHaveValue('5414404011');

  // Persistencia: recargar trae la biografía guardada y no el NIT.
  await page.reload();
  await estable(page);
  await abrirEditor(page, 0);
  await expect(page.getByLabel('Biografía')).toHaveValue(bio);
  await page.getByRole('tab', { name: 'Facturación' }).click();
  await expect(campo(page, 'edicion-nit')).toHaveValue('');

  expect(consola, consola.join('\n')).toEqual([]);
});

test('«Facturación» guarda el NIT solo, y persiste', async ({ page }) => {
  await entrar(page, medica);
  await abrirEditor(page, 2);
  await campo(page, 'edicion-nit').fill('5414404011');

  const patches = await patchesDurante(page, async () => {
    const respuesta = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && PATCH_DEL_PERFIL.test(r.url()),
    );
    await guardar(page).click();
    expect((await respuesta).status()).toBe(200);
  });
  expect(patches.map((p) => p.postDataJSON())).toEqual([{ taxId: '5414404011' }]);

  await page.reload();
  await estable(page);
  await abrirEditor(page, 2);
  await expect(campo(page, 'edicion-nit')).toHaveValue('5414404011');
});

test('«Contacto» aplica las reglas del alta: correo personal con forma de correo', async ({
  page,
}) => {
  await entrar(page, medica);
  await abrirEditor(page, 1);

  // Celular válido, para que el que frene sea el correo.
  const celular = campo(page, 'edicion-celular-personal');
  await celular.fill('70012345');
  await campo(page, 'edicion-correo-personal').fill('lucia-sin-arroba');

  const patches = await patchesDurante(page, async () => {
    await guardar(page).click();
    await expect(page.getByText('Ingrese un correo válido.')).toBeVisible();
  });
  expect(patches).toHaveLength(0);

  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, 'contacto-correo-invalido-1440-claro.png') });

  // Corregido, viaja y persiste.
  await campo(page, 'edicion-correo-personal').fill('lucia.paredes@ejemplo.bo');
  const enviados = await patchesDurante(page, async () => {
    const respuesta = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && PATCH_DEL_PERFIL.test(r.url()),
    );
    await guardar(page).click();
    expect((await respuesta).status()).toBe(200);
  });
  const cuerpo = enviados[0]!.postDataJSON() as Record<string, unknown>;
  expect(cuerpo['personalEmail']).toBe('lucia.paredes@ejemplo.bo');
  expect(Object.keys(cuerpo).every((k) => !['taxId', 'professionalBio'].includes(k))).toBe(true);

  await page.reload();
  await estable(page);
  await abrirEditor(page, 1);
  await expect(campo(page, 'edicion-correo-personal')).toHaveValue('lucia.paredes@ejemplo.bo');
});

test('guardar vuelve a lectura en la misma pestaña, y cancelar también', async ({ page }) => {
  const consola: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consola.push(m.text());
  });
  await entrar(page, medica);
  await abrirEditor(page, 1);

  const correo = `lucia.${Date.now().toString(36)}@ejemplo.bo`;
  await campo(page, 'edicion-correo-personal').fill(correo);
  const enviados = await patchesDurante(page, async () => {
    const respuesta = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && PATCH_DEL_PERFIL.test(r.url()),
    );
    await guardar(page).click();
    expect((await respuesta).status()).toBe(200);
  });
  expect(enviados.map((p) => p.postDataJSON())).toEqual([{ personalEmail: correo }]);

  // Vuelve a la ficha (lectura), abierta en «Contacto», con el dato guardado.
  await expect(page).toHaveURL(/\/account\/profile\?pestana=1$/);
  await expect(page.getByTestId('edicion-pestanas')).toHaveCount(0);
  await expect(page.getByRole('tab', { name: 'Contacto' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').getByText(correo)).toBeVisible();

  // Persistencia: al recargar sigue en «Contacto» y el correo viene del servidor.
  await page.reload();
  await estable(page);
  await expect(page.getByRole('tab', { name: 'Contacto' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel').getByText(correo)).toBeVisible();

  mkdirSync(CAPTURAS, { recursive: true });
  for (const { ancho, tema } of [
    { ancho: 390, tema: 'light' },
    { ancho: 1440, tema: 'light' },
    { ancho: 390, tema: 'dark' },
    { ancho: 1440, tema: 'dark' },
  ] as const) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.evaluate((modo) => {
      localStorage.setItem('mantra-core-health.theme', modo);
      document.documentElement.setAttribute('data-theme', modo);
      document.documentElement.setAttribute('data-tema', modo === 'dark' ? 'oscuro' : 'claro');
    }, tema);
    // Recargar en el ancho y el tema de la celda: el cambio de ancho en
    // caliente anima el menú lateral y la captura lo saca a medio camino.
    // También vuelve a probar que la ficha abre en la pestaña de la URL.
    await page.reload();
    await estable(page);
    await expect(page.getByRole('tab', { name: 'Contacto' })).toHaveAttribute('aria-selected', 'true');
    // El menú lateral quieto: su caja no se mueve entre dos cuadros.
    await page.waitForFunction(
      () =>
        new Promise<boolean>((resolve) => {
          const nav = document.querySelector('app-side-nav');
          const caja = (): string => JSON.stringify(nav?.getBoundingClientRect() ?? null);
          const antes = caja();
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(antes === caja())));
        }),
    );
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, `scroll horizontal en ${ancho}px`).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: join(CAPTURAS, `vuelta-a-contacto-${ancho}-${tema === 'dark' ? 'oscuro' : 'claro'}.png`),
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  // Cancelar sin cambios en «Facturación» vuelve a «Facturación».
  await abrirEditor(page, 2);
  await page.getByRole('button', { name: 'Cancelar edición' }).click();
  await expect(page).toHaveURL(/\/account\/profile\?pestana=2$/);
  await expect(page.getByRole('tab', { name: 'Facturación' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  expect(consola, consola.join('\n')).toEqual([]);
});

test('capturas del editor en tres anchos y en oscuro', async ({ page }) => {
  mkdirSync(CAPTURAS, { recursive: true });
  await entrar(page, medica);
  const celdas: { ancho: number; tema: 'light' | 'dark' }[] = [
    { ancho: 390, tema: 'light' },
    { ancho: 768, tema: 'light' },
    { ancho: 1440, tema: 'light' },
    { ancho: 1440, tema: 'dark' },
  ];
  for (const { ancho, tema } of celdas) {
    await page.setViewportSize({ width: ancho, height: 900 });
    // El tema de la app manda sobre el del sistema: se fija como lo deja su
    // selector (`ThemeService`), con la clave y los atributos que él escribe.
    await page.evaluate((modo) => {
      localStorage.setItem('mantra-core-health.theme', modo);
      document.documentElement.setAttribute('data-theme', modo);
      document.documentElement.setAttribute('data-tema', modo === 'dark' ? 'oscuro' : 'claro');
    }, tema);
    await abrirEditor(page, 0);
    for (const [pestana, nombre] of [
      ['Datos personales', 'datos-personales'],
      ['Contacto', 'contacto'],
      ['Facturación', 'facturacion'],
    ] as const) {
      await page.getByRole('tab', { name: pestana }).click();
      await expect(page.getByRole('tab', { name: pestana })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(desborde, `scroll horizontal en ${ancho}px`).toBeLessThanOrEqual(0);
      // Alto de ventana suficiente para la pestaña entera, con el ancho que se
      // prueba: en captura de página entera la barra lateral y la botonera
      // fijas se repiten encima del contenido al coser los tramos.
      const alto = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width: ancho, height: Math.max(900, alto) });
      await page.screenshot({
        path: join(CAPTURAS, `${nombre}-${ancho}-${tema === 'dark' ? 'oscuro' : 'claro'}.png`),
      });
      await page.setViewportSize({ width: ancho, height: 900 });
    }
  }
});
