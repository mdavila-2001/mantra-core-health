import { HttpHeaders } from '@angular/common/http';

import { PACIENTE, PROFESSIONALS } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, TENANT_LABORATORIO, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { crearRouterSimulado } from './index';
import { registerReferralIssue } from './referral-issue.handlers';
import { REFERRAL_STATUS, registerReferrals } from './referrals.handlers';

/**
 * Las derivaciones del simulador. Lo que se fija: que lo emitido se relee
 * (la mutación se puede demostrar de punta a punta en `mockup`), que una
 * equivalente es 409 como en la API, que sin destino no hay alta, y que sólo
 * el rol clínico entra.
 */
describe('derivaciones en el mock', () => {
  const router = new MockRouter();
  registerReferrals(router);
  registerReferralIssue(router);
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const patientUser = buscarUsuario('paciente@alovida.mock')!;

  const ENCOUNTER = uuid(`encounter-${PACIENTE.id}-0`);
  const ENCOUNTER_2 = uuid(`encounter-${PACIENTE.id}-1`);
  const OTHER = PROFESSIONALS.find((p) => p.id !== doctor.practitionerProfileId)!;

  function hospitalService(index = 0): { id: string; name: string } {
    const { body } = send('GET', `/referrals/target-services?targetTenantId=${TENANT_HOSPITAL}`) as {
      body: { items: { id: string; name: string }[] };
    };
    return body.items[index]!;
  }

  function send(method: MockMethod, path: string, body: unknown = null, user: MockUser = doctor) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }

  it('busca organizaciones por nombre, sin tildes, desde dos letras', () => {
    const short = send('GET', '/referrals/targets?q=s&kind=ORGANIZATION');
    expect(short.status).toBe(422);
    expect((short.body as { reason: string }).reason).toBe('REFERRAL_TARGET_QUERY_TOO_SHORT');
    const { body } = send('GET', '/referrals/targets?q=lucas&kind=ORGANIZATION') as {
      body: { items: { id: string; kind: string }[] };
    };
    expect(body.items.map((i) => i.id)).toEqual([TENANT_HOSPITAL]);
    expect(body.items[0]?.kind).toBe('ORGANIZATION');
  });

  it('no ofrece a quien busca entre los profesionales', () => {
    const { body } = send('GET', '/referrals/targets?q=ro&kind=PRACTITIONER') as {
      body: { items: { id: string }[] };
    };
    expect(body.items.some((i) => i.id === doctor.practitionerProfileId)).toBe(false);
  });

  it('los servicios sin destino son 422 y con un destino que no existe 404, con su reason', () => {
    const none = send('GET', '/referrals/target-services');
    expect(none.status).toBe(422);
    expect((none.body as { reason: string }).reason).toBe('REFERRAL_TARGET_REQUIRED');
    const missing = send('GET', `/referrals/target-services?targetProfileId=${uuid('nadie')}`);
    expect(missing.status).toBe(404);
    expect((missing.body as { reason: string }).reason).toBe('REFERRAL_TARGET_NOT_FOUND');
  });

  it('un destino sin catálogo devuelve una lista vacía, no un error', () => {
    const { status, body } = send('GET', `/referrals/target-services?targetTenantId=${TENANT_LABORATORIO}`) as {
      status: number;
      body: { items: unknown[] };
    };
    expect(status).toBe(200);
    expect(body.items).toEqual([]);
  });

  it('emite, se relee en la lista y una equivalente es 409', () => {
    const offered = send('GET', `/referrals/target-services?targetTenantId=${TENANT_HOSPITAL}`)
      .body as { items: { id: string; name: string }[] };
    const service = offered.items[0]!;
    const payload = {
      patientProfileId: PACIENTE.id,
      // Un encuentro real de la paciente: la API responde 404 por uno ajeno.
      sourceEncounterId: ENCOUNTER,
      targetTenantId: TENANT_HOSPITAL,
      targetServiceCatalogId: service.id,
      referralType: 'TREATMENT',
      reasonText: 'Rehabilitación',
    };

    const createdReply = send('POST', '/referrals', payload) as {
      status: number;
      body: { id: string; statusConceptId: string };
    };
    expect(createdReply.status).toBe(201);
    expect(createdReply.body.statusConceptId).toBe(REFERRAL_STATUS['REF_REQUESTED']);

    const list = send('GET', `/referrals?patientProfileId=${PACIENTE.id}`).body as {
      id: string;
      referralType: string;
      targetDisplayName: string;
      targetServiceName: string;
    }[];
    const reread = list.find((d) => d.id === createdReply.body.id);
    expect(reread?.referralType).toBe('TREATMENT');
    expect(reread?.targetDisplayName).toBe('Hospital San Lucas');
    expect(reread?.targetServiceName).toBe(service.name);
    // La más reciente primero.
    expect(list[0]?.id).toBe(createdReply.body.id);

    expect(send('POST', '/referrals', payload).status).toBe(409);
  });

  it('sin destino no hay alta: 422 PRECONDITION_FAILED con details.reason, como la API', () => {
    const r = send('POST', '/referrals', { patientProfileId: PACIENTE.id }) as {
      status: number;
      body: { code: string; reason: string; details: { reason: string } };
    };
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('PRECONDITION_FAILED');
    // Arriba, como todo `reason` de la API, y también en `details` (los 422).
    expect(r.body.reason).toBe('REFERRAL_TARGET_REQUIRED');
    expect(r.body.details.reason).toBe('REFERRAL_TARGET_REQUIRED');
  });

  it('con tipo y sin servicio ni destino, 400 REFERRAL_TARGET_REQUIRED (reglas tipadas, antes)', () => {
    const r = send('POST', '/referrals', { patientProfileId: PACIENTE.id, referralType: 'TREATMENT' });
    expect(r.status).toBe(400);
    expect((r.body as { reason: string }).reason).toBe('REFERRAL_TARGET_REQUIRED');
  });

  it('un alta con sólo el servicio del catálogo vale, y sin tipo queda CONSULTATION', () => {
    const service = hospitalService();
    const r = send('POST', '/referrals', { patientProfileId: PACIENTE.id, targetServiceCatalogId: service.id }) as {
      status: number;
      body: { referralType: string; targetTenantId: string; targetServiceName: string };
    };
    expect(r.status).toBe(201);
    expect(r.body.referralType).toBe('CONSULTATION');
    // La organización sale del servicio, como en la API.
    expect(r.body.targetTenantId).toBe(TENANT_HOSPITAL);
    expect(r.body.targetServiceName).toBe(service.name);
  });

  it('los servicios viajan con el arancel como número, como la API', () => {
    const { body } = send('GET', `/referrals/target-services?targetTenantId=${TENANT_CLINICA}`) as {
      body: { items: { price: unknown }[] };
    };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => typeof i.price === 'number')).toBe(true);
  });

  it('el 409 lleva el tipo en la clave y exige encuentro y servicio (o profesional y especialidad)', () => {
    const service = hospitalService(1);
    const base = {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: ENCOUNTER_2,
      targetTenantId: TENANT_HOSPITAL,
      targetServiceCatalogId: service.id,
    };
    expect(send('POST', '/referrals', { ...base, referralType: 'TREATMENT' }).status).toBe(201);
    // Mismo destino y servicio, otro tipo: no es la misma derivación.
    expect(send('POST', '/referrals', { ...base, referralType: 'THERAPY' }).status).toBe(201);
    const dup = send('POST', '/referrals', { ...base, referralType: 'TREATMENT' });
    expect(dup.status).toBe(409);
    expect((dup.body as { reason: string }).reason).toBe('REFERRAL_ALREADY_EXISTS');
    // Sin encuentro no hay con qué compararla.
    const { sourceEncounterId: _e, ...noEncounter } = base;
    expect(send('POST', '/referrals', { ...noEncounter, referralType: 'TREATMENT' }).status).toBe(201);
    expect(send('POST', '/referrals', { ...noEncounter, referralType: 'TREATMENT' }).status).toBe(201);
    // Sin servicio ni especialidad tampoco hay 409.
    const byText = {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: ENCOUNTER_2,
      targetProfileId: OTHER.id,
      referralType: 'CONSULTATION',
      requestedServiceText: 'Interconsulta',
      clinicalSummary: 'Resumen.',
    };
    expect(send('POST', '/referrals', byText).status).toBe(201);
    expect(send('POST', '/referrals', byText).status).toBe(201);
    // Con profesional y especialidad, sí.
    const bySpecialty = { ...byText, specialtyConceptId: 'spec-cardio' };
    expect(send('POST', '/referrals', bySpecialty).status).toBe(201);
    expect(send('POST', '/referrals', bySpecialty).status).toBe(409);
  });

  it('sólo a una organización: 409 con encuentro + organización + tipo (sin tipo cuenta como CONSULTATION)', () => {
    const orgOnly = {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: uuid(`encounter-${PACIENTE.id}-2`),
      targetTenantId: TENANT_CLINICA,
    };
    // Sin tipo y sin servicio: no pasan las reglas tipadas; queda CONSULTATION.
    expect(send('POST', '/referrals', orgOnly).status).toBe(201);
    const typed = { ...orgOnly, referralType: 'CONSULTATION', requestedServiceText: 'x', clinicalSummary: 'y' };
    const dup = send('POST', '/referrals', typed);
    expect(dup.status).toBe(409);
    expect((dup.body as { reason: string }).reason).toBe('REFERRAL_ALREADY_EXISTS');
    // Otro tipo a la misma organización no es la misma derivación.
    expect(send('POST', '/referrals', { ...typed, referralType: 'THERAPY' }).status).toBe(201);
    // La especialidad no cuenta en esta regla.
    expect(send('POST', '/referrals', { ...typed, referralType: 'THERAPY', specialtyConceptId: 's' }).status).toBe(409);
    // Sin encuentro, nunca.
    const { sourceEncounterId: _e, ...noEncounter } = typed;
    expect(send('POST', '/referrals', noEncounter).status).toBe(201);
    expect(send('POST', '/referrals', noEncounter).status).toBe(201);
  });

  it('404 con sub-código: profesional, servicio o encuentro que no están', () => {
    const reasonOf = (r: { body: unknown }) => (r.body as { reason: string }).reason;
    const base = { patientProfileId: PACIENTE.id, referralType: 'TREATMENT', requestedServiceText: 'x', clinicalSummary: 'y' };
    const target = send('POST', '/referrals', { ...base, targetProfileId: '00000000-0000-4000-a000-000000000777' });
    expect(target.status).toBe(404);
    expect(reasonOf(target)).toBe('REFERRAL_TARGET_NOT_FOUND');
    const service = send('POST', '/referrals', { ...base, targetServiceCatalogId: uuid('service-que-no-existe') });
    expect(service.status).toBe(404);
    expect(reasonOf(service)).toBe('REFERRAL_SERVICE_NOT_FOUND');
    const encounter = send('POST', '/referrals', {
      ...base,
      targetTenantId: TENANT_HOSPITAL,
      sourceEncounterId: uuid('encuentro-ajeno'),
    });
    expect(encounter.status).toBe(404);
    expect(reasonOf(encounter)).toBe('REFERRAL_ENCOUNTER_NOT_FOUND');
  });

  it('422 con details.reason: servicio inactivo o ajeno al destino', () => {
    const detailsReason = (r: { body: unknown }) => {
      const body = r.body as { reason: string; details: { reason: string } };
      // Los 422 llevan el `reason` arriba y en `details`, y son el mismo.
      expect(body.reason).toBe(body.details.reason);
      return body.details.reason;
    };
    const inactive = send('POST', '/referrals', {
      patientProfileId: PACIENTE.id,
      targetServiceCatalogId: uuid('service-CERT-APTITUD'),
    });
    expect(inactive.status).toBe(422);
    expect(detailsReason(inactive)).toBe('REFERRAL_SERVICE_INACTIVE');
    const mismatch = send('POST', '/referrals', {
      patientProfileId: PACIENTE.id,
      targetTenantId: TENANT_CLINICA,
      targetServiceCatalogId: hospitalService().id,
    });
    expect(mismatch.status).toBe(422);
    expect(detailsReason(mismatch)).toBe('REFERRAL_SERVICE_TARGET_MISMATCH');
  });

  it('sólo el rol clínico entra', () => {
    expect(send('GET', `/referrals?patientProfileId=${PACIENTE.id}`, null, patientUser).status).toBe(403);
  });
});

/** Un aviso de la campana, lo que estas pruebas leen de él. */
interface Notice {
  readonly bodyText: string;
  readonly destination: { type: string; id: string } | null;
  readonly payloadJson: { kind?: string; route?: string; referralId?: string } | null;
}

/**
 * v4266: destino sede o externo, servicio en texto y resumen clínico, leer
 * una, responder desde el destino, contrarreferencia, anulación y el vínculo
 * con el consentimiento dirigido. Con el router completo, porque el vínculo lo
 * escribe el simulador de consentimientos.
 */
describe('derivaciones v4266 en el mock', () => {
  const router = crearRouterSimulado();
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const patientUser = buscarUsuario('paciente@alovida.mock')!;

  function send(
    method: MockMethod,
    path: string,
    body: unknown = {},
    options: { user?: MockUser; tenant?: string | null } = {},
  ) {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const tenant = options.tenant === undefined ? TENANT_HOSPITAL : options.tenant;
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: tenant === null ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': tenant }),
      user: options.user ?? doctor,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }
  const reasonOf = (r: { body: unknown }): string => (r.body as { reason: string }).reason;

  const external = {
    patientProfileId: PACIENTE.id,
    referralType: 'THERAPY',
    targetExternalName: 'Centro de Hemodiálisis Norte',
    targetExternalContact: '3 3334444',
    requestedServiceText: 'Hemodiálisis 3 veces por semana',
    clinicalSummary: 'ERC estadio 5.',
  };
  /** Una dirigida a la médica de la sesión: ella es el destino. */
  const toDoctor = {
    patientProfileId: PACIENTE.id,
    referralType: 'CONSULTATION',
    targetProfileId: doctor.practitionerProfileId,
    requestedServiceText: 'Interconsulta',
    clinicalSummary: 'Resumen.',
  };

  it('con tipo y sin servicio del catálogo exige servicio en texto y resumen clínico (400 con reason)', () => {
    const noSummary = send('POST', '/referrals', { ...external, clinicalSummary: '' });
    expect(noSummary.status).toBe(400);
    expect(reasonOf(noSummary)).toBe('REFERRAL_SERVICE_INFORMATION_INCOMPLETE');
    expect((noSummary.body as { details: { fields: string[] } }).details.fields).toEqual(['clinicalSummary']);
    expect(reasonOf(send('POST', '/referrals', { ...external, targetExternalName: '' }))).toBe(
      'REFERRAL_TARGET_REQUIRED',
    );
  });

  it('a una sede: resuelve organización y nombre de la sede; una sede inexistente es 404', () => {
    const created = send('POST', '/referrals', {
      ...external,
      targetExternalName: undefined,
      targetExternalContact: undefined,
      targetBranchId: uuid('branch-sanlucas-norte'),
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: 'PENDING',
      targetTenantId: TENANT_HOSPITAL,
      targetTenantName: 'Hospital San Lucas',
      targetBranchName: 'Anexo Norte',
    });
    const missing = send('POST', '/referrals', { ...external, targetBranchId: uuid('branch-que-no-existe') });
    expect(missing.status).toBe(404);
    expect(reasonOf(missing)).toBe('REFERRAL_TARGET_BRANCH_NOT_FOUND');
  });

  it('el alta no acepta informedConsentId (400 REFERRAL_CONSENT_LINK_NOT_ALLOWED)', () => {
    const r = send('POST', '/referrals', { ...external, informedConsentId: 'c-1' });
    expect(r.status).toBe(400);
    expect(reasonOf(r)).toBe('REFERRAL_CONSENT_LINK_NOT_ALLOWED');
  });

  it('el destino responde: exige organización activa, motivo al rechazar y no responde dos veces', () => {
    const created = send('POST', '/referrals', toDoctor).body as { id: string };
    const noTenant = send('PATCH', `/referrals/${created.id}/respond`, { decision: 'ACCEPT' }, { tenant: null });
    expect(noTenant.status).toBe(422);
    expect((noTenant.body as { details: { reason: string } }).details.reason).toBe('TENANT_REQUIRED');

    const noReason = send('PATCH', `/referrals/${created.id}/respond`, { decision: 'REJECT' });
    expect(reasonOf(noReason)).toBe('REFERRAL_REJECT_REASON_REQUIRED');
    const accepted = send('PATCH', `/referrals/${created.id}/respond`, { decision: 'ACCEPT' });
    expect(accepted.body).toMatchObject({ ok: true, status: 'ACCEPTED' });
    expect(reasonOf(send('PATCH', `/referrals/${created.id}/respond`, { decision: 'ACCEPT' }))).toBe(
      'REFERRAL_NOT_PENDING',
    );

    expect(send('PATCH', `/referrals/${created.id}/counter-referral`, { counterReferralText: 'Alta.' }).status).toBe(
      200,
    );
    expect(send('GET', `/referrals/${created.id}`).body).toMatchObject({
      status: 'COMPLETED',
      counterReferralText: 'Alta.',
    });
  });

  it('quien no es destino recibe 404 REFERRAL_NOT_FOUND al responder y al contrarreferir', () => {
    // Otro profesional real: uno inexistente ya es 404 al emitir.
    const someoneElse = PROFESSIONALS.find((p) => p.id !== doctor.practitionerProfileId)!;
    const created = send('POST', '/referrals', {
      ...toDoctor,
      targetProfileId: someoneElse.id,
    }).body as { id: string };
    const r = send('PATCH', `/referrals/${created.id}/respond`, { decision: 'ACCEPT' });
    expect(r.status).toBe(404);
    expect(reasonOf(r)).toBe('REFERRAL_NOT_FOUND');
    expect(reasonOf(send('PATCH', `/referrals/${created.id}/counter-referral`, { counterReferralText: 'x' }))).toBe(
      'REFERRAL_NOT_FOUND',
    );
  });

  it('externa: no se responde en la plataforma, pero la contrarreferencia se transcribe aun pendiente', () => {
    const created = send('POST', '/referrals', external).body as { id: string };
    expect(send('PATCH', `/referrals/${created.id}/respond`, { decision: 'ACCEPT' }).status).toBe(404);
    expect(send('PATCH', `/referrals/${created.id}/counter-referral`, { counterReferralText: 'x' }).status).toBe(200);
  });

  it('anula una pendiente y no anula dos veces', () => {
    const created = send('POST', '/referrals', external).body as { id: string };
    expect((send('PATCH', `/referrals/${created.id}/cancel`).body as { status: string }).status).toBe('CANCELLED');
    const again = send('PATCH', `/referrals/${created.id}/cancel`);
    expect(again.status).toBe(422);
    expect(reasonOf(again)).toBe('REFERRAL_ALREADY_CLOSED');
  });

  it('el consentimiento ACEPTADO con targetType=REFERRAL se vincula; al revocarlo se desvincula', () => {
    const created = send('POST', '/referrals', external).body as { id: string; informedConsentId?: string | null };
    expect(created.informedConsentId ?? null).toBeNull();
    const consent = send('POST', '/consent/treatment-informed-consents', {
      patientProfileId: PACIENTE.id,
      encounterId: '00000000-0000-4000-a000-000000000321',
      decision: 'ACCEPTED',
      targetType: 'REFERRAL',
      targetId: created.id,
      targetLabel: 'Derivación · Terapia',
      purposeText: 'Hemodiálisis',
      benefitsText: 'Depuración',
      risksText: 'Hipotensión',
      revocationRightInformed: true,
    }).body as { id: string };
    expect((send('GET', `/referrals/${created.id}`).body as { informedConsentId: string }).informedConsentId).toBe(
      consent.id,
    );

    send('PATCH', `/consent/treatment-informed-consents/${consent.id}/withdraw`, { reason: 'Cambió de idea' });
    expect(
      (send('GET', `/referrals/${created.id}`).body as { informedConsentId: string | null }).informedConsentId,
    ).toBeNull();
  });

  it('con encuentro avisa a la persona también por una organización: ORGANIZATION_PROFILE con /o/{slug}', () => {
    const created = send('POST', '/referrals', {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: uuid(`encounter-${PACIENTE.id}-2`),
      targetTenantId: TENANT_HOSPITAL,
      referralType: 'PROCEDURE',
      requestedServiceText: 'Colonoscopia',
      clinicalSummary: 'Resumen.',
    }).body as { id: string };
    const inbox = send('GET', '/notifications/me', {}, { user: patientUser }).body as { items: Notice[] };
    const notice = inbox.items.find((n) => n.payloadJson?.referralId === created.id);
    expect(notice?.destination).toEqual({ type: 'ORGANIZATION_PROFILE', id: TENANT_HOSPITAL });
    expect(notice?.payloadJson).toMatchObject({ kind: 'REFERRAL_RECOMMENDED', route: '/o/hospital-san-lucas' });
    // Sin el motivo, como la API; con la frase del enlace porque hay ficha.
    expect(notice?.bodyText).toBe('Su médico le derivó a Hospital San Lucas. Puede ver su ficha en la plataforma.');

    // Sin ficha pública (el laboratorio no tiene): aviso sin destino ni ruta.
    const noProfile = send('POST', '/referrals', {
      patientProfileId: PACIENTE.id,
      sourceEncounterId: uuid(`encounter-${PACIENTE.id}-2`),
      targetTenantId: TENANT_LABORATORIO,
      referralType: 'PROCEDURE',
      requestedServiceText: 'Perfil lipídico',
      clinicalSummary: 'Resumen.',
    }).body as { id: string };
    const again = send('GET', '/notifications/me', {}, { user: patientUser }).body as { items: Notice[] };
    const bare = again.items.find((n) => n.payloadJson?.referralId === noProfile.id);
    expect(bare).toBeDefined();
    expect(bare?.destination).toBeNull();
    expect(bare?.payloadJson?.route).toBeUndefined();
    expect(bare?.bodyText).toBe('Su médico le derivó a Laboratorio Central.');

    // Externo: no se avisa.
    const ext = send('POST', '/referrals', { ...external, sourceEncounterId: uuid(`encounter-${PACIENTE.id}-2`) }).body as { id: string };
    const last = send('GET', '/notifications/me', {}, { user: patientUser }).body as { items: Notice[] };
    expect(last.items.some((n) => n.payloadJson?.referralId === ext.id)).toBe(false);
  });

  it('GET /referrals/me devuelve las propias de la persona, como arreglo', () => {
    expect(Array.isArray(send('GET', '/referrals/me', {}, { user: patientUser }).body)).toBe(true);
  });
});
