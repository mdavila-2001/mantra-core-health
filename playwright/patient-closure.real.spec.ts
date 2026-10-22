import { expect, request, test, type APIRequestContext } from '@playwright/test';
import { crearPaciente, CLAVE, urlDeApi } from './support/actores';

const PASSWORD = 'S3cret-passw0rd';

function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

function claims(token: string): Record<string, unknown> {
  const [, payload] = token.split('.');
  if (!payload) throw new Error('La API no devolvió un JWT válido');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

async function login(
  api: APIRequestContext,
  credentials: Record<string, string>,
): Promise<string> {
  const response = await api.post('/iam/auth/login', { data: credentials });
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as { accessToken: string };
  expect(body.accessToken).toBeTruthy();
  return body.accessToken;
}

test('PAC-KILL · la paciente recupera ubicación y orden clínica persistidas con autoría', async () => {
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    expect((await api.get('/health')).ok()).toBe(true);

    // Alta pública real; el helper resuelve municipio y departamento desde los catálogos vivos.
    const patient = await crearPaciente(api);
    const patientToken = await login(api, {
      nationalId: patient.identificador,
      password: CLAVE,
    });
    const initialProfileResponse = await api.get('/profiles/patients/me', {
      headers: bearer(patientToken),
    });
    expect(initialProfileResponse.status(), await initialProfileResponse.text()).toBe(200);
    const initialProfile = (await initialProfileResponse.json()) as {
      patientProfileId: string;
    };
    expect(initialProfile.patientProfileId).toBeTruthy();

    const location = {
      homeAddressLines: 'Calle PAC-KILL 123, Santa Cruz de la Sierra',
      homeLatitude: -17.7833,
      homeLongitude: -63.1821,
    };
    const locationWrite = await api.patch('/profiles/patients/me', {
      headers: bearer(patientToken),
      data: location,
    });
    expect(locationWrite.status(), await locationWrite.text()).toBe(200);

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const doctorEmail = `pac-kill-${suffix}@example.test`;
    const doctorRegistration = await api.post('/iam/auth/register-practitioner', {
      data: {
        email: doctorEmail,
        password: PASSWORD,
        name: 'Profesional',
        lastName: 'Sintético',
        licenseNumber: `PAC-KILL-LIC-${suffix}`,
        credentialNumber: `PAC-KILL-CRED-${suffix}`,
      },
    });
    expect(doctorRegistration.status(), await doctorRegistration.text()).toBe(201);
    const doctor = (await doctorRegistration.json()) as {
      practitionerProfileId: string;
    };
    expect(doctor.practitionerProfileId).toBeTruthy();
    const doctorToken = await login(api, { email: doctorEmail, password: PASSWORD });
    const doctorClaims = claims(doctorToken);
    const tenantIds = doctorClaims['tenants'];
    expect(Array.isArray(tenantIds) && tenantIds.length > 0).toBe(true);
    const tenantId = (tenantIds as string[])[0];

    // Acceso clínico sólo tras pedir y recibir la aceptación de esta paciente.
    const relationshipRequest = await api.post('/authz/care-relationships/request', {
      headers: bearer(doctorToken),
      data: {
        tenantId,
        patientProfileId: initialProfile.patientProfileId,
        relationshipType: 'TREATING',
        reasonText: 'PAC-KILL: prueba sintética de persistencia clínica',
      },
    });
    expect(relationshipRequest.status(), await relationshipRequest.text()).toBe(201);
    const relationship = (await relationshipRequest.json()) as { id: string };

    const relationshipDecision = await api.post(
      `/authz/care-relationships/${relationship.id}/respond`,
      { headers: bearer(patientToken), data: { decision: 'ACCEPT' } },
    );
    expect(relationshipDecision.status(), await relationshipDecision.text()).toBe(200);

    const conceptResponse = await api.get('/terminology/concepts', {
      headers: bearer(doctorToken),
      params: { q: 'clinical:SERVICE_REQUEST_CATEGORY_LAB', limit: 10 },
    });
    expect(conceptResponse.status(), await conceptResponse.text()).toBe(200);
    const concepts = (await conceptResponse.json()) as {
      items: { conceptId: string; code: string }[];
    };
    const labCategory = concepts.items.find(
      (item) => item.code === 'clinical:SERVICE_REQUEST_CATEGORY_LAB',
    );
    expect(labCategory, 'El catálogo debe publicar la categoría SR_LAB').toBeTruthy();

    const orderWrite = await api.post('/clinical/service-requests', {
      headers: bearer(doctorToken),
      data: {
        custodianTenantId: tenantId,
        patientProfileId: initialProfile.patientProfileId,
        codeConceptId: labCategory!.conceptId,
        categoryConceptId: labCategory!.conceptId,
        requesterProfileId: doctor.practitionerProfileId,
      },
    });
    expect(orderWrite.status(), await orderWrite.text()).toBe(201);
    const order = (await orderWrite.json()) as { id: string };

    // Un login posterior crea una sesión independiente, no reutiliza el token que escribió.
    const freshPatientToken = await login(api, {
      nationalId: patient.identificador,
      password: CLAVE,
    });
    const profileRead = await api.get('/profiles/patients/me', {
      headers: bearer(freshPatientToken),
    });
    expect(profileRead.status(), await profileRead.text()).toBe(200);
    const persistedProfile = (await profileRead.json()) as {
      patientProfileId: string;
      homeAddress?: { lines?: string; latitude?: number; longitude?: number };
    };
    expect(persistedProfile.patientProfileId).toBe(initialProfile.patientProfileId);
    expect(persistedProfile.homeAddress).toMatchObject({
      lines: location.homeAddressLines,
      latitude: location.homeLatitude,
      longitude: location.homeLongitude,
    });

    const orderList = await api.get(
      `/diagnostics/patients/${initialProfile.patientProfileId}/orders`,
      { headers: bearer(doctorToken) },
    );
    expect(orderList.status(), await orderList.text()).toBe(200);
    const persistedOrders = (await orderList.json()) as {
      patientProfileId: string;
      orders: { id: string; requesterProfileId?: string }[];
    };
    expect(persistedOrders.patientProfileId).toBe(initialProfile.patientProfileId);
    expect(persistedOrders.orders).toContainEqual(
      expect.objectContaining({
        id: order.id,
        requesterProfileId: doctor.practitionerProfileId,
      }),
    );
  } finally {
    await api.dispose();
  }
});
