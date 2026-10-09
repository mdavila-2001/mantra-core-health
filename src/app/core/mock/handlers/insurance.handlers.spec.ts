import { HttpHeaders } from '@angular/common/http';

import { INSURER_NETWORK_PRACTITIONERS } from '../fixtures/insurer-network.generated';
import { MEDICA } from '../fixtures/people';
import { catalogoAdministrable, registrarSeguros } from './insurance.handlers';
import { vitrinas } from '../fixtures/community';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { MEDICAL_FEE_SCHEDULE } from '../fixtures/fee-schedules.generated';
import { uuid } from '../mock-store';
import { PROFESIONALES } from '../fixtures/people';

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
 * Desglose conciliado de liquidación (Tarea 3 · H8, CA-3.1/CA-3.3). Antes de
 * esta corrección, `totalPatientAmount` se calculaba como `billed - approved`
 * a nivel de cabecera, contando el importe rechazado dos veces.
 */
describe('handlers de solicitudes de seguro · desglose de liquidación (Tarea 3 · H8)', () => {
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

  interface DetalleWire {
    readonly settlement: {
      readonly availability: string;
      readonly totalBilledAmount: string | null;
      readonly totalApprovedAmount: string | null;
      readonly totalPatientAmount: string | null;
      readonly totalDeniedAmount: string | null;
      readonly reconciled: boolean;
      readonly exclusions: readonly { readonly policyClauseReference: string }[];
    };
    readonly eob: { readonly id: string } | null;
  }

  function detalleDe(claimId: string): DetalleWire {
    const lista = call<{ items: readonly { id: string; claimIdentifier: string }[] }>(
      'GET',
      '/insurance-claims',
    );
    const id = lista.items.find((item) => item.claimIdentifier === claimId)!.id;
    return call<DetalleWire>('GET', `/insurance-claims/${id}`);
  }

  it('CLM-2026-0177 concilia: 300 = 150 (cubierto) + 30 (copago) + 120 (rechazado)', () => {
    const { settlement } = detalleDe('CLM-2026-0177');
    expect(settlement.availability).toBe('AVAILABLE');
    expect(settlement.reconciled).toBe(true);
    expect(settlement).toMatchObject({
      totalBilledAmount: '300.00',
      totalApprovedAmount: '150.00',
      totalPatientAmount: '30.00',
      totalDeniedAmount: '120.00',
    });
  });

  it('CLM-2026-0163 concilia: 890 = 0 + 0 + 890 (todo rechazado)', () => {
    const { settlement } = detalleDe('CLM-2026-0163');
    expect(settlement.reconciled).toBe(true);
    expect(settlement).toMatchObject({
      totalBilledAmount: '890.00',
      totalApprovedAmount: '0.00',
      totalPatientAmount: '0.00',
      totalDeniedAmount: '890.00',
    });
  });

  it('CLM-2026-0183 tiene una exclusión sin cláusula y queda UNDER_REVIEW, sin importes', () => {
    const { settlement, eob } = detalleDe('CLM-2026-0183');
    expect(settlement.availability).toBe('UNDER_REVIEW');
    expect(settlement.reconciled).toBe(false);
    expect(settlement.totalApprovedAmount).toBeNull();
    expect(settlement.exclusions).toEqual([]);
    expect(eob).not.toBeNull();
  });

  it('una solicitud sin dictamen queda PENDING_PUBLICATION, sin EOB', () => {
    const { settlement, eob } = detalleDe('CLM-2026-0158');
    expect(settlement.availability).toBe('PENDING_PUBLICATION');
    expect(eob).toBeNull();
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

describe('handlers de seguros · con qué aseguradoras trabaja un profesional', () => {
  const router = new MockRouter();
  const medica = buscarUsuario('medica')!;

  registrarSeguros(router);

  interface Pagina {
    readonly items: readonly { readonly carrierId: string; readonly carrierName: string }[];
    readonly count: number;
  }

  function redes(profileId: string): Pagina {
    const path = `/practitioners/${profileId}/insurance-networks`;
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: medica,
    }) as Pagina;
  }

  it('la médica de la demo trabaja con tres aseguradoras del catálogo', () => {
    const pagina = redes(MEDICA.id);

    expect(pagina.count).toBe(3);
    expect(pagina.items.map((red) => red.carrierName)).toEqual([
      'Seguros Andina',
      'Alianza Seguros',
      'Caja Nacional de Salud',
    ]);
  });

  it('un médico de la red importada trae las aseguradoras que lo publican', () => {
    const importado = INSURER_NETWORK_PRACTITIONERS[0]!;
    const pagina = redes(uuid(`hpid-${importado.id}`));

    expect(pagina.items.map((red) => red.carrierName)).toEqual(
      importado.networks.map((red) => red.insurer),
    );
  });

  it('quien no figura en ninguna red recibe una lista vacía, no un error', () => {
    expect(redes('00000000-0000-0000-0000-000000000000')).toEqual({ items: [], count: 0 });
  });
});

describe('handlers de seguros · el mercado de una aseguradora del directorio', () => {
  const router = new MockRouter();
  const paciente = buscarUsuario('paciente')!;

  registrarSeguros(router);

  interface Mercado {
    readonly carrier: {
      readonly id: string;
      readonly carrierCode: string;
      readonly legalName: string;
      readonly canAdminister: boolean;
      readonly products: readonly {
        readonly name: string;
        readonly productType: { readonly code: string };
        readonly plans: readonly {
          readonly id: string;
          readonly name: string;
          readonly monthlyPremiumAmount: string | null;
          readonly benefits: readonly { readonly id: string }[];
        }[];
      }[];
    } | null;
    readonly brokers: readonly { readonly id: string; readonly chatSlug: string | null }[];
  }

  function mercado(slug: string): Mercado {
    const path = `/insurance-marketplace/insurers/${slug}`;
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: paciente,
    }) as Mercado;
  }

  const fichas = vitrinas.todos().filter((vitrina) => vitrina.kind === 'INSURER');
  const planes = (m: Mercado) => m.carrier?.products.flatMap((producto) => producto.plans) ?? [];

  it('el directorio tiene las 21 aseguradoras: las dos de la maqueta y las 19 reales', () => {
    expect(fichas).toHaveLength(21);
  });

  it.each(fichas.map((ficha) => [ficha.slug]))(
    '%s abre con catálogo, planes con prima y al menos un broker',
    (slug) => {
      const respuesta = mercado(slug);

      expect(respuesta.carrier).not.toBeNull();
      expect(respuesta.carrier!.canAdminister).toBe(false);
      expect(planes(respuesta).length).toBeGreaterThanOrEqual(1);
      for (const plan of planes(respuesta)) {
        expect(plan.benefits.length).toBeGreaterThan(0);
      }
      expect(respuesta.brokers.length).toBeGreaterThanOrEqual(1);
    },
  );

  it('fuera de Alianza Plata —sin prima a propósito— ningún plan queda «a cotizar»', () => {
    // Seguros Andina queda fuera: su catálogo es el que edita la aseguradora
    // en su consola, y un plan dado de alta ahí puede no declarar prima.
    const sinPrima = fichas
      .filter((ficha) => ficha.slug !== 'seguros-andina')
      .flatMap((ficha) => planes(mercado(ficha.slug)))
      .filter((plan) => plan.monthlyPremiumAmount === null)
      .map((plan) => plan.name);

    expect(sinPrima).toEqual(['Plan Plata']);
  });

  it('ningún id de plan ni de cláusula se repite entre aseguradoras', () => {
    const catalogos = fichas.map((ficha) => mercado(ficha.slug).carrier!);
    // La Vitalicia tiene dos fichas y un solo catálogo: se cuenta una vez.
    const unicos = [...new Map(catalogos.map((carrier) => [carrier.id, carrier])).values()];
    const idsDePlan = unicos.flatMap((carrier) =>
      carrier.products.flatMap((producto) => producto.plans.map((plan) => plan.id)),
    );
    const idsDeClausula = unicos.flatMap((carrier) =>
      carrier.products.flatMap((producto) =>
        producto.plans.flatMap((plan) => plan.benefits.map((b) => b.id)),
      ),
    );

    expect(new Set(idsDePlan).size).toBe(idsDePlan.length);
    expect(new Set(idsDeClausula).size).toBe(idsDeClausula.length);
  });

  it('la La Vitalicia real abre el mismo catálogo sembrado que la de la maqueta', () => {
    const real = mercado('la-vitalicia-seguros-y-reaseguros-de-vida-s-a');
    const maqueta = mercado('la-vitalicia');

    expect(real.carrier!.carrierCode).toBe('VITALICIA');
    expect(real.carrier!.id).toBe(maqueta.carrier!.id);
    expect(planes(real).map((plan) => plan.name)).toEqual(['Salud Total', 'Salud Básica']);
  });

  it('Alianza Vida abre el catálogo de Alianza Seguros, con su broker', () => {
    const alianza = mercado('alianza-vida-seguros-y-reaseguros-s-a');

    expect(alianza.carrier!.carrierCode).toBe('ALIANZA');
    expect(alianza.brokers.map((broker) => broker.chatSlug)).toEqual(['broker-monica-aguirre']);
  });

  it('Seguros Andina sigue leyendo el catálogo que administra la aseguradora', () => {
    const andina = mercado('seguros-andina');

    expect(andina.carrier!.id).toBe(uuid('carrier-andina'));
    // Lo que la aseguradora corrigió en su consola —los casos de arriba lo
    // hacen— es lo que ve el paciente.
    expect(andina.carrier!.products).toEqual(
      catalogoAdministrable.get(uuid('carrier-andina'))!.products,
    );
  });

  it('una aseguradora sin catálogo sembrado recibe uno de ejemplo, igual en cada lectura', () => {
    const bisa = mercado('bisa-seguros-y-reaseguros-s-a');

    expect(bisa.carrier!.carrierCode).toBe('BISA');
    expect(bisa.carrier!.legalName).toBe('BISA Seguros y Reaseguros S.A.');
    expect(bisa.carrier!.products[0]!.productType.code).toBe('HEALTH');
    expect(planes(bisa).map((plan) => plan.name)).toEqual([
      'Plan Salud Plus',
      'Plan Salud Esencial',
      'Plan Familiar',
    ]);
    expect(mercado('bisa-seguros-y-reaseguros-s-a')).toEqual(bisa);
  });

  it('una de seguros generales ofrece accidentes personales y no salud', () => {
    const illimani = mercado('seguros-illimani-s-a-generales-y-fianzas');
    const bisaGenerales = mercado('bisa-seguros-y-reaseguros-s-a-generales-y-fianzas');

    expect(illimani.carrier!.products.map((producto) => producto.productType.code)).toEqual([
      'PERSONAL_ACCIDENT',
    ]);
    expect(planes(illimani).length).toBe(2);
    // Mismo nombre que la de salud, otra ficha: otro catálogo.
    expect(bisaGenerales.carrier!.id).not.toBe(mercado('bisa-seguros-y-reaseguros-s-a').carrier!.id);
  });

  it('un slug que no es de una aseguradora es 404', () => {
    expect(mercado('clinica-los-olivos')).toMatchObject({ status: 404 });
  });
});
