import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registerInsurerPatients } from './insurer-patients.handlers';

/**
 * El directorio de pacientes de la aseguradora contra el simulador. La
 * pantalla vino de `dev` y en la maqueta no había quien la atendiera: cada
 * búsqueda caía en `[mock] sin manejador`.
 */
describe('directorio de pacientes de la aseguradora en el simulador', () => {
  const ASEGURADORA = buscarUsuario('aseguradora@alovida.mock')!;
  const PACIENTE = buscarUsuario('paciente@alovida.mock')!;

  interface Renglon {
    patientProfileId: string;
    fullName: string;
    birthDate: string;
    genderCode?: string;
    insurers: readonly { id: string; name: string }[];
    messaging: { channel: string; available: boolean };
  }
  interface Pagina {
    items: Renglon[];
    total: number;
    limit: number;
    nextCursor: string | null;
  }

  let router: MockRouter;

  beforeEach(() => {
    router = new MockRouter();
    registerInsurerPatients(router, { persistir: false });
  });

  function call(method: MockMethod, path: string, user: MockUser | null, body: unknown = null) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const result = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(result) ? result : { status: 200, body: result };
  }

  const buscar = (body: object = {}, user: MockUser | null = ASEGURADORA) =>
    call('POST', '/insurance/patients/search', user, body);

  it('una cuenta que no es de la aseguradora recibe 403', () => {
    expect(buscar({}, PACIENTE).status).toBe(403);
    expect(call('GET', '/insurance/patients/options', PACIENTE).status).toBe(403);
  });

  it('pagina por cursor con el total exacto del conjunto filtrado', () => {
    const primera = buscar({ limit: 25 }).body as Pagina;
    expect(primera.total).toBe(60);
    expect(primera.items).toHaveLength(25);
    expect(primera.nextCursor).toBe('25');

    const ultima = buscar({ limit: 25, cursor: '50' }).body as Pagina;
    expect(ultima.items).toHaveLength(10);
    expect(ultima.nextCursor).toBeNull();
  });

  it('ordena por nombre y, si se pide, por fecha de nacimiento descendente', () => {
    const nombres = (buscar({ limit: 50 }).body as Pagina).items.map((r) => r.fullName);
    expect(nombres).toEqual([...nombres].sort((a, b) => a.localeCompare(b, 'es')));

    const fechas = (buscar({ limit: 50, sortBy: 'birthDate', sortDirection: 'desc' }).body as Pagina).items.map(
      (r) => r.birthDate,
    );
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it('busca por nombre sin distinguir mayúsculas', () => {
    const pagina = buscar({ search: 'pérez' }).body as Pagina;
    expect(pagina.total).toBeGreaterThan(0);
    expect(pagina.items.every((r) => r.fullName.toLocaleLowerCase('es').includes('pérez'))).toBe(true);
  });

  it('filtra por aseguradora y por «sin seguro»', () => {
    const { insurers } = call('GET', '/insurance/patients/options', ASEGURADORA).body as {
      insurers: { id: string; name: string }[];
    };
    const andina = insurers.find((i) => i.name === 'Seguros Andina')!;
    const conAndina = buscar({ insuranceCarrierId: andina.id, limit: 50 }).body as Pagina;
    expect(conAndina.total).toBeGreaterThan(0);
    expect(conAndina.items.every((r) => r.insurers.some((i) => i.id === andina.id))).toBe(true);

    const sinSeguro = buscar({ insuranceStatus: 'NO_INSURANCE', limit: 50 }).body as Pagina;
    expect(sinSeguro.items.every((r) => r.insurers.length === 0)).toBe(true);
  });

  it('rechaza un rango de nacimiento invertido', () => {
    expect(buscar({ birthDateFrom: '2000-01-01', birthDateTo: '1990-01-01' }).status).toBe(422);
  });

  it('entrega el sexo con el código del contrato, nunca el de la maqueta', () => {
    const codigos = new Set((buscar({ limit: 50 }).body as Pagina).items.map((r) => r.genderCode));
    expect([...codigos].every((c) => c === undefined || c.startsWith('GENDER_'))).toBe(true);
  });

  it('«Escribir» a alguien fuera del directorio es 404, y sin mensajería es 412', () => {
    expect(
      call('POST', '/insurance/patients/conversation', ASEGURADORA, { patientProfileId: 'no-existe', channel: 'internal' })
        .status,
    ).toBe(404);

    const renglones = [
      ...(buscar({ limit: 50 }).body as Pagina).items,
      ...(buscar({ limit: 50, cursor: '50' }).body as Pagina).items,
    ];
    const sinMensajeria = renglones.find((r) => !r.messaging.available);
    expect(sinMensajeria).toBeDefined();
    expect(
      call('POST', '/insurance/patients/conversation', ASEGURADORA, {
        patientProfileId: sinMensajeria!.patientProfileId,
        channel: 'internal',
      }).status,
    ).toBe(412);
  });

  it('«Escribir» a la paciente de la demo abre siempre la misma conversación', () => {
    const pedido = { patientProfileId: PACIENTE.patientProfileId, channel: 'internal' };
    const primera = call('POST', '/insurance/patients/conversation', ASEGURADORA, pedido);
    const segunda = call('POST', '/insurance/patients/conversation', ASEGURADORA, pedido);
    expect(primera.status).toBe(200);
    const { conversationId } = primera.body as { conversationId: string };
    expect(conversationId).toBeTruthy();
    expect((segunda.body as { conversationId: string }).conversationId).toBe(conversationId);
  });
});
