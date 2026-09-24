import { expect, test, type Browser, type Locator, type Page, type TestInfo } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4390';
const PASSWORD = 'secreto12';
const TYPES = [
  { code: 'UNIVERSITARIO', prefix: 'UNI' },
  { code: 'DIPLOMADO', prefix: 'DIP' },
  { code: 'MAESTRIA', prefix: 'MAE' },
  { code: 'DOCTORADO', prefix: 'DOC' },
] as const;

function advanceButton(page: Page): Locator {
  return page.getByTestId('paginated-form-continuar');
}

async function advance(page: Page, nextTitle: string): Promise<void> {
  await expect(advanceButton(page)).toBeEnabled({ timeout: 20_000 });
  await advanceButton(page).click();
  await expect(page.locator('.paginated-form__titulo')).toHaveText(nextTitle, { timeout: 20_000 });
}

async function fillDate(page: Page, value: string): Promise<void> {
  const field = page.getByPlaceholder('DD/MM/AAAA');
  await field.evaluate((element: HTMLInputElement, text: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await expect(field).toHaveValue(value);
}

async function chooseUnusedSpecialty(select: Locator, used: Set<string>): Promise<void> {
  const readValues = async () => select.locator('option').evaluateAll((elements) =>
    elements.map((element) => (element as HTMLOptionElement).value).filter((value) => value !== ''),
  );
  await expect.poll(async () => (await readValues()).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
  const values = await readValues();
  const value = values.find((candidate) => !used.has(candidate));
  expect(value, 'el catálogo debe ofrecer una especialidad distinta').toBeDefined();
  await select.selectOption(value!);
  used.add(value!);
}

async function reachAcademicTitles(page: Page, email: string): Promise<void> {
  await page.goto('/auth/register/practitioner');
  await expect(page.getByTestId('registro-form-profesional')).toBeVisible();
  await page.getByTestId('registro-pro-nombre').fill('Médica');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Prueba');
  await advance(page, 'Tu documento de identidad');
  await page.getByTestId('registro-pro-documento').fill(String(Date.now()).slice(-7));
  await page.getByTestId('registro-pro-departamento-ci').locator('select').selectOption({ index: 1 });
  await advance(page, 'Contanos un poco sobre vos');
  await page.getByTestId('registration-practitioner-sex').locator('select').selectOption({ label: 'Femenino' });
  await fillDate(page, '12/05/1985');
  await advance(page, 'Cómo te contactamos en privado');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(email);
  await advance(page, 'El contacto de tu trabajo');
  await advance(page, '¿Dónde vivís?');
  await advance(page, 'Tu consultorio propio');
  await advance(page, 'Tu título profesional y foto');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option', { name: 'Médico / Médica', exact: true }).click();
  await advance(page, 'Tu habilitación para ejercer');
  await page.getByTestId('registro-pro-matricula').fill('MP-' + String(Date.now()).slice(-7));
  await page.getByTestId('registro-pro-credencial').fill('SEDES-PLAN-SINTETICO');
  await advance(page, 'Los respaldos de tu habilitación');
  await advance(page, 'Tus títulos');
}

async function goTo(page: Page, path: string): Promise<void> {
  await page.evaluate((destination) => {
    window.history.pushState({}, '', destination);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
}

function ownSummaryUrl(url: string): boolean {
  return url.includes('/profiles/practitioners/me/summary');
}

test('edits a credential in the real profile editor, preserves its type and PDF, and blocks another actor', async ({ page, browser }: { page: Page; browser: Browser }, testInfo: TestInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const mark = (Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 5)).toUpperCase();
  const email = 'med-editor-' + mark + '@example.test';
  const expectedNumbers = TYPES.flatMap(({ prefix }) => [1, 2].map((index) => prefix + '-' + index + '-' + mark)).sort();

  await reachAcademicTitles(page, email);

  for (const { code, prefix } of TYPES) {
    const add = page.getByTestId('registro-pro-agregar-' + code);
    const rows = page.getByTestId('registro-pro-fila-' + code);
    await add.click();
    await add.click();
    await expect(rows).toHaveCount(2);
    for (const [index, row] of [rows.nth(0), rows.nth(1)].entries()) {
      const number = prefix + '-' + (index + 1) + '-' + mark;
      const fields = row.locator('input[type="text"]');
      await expect(fields).toHaveCount(5);
      await fields.nth(0).fill('Título sintético ' + number);
      await fields.nth(1).fill(number);
      await fields.nth(2).fill('Institución de prueba ' + number);
      await row.locator('input[type="file"]').setInputFiles({
        name: number + '.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 Documento sintético ' + number),
      });
      await expect(row).toContainText(number + '.pdf');
    }
  }

  await page.screenshot({ path: testInfo.outputPath('medical-credentials-before-editor-mobile.png'), fullPage: true });
  await advance(page, 'Tus especialidades');
  const specialtiesUsed = new Set<string>();
  await chooseUnusedSpecialty(page.getByTestId('registro-pro-especialidad-1').locator('select'), specialtiesUsed);
  const addSpecialty = page.getByTestId('registro-pro-agregar-especialidad');
  for (let index = 0; index < 2; index++) {
    await addSpecialty.click();
    await chooseUnusedSpecialty(
      page.getByTestId('registro-pro-especialidad-extra-' + index).locator('select'),
      specialtiesUsed,
    );
  }
  await page.screenshot({ path: testInfo.outputPath('medical-specialties-before-editor-mobile.png'), fullPage: true });

  await advance(page, 'Tu contraseña');
  await page.getByTestId('registro-pro-password').fill(PASSWORD);
  await expect(advanceButton(page)).toHaveText(/Crear cuenta/);
  const registrationResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/iam/auth/register-practitioner') && response.request().method() === 'POST',
  );
  await advanceButton(page).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  const registration = await registrationResponse.json();
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });

  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill(PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });

  const initialSummaryPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await goTo(page, '/my-account/edit');
  const initialSummaryResponse = await initialSummaryPromise;
  expect(initialSummaryResponse.status()).toBe(200);
  const initialSummary = await initialSummaryResponse.json();
  const ownedCredentials = (initialSummary.credentials as Array<Record<string, unknown>>).filter((credential) =>
    expectedNumbers.includes(String(credential['number'])),
  );
  expect(ownedCredentials).toHaveLength(8);
  expect(initialSummary.specialties).toHaveLength(3);

  await page.getByRole('tab', { name: 'Trayectoria' }).click();
  const table = page.getByTestId('tabla-formacion');
  await expect(table).toBeVisible({ timeout: 30_000 });

  const specialtyNumbers = [1, 2].map((index) => 'ESP-' + index + '-' + mark);
  const specialtyCredentialIds: string[] = [];
  for (const [index, number] of specialtyNumbers.entries()) {
    await page.getByTestId('credencial-tipo').locator('select').selectOption({ label: 'Specialty degree credential' });
    await page.getByTestId('credencial-numero').locator('input').fill(number);
    await page.getByTestId('credencial-institucion').locator('select').selectOption({ label: 'Otra institución o estudié en el exterior…' });
    await page.getByTestId('credencial-institucion-otra').locator('input').fill('Centro de especialidad sintético ' + (index + 1));
    await page.getByTestId('credencial-archivo').locator('input[type="file"]').setInputFiles({
      name: number + '.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 Credencial de especialidad sintética ' + number),
    });
    const specialtyPostPromise = page.waitForResponse(
      (response) => response.url().includes('/profiles/practitioners/me/credentials') && response.request().method() === 'POST',
    );
    const specialtySummaryPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
    await page.getByRole('button', { name: 'Agregar título', exact: true }).click();
    const specialtyPost = await specialtyPostPromise;
    expect(specialtyPost.status()).toBe(201);
    specialtyCredentialIds.push(String((await specialtyPost.json()).id));
    expect((await specialtySummaryPromise).status()).toBe(200);
  }
  const principalDegreeNumber = 'MED-PRINCIPAL-' + mark;
  await page.getByTestId('credencial-tipo').locator('select').selectOption({ label: 'Academic degree credential' });
  await page.getByTestId('credencial-numero').locator('input').fill(principalDegreeNumber);
  await page.getByTestId('credencial-institucion').locator('select').selectOption({ label: 'Otra institución o estudié en el exterior…' });
  await page.getByTestId('credencial-institucion-otra').locator('input').fill('Universidad sintética de Medicina');
  await page.getByTestId('credencial-archivo').locator('input[type="file"]').setInputFiles({
    name: principalDegreeNumber + '.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 Título profesional universitario sintético ' + principalDegreeNumber),
  });
  const principalDegreePostPromise = page.waitForResponse(
    (response) => response.url().includes('/profiles/practitioners/me/credentials') && response.request().method() === 'POST',
  );
  const principalDegreeSummaryPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await page.getByRole('button', { name: 'Agregar título', exact: true }).click();
  const principalDegreePost = await principalDegreePostPromise;
  expect(principalDegreePost.status()).toBe(201);
  const principalDegreeCredentialId = String((await principalDegreePost.json()).id);
  expect((await principalDegreeSummaryPromise).status()).toBe(200);
  const summaryWithSpecialtyCredentialsResponsePromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await page.reload();
  const summaryWithSpecialtyCredentialsResponse = await summaryWithSpecialtyCredentialsResponsePromise;
  expect(summaryWithSpecialtyCredentialsResponse.status()).toBe(200);
  const summaryWithSpecialtyCredentials = await summaryWithSpecialtyCredentialsResponse.json();
  const specialtyCredentials = (summaryWithSpecialtyCredentials.credentials as Array<Record<string, unknown>>).filter((row) =>
    specialtyCredentialIds.includes(String(row['id'])),
  );
  expect(specialtyCredentials).toHaveLength(2);
  expect(specialtyCredentials.map((row) => row['number']).sort()).toEqual([...specialtyNumbers].sort());
  expect(specialtyCredentials.every((row) => typeof row['fileId'] === 'string')).toBe(true);
  const principalDegreeCredential = (summaryWithSpecialtyCredentials.credentials as Array<Record<string, unknown>>).find((row) => row['id'] === principalDegreeCredentialId);
  expect(principalDegreeCredential).toMatchObject({ number: principalDegreeNumber, issuingInstitutionText: 'Universidad sintética de Medicina' });
  expect(typeof principalDegreeCredential?.['fileId']).toBe('string');
  const addedCredentialFileIds = new Map([
    ...specialtyCredentials.map((row) => [String(row['id']), String(row['fileId'])] as const),
    [principalDegreeCredentialId, String(principalDegreeCredential?.['fileId'])] as const,
  ]);
  await page.getByRole('tab', { name: 'Trayectoria' }).click();
  await expect(page.getByTestId('tabla-formacion')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('medical-specialty-credentials-profile-mobile.png'), fullPage: true });

  const edited = ownedCredentials.find((credential) => String(credential['number']) === 'UNI-1-' + mark)!;
  expect(edited).toBeDefined();
  const credentialId = String(edited['id']);
  const originalType = edited['credentialTypeConceptId'];
  const originalFileId = edited['fileId'];
  const newNumber = String(edited['number']) + '-EDIT';
  const newInstitution = 'Institución corregida por la profesional ' + mark;

  await page.getByTestId('formacion-editar-' + credentialId).click();
  const dialog = page.locator('app-content-dialog[data-testid="edicion-dialogo"] dialog[data-testid="content-dialog"]');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('edicion-credencial-numero').locator('input')).toHaveValue(String(edited['number']));
  await expect(page.getByTestId('edicion-credencial-institucion-otra').locator('input')).toHaveValue(
    String(edited['issuingInstitutionText']),
  );
  await page.screenshot({ path: testInfo.outputPath('medical-credential-editor-mobile.png'), fullPage: true });
  await page.getByTestId('edicion-credencial-numero').locator('input').fill(newNumber);
  await page.getByTestId('edicion-credencial-institucion-otra').locator('input').fill(newInstitution);

  const patchResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/profiles/practitioners/me/credentials/' + credentialId) &&
      response.request().method() === 'PATCH',
  );
  const updatedSummaryPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  const patchResponse = await patchResponsePromise;
  expect(patchResponse.status()).toBe(204);
  const updatedSummaryResponse = await updatedSummaryPromise;
  expect(updatedSummaryResponse.status()).toBe(200);
  const updatedSummary = await updatedSummaryResponse.json();
  const updatedCredentials = (updatedSummary.credentials as Array<Record<string, unknown>>).filter((credential) =>
    ownedCredentials.some((original) => original['id'] === credential['id']),
  );
  expect(updatedCredentials).toHaveLength(8);
  expect(new Set(updatedCredentials.map((credential) => credential['fileId'])).size).toBe(8);
  expect(updatedSummary.credentials).toHaveLength(11);
  expect(new Set((updatedSummary.credentials as Array<Record<string, unknown>>).map((credential) => credential['fileId'])).size).toBe(11);
  expect(updatedSummary.specialties).toHaveLength(3);

  const reloadSummaryPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await page.reload();
  const reloadSummaryResponse = await reloadSummaryPromise;
  expect(reloadSummaryResponse.status()).toBe(200);
  const reloadedSummary = await reloadSummaryResponse.json();
  const reloadedCredentials = (reloadedSummary.credentials as Array<Record<string, unknown>>).filter((credential) =>
    ownedCredentials.some((original) => original['id'] === credential['id']),
  );
  expect(reloadedCredentials).toHaveLength(8);
  expect(new Set(reloadedCredentials.map((credential) => credential['fileId'])).size).toBe(8);
  expect(reloadedSummary.credentials).toHaveLength(11);
  const reloadedSpecialtyCredentials = (reloadedSummary.credentials as Array<Record<string, unknown>>).filter((row) =>
    specialtyCredentialIds.includes(String(row['id'])),
  );
  expect(reloadedSpecialtyCredentials).toHaveLength(2);
  expect(reloadedSpecialtyCredentials.map((row) => row['fileId']).sort()).toEqual(specialtyCredentials.map((row) => row['fileId']).sort());
  for (const [id, fileId] of addedCredentialFileIds) {
    expect((reloadedSummary.credentials as Array<Record<string, unknown>>).find((row) => row['id'] === id)?.['fileId']).toBe(fileId);
  }
  expect(new Set((reloadedSummary.credentials as Array<Record<string, unknown>>).map((credential) => credential['fileId'])).size).toBe(11);
  expect(reloadedSummary.specialties).toHaveLength(3);
  expect(reloadedCredentials.find((credential) => credential['id'] === credentialId)).toMatchObject({
    credentialTypeConceptId: originalType,
    number: newNumber,
    issuingInstitutionText: newInstitution,
    fileId: originalFileId,
  });

  await page.getByRole('tab', { name: 'Trayectoria' }).click();
  await expect(page.getByTestId('tabla-formacion')).toContainText(newNumber);
  await page.screenshot({ path: testInfo.outputPath('medical-credential-editor-persisted-mobile.png'), fullPage: true });
  for (const [id, fileId] of addedCredentialFileIds) {
    const contentResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/common/files/' + fileId + '/content') && response.request().method() === 'GET',
    );
    await page.getByTestId('formacion-descargar-' + id).click();
    const contentResponse = await contentResponsePromise;
    expect(contentResponse.status()).toBe(200);
    expect(contentResponse.headers()['content-type']).toContain('application/pdf');
    expect((await contentResponse.body()).subarray(0, 8).toString()).toBe('%PDF-1.4');
  }

  const otherContext = await browser.newContext();
  const otherPage = await otherContext.newPage();
  await otherPage.setViewportSize({ width: 390, height: 844 });
  const otherMark = (Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 5)).toUpperCase();
  const otherEmail = 'med-editor-other-' + otherMark + '@example.test';
  await reachAcademicTitles(otherPage, otherEmail);
  await advance(otherPage, 'Tus especialidades');
  await advance(otherPage, 'Tu contraseña');
  await otherPage.getByTestId('registro-pro-password').fill(PASSWORD);
  await expect(advanceButton(otherPage)).toHaveText(/Crear cuenta/);
  const otherRegistrationPromise = otherPage.waitForResponse(
    (response) => response.url().includes('/iam/auth/register-practitioner') && response.request().method() === 'POST',
  );
  await advanceButton(otherPage).click();
  expect((await otherRegistrationPromise).status()).toBe(201);
  await expect(otherPage.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
  await otherPage.goto('/auth');
  await otherPage.getByTestId('login-identifier').fill(otherEmail);
  await otherPage.getByTestId('login-password').fill(PASSWORD);
  await otherPage.getByTestId('login-submit').click();
  await otherPage.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  const otherSummaryPromise = otherPage.waitForResponse((response) => ownSummaryUrl(response.url()));
  await goTo(otherPage, '/my-account/edit');
  const otherSummaryResponse = await otherSummaryPromise;
  expect(otherSummaryResponse.status()).toBe(200);
  const otherSummary = await otherSummaryResponse.json();
  expect(otherSummary.credentials).toEqual([]);
  expect(JSON.stringify(otherSummary)).not.toContain(String(edited['number']));
  const otherLogin = await otherPage.request.post(ORIGIN + '/iam/auth/login', { data: { email: otherEmail, password: PASSWORD } });
  expect(otherLogin.status()).toBe(200);
  const otherTokens = await otherLogin.json();
  const foreignPatch = await otherPage.request.patch(
    ORIGIN + '/profiles/practitioners/me/credentials/' + credentialId,
    { headers: { Authorization: 'Bearer ' + otherTokens.accessToken }, data: { number: 'FOREIGN-EDIT-' + otherMark } },
  );
  expect(foreignPatch.status()).toBe(404);
  const ownerAfterForeignAttemptPromise = page.waitForResponse((response) => ownSummaryUrl(response.url()));
  await page.reload();
  const ownerAfterForeignAttemptResponse = await ownerAfterForeignAttemptPromise;
  expect(ownerAfterForeignAttemptResponse.status()).toBe(200);
  const ownerAfterForeignAttempt = await ownerAfterForeignAttemptResponse.json();
  expect((ownerAfterForeignAttempt.credentials as Array<Record<string, unknown>>).find((row) => row['id'] === credentialId)).toMatchObject({
    number: newNumber,
    fileId: originalFileId,
  });
  await otherContext.close();

  console.log('MEDICAL_REAL_API_EDITOR=' + JSON.stringify({
    email,
    userId: registration.userId,
    profileId: registration.practitionerProfileId,
    credentialId,
    credentialTypeConceptId: originalType,
    number: newNumber,
    institution: newInstitution,
    specialtyCredentialIds,
    principalDegreeCredentialId,
    fileId: originalFileId,
    credentialsAfterReload: (reloadedSummary.credentials as unknown[]).length,
    specialtiesAfterReload: reloadedSummary.specialties.length,
    otherActorSummaryCredentials: (otherSummary.credentials as unknown[]).length,
    otherActorPatchStatus: foreignPatch.status(),
  }));
});
