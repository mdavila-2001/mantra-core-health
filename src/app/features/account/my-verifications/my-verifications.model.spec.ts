import type { InsurerRequest } from '../../../core/data-access/insurance/practitioner-insurer-requests.types';
import type {
  OwnPractitionerProfile,
  PractitionerAffiliation,
} from '../../../core/data-access/profiles/profiles.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import {
  buildRoadmap,
  buildThreads,
  combineStates,
  insurerThread,
  institutionThread,
} from './my-verifications.model';

const concepto = (id: string, code: string) =>
  [id, { conceptId: id, code, display: code, codeSystemVersionId: 'v1' }] as const;

const etiquetas: ConceptLabels = new Map([
  concepto('c-verified', 'VERIFIED'),
  concepto('c-pending', 'PRACT_VERIF_PENDING'),
  concepto('c-auth-active', 'AUTH_ACTIVE'),
  concepto('c-auth-pending', 'AUTH_PENDING'),
  concepto('c-auth-rejected', 'AUTH_REJECTED'),
  concepto('c-cred-verified', 'CRED_VERIFIED'),
  concepto('c-cred-rejected', 'CRED_REJECTED'),
  concepto('c-spec-rejected', 'SPECIALTY_REJECTED'),
]);

function afiliacion(over: Partial<PractitionerAffiliation>): PractitionerAffiliation {
  return {
    id: 'af-1',
    practitionerProfileId: 'p-1',
    organizationName: 'Clínica Foianini',
    roleTitle: null,
    practiceSiteId: 'site-1',
    affiliationTypeConceptId: null,
    startDate: new Date('2026-10-01'),
    endDate: null,
    current: true,
    status: 'PENDING',
    statusKind: 'pendiente',
    decisionReasonText: null,
    createdAt: new Date('2026-10-20T10:00:00Z'),
    ...over,
  };
}

function solicitud(over: Partial<InsurerRequest>): InsurerRequest {
  return {
    id: 'ir-1',
    carrierId: 'c-1',
    carrierName: 'La Vitalicia',
    status: 'PENDING',
    decisionReasonText: null,
    createdAt: new Date('2026-10-21T10:00:00Z'),
    decidedAt: null,
    ...over,
  };
}

function perfil(over: Partial<OwnPractitionerProfile> = {}): OwnPractitionerProfile {
  return {
    verificationStatusConceptId: 'c-pending',
    licenses: [{ id: 'l-1', stateConceptId: 'c-auth-active' }],
    credentials: [],
    specialties: [],
    affiliations: [],
    ...over,
  } as unknown as OwnPractitionerProfile;
}

describe('combineStates', () => {
  it('un rechazo manda, después lo pendiente, y verificado sólo si está todo', () => {
    expect(combineStates([])).toBe('not-started');
    expect(combineStates(['approved', 'rejected', 'pending'])).toBe('rejected');
    expect(combineStates(['approved', 'pending'])).toBe('pending');
    expect(combineStates(['approved', 'approved'])).toBe('approved');
  });
});

describe('buildRoadmap', () => {
  it('ordena los tramos: primero lo que habilita a atender, después dónde y con quién', () => {
    const pasos = buildRoadmap(perfil(), etiquetas, []);
    expect(pasos.map((p) => p.key)).toEqual([
      'account',
      'profile',
      'licenses',
      'credentials',
      'specialties',
      'institutions',
      'insurers',
    ]);
  });

  it('lee el estado del perfil y de la matrícula por el código del concepto', () => {
    const pasos = buildRoadmap(
      perfil({
        licenses: [
          { id: 'l-1', stateConceptId: 'c-auth-active' },
          { id: 'l-2', stateConceptId: 'c-auth-rejected' },
        ],
      } as unknown as Partial<OwnPractitionerProfile>),
      etiquetas,
      [],
    );
    const de = (k: string) => pasos.find((p) => p.key === k)!;
    expect(de('profile').state).toBe('pending');
    expect(de('profile').action?.route).toBe('/onboarding');
    expect(de('licenses').state).toBe('rejected');
    expect(de('licenses').detail).toContain('1 de 2');
  });

  it('las instituciones cuentan sólo los pedidos que alguien puede confirmar', () => {
    const pasos = buildRoadmap(
      perfil({
        affiliations: [
          afiliacion({ id: 'a', statusKind: 'aprobado' }),
          afiliacion({ id: 'b', statusKind: 'pendiente' }),
          afiliacion({ id: 'c', statusKind: 'declarado' }),
          afiliacion({ id: 'd', practiceSiteId: null, statusKind: 'declarado' }),
        ],
      }),
      etiquetas,
      [],
    );
    const inst = pasos.find((p) => p.key === 'institutions')!;
    expect(inst.state).toBe('pending');
    expect(inst.detail).toContain('1 de 2');
  });

  it('si no se pudieron leer las aseguradoras, lo dice en vez de mostrar «sin cargar»', () => {
    const seguros = buildRoadmap(perfil(), etiquetas, null).find((p) => p.key === 'insurers')!;
    expect(seguros.state).toBe('unknown');
    expect(seguros.detail).toContain('No pudimos leer');
  });

  it('un título rechazado dice «Rechazado» aunque tenga fecha de revisión (verifiedAt)', () => {
    // La API escribe `verifiedAt` también al RECHAZAR: el estado sale del
    // concepto, como en «Mi perfil», nunca de la fecha.
    const pasos = buildRoadmap(
      perfil({
        credentials: [
          { id: 'c1', stateConceptId: 'c-cred-rejected', verifiedAt: new Date('2026-10-01') },
          { id: 'c2', stateConceptId: 'c-cred-verified', verifiedAt: new Date('2026-10-01') },
        ],
      } as unknown as Partial<OwnPractitionerProfile>),
      etiquetas,
      [],
    );
    const titulos = pasos.find((p) => p.key === 'credentials')!;
    expect(titulos.state).toBe('rejected');
    expect(titulos.detail).toContain('1 de 2');
  });

  it('un título vencido es «Vencido» aunque se haya verificado', () => {
    const pasos = buildRoadmap(
      perfil({
        credentials: [
          { id: 'c1', stateConceptId: 'c-cred-verified', expiryDate: new Date('2026-01-01') },
        ],
      } as unknown as Partial<OwnPractitionerProfile>),
      etiquetas,
      [],
      new Date('2026-10-28'),
    );
    expect(pasos.find((p) => p.key === 'credentials')!.state).toBe('expired');
  });

  it('una especialidad rechazada dice «Rechazado», no «Pendiente»', () => {
    const pasos = buildRoadmap(
      perfil({
        specialties: [{ id: 's1', verificationStatusConceptId: 'c-spec-rejected', verified: false }],
      } as unknown as Partial<OwnPractitionerProfile>),
      etiquetas,
      [],
    );
    expect(pasos.find((p) => p.key === 'specialties')!.state).toBe('rejected');
  });

  it('las aseguradoras cuentan sólo la última solicitud de cada una', () => {
    const seguros = buildRoadmap(perfil(), etiquetas, [
      solicitud({ id: 'vieja', status: 'REJECTED', createdAt: new Date('2026-10-01') }),
      solicitud({ id: 'nueva', status: 'APPROVED', createdAt: new Date('2026-10-20') }),
    ]).find((p) => p.key === 'insurers')!;
    expect(seguros.state).toBe('approved');
    expect(seguros.detail).toContain('1 de 1');
  });

  it('una solicitud retirada no cuenta como pendiente', () => {
    const seguros = buildRoadmap(perfil(), etiquetas, [solicitud({ status: 'WITHDRAWN' })]).find(
      (p) => p.key === 'insurers',
    )!;
    expect(seguros.state).toBe('not-started');
  });
});

describe('la bandeja como chat', () => {
  it('un vínculo aprobado lo cuenta la plataforma con el sello, sin poner palabras en boca de la institución', () => {
    const hilo = institutionThread(afiliacion({ statusKind: 'aprobado', roleTitle: 'Cardióloga' }));
    expect(hilo.messages[0]).toMatchObject({ speaker: 'me', ticks: 'answered' });
    expect(hilo.messages[0]!.text).toContain('como Cardióloga');
    expect(hilo.messages[1]).toMatchObject({ speaker: 'system', seal: 'approved', at: null });
    expect(hilo.messages[1]!.text).toContain('Clínica Foianini confirmó');
    expect(hilo.messages).toHaveLength(2);
    expect(hilo.stateLabel).toBe('Confirmado');
  });

  it('un rechazo: el aviso es de la plataforma y el motivo, en la voz de quien lo escribió', () => {
    const hilo = insurerThread([
      solicitud({
        status: 'REJECTED',
        decisionReasonText: '  Sin convenio vigente ',
        decidedAt: new Date('2026-10-22T10:00:00Z'),
      }),
    ]);
    expect(hilo.messages[1]).toMatchObject({ speaker: 'system', seal: 'rejected' });
    expect(hilo.messages[2]).toEqual({
      speaker: 'them',
      text: '«Sin convenio vigente»',
      at: new Date('2026-10-22T10:00:00Z'),
    });
    expect(hilo.canRequestAgain).toBe(true);
    expect(hilo.canWithdraw).toBe(false);
  });

  it('un rechazo sin motivo no inventa una burbuja de la otra parte', () => {
    const hilo = insurerThread([solicitud({ status: 'REJECTED', decidedAt: new Date() })]);
    expect(hilo.messages.some((m) => m.speaker === 'them')).toBe(false);
  });

  it('volver a pedir no borra la historia: el rechazo y su motivo siguen en el hilo', () => {
    const hilo = insurerThread([
      solicitud({ id: 'ir-2', createdAt: new Date('2026-10-25T10:00:00Z') }),
      solicitud({
        id: 'ir-1',
        status: 'REJECTED',
        decisionReasonText: 'Sin convenio vigente',
        createdAt: new Date('2026-10-21T10:00:00Z'),
        decidedAt: new Date('2026-10-22T10:00:00Z'),
      }),
    ]);
    expect(hilo.messages.map((m) => m.speaker)).toEqual(['me', 'system', 'them', 'me', 'system']);
    expect(hilo.messages[2]!.text).toBe('«Sin convenio vigente»');
    expect(hilo).toMatchObject({
      id: 'ins-c-1',
      requestId: 'ir-2',
      state: 'pending',
      canWithdraw: true,
    });
  });

  it('un retiro queda como mensaje propio con su hora', () => {
    const hilo = insurerThread([
      solicitud({ status: 'WITHDRAWN', decidedAt: new Date('2026-10-23T09:00:00Z') }),
    ]);
    expect(hilo.messages[1]).toEqual({
      speaker: 'me',
      text: 'Retiré la solicitud.',
      at: new Date('2026-10-23T09:00:00Z'),
    });
    expect(hilo.stateLabel).toBe('Retirada');
    expect(hilo.canRequestAgain).toBe(true);
  });

  it('una pendiente se puede retirar y la plataforma dice que espera', () => {
    const hilo = insurerThread([solicitud({})]);
    expect(hilo.canWithdraw).toBe(true);
    expect(hilo.messages[1]).toMatchObject({ speaker: 'system' });
    expect(hilo.messages[0]!.ticks).toBe('sent');
  });

  it('la bandeja: un hilo por institución y uno por aseguradora, de la novedad más reciente a la más vieja', () => {
    const hilos = buildThreads(
      [
        afiliacion({ id: 'vieja', createdAt: new Date('2026-10-01') }),
        afiliacion({ id: 'sin-sede', practiceSiteId: null, statusKind: 'declarado' }),
      ],
      [
        solicitud({ id: 'nueva', createdAt: new Date('2026-10-25') }),
        solicitud({ id: 'anterior', status: 'REJECTED', createdAt: new Date('2026-10-05') }),
      ],
    );
    expect(hilos.map((h) => h.id)).toEqual(['ins-c-1', 'inst-vieja']);
  });
});
