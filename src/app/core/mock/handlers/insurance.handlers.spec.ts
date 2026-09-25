import { HttpHeaders } from '@angular/common/http';

import { registrarSeguros } from './insurance.handlers';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';

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
