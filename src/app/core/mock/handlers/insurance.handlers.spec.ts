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
