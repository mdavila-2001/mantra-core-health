import { HttpHeaders } from '@angular/common/http';

import { setByCode } from '../fixtures/concepts';
import { PERFORMER_MODE } from '../fixtures/performer-concepts';
import { MockRouter } from '../mock-router';
import { registrarTerminologia } from './terminology.handlers';

/**
 * El conjunto `service-request-performer-selection` en la maqueta: el
 * front lo busca por su código interno y lo expande para obtener los tres
 * uuids de los modos del ejecutor.
 */
describe('maqueta: conjunto de modos del ejecutor de la orden', () => {
  const router = new MockRouter();
  registrarTerminologia(router);

  async function get<T>(path: string, query = new URLSearchParams()): Promise<T> {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return (await match.handler({
      method: 'GET',
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: null,
    })) as T;
  }

  it('se encuentra por su código interno', async () => {
    const pagina = await get<{ items: readonly { id: string; internalCode: string }[] }>(
      '/terminology/value-sets',
      new URLSearchParams({ code: 'service-request-performer-selection' }),
    );

    expect(pagina.items).toHaveLength(1);
    expect(pagina.items[0]!.id).toBe(setByCode('service-request-performer-selection')!.id);
  });

  it('expande los tres modos con los códigos del contrato y ids estables', async () => {
    const conjunto = setByCode('service-request-performer-selection')!;
    const expansion = await get<{ items: readonly { conceptId: string; code: string }[] }>(
      `/terminology/value-sets/${conjunto.id}/$expand`,
    );

    expect(expansion.items.map((i) => i.code).sort()).toEqual([
      'SR_PERF_ORGANIZATION',
      'SR_PERF_PATIENT_CHOICE',
      'SR_PERF_SELF',
    ]);
    for (const item of expansion.items) {
      expect(item.conceptId).toBe(PERFORMER_MODE[item.code]);
    }
  });
});
