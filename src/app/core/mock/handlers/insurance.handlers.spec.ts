import { HttpHeaders } from '@angular/common/http';

import { registrarSeguros } from './insurance.handlers';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { MEDICAL_FEE_SCHEDULE } from '../fixtures/fee-schedules.generated';
import { uuid } from '../mock-store';
import { PROFESIONALES } from '../fixtures/personas';

interface DetailWire {
  readonly id: string;
  readonly canAdminister: boolean;
  readonly products: readonly {
    readonly id: string;
    readonly plans: readonly {
      readonly id: string;
      readonly planCode: string;
      readonly benefits: readonly {
        readonly id: string;
        readonly coveragePercent: string | null;
        readonly copayAmount: string | null;
        readonly requiresPriorAuthorization: boolean;
        readonly approvalRules: {
          readonly requiredDocuments: readonly string[];
          readonly exclusionNotes: string | null;
        };
      }[];
    }[];
  }[];
}

describe('handlers del catálogo administrativo de seguros', () => {
  const router = new MockRouter();
  const owner = buscarUsuario('aseguradora')!;
  const staff = buscarUsuario('aseguradora_staff')!;

  registrarSeguros(router);

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T;
  }

  function detail(user = owner): DetailWire {
    const directory = call<{ items: readonly { id: string }[] }>(
      'GET',
      '/insurance-carriers',
      null,
      user,
    );
    return call<DetailWire>('GET', `/insurance-carriers/${directory.items[0]!.id}`, null, user);
  }

  it('conserva plan, cobertura, importes y reglas entre lecturas', () => {
    const initial = detail();
    const productId = initial.products[0]!.id;
    const planReply = call<MockReply>(
      'POST',
      `/insurance-products/${productId}/plans`,
      { planCode: 'MOCK-PERSISTE', name: 'Plan persistente', effectiveFrom: '2026-10-01' },
      owner,
    );
    const planId = (planReply.body as { id: string }).id;
    const benefitReply = call<MockReply>(
      'POST',
      `/insurance-plans/${planId}/benefits`,
      { benefitCategoryConceptId: 'category-1', coveragePercent: '80.50', copayAmount: '25.00' },
      owner,
    );
    const benefitId = (benefitReply.body as { id: string }).id;

    call(
      'PUT',
      `/insurance-plans/${planId}/benefits/${benefitId}`,
      {
        coveragePercent: '72.25',
        copayAmount: null,
        deductibleAmount: '100.00',
        annualLimitAmount: null,
      },
      owner,
    );
    call(
      'PUT',
      `/insurance-plans/${planId}/benefits/${benefitId}/rules`,
      {
        requiresPriorAuthorization: true,
        requiredDocuments: ['ORDEN_MEDICA'],
        exclusionNotes: 'Sin experimentales',
      },
      owner,
    );

    const persisted = detail();
    const plan = persisted.products[0]!.plans.find((item) => item.id === planId)!;
    const benefit = plan.benefits.find((item) => item.id === benefitId)!;
    expect(plan.planCode).toBe('MOCK-PERSISTE');
    expect(benefit.coveragePercent).toBe('72.25');
    expect(benefit.copayAmount).toBeNull();
    expect(benefit.approvalRules.requiredDocuments).toEqual(['ORDEN_MEDICA']);
    expect(benefit.approvalRules.exclusionNotes).toBe('Sin experimentales');
  });

  it('corrige los datos generales del producto seguro y lo da de baja', () => {
    const productId = detail().products[0]!.id;
    const planReply = call<MockReply>(
      'POST',
      `/insurance-products/${productId}/plans`,
      { planCode: 'MOCK-EDITA', name: 'Plan a editar', effectiveFrom: '2026-10-01' },
      owner,
    );
    const planId = (planReply.body as { id: string }).id;

    call('PUT', `/insurance-plans/${planId}`, {
      planCode: 'MOCK-EDITADO',
      name: 'Plan editado',
      effectiveFrom: '2026-11-01',
      effectiveTo: null,
    }, owner);
    const edited = detail().products[0]!.plans.find((item) => item.id === planId) as unknown as {
      planCode: string;
      name: string;
      effectiveFrom: string | null;
    };
    expect(edited).toMatchObject({
      planCode: 'MOCK-EDITADO',
      name: 'Plan editado',
      effectiveFrom: '2026-11-01',
    });

    const deleted = call<MockReply>('DELETE', `/insurance-plans/${planId}`, null, owner);
    expect(deleted.status).toBe(204);
    expect(detail().products[0]!.plans.some((item) => item.id === planId)).toBe(false);
  });

  it('nombra el servicio de la cláusula con la entrada del arancel', () => {
    const plan = detail().products[0]!.plans[0]!;
    const procedure = MEDICAL_FEE_SCHEDULE[0]!;
    const reply = call<MockReply>(
      'POST',
      `/insurance-plans/${plan.id}/benefits`,
      {
        benefitCategoryConceptId: 'category-1',
        serviceConceptId: uuid(`nomenclador-${procedure.code}`),
        coveragePercent: '90',
      },
      owner,
    );
    const benefitId = (reply.body as { id: string }).id;

    const benefit = detail()
      .products[0]!.plans[0]!.benefits.find((item) => item.id === benefitId) as unknown as {
      service: { code: string; display: string } | null;
    };
    expect(benefit.service).toEqual({ code: procedure.code, display: procedure.display });
  });

  it('rechaza que el staff edite o elimine un producto seguro', () => {
    const planId = detail(staff).products[0]!.plans[0]!.id;
    expect(
      call<MockReply>('PUT', `/insurance-plans/${planId}`, { planCode: 'X', name: 'X' }, staff)
        .status,
    ).toBe(403);
    expect(call<MockReply>('DELETE', `/insurance-plans/${planId}`, null, staff).status).toBe(403);
  });

  it('da al staff la misma lectura sin acciones y rechaza su escritura', () => {
    const catalog = detail(staff);
    expect(catalog.canAdminister).toBe(false);

    const response = call<MockReply>(
      'POST',
      `/insurance-products/${catalog.products[0]!.id}/plans`,
      { planCode: 'NO', name: 'No autorizado' },
      staff,
    );
    expect(response.status).toBe(403);
  });
});

/**
 * El estudio duplicado en el detalle de una solicitud (antiduplicación de
 * estudios, v4.2.17, T-26, subtarea 3.2): la línea «Perfil lipídico» de
 * `CLM-2026-0142` es el único caso sembrado, para no tocar el conteo de
 * órdenes que `patient-coverage-copays.spec.ts` exige exacto.
 */
describe('handlers de solicitudes de seguro · antiduplicación de estudios', () => {
  const router = new MockRouter();
  const usuario = buscarUsuario('admin')!;

  registrarSeguros(router);

  function call<T>(method: MockMethod, path: string, body: unknown = null): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: usuario,
    }) as T;
  }

  interface LineaWire {
    readonly service: { readonly display: string };
    readonly duplicateStudy: {
      readonly previousDiagnosticReportId: string;
      readonly studyName: string;
      readonly daysAgo: number;
      readonly providerName: string;
      readonly justification: string | null;
      readonly reused: boolean;
    } | null;
  }

  function detalleDe(claimId: string): { readonly lines: readonly LineaWire[] } {
    const lista = call<{ items: readonly { id: string; claimIdentifier: string }[] }>(
      'GET',
      '/insurance-claims',
    );
    const id = lista.items.find((item) => item.claimIdentifier === claimId)!.id;
    return call<{ lines: readonly LineaWire[] }>('GET', `/insurance-claims/${id}`);
  }

  it('la línea "Perfil lipídico" de CLM-2026-0142 trae el estudio duplicado', () => {
    const detalle = detalleDe('CLM-2026-0142');
    const linea = detalle.lines.find((l) => l.service.display === 'Perfil lipídico');
    expect(linea?.duplicateStudy).not.toBeNull();
    expect(linea?.duplicateStudy?.studyName).toBe('Perfil lipídico');
    expect(linea?.duplicateStudy?.reused).toBe(false);
    expect(linea?.duplicateStudy?.justification).not.toBeNull();
  });

  it('el resto de las líneas de esa misma solicitud no trae estudio duplicado', () => {
    const detalle = detalleDe('CLM-2026-0142');
    const otras = detalle.lines.filter((l) => l.service.display !== 'Perfil lipídico');
    expect(otras.length).toBeGreaterThan(0);
    expect(otras.every((l) => l.duplicateStudy === null)).toBe(true);
  });

  it('otra solicitud no trae ningún estudio duplicado', () => {
    const detalle = detalleDe('CLM-2026-0158');
    expect(detalle.lines.every((l) => l.duplicateStudy === null)).toBe(true);
  });
});

/**
 * `GET /practitioners/:id/insurance-carriers` — con qué seguros trabaja un
 * profesional, para su ficha. El dato sale de las redes que publican Alianza
 * Seguros y Nacional Seguros (`insurer-network.generated.ts`); estas pruebas
 * fijan que el doble lo devuelve **tal cual**, sin agregar ni perder planes.
 */
describe('handlers de seguros · aseguradoras de un profesional', () => {
  const router = new MockRouter();
  const patient = buscarUsuario('paciente')!;

  registrarSeguros(router);

  interface CarriersWire {
    readonly items: readonly {
      readonly carrierId: string;
      readonly carrierName: string;
      readonly networks: readonly { readonly id: string; readonly name: string }[];
    }[];
  }

  function get<T>(path: string): T {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: patient,
    }) as T;
  }

  const fromNetwork = PROFESIONALES.filter((p) => p.origen === 'RED_ASEGURADORA');

  it('devuelve cada aseguradora de la red con sus planes, por nombre', () => {
    const both = fromNetwork.find((p) => (p.insurerNetworks?.length ?? 0) === 2)!;

    const body = get<CarriersWire>(`/practitioners/${both.id}/insurance-carriers`);

    expect(body.items.map((c) => c.carrierName)).toEqual(['Alianza Seguros', 'Nacional Seguros']);
    for (const carrier of body.items) {
      const source = both.insurerNetworks!.find((n) => n.insurer === carrier.carrierName)!;
      expect(carrier.networks.map((n) => n.name)).toEqual(source.plans);
    }
  });

  it('no agrega ni pierde ningún plan en los médicos de la red', () => {
    expect(fromNetwork.length).toBeGreaterThan(700);

    for (const practitioner of fromNetwork) {
      const body = get<CarriersWire>(`/practitioners/${practitioner.id}/insurance-carriers`);
      const published = [...practitioner.insurerNetworks!]
        .map((n) => `${n.insurer}: ${n.plans.join(', ')}`)
        .sort();
      const served = body.items.map((c) => `${c.carrierName}: ${c.networks.map((n) => n.name).join(', ')}`).sort();
      expect(served).toEqual(published);
    }
  });

  it('la aseguradora que ya está en el catálogo conserva su id', () => {
    const catalog = get<{ carriers: readonly { id: string; name: string }[] }>(
      '/insurance-carrier-catalog',
    );
    const alianzaId = catalog.carriers.find((c) => c.name === 'Alianza Seguros')!.id;
    const withAlianza = fromNetwork.find((p) =>
      p.insurerNetworks!.some((n) => n.insurer === 'Alianza Seguros'),
    )!;

    const body = get<CarriersWire>(`/practitioners/${withAlianza.id}/insurance-carriers`);

    expect(body.items.find((c) => c.carrierName === 'Alianza Seguros')!.carrierId).toBe(alianzaId);
  });

  it('un profesional que ninguna aseguradora incluyó en su red devuelve la lista vacía', () => {
    const outside = PROFESIONALES.find((p) => p.insurerNetworks === undefined)!;

    expect(get<CarriersWire>(`/practitioners/${outside.id}/insurance-carriers`).items).toEqual([]);
  });

  it('un profesional inexistente es 404', () => {
    const reply = get<{ status: number }>('/practitioners/no-existe/insurance-carriers');

    expect(reply.status).toBe(404);
  });
});
