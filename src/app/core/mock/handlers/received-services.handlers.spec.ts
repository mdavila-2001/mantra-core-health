import { HttpHeaders } from '@angular/common/http';

import type { ReceivedServicesPage } from '../../data-access/received-services/received-services.types';
import { PATIENTS, PACIENTE } from '../fixtures/people';
import { RECEIVED_SERVICES } from '../fixtures/received-services';
import { isMockReply, type MockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { crearRouterSimulado } from './index';

/**
 * `GET /clinical/patients/:id/received-services` del backend simulado.
 *
 * Fija que el simulador obedece las MISMAS reglas que la API real (mismo acceso
 * que el resumen, orden, tope, y quién ve el dinero): dev, test y mockup tienen
 * que mostrar lo mismo, y un doble más generoso que la API sería la forma de que
 * una pantalla pase en la maqueta y falle contra el servidor.
 */
describe('handlers de servicios recibidos: GET /clinical/patients/:id/received-services', () => {
  const router = crearRouterSimulado();
  const paciente = buscarUsuario('paciente')!;
  const medica = buscarUsuario('medica')!;
  const superadmin = buscarUsuario('superadmin')!;

  function pedir(user: MockRequest['user'], patientId: string, query: Record<string, string> = {}): ReceivedServicesPage | MockReply {
    const path = `/clinical/patients/${patientId}/received-services`;
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: {},
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest) as ReceivedServicesPage | MockReply;
  }

  function page(value: ReceivedServicesPage | MockReply): ReceivedServicesPage {
    if (isMockReply(value)) throw new Error(`Se esperaba la página y respondió ${value.status}`);
    return value;
  }

  /**
   * Alguien que el paciente de demostración no es ni representa: un extraño de verdad.
   *
   * No sirve «el primer paciente que no sea él». El builder de Angular corre las
   * pruebas con `isolate: false`, así que los archivos que caen en el mismo worker
   * comparten el estado del backend simulado, y `dependent-requests.handlers.spec.ts`
   * deja a `PATIENTS[1]` como dependiente de este mismo paciente (acepta la
   * solicitud y el vínculo vive en memoria). Con ese vínculo la API responde 200,
   * correctamente, y la prueba fallaba según qué archivo hubiera corrido antes en
   * el worker (#1366).
   *
   * Por eso se le pregunta al propio simulador a quién representa, por el mismo
   * endpoint que usa la pantalla de dependientes, y se elige a alguien fuera de esa
   * lista: la aserción de abajo sigue siendo «un extraño recibe 403», sin importar
   * qué vínculos hayan dejado otros archivos.
   */
  function extrano(): (typeof PATIENTS)[number] {
    const path = '/profiles/patients/me/dependents';
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const dependientes = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: {},
      headers: new HttpHeaders(),
      user: paciente,
    } satisfies MockRequest) as { patientProfileId: string }[];
    const representados = new Set(dependientes.map((dependiente) => dependiente.patientProfileId));
    const candidato = PATIENTS.find((p) => p.id !== PACIENTE.id && !representados.has(p.id));
    if (candidato === undefined) throw new Error('No hay ningún paciente ajeno al de demostración');
    return candidato;
  }

  it('el titular recibe sus cuatro servicios, del más reciente al más antiguo', () => {
    const result = page(pedir(paciente, PACIENTE.id));

    expect(result.patientProfileId).toBe(PACIENTE.id);
    expect(result.items).toHaveLength(4);
    const fechas = result.items.map((item) => item.performedAt);
    expect([...fechas].sort().reverse()).toEqual(fechas);
    expect(result.truncated).toBe(false);
  });

  it('distingue dos intervenciones y dos vacunas', () => {
    const types = page(pedir(paciente, PACIENTE.id)).items.map((item) => item.type);
    expect(types.filter((type) => type === 'INTERVENTION')).toHaveLength(2);
    expect(types.filter((type) => type === 'VACCINATION')).toHaveLength(2);
  });

  it('el titular ve el costo; la vacuna sin cobro lo trae null, no cero', () => {
    const items = page(pedir(paciente, PACIENTE.id)).items;
    expect(page(pedir(paciente, PACIENTE.id)).costsVisible).toBe(true);
    expect(items.find((item) => item.type === 'INTERVENTION')?.cost).toEqual({
      amount: '350.00',
      currencyCode: 'BOB',
      source: 'INVOICE_LINE',
    });
    expect(items.filter((item) => item.type === 'VACCINATION').map((item) => item.cost)).toEqual([null, null]);
  });

  it('el costo de la apendicectomía sale de la suma de los cargos del caso', () => {
    const cost = page(pedir(paciente, PACIENTE.id)).items.find((item) => item.cost?.source === 'CHARGE_ITEMS')?.cost;
    expect(cost).toEqual({ amount: '4200.00', currencyCode: 'BOB', source: 'CHARGE_ITEMS' });
  });

  it('el servidor manda el nombre del profesional y de la sede: el paciente no puede resolverlos', () => {
    const intervention = page(pedir(paciente, PACIENTE.id)).items.find((item) => item.type === 'INTERVENTION')!;
    expect(intervention.performerName).toBeTruthy();
    expect(intervention.practiceSiteName).toBeTruthy();
  });

  it('una vacuna puede no traer profesional: no se inventa uno', () => {
    const vaccine = page(pedir(paciente, PACIENTE.id)).items.find((item) => item.type === 'VACCINATION')!;
    expect(vaccine.performerName).toBeUndefined();
  });

  describe('quién ve el dinero', () => {
    it.each([
      ['el personal clínico', medica],
      ['el superadministrador', superadmin],
    ])('%s lee el servicio sin importes, y la respuesta lo dice', (_name, user) => {
      const result = page(pedir(user, PACIENTE.id));
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.costsVisible).toBe(false);
      expect(result.items.every((item) => item.cost === null)).toBe(true);
    });
  });

  describe('acceso', () => {
    it('sin sesión responde 403', () => {
      const reply = pedir(null, PACIENTE.id);
      expect(isMockReply(reply) && reply.status).toBe(403);
    });

    it('un paciente no lee los servicios de otro', () => {
      const reply = pedir(paciente, extrano().id);
      expect(isMockReply(reply) && reply.status).toBe(403);
    });

    it('un paciente que no existe responde 404', () => {
      const reply = pedir(paciente, '00000000-0000-4000-8000-000000000000');
      expect(isMockReply(reply) && reply.status).toBe(404);
    });
  });

  describe('tope', () => {
    it('corta la lista y dice que cortó', () => {
      const result = page(pedir(paciente, PACIENTE.id, { limit: '3' }));
      expect(result.items).toHaveLength(3);
      expect(result.limit).toBe(3);
      expect(result.truncated).toBe(true);
    });

    it('con un tope que alcanza no marca corte', () => {
      expect(page(pedir(paciente, PACIENTE.id, { limit: '4' })).truncated).toBe(false);
    });
  });

  it('un paciente sin servicios recibe una lista vacía, no un error', () => {
    const other = PATIENTS.find((candidate) => candidate.id !== PACIENTE.id)!;
    // Quien puede leer la historia ajena (superadministrador) ve que no hay nada.
    const result = page(pedir(superadmin, other.id));
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  it('todos los servicios del escenario son de la paciente de demostración', () => {
    expect(RECEIVED_SERVICES.every((service) => service.patientProfileId === PACIENTE.id)).toBe(true);
  });

  it('nunca expone la cobertura del seguro', () => {
    const body = JSON.stringify(page(pedir(paciente, PACIENTE.id)));
    expect(body).not.toMatch(/coverage|insurance|claim|cobertura/i);
  });
});
