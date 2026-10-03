import { profileTest as test } from './support/practitioner-profile-test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';

import {
  contextoDeApi,
  crearPaciente,
  firstDepartmentConceptId,
  urlDeApi,
  type Actor,
} from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Integración real: cuentas, credenciales, vínculos y bytes se crean en la API.
 * No guarda storageState ni trace: los argumentos de addInitScript y las
 * cabeceras del refresco contienen credenciales que deben quedar en memoria.
 * Ejecutar con E2E_API_URL=http://localhost:3000, Chromium, un worker y cero retries.
 */
test.use({ trace: 'off' });

const SCREENSHOTS = resolve(
  'docs/trabajo/2026-10-02-perfil-medico-ux-credenciales-especialidades/evidencia/capturas',
);
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;
const THEMES = [
  { value: 'light', nombre: 'claro' },
  { value: 'dark', nombre: 'oscuro' },
] as const;
const FILE_NAME = 'respaldo-sintetico-h1.pdf';
const ATTACHED_CREDENTIAL_NUMBER = 'H1-CRED-01';

interface SyntheticSession {
  actor: Actor;
  accessToken: string;
  refreshToken: string;
}

/** PDF de una página, con longitudes y tabla xref calculadas sobre sus bytes. */
function syntheticPdf(): Buffer {
  const content = 'BT /F1 18 Tf 50 760 Td (Respaldo sintetico H1 - sin datos reales) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  ];
  let documentBytes = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(documentBytes));
    documentBytes += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(documentBytes);
  documentBytes += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  documentBytes += offsets
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');
  documentBytes += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(documentBytes);
}

async function register(
  api: APIRequestContext,
  suffix: string,
  issuerAdministrativeAreaConceptId: string,
): Promise<SyntheticSession> {
  const actor: Actor = {
    rol: 'doctora',
    identificador: `perfil-listados-${suffix}@example.test`,
    clave: 'Synthetic-H1-2026!',
    nombre: 'Prueba Listados',
  };
  const registration = await api.post('/iam/auth/register-practitioner', {
    data: {
      email: actor.identificador,
      password: actor.clave,
      name: 'Prueba',
      lastName: 'Listados',
      nationalId: `H1-${suffix}`,
      issuerAdministrativeAreaConceptId,
      licenseNumber: `H1-LIC-${suffix}`,
    },
  });
  expect(registration.status(), 'registro del profesional sintético').toBe(201);
  const login = await api.post('/iam/auth/login', {
    data: { email: actor.identificador, password: actor.clave },
  });
  expect(login.status(), 'un único login API por cuenta, sin reintentos').toBe(200);
  const session = (await login.json()) as { accessToken?: string; refreshToken?: string };
  // Una aserción fallida tampoco debe imprimir el token recibido.
  expect(typeof session.accessToken === 'string' && session.accessToken.length > 0).toBe(true);
  expect(typeof session.refreshToken === 'string' && session.refreshToken.length > 0).toBe(true);
  return { actor, accessToken: session.accessToken!, refreshToken: session.refreshToken! };
}

function education(page: Page): Locator {
  return page.getByRole('region', { name: /^Títulos y formación/ });
}

async function dismissNotices(page: Page): Promise<void> {
  const notices = page.getByTestId('avisos-region');
  for (const close of await notices
    .getByRole('button', { name: 'Cerrar aviso', exact: true })
    .all()) {
    if (await close.isVisible()) await close.click();
  }
}

async function openTab(
  page: Page,
  name: 'Credenciales' | 'Trayectoria' | 'Datos personales',
): Promise<void> {
  const tab = page.getByRole('tab', { name: name, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  if (name === 'Credenciales') {
    await expect(
      education(page).getByRole('table', { name: 'Títulos y formación', exact: true }),
    ).toBeVisible();
  } else if (name === 'Trayectoria') {
    await expect(page.getByRole('table', { name: 'Actividad actual', exact: true })).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Experiencia histórica', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('table', { name: 'Tu historial laboral', exact: true }),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole('tabpanel').getByText('Especialidades', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Idiomas', { exact: true })).toBeVisible();
  }
}

/** Medidas de documento y tablas visibles; una tira de pestañas puede tener scroll propio. */
async function measureOverflow(page: Page, cell: string) {
  const measurements = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    tables: Array.from(document.querySelectorAll('table'))
      .filter((table) => table.getClientRects().length > 0)
      .map((table) => ({
        nombre: table.caption?.textContent?.trim() ?? '',
        width: table.scrollWidth,
        container: table.parentElement?.clientWidth ?? 0,
      })),
  }));
  expect(measurements.documentWidth, `desborde del documento en ${cell}`).toBeLessThanOrEqual(
    measurements.viewport + 1,
  );
  for (const table of measurements.tables) {
    expect(table.width, `desborde de ${table.nombre} en ${cell}`).toBeLessThanOrEqual(
      table.container + 1,
    );
  }
  return { cell, ...measurements };
}

test('listados densos, respaldo autorizado y matriz visual conservan los datos reales al recargar', async ({
  page,
  context,
}, testInfo) => {
  // Evita que el helper tome su puerto alternativo o apunte a un servicio externo.
  expect(urlDeApi(), 'definir E2E_API_URL=http://localhost:3000').toBe('http://localhost:3000');
  const api = await contextoDeApi();
  const problems: string[] = [];
  const measurements: Awaited<ReturnType<typeof measureOverflow>>[] = [];
  const secrets: string[] = [];
  const redact = (text: string) =>
    secrets.reduce((output, secret) => output.split(secret).join('[redactado]'), text);
  const pathname = (url: string) => new URL(url).pathname;
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${redact(message.text())}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${redact(error.message)}`));
  page.on('requestfailed', (request) =>
    problems.push(`requestfailed: ${request.method()} ${pathname(request.url())}`),
  );
  page.on('response', (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${pathname(response.url())}`);
  });

  try {
    const issuer = await firstDepartmentConceptId(api);
    const suffix = String(Date.now());
    const owner = await register(api, `${suffix}-1`, issuer);
    secrets.push(owner.accessToken, owner.refreshToken, owner.actor.clave);
    const headers = { Authorization: `Bearer ${owner.accessToken}` };
    const catalog = await api.get('/system-context/dynamic-enums', {
      headers,
      params: { target: 'profiles.professional_credentials.credential_type_concept_id' },
    });
    expect(catalog.status(), 'catálogo real de clases de credencial').toBe(200);
    const types = (await catalog.json()) as {
      options: { conceptId: string; isDefault?: boolean }[];
    };
    const credentialType = types.options.find((option) => option.isDefault) ?? types.options[0];
    expect(Boolean(credentialType?.conceptId), 'el catálogo tiene un tipo utilizable').toBe(true);

    const pdf = syntheticPdf();
    const upload = await api.post('/common/files/upload', {
      headers,
      multipart: {
        file: { name: FILE_NAME, mimeType: 'application/pdf', buffer: pdf },
        category: 'DOCUMENT',
        sensitivity: 'NORMAL',
      },
    });
    expect(upload.status(), 'subida de PDF real').toBe(201);
    const file = (await upload.json()) as { id: string };
    expect(Boolean(file.id)).toBe(true);

    for (let index = 1; index <= 12; index += 1) {
      const credential = await api.post('/profiles/practitioners/me/credentials', {
        headers,
        data: {
          credentialTypeConceptId: credentialType!.conceptId,
          number: `H1-CRED-${String(index).padStart(2, '0')}`,
          issuingInstitutionText: `Universidad Sintética ${index} de Ciencias de la Salud y Formación Profesional Continua`,
          issueDate: '2020-02-01',
          ...(index === 1 ? { fileId: file.id } : {}),
        },
      });
      expect(credential.status(), `alta de credencial ${index}`).toBe(201);
      const affiliation = await api.post('/profiles/practitioners/me/affiliations', {
        headers,
        data: {
          organizationName:
            index === 12
              ? 'Hospital Histórico Sintético'
              : `Institución Sintética Actual ${String(index).padStart(2, '0')}`,
          roleTitle: 'Profesional de prueba de atención y formación continua',
          startDate: '2020-03-01',
          ...(index === 12 ? { endDate: '2023-12-31' } : {}),
        },
      });
      expect(affiliation.status(), `alta de vínculo ${index}`).toBe(201);
    }
    const readResponse = await api.get('/profiles/practitioners/me/affiliations', { headers });
    expect(readResponse.status()).toBe(200);
    const affiliations = (await readResponse.json()) as { items: { current: boolean }[] };
    expect(affiliations.items.filter((row) => row.current)).toHaveLength(11);
    expect(affiliations.items.filter((row) => !row.current)).toHaveLength(1);

    const otherUser = await register(api, `${suffix}-2`, issuer);
    secrets.push(otherUser.accessToken, otherUser.refreshToken);
    const denied = await api.get(`/common/files/${file.id}/content`, {
      headers: { Authorization: `Bearer ${otherUser.accessToken}` },
    });
    expect(denied.status(), 'otro profesional no puede leer el PDF del propietario').toBe(403);
    expect((await denied.body()).equals(pdf), 'el rechazo no entrega los bytes').toBe(false);

    await context.addInitScript(
      ({ token }) => {
        // Una sola siembra: los reloads conservan el token rotado por AuthService.
        if (sessionStorage.getItem('h1-listados-sesion-sembrada') !== '1') {
          localStorage.setItem('mantra.refresh-token', token);
          sessionStorage.setItem('h1-listados-sesion-sembrada', '1');
        }
      },
      { token: owner.refreshToken },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/account/profile');
    await expect(page).toHaveURL(/\/account\/profile$/);
    await openTab(page, 'Credenciales');

    const group = education(page);
    const table = group.getByRole('table', { name: 'Títulos y formación', exact: true });
    await expect(table.getByRole('row')).toHaveCount(11); // Diez datos y encabezado.
    await expect(
      table.getByRole('row').filter({ hasText: 'Credencial pendiente de verificación' }),
    ).toHaveCount(10);
    await expect(
      page.getByRole('tabpanel').getByRole('heading', { name: /^Especialidades/ }),
    ).toHaveCount(0);
    await group.getByRole('button', { name: 'Página siguiente', exact: true }).click();
    await expect(table.getByRole('row')).toHaveCount(3);
    await group.getByRole('button', { name: 'Página anterior', exact: true }).click();
    await expect(table.getByRole('row')).toHaveCount(11);
    await group
      .getByRole('textbox', { name: 'Buscar en Títulos y formación', exact: true })
      .fill(ATTACHED_CREDENTIAL_NUMBER);
    await expect(table.getByRole('row')).toHaveCount(2);
    const pendingDownload = page.waitForEvent('download');
    await group
      .getByRole('button', {
        name: new RegExp(`Descargar respaldo de .*${ATTACHED_CREDENTIAL_NUMBER}`),
      })
      .click();
    const download = await pendingDownload;
    // El componente usa el número de diploma; Chromium puede añadir la extensión del MIME.
    expect(download.suggestedFilename()).toMatch(/^diploma-H1-CRED-01(?:\.pdf)?$/);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream)
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    expect(
      Buffer.concat(chunks).equals(pdf),
      'el archivo descargado por la ficha conserva todos los bytes',
    ).toBe(true);
    await group
      .getByRole('textbox', { name: 'Buscar en Títulos y formación', exact: true })
      .fill('');
    await expect(table.getByRole('row')).toHaveCount(11);

    // Flechas mueven el foco; Enter activa la pestaña, según el contrato de Tabs.
    await page.getByRole('tab', { name: 'Credenciales', exact: true }).focus();
    await page.keyboard.press('ArrowLeft');
    const career = page.getByRole('tab', { name: 'Trayectoria', exact: true });
    await expect(career).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(career).toHaveAttribute('aria-selected', 'true');
    await openTab(page, 'Trayectoria');
    const current = page.getByTestId('trayectoria-actual'); // La sección no tiene nombre accesible propio.
    const historical = page.getByRole('table', { name: 'Experiencia histórica', exact: true });
    await expect(current.getByRole('table').getByRole('row')).toHaveCount(11);
    await expect(historical.getByRole('row')).toHaveCount(2);
    await current.getByRole('button', { name: 'Página siguiente', exact: true }).click();
    await expect(current.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(historical.getByRole('row')).toHaveCount(2);
    await current.getByRole('button', { name: 'Página anterior', exact: true }).click();
    await expect(current.getByRole('table').getByRole('row')).toHaveCount(11);

    await page.reload();
    await openTab(page, 'Credenciales');
    await expect(education(page).getByRole('table').getByRole('row')).toHaveCount(11);
    await education(page).getByRole('button', { name: 'Página siguiente', exact: true }).click();
    await expect(education(page).getByRole('table').getByRole('row')).toHaveCount(3);
    await education(page).getByRole('button', { name: 'Página anterior', exact: true }).click();
    await openTab(page, 'Trayectoria');
    await expect(current.getByRole('table').getByRole('row')).toHaveCount(11);
    await expect(historical.getByRole('row')).toHaveCount(2);

    await mkdir(SCREENSHOTS, { recursive: true });
    for (const theme of THEMES) {
      await page.evaluate(
        (value) => localStorage.setItem('mantra-core-health.theme', value),
        theme.value,
      );
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const tab of ['Credenciales', 'Trayectoria'] as const) {
          await openTab(page, tab);
          const cell = `listados-${viewport.width}x${viewport.height}-${theme.nombre}-${tab.toLowerCase()}`;
          measurements.push(await measureOverflow(page, cell));
          await dismissNotices(page);
          await page.screenshot({
            path: resolve(SCREENSHOTS, `${cell}.png`),
            fullPage: true,
            animations: 'disabled',
          });
        }
        if (viewport.width === 390 && theme.value === 'light') {
          await openTab(page, 'Datos personales');
          measurements.push(await measureOverflow(page, 'datos-propios-390x844-claro'));
          await dismissNotices(page);
          await page.screenshot({
            path: resolve(SCREENSHOTS, 'datos-propios-390x844-claro.png'),
            fullPage: true,
            animations: 'disabled',
          });
          await irA(page, '/my-account/edit');
          const name = page.getByRole('textbox', { name: 'Nombre', exact: true });
          await expect(name).toHaveValue('Prueba');
          await name.fill('Borrador sintético sin guardar');
          await page.getByRole('button', { name: 'Cancelar edición', exact: true }).click();
          const dialog = page.getByRole('dialog');
          await expect(dialog).toContainText('¿Descartás lo que escribiste?');
          await dialog.getByRole('button', { name: 'Descartar', exact: true }).focus();
          await page.keyboard.press('Tab');
          // Chromium pasa por su chrome al salir del último control; el siguiente Tab vuelve al diálogo nativo.
          await page.keyboard.press('Tab');
          await expect(
            dialog.getByRole('button', { name: 'Seguir editando', exact: true }),
          ).toBeFocused();
          await name.focus();
          await expect(
            dialog.getByRole('button', { name: 'Seguir editando', exact: true }),
          ).toBeFocused();
          await expect
            .poll(() => dialog.evaluate((element) => element.matches(':modal')))
            .toBe(true);
          await expect
            .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
            .toBe(true);
          measurements.push(await measureOverflow(page, 'cancelacion-390x844-claro'));
          const bounds = await dialog.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
          await dismissNotices(page);
          await page.screenshot({
            path: resolve(SCREENSHOTS, 'cancelacion-390x844-claro.png'),
            fullPage: true,
            animations: 'disabled',
          });
          await dialog.getByRole('button', { name: 'Descartar', exact: true }).click();
          await expect(page).toHaveURL(/\/account\/profile$/);
        }
      }
    }
    expect(
      problems,
      'consola y red del navegador; el 403 esperado se comprueba por API separada',
    ).toEqual([]);
  } finally {
    await testInfo.attach('medidas-y-red-listados', {
      body: Buffer.from(
        JSON.stringify(
          { measurements, problems, negativoEsperado: '403 al PDF desde la segunda cuenta' },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
    await api.dispose();
  }
});

/** Variante pública con datos de API real; previewMode se cubre en el spec del componente porque no tiene una ruta propia. */
test('un paciente consulta especialidades en portada y credenciales públicas sin respaldos privados', async ({
  page,
}, testInfo) => {
  const api = await contextoDeApi();
  const problems: string[] = [];
  const measurements: Awaited<ReturnType<typeof measureOverflow>>[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      problems.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  try {
    const owner = await register(api, `public-${Date.now()}`, await firstDepartmentConceptId(api));
    const headers = { Authorization: `Bearer ${owner.accessToken}` };
    const summaryResponse = await api.get('/profiles/practitioners/me/summary', { headers });
    expect(summaryResponse.status()).toBe(200);
    const summary = (await summaryResponse.json()) as { profileId: string };
    const setsResponse = await api.get('/terminology/value-sets', {
      params: { code: 'VS_MEDICAL_SPECIALTY' },
    });
    expect(setsResponse.status()).toBe(200);
    const sets = (await setsResponse.json()) as { items: { id: string; internalCode: string }[] };
    const valueSet = sets.items.find((item) => item.internalCode === 'VS_MEDICAL_SPECIALTY');
    expect(Boolean(valueSet)).toBe(true);
    const expansionResponse = await api.get(`/terminology/value-sets/${valueSet!.id}/$expand`);
    expect(expansionResponse.status()).toBe(200);
    const expansion = (await expansionResponse.json()) as {
      items: { conceptId: string; display: string }[];
    };
    const specialty = expansion.items[0];
    expect(Boolean(specialty)).toBe(true);
    const specialtyResponse = await api.post(
      `/profiles/practitioners/${summary.profileId}/specialties`,
      { headers, data: { specialtyConceptId: specialty!.conceptId } },
    );
    expect(specialtyResponse.status()).toBe(201);
    const typesResponse = await api.get('/system-context/dynamic-enums', {
      headers,
      params: { target: 'profiles.professional_credentials.credential_type_concept_id' },
    });
    expect(typesResponse.status()).toBe(200);
    const types = (await typesResponse.json()) as { options: { conceptId: string }[] };
    const upload = await api.post('/common/files/upload', {
      headers,
      multipart: {
        file: { name: FILE_NAME, mimeType: 'application/pdf', buffer: syntheticPdf() },
        category: 'DOCUMENT',
        sensitivity: 'NORMAL',
      },
    });
    expect(upload.status()).toBe(201);
    const file = (await upload.json()) as { id: string };
    for (let index = 1; index <= 6; index++) {
      const response = await api.post('/profiles/practitioners/me/credentials', {
        headers,
        data: {
          credentialTypeConceptId: types.options[0]!.conceptId,
          number: `H1-PUBLIC-${index}`,
          issuingInstitutionText: 'Institución Sintética de Formación Profesional Continua',
          issueDate: '2020-02-01',
          ...(index === 1 ? { fileId: file.id } : {}),
        },
      });
      expect(response.status()).toBe(201);
    }
    const patient = await crearPaciente(api);
    await entrar(page, patient);
    await irA(page, `/directory/${summary.profileId}`);
    await expect(
      page.getByRole('tab', { name: 'Credenciales y verificaciones', exact: true }),
    ).toBeVisible();
    await expect(page.locator('app-practitioner-profile-view')).toContainText(specialty!.display);
    await mkdir(SCREENSHOTS, { recursive: true });
    for (const theme of THEMES) {
      await page.evaluate(
        (value) => localStorage.setItem('mantra-core-health.theme', value),
        theme.value,
      );
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme.value);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.getByRole('tab', { name: 'Credenciales y verificaciones', exact: true }).click();
        const panel = page.getByRole('tabpanel', { name: 'Credenciales y verificaciones', exact: true });
        await expect(
          panel.getByRole('table', { name: 'Títulos y formación', exact: true }).getByRole('row'),
        ).toHaveCount(7);
        await expect(panel.getByRole('heading', { name: /^Especialidades/ })).toHaveCount(0);
        await expect(panel).not.toContainText(specialty!.display);
        await expect(page.getByRole('button', { name: /Descargar respaldo/ })).toHaveCount(0);
        const specialtyBounds = await page.locator('.profesional__especialidades app-specialty-badge').evaluateAll((badges) =>
          badges.map((badge) => {
            const container = badge.getBoundingClientRect();
            const seal = badge.querySelector('app-status-seal')?.getBoundingClientRect();
            return {
              contained: seal !== undefined && seal.left >= container.left - 1 && seal.right <= container.right + 1,
              badge: { left: container.left, right: container.right, width: container.width },
              seal: seal ? { left: seal.left, right: seal.right, width: seal.width } : null,
              grid: badge.closest('app-specialty-badge-grid')?.getBoundingClientRect().width,
            };
          }),
        );
        expect(specialtyBounds.map((bounds) => bounds.contained), `cada sello cabe dentro de su insignia de especialidad: ${JSON.stringify(specialtyBounds)}`).toEqual([true]);
        const cell = `public-${viewport.width}x${viewport.height}-${theme.nombre}-credentials`;
        measurements.push(await measureOverflow(page, cell));
        await dismissNotices(page);
        // El click desplaza hasta la pestaña; capturar desde arriba evita estampar
        // la cabecera fija en mitad de una imagen de página completa.
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        await page.screenshot({
          path: resolve(SCREENSHOTS, `${cell}.png`),
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
    expect(problems, 'consola y red de la ficha pública real').toEqual([]);
  } finally {
    await testInfo.attach('public-profile-measurements', {
      body: Buffer.from(JSON.stringify({ measurements, problems }, null, 2)),
      contentType: 'application/json',
    });
    await api.dispose();
  }
});
