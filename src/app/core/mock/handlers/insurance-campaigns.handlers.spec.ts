import { HttpHeaders } from '@angular/common/http';

import { PACIENTES } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { isoDia } from '../mock-store';
import { registerInsuranceCampaigns } from './insurance-campaigns.handlers';

interface CampaignView {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly copayBonusPercentage: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly partners: readonly { role: string; type: string; name: string }[];
  readonly [key: string]: unknown;
}

describe('handlers de campañas preventivas de seguros (Tarea 4)', () => {
  const router = new MockRouter();
  registerInsuranceCampaigns(router);

  const owner = buscarUsuario('aseguradora')!;
  const staff = buscarUsuario('aseguradora_staff')!;
  const patient = buscarUsuario('paciente')!;
  const doctor = buscarUsuario('medica')!;
  const superadmin = buscarUsuario('superadmin')!;

  /** Una afiliada de OTRA aseguradora (La Vitalicia), con su propia sesión. */
  const vitaliciaProfile = PACIENTES.find((p) => p.aseguradora === 'La Vitalicia')!;
  const vitaliciaPatient: MockUser = { ...patient, patientProfileId: vitaliciaProfile.id };
  /** Un afiliado sin seguro declarado. */
  const uninsuredProfile = PACIENTES.find((p) => p.aseguradora === undefined)!;
  const uninsuredPatient: MockUser = { ...patient, patientProfileId: uninsuredProfile.id };

  function call<T>(
    method: MockMethod,
    path: string,
    body: unknown,
    user: MockUser | null,
    query = new URLSearchParams(),
  ): T {
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
    }) as T;
  }

  const list = (user: MockUser | null, query?: URLSearchParams) =>
    call<{ items: CampaignView[]; nextCursor: string | null }>(
      'GET',
      '/insurance-campaigns',
      null,
      user,
      query,
    );

  const forPatient = (profileId: string, user: MockUser | null) =>
    call<CampaignView[] | MockReply>(
      'GET',
      `/insurance-campaigns/patient/${profileId}`,
      null,
      user,
    );

  const create = (body: Record<string, unknown>, user: MockUser | null = owner) =>
    call<MockReply>('POST', '/insurance-campaigns', body, user);

  const changeStatus = (id: string, status: string, user: MockUser | null = owner) =>
    call<MockReply | CampaignView>('PATCH', `/insurance-campaigns/${id}/status`, { status }, user);

  const validBody = (code: string, overrides: Record<string, unknown> = {}) => ({
    code,
    title: 'Chequeo de prueba',
    campaignType: 'LABORATORY',
    targetConditionCode: 'I10',
    copayBonusPercentage: 100,
    validFrom: isoDia(0),
    validTo: isoDia(60),
    partners: [
      { role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' },
      { role: 'PROVIDER', type: 'PHARMACY', name: 'Farmacias Aliadas' },
    ],
    activate: false,
    ...overrides,
  });

  const codesOf = (items: readonly { code: string }[]) => items.map((item) => item.code);

  describe('consola de la aseguradora', () => {
    it('lista sólo las campañas de su aseguradora, nunca las de otra (CA-4.4)', () => {
      const codes = codesOf(list(owner).items);

      expect(codes).toEqual(
        expect.arrayContaining([
          'CMP-CARDIO-2026',
          'CMP-DIABETES-2026',
          'CMP-MAMA-2026',
          'CMP-FLU-2025',
        ]),
      );
      expect(codes).not.toContain('CMP-VITALICIA-OSTEO');
    });

    it('no expone qué aseguradora es dueña: es la propia', () => {
      for (const item of list(owner).items) {
        expect(item).not.toHaveProperty('carrierName');
      }
    });

    it('filtra por tipo y por estado', () => {
      const vaccination = list(owner, new URLSearchParams({ type: 'VACCINATION' })).items;
      expect(codesOf(vaccination)).toEqual(['CMP-FLU-2025']);

      const paused = list(owner, new URLSearchParams({ status: 'PAUSED' })).items;
      expect(codesOf(paused)).toEqual(['CMP-MAMA-2026']);
    });

    it('pagina con cursor: la última página no trae cursor', () => {
      const first = list(owner, new URLSearchParams({ limit: '2' }));
      expect(first.items).toHaveLength(2);
      expect(first.nextCursor).not.toBeNull();

      const second = list(owner, new URLSearchParams({ limit: '2', cursor: first.nextCursor! }));
      expect(second.items.length).toBeGreaterThan(0);
      expect(codesOf(second.items)).not.toEqual(expect.arrayContaining(codesOf(first.items)));
    });

    it('una campaña inexistente, o de otra aseguradora, responde 404', () => {
      const missing = call<MockReply>('GET', '/insurance-campaigns/inexistente', null, owner);
      expect(missing.status).toBe(404);
    });
  });

  describe('control de acceso administrativo (CA-4.7)', () => {
    it('un paciente y un médico no pueden crear ni cambiar el estado (403)', () => {
      for (const user of [patient, doctor]) {
        expect(create(validBody('CMP-ACCESO-1'), user).status).toBe(403);
        expect((changeStatus('cualquiera', 'ACTIVE', user) as MockReply).status).toBe(403);
      }
    });

    it('un paciente y un médico tampoco listan la consola', () => {
      for (const user of [patient, doctor]) {
        expect((list(user) as unknown as MockReply).status).toBe(403);
      }
    });

    it('quien no administra la aseguradora (staff) puede leer pero no crear', () => {
      expect(list(staff).items.length).toBeGreaterThan(0);
      expect(create(validBody('CMP-ACCESO-2'), staff).status).toBe(403);
    });

    it('sin sesión no hay acceso', () => {
      expect(create(validBody('CMP-ACCESO-3'), null).status).toBe(403);
    });
  });

  describe('alta y validaciones (CA-4.1, CA-4.6)', () => {
    it('crea y activa la campaña de referencia: queda ACTIVE con sus aliados', () => {
      const reply = create(
        validBody('CMP-CARDIO-E2E', {
          title: 'Chequeo Preventivo Cardiovascular y Perfil Lipídico',
          activate: true,
        }),
      );

      expect(reply.status).toBe(201);
      const created = reply.body as CampaignView;
      expect(created).toMatchObject({
        code: 'CMP-CARDIO-E2E',
        status: 'ACTIVE',
        copayBonusPercentage: 100,
        targetCondition: { code: 'I10' },
      });
      expect(created.partners.map((p) => p.name)).toEqual([
        'Laboratorio Central AloVida',
        'Farmacias Aliadas',
      ]);
      // Aparece en la consola, la más nueva primero.
      expect(codesOf(list(owner).items)[0]).toBe('CMP-CARDIO-E2E');

      changeStatus(created.id, 'EXPIRED');
    });

    it('sin activate nace en borrador', () => {
      const reply = create(validBody('CMP-BORRADOR-1'));
      expect((reply.body as CampaignView).status).toBe('DRAFT');
    });

    it('rechaza fechas invertidas', () => {
      const reply = create(
        validBody('CMP-FECHAS-1', { validFrom: isoDia(10), validTo: isoDia(1) }),
      );
      expect(reply.status).toBe(422);
    });

    it('rechaza un porcentaje fuera de 0..100 y con más de dos decimales', () => {
      for (const copayBonusPercentage of [-1, 101, 50.123, Number.NaN, '100']) {
        expect(
          create(validBody('CMP-PCT-1', { copayBonusPercentage })).status,
          String(copayBonusPercentage),
        ).toBe(422);
      }
      for (const copayBonusPercentage of [0, 100, 33.5]) {
        expect(
          create(
            validBody(`CMP-PCT-${String(copayBonusPercentage).replace('.', '')}`, {
              copayBonusPercentage,
            }),
          ).status,
        ).toBe(201);
      }
    });

    it('rechaza un código repetido en la aseguradora con 409', () => {
      expect(create(validBody('CMP-DUPLICADO-1')).status).toBe(201);
      const duplicated = create(validBody('CMP-DUPLICADO-1'));
      expect(duplicated.status).toBe(409);
      expect(duplicated.body).toMatchObject({ code: 'CONFLICT' });
    });

    it('rechaza un código con formato inválido, sin aliados y un CIE-10 desconocido', () => {
      expect(create(validBody('cmp-minusculas')).status).toBe(422);
      expect(create(validBody('CMP-SIN-ALIADOS', { partners: [] })).status).toBe(422);
      expect(create(validBody('CMP-CIE-1', { targetConditionCode: 'ZZZ9' })).status).toBe(422);
    });

    it('rechaza activar una campaña cuya vigencia ya terminó', () => {
      const reply = create(
        validBody('CMP-VENCIDA-1', { validFrom: isoDia(-30), validTo: isoDia(-1), activate: true }),
      );
      expect(reply.status).toBe(422);
    });
  });

  describe('cambio de estado', () => {
    /** El estado de una campaña, o el código HTTP si la respuesta fue un error. */
    const statusOf = (value: unknown) => (value as { status: unknown }).status;

    it('recorre DRAFT → ACTIVE → PAUSED → ACTIVE → EXPIRED', () => {
      const id = (create(validBody('CMP-CICLO-1')).body as CampaignView).id;

      expect(statusOf(changeStatus(id, 'ACTIVE'))).toBe('ACTIVE');
      expect(statusOf(changeStatus(id, 'PAUSED'))).toBe('PAUSED');
      expect(statusOf(changeStatus(id, 'ACTIVE'))).toBe('ACTIVE');
      expect(statusOf(changeStatus(id, 'EXPIRED'))).toBe('EXPIRED');
    });

    it('una transición fuera de la tabla responde 422', () => {
      const id = (create(validBody('CMP-CICLO-2')).body as CampaignView).id;
      expect((changeStatus(id, 'PAUSED') as MockReply).status).toBe(422);

      changeStatus(id, 'ACTIVE');
      changeStatus(id, 'EXPIRED');
      // EXPIRED es terminal.
      expect((changeStatus(id, 'ACTIVE') as MockReply).status).toBe(422);
    });

    it('repetir el estado actual es idempotente', () => {
      const id = (create(validBody('CMP-CICLO-3', { activate: true })).body as CampaignView).id;
      expect(statusOf(changeStatus(id, 'ACTIVE'))).toBe('ACTIVE');
      changeStatus(id, 'EXPIRED');
    });

    it('no activa una campaña cuya vigencia ya terminó', () => {
      // Un borrador con la vigencia en el pasado se puede guardar, pero no activar.
      const id = (
        create(validBody('CMP-VENCIDA-2', { validFrom: isoDia(-30), validTo: isoDia(-1) }))
          .body as CampaignView
      ).id;

      const reply = changeStatus(id, 'ACTIVE') as MockReply;
      expect(reply.status).toBe(422);
      expect(reply.body).toMatchObject({ code: 'PRECONDITION_FAILED' });
    });

    it('rechaza un estado destino que no es de operador (DRAFT o inventado)', () => {
      const id = (create(validBody('CMP-CICLO-4')).body as CampaignView).id;

      expect((changeStatus(id, 'DRAFT') as MockReply).status).toBe(422);
      expect((changeStatus(id, 'INVENTADO') as MockReply).status).toBe(422);
    });

    it('la aseguradora no alcanza la campaña de otra: responde 404', () => {
      const reply = changeStatus('id-de-otra-aseguradora', 'ACTIVE') as MockReply;
      expect(reply.status).toBe(404);
    });
  });

  describe('lo que ve el afiliado (CA-4.2, CA-4.3, CA-4.4)', () => {
    it('ve la campaña activa y vigente de su aseguradora, con sello y aliados', () => {
      const campaigns = forPatient(patient.patientProfileId!, patient) as CampaignView[];
      const cardio = campaigns.find((item) => item.code === 'CMP-CARDIO-2026')!;

      expect(cardio).toMatchObject({ copayBonusPercentage: 100, carrierName: 'Seguros Andina' });
      expect(cardio.partners).toEqual([
        { role: 'PROVIDER', type: 'LABORATORY', name: 'Laboratorio Central AloVida' },
        { role: 'PROVIDER', type: 'PHARMACY', name: 'Farmacias Aliadas' },
      ]);
    });

    it('nunca ve borradores, pausadas, vencidas ni las de otra aseguradora', () => {
      const codes = codesOf(forPatient(patient.patientProfileId!, patient) as CampaignView[]);

      expect(codes).not.toContain('CMP-DIABETES-2026'); // borrador
      expect(codes).not.toContain('CMP-MAMA-2026'); // pausada
      expect(codes).not.toContain('CMP-FLU-2025'); // ACTIVE pero vencida por fecha
      expect(codes).not.toContain('CMP-VITALICIA-OSTEO'); // de otra aseguradora
    });

    it('una campaña pausada desaparece de su panel y al reanudarla vuelve', () => {
      const id = (create(validBody('CMP-PANEL-1', { activate: true })).body as CampaignView).id;
      const codesNow = () =>
        codesOf(forPatient(patient.patientProfileId!, patient) as CampaignView[]);

      expect(codesNow()).toContain('CMP-PANEL-1');
      changeStatus(id, 'PAUSED');
      expect(codesNow()).not.toContain('CMP-PANEL-1');
      changeStatus(id, 'ACTIVE');
      expect(codesNow()).toContain('CMP-PANEL-1');

      changeStatus(id, 'EXPIRED');
      expect(codesNow()).not.toContain('CMP-PANEL-1');
    });

    it('una campaña que aún no empezó no se muestra', () => {
      const id = (
        create(
          validBody('CMP-FUTURA-1', { validFrom: isoDia(5), validTo: isoDia(30), activate: true }),
        ).body as CampaignView
      ).id;
      expect(
        codesOf(forPatient(patient.patientProfileId!, patient) as CampaignView[]),
      ).not.toContain('CMP-FUTURA-1');
      changeStatus(id, 'EXPIRED');
    });

    it('un afiliado de otra aseguradora ve sólo las de la suya', () => {
      const codes = codesOf(forPatient(vitaliciaProfile.id, vitaliciaPatient) as CampaignView[]);

      expect(codes).toEqual(['CMP-VITALICIA-OSTEO']);
    });

    it('sin seguro declarado no hay campañas', () => {
      expect(forPatient(uninsuredProfile.id, uninsuredPatient)).toEqual([]);
    });

    it('la respuesta no filtra ningún dato interno', () => {
      const [first] = forPatient(patient.patientProfileId!, patient) as CampaignView[];

      expect(Object.keys(first!).sort()).toEqual(
        [
          'campaignType',
          'carrierName',
          'code',
          'copayBonusPercentage',
          'description',
          'id',
          'partners',
          'targetCondition',
          'title',
          'validFrom',
          'validTo',
        ].sort(),
      );
      expect(Object.keys(first!.partners[0]!).sort()).toEqual(['name', 'role', 'type']);
    });
  });

  describe('aislamiento entre afiliados (CA-4.5)', () => {
    it('pedir con el perfil de otro afiliado responde 403, no una lista vacía', () => {
      const reply = forPatient(vitaliciaProfile.id, patient) as MockReply;

      expect(reply.status).toBe(403);
      expect(reply.body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('una sesión sin perfil de paciente también recibe 403', () => {
      expect((forPatient(patient.patientProfileId!, doctor) as MockReply).status).toBe(403);
      expect((forPatient(patient.patientProfileId!, null) as MockReply).status).toBe(403);
    });

    it('la plataforma sí puede consultar el perfil de un afiliado', () => {
      expect(Array.isArray(forPatient(patient.patientProfileId!, superadmin))).toBe(true);
    });
  });
});
