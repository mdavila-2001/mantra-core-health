import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  CLAVE,
  administrador,
  contextoDeApi,
  firstDepartmentConceptId,
  firstMunicipalityConceptId,
} from './support/actores';
import { actorsWithoutPortal, expectDenied, openPortal } from './support/portal-data-center';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  reloadApp,
  responseOf,
  uniqueSuffix,
  type RealSession,
} from './support/real-session';

/**
 * Centro de datos · grupo «Gobierno y acceso» del portal, contra la API real:
 * Auditoría, Usuarios y roles y Deriva de permisos.
 *
 * Cada prueba entra por la dirección con sus filtros en la URL y comprueba que
 * viajan a la API, que la respuesta llega y que la pantalla la dibuja. Asignar
 * y revocar se prueba de punta a punta (pantalla → petición → respuesta → API →
 * recarga → pantalla) sobre un usuario sintético dado de alta por la prueba,
 * nunca sobre una cuenta existente; lo que se asigna se revoca. Médico y
 * paciente no entran: ni por la dirección ni llamando a la API con su token.
 *
 *   E2E_API_REAL=1 corepack yarn pw data-center-governance --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

/** Las capturas de este grupo, donde las manda `visual-quality-gate`; viajan en el diff. */
const EVIDENCE_DIR = join(__dirname, '..', 'docs', 'frontend', 'evidence', 'centro-datos-gobierno');

async function capture(page: Page, name: string): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`), animations: 'disabled' });
}

/** Un usuario sintético propio, sin roles: un paciente recién dado de alta. Devuelve su id. */
async function registerSyntheticUser(api: APIRequestContext): Promise<string> {
  const suffix = uniqueSuffix();
  const [residenceMunicipalityConceptId, issuerAdministrativeAreaConceptId] = await Promise.all([
    firstMunicipalityConceptId(api),
    firstDepartmentConceptId(api),
  ]);
  const response = await api.post('/iam/auth/register-patient', {
    data: {
      nationalId: `CI-GOV-${suffix}`,
      password: CLAVE,
      name: 'Prueba',
      middleName: 'Gobierno',
      lastName: 'Sintética',
      motherLastName: suffix,
      email: `gobierno-pw-${suffix.toLowerCase()}@example.test`,
      phone: '+591 70055555',
      gender: 'FEMALE',
      sexAtBirth: 'FEMALE',
      birthDate: '1995-05-20',
      residenceMunicipalityConceptId,
      issuerAdministrativeAreaConceptId,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { userId: string }).userId;
}

interface Assignment {
  id: string;
  status: string;
  appliesGlobally: boolean;
}

let session: RealSession;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, administrador());
});

test.afterAll(async () => {
  await session?.close();
});

async function activeAssignments(userId: string): Promise<Assignment[]> {
  const res = await session.api.get(`/authz/users/${userId}/role-assignments`, {
    headers: session.authHeaders(),
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { items: Assignment[] }).items.filter((a) => a.status === 'ACTIVE');
}

/** Elige una opción de un `app-select` por su texto. */
async function pick(page: Page, testId: string, option: RegExp, search?: string): Promise<void> {
  await page.getByTestId(testId).getByRole('combobox').first().click();
  const searchBox = page.getByRole('combobox', { name: 'Buscar opción' });
  if (search && (await searchBox.isVisible())) await searchBox.fill(search);
  await page.getByRole('option', { name: option }).first().click();
}

test('Auditoría: los filtros de la URL viajan a la API y cada pestaña lee su bitácora', async () => {
  const { page } = session;
  const log = await responseOf(page, 'GET', /\/audit\/log$/, () =>
    openPortal(page, 'governance/audit?result=SUCCESS'),
  );
  expect(log.status()).toBe(200);
  expect(new URL(log.url()).searchParams.get('result')).toBe('SUCCESS');
  const body = (await log.json()) as { items: { result: string; healthRisk: string }[] };
  expect(body.items.every((e) => e.result === 'SUCCESS')).toBe(true);
  const table = page.getByTestId('portal-audit-log-table');
  if (body.items.length > 0) await expect(table).toContainText('Correcta');
  await capture(page, 'auditoria-acciones');

  const access = await responseOf(page, 'GET', /\/audit\/data-access$/, () =>
    page.getByRole('tab', { name: 'Accesos a datos sensibles' }).click(),
  );
  expect(access.status()).toBe(200);
  await expect(page).toHaveURL(/view=data-access/);
  await expect(page.getByTestId('portal-audit-access-table')).toBeVisible();
  await capture(page, 'auditoria-accesos');
});

test('Usuarios y roles: lista, cajón de una persona y permisos de un rol', async () => {
  const { page } = session;
  const list = await responseOf(page, 'GET', /\/authz\/internal-users$/, () =>
    openPortal(page, 'governance/users'),
  );
  expect(list.status()).toBe(200);
  const users = (await list.json()) as { items: { id: string; displayName: string }[] };
  expect(users.items.length).toBeGreaterThan(0);
  await expect(page.getByTestId('portal-internal-users-table')).toContainText(users.items[0]!.displayName);

  const assignments = await responseOf(page, 'GET', /\/authz\/users\/[^/]+\/role-assignments$/, () =>
    page.getByTestId('portal-internal-user-link').first().click(),
  );
  expect(assignments.status()).toBe(200);
  await expect(page).toHaveURL(/user=/);
  await expect(page.getByTestId('portal-user-access')).toBeVisible();
  await capture(page, 'usuarios-persona');

  const roles = (await (
    await session.api.get('/authz/roles', { headers: session.authHeaders() })
  ).json()) as { id: string }[];
  const permissions = await responseOf(page, 'GET', /\/authz\/roles\/[^/]+\/permissions$/, () =>
    openPortal(page, `governance/users?view=role-permissions&role=${roles[0]!.id}`),
  );
  expect(permissions.status()).toBe(200);
  await expect(page.getByTestId('portal-role-permissions-table')).toBeVisible();
  await capture(page, 'usuarios-permisos-rol');
});

test('Usuarios y roles: asignar (rechazo 422 explicado y éxito) y revocar con confirmación', async () => {
  const { page } = session;
  const api = await contextoDeApi();
  const userId = await registerSyntheticUser(api).finally(() => api.dispose());
  try {
    await responseOf(page, 'GET', /\/role-assignments$/, () =>
      openPortal(page, `governance/users?user=${userId}`),
    );
    await expect(page.getByTestId('portal-user-access')).toContainText('Todavía no tiene asignaciones');

    await page.getByTestId('portal-assign-role').click();
    await pick(page, 'assign-role-role', /GOVERNANCE_ADMIN/, 'GOVERNANCE_ADMIN');
    // Un rol de ámbito global con organización: la API lo rechaza y el formulario lo explica.
    await page.getByTestId('assign-role-scope').getByRole('combobox').first().click();
    await page.getByRole('option', { name: /la de su sesión/ }).click();
    const rejected = await responseOf(page, 'POST', /\/role-assignments$/, () =>
      page.getByTestId('assign-role-save').click(),
    );
    expect(rejected.status()).toBe(422);
    expect(((await rejected.json()) as { reason: string }).reason).toBe('ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE');
    await expect(page.getByTestId('assign-role-error')).toContainText('ámbito global');
    expect(await activeAssignments(userId)).toHaveLength(0);
    await capture(page, 'usuarios-asignar-rechazo');

    await pick(page, 'assign-role-scope', /Toda la plataforma/);
    const created = await responseOf(page, 'POST', /\/role-assignments$/, () =>
      page.getByTestId('assign-role-save').click(),
    );
    expect(created.status()).toBe(201);
    await expect(page.getByTestId('portal-user-access-notice')).toContainText('recibió el rol');
    const active = await activeAssignments(userId);
    expect(active).toHaveLength(1);
    expect(active[0]!.appliesGlobally).toBe(true);
    await capture(page, 'usuarios-asignado');

    await page.getByTestId('portal-assignment-revoke').first().click();
    await expect(page.getByTestId('dialogo')).toContainText('Revocar el rol');
    await capture(page, 'usuarios-revocar-confirmacion');
    const revoked = await responseOf(page, 'DELETE', /\/role-assignments\/[^/]+$/, () =>
      page.getByTestId('dialogo-confirmar').click(),
    );
    expect(revoked.status()).toBe(200);
    expect(await activeAssignments(userId)).toHaveLength(0);

    // Lo que se ve después de recargar sale de la API, no del estado de la pantalla.
    await reloadApp(page);
    await expect(page.getByTestId('portal-assignment').filter({ hasText: 'Revocada' })).toHaveCount(1);
    await capture(page, 'usuarios-revocado');
  } finally {
    for (const a of await activeAssignments(userId)) {
      await session.api.delete(`/authz/users/${userId}/role-assignments/${a.id}`, {
        headers: session.authHeaders(),
      });
    }
  }
});

test('Deriva de permisos: recuentos, roles sin sembrar y rutas sin roles', async () => {
  const { page } = session;
  const drift = await responseOf(page, 'GET', /\/admin\/catalog\/permission-drift$/, () =>
    openPortal(page, 'governance/permission-drift'),
  );
  expect(drift.status()).toBe(200);
  const body = (await drift.json()) as { usedNotSeeded: { role: string }[]; routes: { total: number } };
  await expect(page.getByTestId('portal-permission-drift')).toBeVisible();
  if (body.usedNotSeeded.length > 0) {
    await expect(page.getByTestId('portal-drift-used-not-seeded')).toContainText(body.usedNotSeeded[0]!.role);
  }
  await capture(page, 'deriva-permisos');

  await page.getByRole('tab', { name: /Rutas sin roles/ }).click();
  await expect(page).toHaveURL(/view=without-roles/);
  await expect(page.getByTestId('portal-drift-without-roles')).toBeVisible();
  await capture(page, 'deriva-permisos-rutas');
});

test('médico y paciente no llegan al gobierno de acceso, ni por la dirección ni por la API', async ({ browser }) => {
  for (const actor of await actorsWithoutPortal()) {
    await expectDenied(
      browser,
      actor,
      ['governance/audit', 'governance/users', 'governance/permission-drift'],
      '/audit/log',
    );
  }
});
