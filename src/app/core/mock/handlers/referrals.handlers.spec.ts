import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { PACIENTES } from '../fixtures/personas';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/** Las reglas del contrato §2 (derivaciones) en el simulador. */
describe('handlers de derivaciones', () => {
  const router = crearRouterSimulado();
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;

  function pedir(
    method: MockMethod,
    path: string,
    user: typeof medica | null,
    body: unknown = {},
    query = new URLSearchParams(),
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }

  const estado = (r: unknown): number => (isMockReply(r) ? r.status : 200);
  const cuerpoDe = <T>(r: unknown): T => (isMockReply(r) ? r.body : r) as T;

  const valida = {
    patientProfileId: PACIENTES[0]!.id,
    referralType: 'TREATMENT',
    targetExternalName: 'Centro de Hemodiálisis Norte',
    requestedServiceText: 'Hemodiálisis 3 veces por semana',
    clinicalSummary: 'ERC estadio 5.',
  };

  it('lista las del paciente con estado legible y destino resuelto', () => {
    const r = pedir('GET', '/referrals', medica, {}, new URLSearchParams({ patientProfileId: PACIENTES[0]!.id }));
    const filas = cuerpoDe<{ status: string; targetTenantName: string | null }[]>(r);
    expect(estado(r)).toBe(200);
    expect(filas.length).toBeGreaterThanOrEqual(3);
    expect(filas.some((f) => f.targetTenantName === 'Hospital San Lucas')).toBe(true);
  });

  it('un paciente no lista derivaciones ajenas por esta ruta', () => {
    const r = pedir('GET', '/referrals', paciente, {}, new URLSearchParams({ patientProfileId: PACIENTES[0]!.id }));
    expect(estado(r)).toBe(403);
  });

  const motivo = (r: unknown): string => cuerpoDe<{ reason: string }>(r).reason;

  it('con referralType exige destino, servicio y resumen clínico (400 con reason)', () => {
    const sinDestino = pedir('POST', '/referrals', medica, { ...valida, targetExternalName: '' });
    expect(estado(sinDestino)).toBe(400);
    expect(motivo(sinDestino)).toBe('REFERRAL_TARGET_REQUIRED');
    const sinResumen = pedir('POST', '/referrals', medica, { ...valida, clinicalSummary: '' });
    expect(motivo(sinResumen)).toBe('REFERRAL_SERVICE_INFORMATION_INCOMPLETE');
    expect(cuerpoDe<{ details: { fields: string[] } }>(sinResumen).details.fields).toEqual(['clinicalSummary']);
  });

  it('sin referralType (legado) no aplica las reglas nuevas y responde 201', () => {
    const r = pedir('POST', '/referrals', medica, { patientProfileId: PACIENTES[0]!.id, reasonText: 'x' });
    expect(estado(r)).toBe(201);
  });

  /** Una dirigida a la médica de la sesión: ella es el destino. */
  const aLaMedica = (() => {
    const { targetExternalName: _e, ...resto } = valida;
    return { ...resto, targetProfileId: medica.practitionerProfileId };
  })();

  it('emite, el destino responde con motivo obligatorio al rechazar y no responde dos veces', () => {
    const alta = pedir('POST', '/referrals', medica, aLaMedica);
    expect(estado(alta)).toBe(201);
    const creada = cuerpoDe<{ id: string; status: string }>(alta);
    expect(creada.status).toBe('PENDING');

    const sinMotivo = pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'REJECT' });
    expect(estado(sinMotivo)).toBe(400);
    expect(motivo(sinMotivo)).toBe('REFERRAL_REJECT_REASON_REQUIRED');
    const aceptada = pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'ACCEPT' });
    expect(cuerpoDe<{ ok: boolean; status: string }>(aceptada)).toMatchObject({ ok: true, status: 'ACCEPTED' });
    const otraVez = pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'ACCEPT' });
    expect(estado(otraVez)).toBe(422);
    expect(motivo(otraVez)).toBe('REFERRAL_NOT_PENDING');

    expect(
      estado(pedir('PATCH', `/referrals/${creada.id}/counter-referral`, medica, { counterReferralText: 'Alta.' })),
    ).toBe(200);
    // (la médica es el destino: contrarrefiere la aceptada)
    const leida = cuerpoDe<{ status: string; counterReferralText: string }>(
      pedir('GET', `/referrals/${creada.id}`, medica),
    );
    expect(leida.status).toBe('COMPLETED');
    expect(leida.counterReferralText).toBe('Alta.');
  });

  it('externa: no se responde en la plataforma (403 REFERRAL_RESPOND_FORBIDDEN)', () => {
    const creada = cuerpoDe<{ id: string }>(pedir('POST', '/referrals', medica, valida));
    const r = pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'ACCEPT' });
    expect(estado(r)).toBe(403);
    expect(motivo(r)).toBe('REFERRAL_RESPOND_FORBIDDEN');
  });

  it('quien no es destino no responde (403 REFERRAL_RESPOND_FORBIDDEN)', () => {
    const { targetExternalName: _e, ...resto } = valida;
    const creada = cuerpoDe<{ id: string }>(
      pedir('POST', '/referrals', medica, { ...resto, targetProfileId: '00000000-0000-4000-a000-000000000777' }),
    );
    expect(motivo(pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'ACCEPT' }))).toBe(
      'REFERRAL_RESPOND_FORBIDDEN',
    );
  });

  it('el alta no acepta informedConsentId (400 REFERRAL_CONSENT_LINK_NOT_ALLOWED)', () => {
    const r = pedir('POST', '/referrals', medica, { ...valida, informedConsentId: 'c-1' });
    expect(estado(r)).toBe(400);
    expect(motivo(r)).toBe('REFERRAL_CONSENT_LINK_NOT_ALLOWED');
  });

  it('listar y emitir exigen acceso a la historia (403)', () => {
    const ajeno = '00000000-0000-4000-a000-000000000555';
    expect(estado(pedir('GET', '/referrals', medica, {}, new URLSearchParams({ patientProfileId: ajeno })))).toBe(403);
    expect(estado(pedir('POST', '/referrals', medica, { ...valida, patientProfileId: ajeno }))).toBe(403);
  });

  it('el consentimiento ACEPTADO con targetType=REFERRAL se vincula; al revocarlo se desvincula', () => {
    const creada = cuerpoDe<{ id: string; informedConsentId: string | null }>(
      pedir('POST', '/referrals', medica, valida),
    );
    expect(creada.informedConsentId).toBeNull();
    const consent = cuerpoDe<{ id: string }>(
      pedir('POST', '/consent/treatment-informed-consents', medica, {
        patientProfileId: valida.patientProfileId,
        encounterId: '00000000-0000-4000-a000-000000000321',
        decision: 'ACCEPTED',
        targetType: 'REFERRAL',
        targetId: creada.id,
        targetLabel: 'Derivación · Tratamiento',
        purposeText: 'Hemodiálisis',
        benefitsText: 'Depuración',
        risksText: 'Hipotensión',
        revocationRightInformed: true,
      }),
    );
    const vinculada = cuerpoDe<{ informedConsentId: string | null }>(pedir('GET', `/referrals/${creada.id}`, medica));
    expect(vinculada.informedConsentId).toBe(consent.id);

    pedir('PATCH', `/consent/treatment-informed-consents/${consent.id}/withdraw`, medica, { reason: 'Cambió de idea' });
    const desvinculada = cuerpoDe<{ informedConsentId: string | null }>(
      pedir('GET', `/referrals/${creada.id}`, medica),
    );
    expect(desvinculada.informedConsentId).toBeNull();
  });

  it('externa: la contrarreferencia se transcribe aun pendiente', () => {
    const creada = cuerpoDe<{ id: string }>(pedir('POST', '/referrals', medica, valida));
    expect(
      estado(pedir('PATCH', `/referrals/${creada.id}/counter-referral`, medica, { counterReferralText: 'x' })),
    ).toBe(200);
  });

  it('en la plataforma, sólo el destino contrarrefiere (403 con reason)', () => {
    const { targetExternalName: _e, ...sinExterno } = valida;
    const creada = cuerpoDe<{ id: string }>(
      pedir('POST', '/referrals', medica, { ...sinExterno, targetTenantId: '00000000-0000-4000-a000-000000000999' }),
    );
    pedir('PATCH', `/referrals/${creada.id}/respond`, medica, { decision: 'ACCEPT' });
    const r = pedir('PATCH', `/referrals/${creada.id}/counter-referral`, medica, { counterReferralText: 'x' });
    expect(estado(r)).toBe(403);
    expect(motivo(r)).toBe('REFERRAL_COUNTER_REFERRAL_FORBIDDEN');
  });

  it('anula una pendiente y no anula dos veces', () => {
    const creada = cuerpoDe<{ id: string }>(pedir('POST', '/referrals', medica, valida));
    const anulada = pedir('PATCH', `/referrals/${creada.id}/cancel`, medica);
    expect(cuerpoDe<{ status: string }>(anulada).status).toBe('CANCELLED');
    const otraVez = pedir('PATCH', `/referrals/${creada.id}/cancel`, medica);
    expect(estado(otraVez)).toBe(422);
    expect(motivo(otraVez)).toBe('REFERRAL_ALREADY_CLOSED');
  });

  it('GET /referrals/me devuelve las propias de la persona, como arreglo', () => {
    const r = pedir('GET', '/referrals/me', paciente);
    expect(Array.isArray(cuerpoDe(r))).toBe(true);
  });
});
