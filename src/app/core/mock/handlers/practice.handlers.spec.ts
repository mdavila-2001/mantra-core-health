import '@angular/compiler';
import { HttpHeaders } from '@angular/common/http';

import { registrarPracticas } from './practice.handlers';
import { PRACTICE_CONSULTORIO, PRACTICE_OLIVOS } from '../fixtures/agenda';
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

  it('GET /billing/service-catalog asegura CITA_MEDICA por defecto en cualquier práctica', () => {
    const practiceId = 'practica-arbitraria-nueva';
    const params = new URLSearchParams({ practiceId });
    const respuesta = call<{ items: readonly { code: string; name: string; defaultPrice: string; isActive: boolean }[] }>(
      'GET',
      '/billing/service-catalog',
      params,
    );

    const citaMedica = respuesta.items.find((s) => s.code === 'CITA_MEDICA');
    expect(citaMedica).toBeDefined();
    expect(citaMedica?.name).toBe('Cita médica');
    expect(citaMedica?.defaultPrice).toBe('0.00');
    expect(citaMedica?.isActive).toBe(true);
  });

  it('PRACTICE_CONSULTORIO y PRACTICE_OLIVOS tienen CITA_MEDICA garantizada', () => {
    for (const practiceId of [PRACTICE_CONSULTORIO, PRACTICE_OLIVOS]) {
      const params = new URLSearchParams({ practiceId });
      const respuesta = call<{ items: readonly { code: string; defaultPrice: string; isActive: boolean }[] }>(
        'GET',
        '/billing/service-catalog',
        params,
      );
      const cita = respuesta.items.find((s) => s.code === 'CITA_MEDICA');
      expect(cita).toBeDefined();
      expect(cita?.defaultPrice).toBe('0.00');
      expect(cita?.isActive).toBe(true);
    }
  });
});
