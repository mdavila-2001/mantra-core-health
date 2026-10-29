import { HttpHeaders } from '@angular/common/http';

import { isMockReply, type MockMethod, type MockReply, type MockRouter } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';

/**
 * «Mis solicitudes» del paciente (REQ-16-031 y 032): el desglose del cobro y
 * la objeción. Contra el router completo, porque la regla de propiedad y el
 * despacho por actor viven en las dos piezas que registra el router.
 */

interface Items {
  readonly items: readonly {
    readonly id: string;
    readonly breakdown: { readonly patientTotal: string; readonly insurerTotal: string; readonly lines: readonly { readonly patientAmount: string; readonly insurerAmount: string; readonly billedAmount: string }[] } | null;
    readonly patientObjection: { readonly id: string; readonly reason: string; readonly status: string } | null;
  }[];
}

describe('Mis solicitudes: desglose y objeción del paciente', () => {
  let router: MockRouter;
  const paciente = buscarUsuario('paciente')!;
  const admin = buscarUsuario('admin')!;
  const aseguradora = buscarUsuario('aseguradora')!;

  beforeEach(() => {
    // Cada prueba arranca de la siembra limpia: la tabla se guarda en sessionStorage.
    sessionStorage.clear();
    router = crearRouterSimulado();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  function llamar(method: MockMethod, path: string, body: unknown = null, user: MockUser | null = paciente): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
  }

  function misSolicitudes(user: MockUser = paciente): Items {
    const r = llamar('GET', '/insurance/my-claims', null, user);
    expect(r.status).toBe(200);
    return r.body as Items;
  }

  it('el paciente recibe el desglose con importes en texto y las dos partes suman lo facturado', () => {
    const { items } = misSolicitudes();
    const conDesglose = items.filter((i) => i.breakdown !== null);
    expect(conDesglose.length).toBeGreaterThan(0);
    for (const solicitud of conDesglose) {
      const d = solicitud.breakdown!;
      for (const linea of d.lines) {
        const suma = Math.round(Number(linea.patientAmount) * 100) + Math.round(Number(linea.insurerAmount) * 100);
        expect(suma).toBe(Math.round(Number(linea.billedAmount) * 100));
      }
      expect(typeof d.patientTotal).toBe('string');
      expect(typeof d.insurerTotal).toBe('string');
    }
  });

  it('el desglose no viaja a quien no es el paciente', () => {
    const { items } = misSolicitudes(admin);
    expect(items.every((i) => i.breakdown === null)).toBe(true);
    expect(items.every((i) => i.patientObjection === null)).toBe(true);
  });

  it('objetar una solicitud propia la registra como abierta, con su motivo', () => {
    const propia = misSolicitudes().items[0]!;
    const r = llamar('POST', `/insurance-claims/${propia.id}/disputes`, {
      initiatedBy: 'PATIENT',
      objectionReason: 'AMOUNT_DIFFERS',
    });
    expect(r.status).toBe(201);
    const { items } = misSolicitudes();
    const objetada = items.find((i) => i.id === propia.id)!;
    expect(objetada.patientObjection?.reason).toBe('AMOUNT_DIFFERS');
    expect(objetada.patientObjection?.status).toBe('OPEN');
  });

  it('objetar de nuevo devuelve la objeción abierta y no crea otra', () => {
    const propia = misSolicitudes().items[0]!;
    const primera = llamar('POST', `/insurance-claims/${propia.id}/disputes`, {
      initiatedBy: 'PATIENT',
      objectionReason: 'SERVICE_NOT_RECEIVED',
    });
    const segunda = llamar('POST', `/insurance-claims/${propia.id}/disputes`, {
      initiatedBy: 'PATIENT',
      objectionReason: 'AMOUNT_DIFFERS',
    });
    expect(segunda.status).toBe(201);
    expect((segunda.body as { id: string }).id).toBe((primera.body as { id: string }).id);
    const objetada = misSolicitudes().items.find((i) => i.id === propia.id)!;
    expect(objetada.patientObjection?.reason).toBe('SERVICE_NOT_RECEIVED');
  });

  it('un reclamo ajeno y uno inexistente responden lo mismo: 403 sin detalle', () => {
    const propios = new Set(misSolicitudes().items.map((i) => i.id));
    const ajeno = llamar('GET', '/insurance/received-claims', null, aseguradora).body as Items;
    const otro = ajeno.items.find((i) => !propios.has(i.id));
    expect(otro, 'hace falta una solicitud de otra persona para comparar').toBeDefined();

    const deOtro = llamar('POST', `/insurance-claims/${otro!.id}/disputes`, { initiatedBy: 'PATIENT' });
    const inexistente = llamar('POST', '/insurance-claims/00000000-0000-4000-8000-00000000ffff/disputes', {
      initiatedBy: 'PATIENT',
    });
    expect(deOtro.status).toBe(403);
    expect(inexistente.status).toBe(403);
    expect(deOtro.body).toEqual(inexistente.body);
  });

  it('sin motivo, la objeción queda con el motivo por defecto NOT_INFORMED', () => {
    const propia = misSolicitudes().items[0]!;
    llamar('POST', `/insurance-claims/${propia.id}/disputes`, { initiatedBy: 'PATIENT' });
    const objetada = misSolicitudes().items.find((i) => i.id === propia.id)!;
    expect(objetada.patientObjection?.reason).toBe('NOT_INFORMED');
  });

  it('un motivo fuera de la lista cerrada responde 400', () => {
    const propia = misSolicitudes().items[0]!;
    const r = llamar('POST', `/insurance-claims/${propia.id}/disputes`, {
      initiatedBy: 'PATIENT',
      objectionReason: 'texto libre con datos',
    });
    expect(r.status).toBe(400);
  });

  it('quien no es solo paciente pasa por el camino del prestador', () => {
    const r = llamar('POST', '/insurance-claims/00000000-0000-4000-8000-00000000ffff/disputes', {
      initiatedBy: 'PROVIDER',
    }, admin);
    expect(r.status).toBe(404);
  });
});

