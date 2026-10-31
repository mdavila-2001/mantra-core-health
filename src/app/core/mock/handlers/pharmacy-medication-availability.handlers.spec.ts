import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { buscarUsuario, TENANT_FARMACIA } from '../mock-session';
import { isMockReply, type MockRequest } from '../mock-router';
import { uuid } from '../mock-store';
import { productos } from './pharmacy.handlers';

interface MedicationSite {
  readonly siteId: string;
  readonly pharmacyId: string;
  readonly complete: boolean;
  readonly missingMedicationConceptIds: readonly string[];
  readonly products: readonly {
    readonly productId: string;
    readonly medicationConceptId: string;
  }[];
}

describe('maqueta de la disponibilidad por medicamento', () => {
  const router = crearRouterSimulado();
  const paciente = buscarUsuario('paciente')!;
  const IBUPROFENO = productos.get(
    uuid(`product-${TENANT_FARMACIA}-MED-IBUPROFENO`),
  )!.medicationConceptId!;

  function ask(medications: string): {
    unpublishedMedicationConceptIds: readonly string[];
    items: readonly MedicationSite[];
  } {
    const path = '/pharmacy-inventory/availability/medications';
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const answer = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams({ medications }),
      body: {},
      headers: new HttpHeaders(),
      user: paciente,
    } satisfies MockRequest);
    return (isMockReply(answer) ? answer.body : answer) as ReturnType<typeof ask>;
  }

  it('trae varias farmacias, cada sede con un producto suyo del medicamento', () => {
    const { items, unpublishedMedicationConceptIds } = ask(IBUPROFENO);

    expect(unpublishedMedicationConceptIds).toEqual([]);
    expect(new Set(items.map((site) => site.pharmacyId)).size).toBeGreaterThan(1);
    for (const site of items) {
      expect(site.products.map((product) => product.medicationConceptId)).toEqual([IBUPROFENO]);
      expect(productos.get(site.products[0]!.productId)?.pharmacyId).toBe(site.pharmacyId);
    }
  });

  it('dice qué medicamento no publica nadie, y no inventa sedes para él', () => {
    const { items, unpublishedMedicationConceptIds } = ask('concepto-que-nadie-publica');

    expect(unpublishedMedicationConceptIds).toEqual(['concepto-que-nadie-publica']);
    expect(items).toEqual([]);
  });
});
