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
  roadmapStepper,
} from './my-verifications.model';

const concepto = (id: string, code: string) =>
  [id, { conceptId: id, code, display: code, codeSystemVersionId: 'v1' }] as const;

const etiquetas: ConceptLabels = new Map([
  concepto('c-verified', 'VERIFIED'),
  concepto('c-pending', 'PRACT_VERIF_PENDING'),
  concepto('c-auth-active', 'AUTH_ACTIVE'),
  concepto('c-auth-pending', 'AUTH_PENDING'),
  concepto('c-auth-rejected', 'AUTH_REJECTED'),
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

  it('una solicitud retirada no cuenta como pendiente', () => {
    const seguros = buildRoadmap(perfil(), etiquetas, [solicitud({ status: 'WITHDRAWN' })]).find(
      (p) => p.key === 'insurers',
    )!;
    expect(seguros.state).toBe('not-started');
  });
});

describe('roadmapStepper', () => {
  it('el tramo actual es el primero obligatorio sin verificar', () => {
    const indicador = roadmapStepper(buildRoadmap(perfil(), etiquetas, []));
    expect(indicador[0]!.status).toBe('complete');
    expect(indicador[1]!.status).toBe('current');
    expect(indicador.filter((s) => s.status === 'current')).toHaveLength(1);
  });
});

describe('la bandeja como chat', () => {
  it('un vínculo aprobado responde con el sello oficial y doble marca', () => {
    const hilo = institutionThread(afiliacion({ statusKind: 'aprobado', roleTitle: 'Cardióloga' }));
    expect(hilo.messages[0]).toMatchObject({ speaker: 'me', ticks: 'answered' });
    expect(hilo.messages[0]!.text).toContain('como Cardióloga');
    expect(hilo.messages[1]).toMatchObject({ speaker: 'them', seal: 'approved', at: null });
    expect(hilo.stateLabel).toBe('Confirmado');
  });

  it('un rechazo trae el motivo que escribió la otra parte', () => {
    const hilo = insurerThread(
      solicitud({
        status: 'REJECTED',
        decisionReasonText: 'Sin convenio vigente',
        decidedAt: new Date('2026-10-22T10:00:00Z'),
      }),
    );
    expect(hilo.messages[1]!.text).toContain('«Sin convenio vigente»');
    expect(hilo.messages[1]!.at).toEqual(new Date('2026-10-22T10:00:00Z'));
    expect(hilo.canRequestAgain).toBe(true);
    expect(hilo.canWithdraw).toBe(false);
  });

  it('una pendiente se puede retirar y la plataforma dice que espera', () => {
    const hilo = insurerThread(solicitud({}));
    expect(hilo.canWithdraw).toBe(true);
    expect(hilo.messages[1]).toMatchObject({ speaker: 'system' });
    expect(hilo.messages[0]!.ticks).toBe('sent');
  });

  it('la bandeja junta instituciones y aseguradoras, de la novedad más reciente a la más vieja', () => {
    const hilos = buildThreads(
      [
        afiliacion({ id: 'vieja', createdAt: new Date('2026-10-01') }),
        afiliacion({ id: 'sin-sede', practiceSiteId: null, statusKind: 'declarado' }),
      ],
      [solicitud({ id: 'nueva', createdAt: new Date('2026-10-25') })],
    );
    expect(hilos.map((h) => h.id)).toEqual(['ins-nueva', 'inst-vieja']);
  });
});
