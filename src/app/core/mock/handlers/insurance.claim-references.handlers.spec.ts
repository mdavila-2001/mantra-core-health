import { HttpHeaders } from '@angular/common/http';

import { isMockReply, type MockMethod, type MockReply, type MockRouter } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { crearRouterSimulado } from './index';

/**
 * Las líneas de un reclamo llevan su referencia clínica real de la maqueta
 * (REQ-16-014 a 018): el botón de la referencia se dibuja y su número sale del
 * reclamo, no se inventa en la pantalla.
 */
describe('referencias clínicas de las líneas de un reclamo (maqueta)', () => {
  let router: MockRouter;
  const admin = buscarUsuario('admin')!;

  beforeEach(() => {
    sessionStorage.clear();
    router = crearRouterSimulado();
  });

  function llamar(method: MockMethod, path: string): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    });
    return isMockReply(resultado) ? resultado : { status: 200, body: resultado };
  }

  it('el estudio de laboratorio lleva su número de estudio; la consulta no inventa ninguno', () => {
    const lista = llamar('GET', '/insurance-claims').body as { items: { id: string; claimIdentifier: string }[] };
    const reclamo = lista.items.find((i) => i.claimIdentifier === 'CLM-2026-0142')!;
    expect(reclamo).toBeDefined();

    const detalle = llamar('GET', `/insurance-claims/${reclamo.id}`).body as {
      lines: { service: { display: string }; referenceType: string | null; reference: string | null }[];
    };
    const estudio = detalle.lines.find((l) => /perfil/i.test(l.service.display));
    expect(estudio?.referenceType).toBe('DIAGNOSTIC_STUDY');
    expect(estudio?.reference).toMatch(/^EST-0142-\d+$/);

    const sinReferencia = detalle.lines.find((l) => !/laborator|perfil|hemograma|ecograf|radiograf|tomograf|estudio|medicament|farmac|dispens|receta/i.test(l.service.display));
    if (sinReferencia !== undefined) {
      expect(sinReferencia.referenceType).toBeNull();
      expect(sinReferencia.reference).toBeNull();
    }
  });
});
