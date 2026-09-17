import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * B.3 — el botón de la receta oficial, contra la API real (no el mock).
 *
 * Siembra por API (una receta emitida real, para una paciente real) y
 * después recorre la UI para bajar el PDF. El contenido del documento
 * —matrícula, sello, marca de agua— ya lo verifica
 * `clinical-prescriptions-pdf.int-spec.ts` del backend; acá sólo se
 * comprueba que el botón del portal lo baja de verdad.
 */

/** Decodifica el cuerpo de un JWT (sin validar la firma: es de prueba). */
function decodificarJwt(token: string): Record<string, unknown> {
  const cuerpo = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as Record<string, unknown>;
}

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  test.skip(
    !(await apiViva(api)),
    `La API E2E no responde en ${urlDeApi()}: este carril necesita backend vivo.`,
  );
});

test.afterAll(async () => {
  await api.dispose();
});

test('la paciente descarga el PDF oficial de una receta real, emitida por la doctora demo', async ({
  page,
}) => {
  const paciente = await crearPaciente(api);
  const doctoraActor = doctora();

  const loginDoctora = await api.post('/iam/auth/login', {
    data: { email: doctoraActor.identificador, password: doctoraActor.clave },
  });
  expect(loginDoctora.ok(), `login de la doctora demo: ${await loginDoctora.text()}`).toBe(true);
  const { accessToken: tokenDoctora } = (await loginDoctora.json()) as { accessToken: string };
  const claimsDoctora = decodificarJwt(tokenDoctora) as {
    tenants?: string[];
    hpid?: string;
  };
  const tenantId = claimsDoctora.tenants?.[0];
  const prescriberProfileId = claimsDoctora.hpid;
  test.skip(
    tenantId === undefined || prescriberProfileId === undefined,
    'La doctora demo no declara tenant o perfil profesional en su token.',
  );

  const loginPaciente = await api.post('/iam/auth/login', {
    data: { nationalId: paciente.identificador, password: paciente.clave },
  });
  expect(loginPaciente.ok()).toBe(true);
  const { accessToken: tokenPaciente } = (await loginPaciente.json()) as { accessToken: string };
  const { pid: patientProfileId } = decodificarJwt(tokenPaciente) as { pid?: string };
  test.skip(patientProfileId === undefined, 'El token de la paciente no trae `pid`.');

  const conceptos = await api.get('/terminology/concepts?limit=1', {
    headers: { Authorization: `Bearer ${tokenDoctora}` },
  });
  const { items } = (await conceptos.json()) as { items: { conceptId: string }[] };
  const medicationConceptId = items[0]?.conceptId;
  test.skip(medicationConceptId === undefined, 'El catálogo de conceptos no tiene ningún miembro.');

  const prescripcion = await api.post('/clinical/medication-requests', {
    headers: { Authorization: `Bearer ${tokenDoctora}` },
    data: {
      custodianTenantId: tenantId,
      patientProfileId,
      medicationConceptId,
      prescriberProfileId,
      doseText: '1 comprimido',
      frequencyText: 'cada 12 horas',
      patientInstructionsText: 'Receta sembrada por el carril E2E de B.3.',
    },
  });
  expect(prescripcion.ok(), `prescribir: ${await prescripcion.text()}`).toBe(true);
  const { id: requestId } = (await prescripcion.json()) as { id: string };

  await api.post(`/clinical/medication-requests/${requestId}/sign`, {
    headers: { Authorization: `Bearer ${tokenDoctora}` },
    data: {},
  });
  const emision = await api.post(`/clinical/medication-requests/${requestId}/issue`, {
    headers: { Authorization: `Bearer ${tokenDoctora}` },
    data: {},
  });
  expect(emision.ok(), `emitir: ${await emision.text()}`).toBe(true);

  await entrar(page, {
    rol: 'paciente',
    identificador: paciente.identificador,
    clave: paciente.clave,
    nombre: paciente.nombre,
  });
  await irA(page, '/my-account/medical-record?seccion=recetas');
  await estable(page);

  const boton = page.getByTestId('historia-descargar-receta').first();
  await expect(boton).toBeVisible({ timeout: 30_000 });

  const descarga = await Promise.all([page.waitForEvent('download'), boton.click()]).then(
    ([evento]) => evento,
  );
  expect(descarga.suggestedFilename()).toBe(`receta-${requestId}.pdf`);
  await expect(page.getByText('Descarga iniciada exitosamente')).toBeVisible();
});
