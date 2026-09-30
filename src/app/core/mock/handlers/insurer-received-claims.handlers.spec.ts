import { HttpHeaders } from '@angular/common/http';

import { PROFESIONALES } from '../fixtures/personas';
import { MockRouter, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registerInsurerReceivedClaims } from './insurer-received-claims.handlers';

interface ReceivedClaimView {
  readonly id: string;
  readonly practitioner: { readonly id: string } | null;
  readonly submittedAt: string;
  readonly serviceDate: string;
  readonly billedTotal: { readonly amount: string };
}

describe('handler de solicitudes recibidas por la aseguradora', () => {
  const router = new MockRouter();
  registerInsurerReceivedClaims(router);

  function list(user: MockUser | null): { items: ReceivedClaimView[]; truncated: boolean } | MockReply {
    const match = router.match('GET', '/insurance/received-claims')!;
    return match.handler({
      method: 'GET',
      path: '/insurance/received-claims',
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user,
    }) as { items: ReceivedClaimView[]; truncated: boolean } | MockReply;
  }

  function items(user: MockUser): ReceivedClaimView[] {
    return (list(user) as { items: ReceivedClaimView[] }).items;
  }

  it('la dueña y el personal de la aseguradora ven la lista completa, sin recorte', () => {
    for (const key of ['aseguradora', 'aseguradora_staff', 'superadmin']) {
      const body = list(buscarUsuario(key)!) as { items: ReceivedClaimView[]; truncated: boolean };
      expect(body.items.length).toBe(180);
      expect(body.truncated).toBe(false);
    }
  });

  it('el paciente y la médica reciben 403: no es su pantalla', () => {
    for (const key of ['paciente', 'medica']) {
      expect((list(buscarUsuario(key)!) as MockReply).status).toBe(403);
    }
  });

  it('viene de la más reciente a la más antigua y la prestación nunca es posterior a la solicitud', () => {
    const claims = items(buscarUsuario('aseguradora')!);
    for (let i = 1; i < claims.length; i++) {
      expect(claims[i - 1]!.submittedAt >= claims[i]!.submittedAt).toBe(true);
    }
    for (const claim of claims) {
      expect(claim.serviceDate <= claim.submittedAt.slice(0, 10)).toBe(true);
      expect(claim.billedTotal.amount).toMatch(/^\d+\.\d{2}$/);
    }
  });

  it('no le atribuye ninguna prestación a un médico real de la red ni a un registrado', () => {
    const reales = new Set(
      PROFESIONALES.filter((p) => p.origen === 'RED_ASEGURADORA' || p.origen === 'USUARIO_PROPIETARIO').map(
        (p) => p.id,
      ),
    );
    for (const claim of items(buscarUsuario('aseguradora')!)) {
      expect(reales.has(claim.practitioner!.id)).toBe(false);
    }
  });

  it('es determinista: dos lecturas devuelven lo mismo', () => {
    const user = buscarUsuario('aseguradora')!;
    expect(items(user).map((c) => c.id)).toEqual(items(user).map((c) => c.id));
  });

  describe('dictamen y factura', () => {
    /** Lo justo para leer la respuesta sin `any`: los campos que miran las pruebas. */
    interface Monto {
      readonly amount: string;
    }
    interface Factura {
      readonly status: string;
      readonly invoiceNumber: string;
      readonly amount: Monto;
      readonly previous: readonly Factura[];
    }
    interface Fila {
      readonly id: string;
      readonly status: { readonly code: string };
      readonly service: { readonly code: string };
      readonly billedTotal: Monto;
      readonly lines: readonly { readonly code: string; readonly billedAmount: Monto }[];
      readonly decision: unknown;
      readonly invoice: Factura | null;
    }

    function call(method: 'GET' | 'POST', path: string, user: MockUser, body: unknown = null): unknown {
      const match = local.match(method, path)!;
      return match.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(),
        body,
        headers: new HttpHeaders(),
        user,
      });
    }

    let local: MockRouter;
    const user = buscarUsuario('aseguradora')!;

    beforeEach(() => {
      local = new MockRouter();
      registerInsurerReceivedClaims(local, { persistir: false });
    });

    function all(): Fila[] {
      return (call('GET', '/insurance/received-claims', user) as { items: Fila[] }).items;
    }

    it('los renglones suman el monto solicitado y el primero es el servicio', () => {
      for (const claim of all()) {
        const cents = claim['lines'].reduce((sum, l) => sum + Math.round(Number(l.billedAmount.amount) * 100), 0);
        expect(cents).toBe(Math.round(Number(claim['billedTotal'].amount) * 100));
        expect(claim['lines'][0]!.code).toBe(claim['service'].code);
      }
    });

    it('lo ya dictaminado trae dictamen, y factura salvo el rechazo', () => {
      for (const claim of all()) {
        const code = claim['status'].code;
        expect(claim['decision'] === null).toBe(code === 'SUBMITTED' || code === 'IN_REVIEW');
        expect(claim['invoice'] !== null).toBe(['APPROVED', 'PARTIAL', 'PAID'].includes(code));
      }
    });

    it('aprobar emite la factura y el dictamen no se puede volver a tomar', () => {
      const open = all().find((c) => c['status'].code === 'SUBMITTED')!;
      const path = `/insurance/received-claims/${open['id']}/decision`;
      const decided = call('POST', path, user, { outcome: 'APPROVED' }) as Fila;
      expect(decided['status'].code).toBe('APPROVED');
      expect(decided['invoice']!.status).toBe('ISSUED');
      expect(decided['invoice']!.amount.amount).toBe(open['billedTotal'].amount);
      expect((call('POST', path, user, { outcome: 'REJECTED', reason: 'Cambio de idea' }) as MockReply).status).toBe(409);
    });

    it('rechazar sin motivo es 400, y aprobar en parte exige un monto menor al solicitado', () => {
      const open = all().find((c) => c['status'].code === 'IN_REVIEW')!;
      const path = `/insurance/received-claims/${open['id']}/decision`;
      expect(call('POST', path, user, { outcome: 'REJECTED' })).toMatchObject({
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: { violations: ['reason Al menos 5 caracteres'] },
        },
      });
      expect(all().find((claim) => claim.id === open.id)).toEqual(open);
      expect(call('POST', path, user, {
        outcome: 'PARTIAL', approvedAmount: open['billedTotal'].amount, reason: 'Tope del plan',
      })).toMatchObject({
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: { violations: ['approvedAmount Mayor que cero y menor que el monto solicitado'] },
        },
      });
      expect(all().find((claim) => claim.id === open.id)).toEqual(open);
      const partial = call('POST', path, user, { outcome: 'PARTIAL', approvedAmount: '10.00', reason: 'Tope del plan' }) as Fila;
      expect(partial['invoice']!.amount.amount).toBe('10.00');
    });

    it('anular deja el dictamen, y volver a facturar guarda la anulada en el historial', () => {
      const claim = all().find((c) => c['status'].code === 'APPROVED')!;
      const base = `/insurance/received-claims/${claim['id']}`;
      const annulled = call('POST', `${base}/invoice/annulment`, user, { reason: 'NIT equivocado' }) as Fila;
      expect(annulled['invoice']!.status).toBe('ANNULLED');
      expect(annulled['status'].code).toBe('APPROVED');
      expect((call('POST', `${base}/invoice/annulment`, user, { reason: 'Otra vez' }) as MockReply).status).toBe(409);

      const reissued = call('POST', `${base}/invoice`, user, {}) as Fila;
      expect(reissued['invoice']!.status).toBe('ISSUED');
      expect(reissued['invoice']!.previous[0]!.invoiceNumber).toBe(claim['invoice']!.invoiceNumber);
    });

    it('una factura pagada no se anula, y quien no es de la aseguradora no decide', () => {
      const paid = all().find((c) => c['status'].code === 'PAID')!;
      expect(
        (call('POST', `/insurance/received-claims/${paid['id']}/invoice/annulment`, user, { reason: 'NIT equivocado' }) as MockReply)
          .status,
      ).toBe(409);
      const open = all().find((c) => c['status'].code === 'SUBMITTED')!;
      expect(
        (call('POST', `/insurance/received-claims/${open['id']}/decision`, buscarUsuario('medica')!, { outcome: 'APPROVED' }) as MockReply)
          .status,
      ).toBe(403);
    });
  });
});
