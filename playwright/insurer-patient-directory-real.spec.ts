import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Requires the isolated API integration suite to create synthetic fixtures first.
// Authentication snapshots stay in ignored cache; never attach traces with tokens.
test.use({ trace: 'off', viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

test('directorio y conversación persistida con API real @real-directory', async ({
  page,
  request,
}) => {
  const fixturePath =
    process.env['DIRECTORY_BROWSER_FIXTURES_PATH'] ??
    path.resolve('../mantra-core-health-api/node_modules/.cache/directory-qa/browser.json');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
    insurer: { email: string; password: string; ownerId: string; tenantId: string };
    marker: string;
    patientProfileId: string;
  };
  const apiBase = process.env['DIRECTORY_API_URL'] ?? 'http://127.0.0.1:3105';
  const login = await request.post(`${apiBase}/iam/auth/login`, {
    data: { email: fixture.insurer.email, password: fixture.insurer.password },
  });
  expect(login.status()).toBe(200);
  const session = (await login.json()) as { refreshToken: string };
  expect(typeof session.refreshToken).toBe('string');
  await page.addInitScript(
    ({ refreshToken, ownerId, tenantId }) => {
      if (!localStorage.getItem('mantra.refresh-token')) {
        localStorage.setItem('mantra.refresh-token', refreshToken);
        localStorage.setItem('mantra.session', '1');
        localStorage.setItem('mantra.selected-tenant', `${ownerId}|${tenantId}`);
      }
    },
    {
      refreshToken: session.refreshToken,
      ownerId: fixture.insurer.ownerId,
      tenantId: fixture.insurer.tenantId,
    },
  );

  const problems: string[] = [];
  const directoryRequests: { pathname: string; body: Record<string, unknown> }[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400)
      problems.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('request', (outgoing) => {
    const url = new URL(outgoing.url());
    expect(url.toString()).not.toContain(fixture.marker);
    if (url.pathname.endsWith('/insurance/patients/search')) {
      expect(outgoing.method()).toBe('POST');
      expect(url.search).toBe('');
      directoryRequests.push({
        pathname: url.pathname,
        body: outgoing.postDataJSON() as Record<string, unknown>,
      });
    }
  });

  const directory = '/administration/insurance-patients';
  await page.goto(directory);
  await expect(
    page.getByRole('heading', { name: 'Directorio de Pacientes', exact: true }),
  ).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Buscar pacientes', exact: true });
  const filtered = page.waitForResponse(
    (response) =>
      response.url().endsWith('/insurance/patients/search') &&
      response.request().postDataJSON()?.search === fixture.marker,
  );
  await search.fill(fixture.marker);
  const result = await filtered;
  expect(result.status()).toBe(200);
  const body = (await result.json()) as {
    items: Record<string, unknown>[];
    total: number;
    limit: number;
  };
  expect(body.total).toBe(12);
  expect(body.limit).toBe(25);
  for (const item of body.items) {
    for (const forbidden of [
      'documentNumber',
      'policyNumber',
      'memberIdentifier',
      'profileSlug',
      'communityProfileId',
    ])
      expect(item).not.toHaveProperty(forbidden);
  }
  await expect(page.getByTestId('directory-count')).toContainText('12');
  await page.getByRole('combobox', { name: 'Filas por página' }).selectOption('10');
  await expect.poll(() => directoryRequests.at(-1)?.body['limit']).toBe(10);
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect.poll(() => directoryRequests.at(-1)?.body['cursor']).toEqual(expect.any(String));
  await expect(page.getByTestId('directory-count')).toContainText('12');
  await page.getByRole('button', { name: 'Anterior', exact: true }).click();

  const openConversation = async () => {
    const response = page.waitForResponse((reply) =>
      reply.url().endsWith('/insurance/patients/conversation'),
    );
    const region = (await page.getByTestId('patient-cards').isVisible())
      ? page.getByTestId('patient-cards')
      : page.getByTestId('table-insurer-patients');
    await region
      .getByRole('button', { name: `Enviar Mensaje a ${fixture.marker} 00`, exact: true })
      .click();
    const reply = await response;
    expect(reply.status()).toBe(200);
    expect(reply.request().postDataJSON()).toEqual({
      patientProfileId: fixture.patientProfileId,
      channel: 'internal',
    });
    const conversation = (await reply.json()) as { conversationId: string };
    await expect(page).toHaveURL(new RegExp(`/messaging/${conversation.conversationId}$`));
    return conversation.conversationId;
  };
  const first = await openConversation();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/messaging/${first}$`));
  await page.goto(directory);
  await search.fill(fixture.marker);
  await expect(page.getByTestId('directory-count')).toContainText('12');
  expect(await openConversation()).toBe(first);
  expect(problems).toEqual([]);
  console.log(
    'API real: búsqueda POST, payload mínimo, total/cursor, chat reutilizado y recarga PASS; consola/red sin errores inesperados',
  );
});
