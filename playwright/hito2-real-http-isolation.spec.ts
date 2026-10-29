import { access, mkdir, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { type RequestHandler } from 'express';
import { expect, test } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * H2.S3.M12: doble local del contrato de transporte HTTP, sin page.route.
 * Ejecuta el artefacto production-api con SSR y los interceptores reales del
 * navegador. No certifica la API de Hito 1 ni persistencia contra el backend.
 *
 * Contrato: mantra-core-health-api/docs/api/error-model.md y
 * src/common/filters/all-exceptions.filter.ts (400/409/500, violations e INTERNAL
 * opaco). Las respuestas son sintéticas: no afirman que este login produzca
 * todos estos errores en la API real. Las credenciales también son sintéticas.
 *
 * Antes: corepack yarn build --configuration=production-api
 * Ejecutar: corepack yarn pw playwright/hito2-real-http-isolation.spec.ts
 *           --project=chromium --workers=1 --retries=0
 */
const LOGIN_PATH = '/iam/auth/login';
const CREDENTIALS = { email: 'a@example.invalid', password: 'dummy' };
const ARTIFACT_DIRECTORY = 'artifacts/playwright/hito2';
const SERVER_ARTIFACT = resolve('dist/mantra-core-health/server/server.mjs');
const CONTRACT_TIMESTAMP = '2026-09-30T00:00:00.000Z';

interface ContractError {
  readonly code: 'VALIDATION_FAILED' | 'CONFLICT' | 'INTERNAL';
  readonly message: string;
  readonly correlationId: string;
  readonly details?: { readonly violations: readonly string[] };
  readonly timestamp: string;
  readonly path: string;
}

interface ErrorScenario {
  readonly status: 400 | 409 | 500;
  readonly code: ContractError['code'];
  readonly message: string;
  readonly violations?: readonly string[];
}

interface LoginTraffic {
  readonly method: string;
  readonly path: string;
  readonly requestBody: unknown;
  readonly status: number;
  readonly responseBody: string;
  readonly correlationId: string;
}

const SCENARIOS: readonly ErrorScenario[] = [
  {
    status: 400,
    code: 'VALIDATION_FAILED',
    message: 'Error de validación',
    violations: ['email must be an email'],
  },
  { status: 409, code: 'CONFLICT', message: 'Conflicto sintético de autenticación.' },
  { status: 500, code: 'INTERNAL', message: 'Error interno del servidor' },
];

async function loadSsrHandler(): Promise<RequestHandler> {
  try {
    await access(SERVER_ARTIFACT);
  } catch {
    throw new Error(
      'Falta el artefacto SSR production-api: ejecutar corepack yarn build --configuration=production-api. ' +
        SERVER_ARTIFACT,
    );
  }
  const artifact: { reqHandler?: unknown } = await import(pathToFileURL(SERVER_ARTIFACT).href);
  if (typeof artifact.reqHandler !== 'function') {
    throw new Error('El artefacto SSR no exporta reqHandler: ' + SERVER_ARTIFACT);
  }
  return artifact.reqHandler as RequestHandler;
}

async function listenOnLoopback(server: Server): Promise<string> {
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolveListen();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('El doble HTTP no obtuvo un puerto TCP local.');
  }
  return 'http://127.0.0.1:' + address.port;
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
    server.closeAllConnections();
  });
}

for (const width of [390, 1440]) {
  for (const scenario of SCENARIOS) {
    test('HTTP local conserva ' + scenario.status + ' y su error de login a ' + width + ' px', async ({ page }, info) => {
      const evidenceName = 'http-isolation-' + scenario.status + '-' + width;
      const correlationId = 'hito2-' + scenario.status + '-' + width;
      const body: ContractError = {
        code: scenario.code,
        message: scenario.message,
        correlationId,
        ...(scenario.violations ? { details: { violations: scenario.violations } } : {}),
        timestamp: CONTRACT_TIMESTAMP,
        path: LOGIN_PATH,
      };
      const responseBody = JSON.stringify(body);
      const traffic: LoginTraffic[] = [];
      const runtimeErrors: string[] = [];
      const consoleErrors: string[] = [];
      let browserResponse: { status: number; body: string; correlationId: string | null } | undefined;
      page.on('pageerror', (error) => runtimeErrors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      const app = express();
      app.post(LOGIN_PATH, express.json(), (request, response) => {
        const requestBody: unknown = request.body;
        traffic.push({
          method: request.method,
          path: request.originalUrl,
          requestBody,
          status: scenario.status,
          responseBody,
          correlationId,
        });
        response.setHeader('x-request-id', correlationId);
        response.status(scenario.status).type('application/json').send(responseBody);
      });
      app.use(await loadSsrHandler());
      const server = createServer(app);
      try {
        const origin = await listenOnLoopback(server);
        await page.setViewportSize({ width, height: 900 });
        const documentResponse = await page.goto(origin + '/auth');
        if (documentResponse === null) throw new Error('El servidor SSR no devolvi\u00f3 el documento de login.');
        expect(documentResponse.status(), 'Documento servido por el artefacto SSR').toBe(200);
        expect(await documentResponse.text(), 'El HTML inicial contiene el formulario prerenderizado')
          .toContain('data-testid="login-form"');
        await esperarAplicacionLista(page);
        await expect(page.getByRole('complementary', { name: 'Modo de demostración' })).toHaveCount(0);
        await page.getByTestId('login-identifier').fill(CREDENTIALS.email);
        await page.getByTestId('login-password').fill(CREDENTIALS.password);
        await expect(page.getByTestId('login-identifier')).toHaveValue(CREDENTIALS.email);
        await expect(page.getByTestId('login-password')).toHaveValue(CREDENTIALS.password);

        const [response] = await Promise.all([
          page.waitForResponse(
            (response) => response.url() === origin + LOGIN_PATH && response.request().method() === 'POST',
          ),
          page.getByTestId('login-submit').click(),
        ]);
        browserResponse = {
          status: response.status(),
          body: await response.text(),
          correlationId: await response.headerValue('x-request-id'),
        };
        expect(response.request().postDataJSON(), 'El login alcanza el transporte HTTP').toEqual(CREDENTIALS);
        expect(browserResponse).toEqual({ status: scenario.status, body: responseBody, correlationId });
        expect(await response.json(), 'El cuerpo HTTP llega intacto al navegador').toEqual(body);
        expect(traffic).toEqual([{
          method: 'POST', path: LOGIN_PATH, requestBody: CREDENTIALS,
          status: scenario.status, responseBody, correlationId,
        }]);

        const expectedMessage = scenario.violations?.[0] ?? (
          scenario.status === 500 ? scenario.message + ' (' + correlationId + ')' : scenario.message
        );
        await expect(page.getByTestId('login-error')).toBeVisible();
        await expect(page.getByTestId('login-error').locator('.alert__message')).toHaveText(expectedMessage);
        await expect(page).toHaveURL(origin + '/auth');
        await expect(page.getByTestId('login-submit')).toBeEnabled();
        await expect(page.getByRole('complementary', { name: 'Modo de demostración' })).toHaveCount(0);
        expect(runtimeErrors, 'Sin excepciones JavaScript').toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
          'Sin desborde horizontal',
        ).toBe(false);
      } finally {
        try {
          await mkdir(ARTIFACT_DIRECTORY, { recursive: true });
          const trafficPath = ARTIFACT_DIRECTORY + '/' + evidenceName + '.json';
          await writeFile(trafficPath, JSON.stringify({
            evidence: 'Doble local de contrato HTTP; no certifica API Hito 1 ni persistencia.',
            artifact: SERVER_ARTIFACT,
            viewport: { width, height: 900 },
            expectedResponse: { status: scenario.status, body },
            serverTraffic: traffic,
            browserResponse,
            runtimeErrors,
            consoleErrors,
          }, null, 2), 'utf8');
          await info.attach(evidenceName + '-traffic', { path: trafficPath, contentType: 'application/json' });
          const screenshotPath = ARTIFACT_DIRECTORY + '/' + evidenceName + '.png';
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await info.attach(evidenceName, { path: screenshotPath, contentType: 'image/png' });
        } finally {
          await closeServer(server);
        }
      }
    });
  }
}
