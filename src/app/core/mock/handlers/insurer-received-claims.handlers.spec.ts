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
});
