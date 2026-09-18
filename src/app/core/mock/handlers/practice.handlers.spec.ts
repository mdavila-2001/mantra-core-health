import { HttpHeaders } from '@angular/common/http';

import { registrarPracticas } from './practice.handlers';
import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';

/**
 * El simulador tiene que contestar con la MISMA forma que la API real: si no,
 * la pantalla funciona contra el backend y revienta en la maqueta, o al revés.
 */
describe('handlers de consultorios y arancel', () => {
  const router = new MockRouter();
  registrarPracticas(router);
  const admin = buscarUsuario('superadmin')!;

  function call<T>(method: MockMethod, path: string, query = new URLSearchParams()): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    }) as T;
  }

  it('las especialidades del arancel llegan en { items }, como las lee el cliente', () => {
    // Con el arreglo pelado, «Importar arancel» reventaba al abrir:
    // «Cannot read properties of undefined (reading 'map')» (barrido del refactor UX).
    const respuesta = call<{ items: readonly { specialty: string; count: number }[] }>(
      'GET',
      '/billing/service-catalog/procedure-specialties',
    );

    expect(Array.isArray(respuesta)).toBe(false);
    expect(respuesta.items.length).toBeGreaterThan(0);
    expect(respuesta.items[0]).toEqual({
      specialty: expect.any(String),
      count: expect.any(Number),
    });
  });
});
