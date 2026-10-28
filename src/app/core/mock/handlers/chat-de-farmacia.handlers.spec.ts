import { HttpHeaders } from '@angular/common/http';

import { conversaciones, VITRINA_PACIENTE, vitrinaPorSlug } from '../fixtures/comunidad';
import { crearRouterSimulado } from './index';
import { isMockReply, type MockMethod } from '../mock-router';
import { uuid } from '../mock-store';
import { ID_PEDIDO_CON_SEGURO } from '../fixtures/pedidos-de-farmacia';
import { MOCK_USERS, TENANT_FARMACIA, type MockUser } from '../mock-session';

/* ============================================================================
    El chat paciente ↔ farmacia en la maqueta: quién puede escribir como la
    vitrina de la farmacia, quién puede abrir el hilo de un pedido, y el hilo
    sembrado que cada lado ve desde el suyo.
   ========================================================================== */

const router = crearRouterSimulado();
const usuario = (key: string): MockUser => MOCK_USERS.find((u) => u.key === key)!;
const MOSTRADOR = usuario('farmacia');
const PACIENTE = usuario('paciente');
const VISITADOR = usuario('visitador');
const FARMACIA_VIDA = vitrinaPorSlug('farmacia-vida')!;

function llamar(
  method: MockMethod,
  ruta: string,
  user: MockUser | null,
  body: unknown = {},
): { status: number; body: unknown } {
  const [path, qs] = ruta.split('?');
  const match = router.match(method, path!)!;
  expect(match).not.toBeNull();
  const resultado = match.handler({
    method,
    path: path!,
    params: match.params,
    query: new URLSearchParams(qs ?? ''),
    body,
    headers: new HttpHeaders(),
    user,
  });
  return isMockReply(resultado)
    ? { status: resultado.status, body: resultado.body }
    : { status: 200, body: resultado };
}

describe('maqueta · chat paciente ↔ farmacia', () => {
  it('la cuenta del mostrador es personal de Farmacia Vida', () => {
    expect(MOSTRADOR.roles).toContain('PHARMACY_STAFF');
    expect(MOSTRADOR.tenants).toContain(TENANT_FARMACIA);
    expect(FARMACIA_VIDA.tenantId).toBe(TENANT_FARMACIA);
  });

  it('el personal (farmacia@alovida.mock) encuentra la vitrina de su farmacia en organization-showcases/me', () => {
    expect(MOSTRADOR.email).toBe('farmacia@alovida.mock');
    const r = llamar('GET', '/community/profiles/organization-showcases/me', MOSTRADOR);
    expect(r.status).toBe(200);
    const items = (r.body as { items: { profileId: string; slug: string; displayName: string; kind: string }[] }).items;
    expect(items).toContainEqual(
      expect.objectContaining({ profileId: FARMACIA_VIDA.id, slug: FARMACIA_VIDA.slug, kind: 'PHARMACY' }),
    );
    // Sólo farmacias de sus tenants.
    expect(items.every((i) => i.kind === 'PHARMACY')).toBe(true);
  });

  it('nadie más recibe vitrinas: ni la paciente ni el visitador del mismo tenant', () => {
    for (const user of [PACIENTE, VISITADOR]) {
      const r = llamar('GET', '/community/profiles/organization-showcases/me', user);
      expect((r.body as { items: unknown[] }).items).toEqual([]);
    }
  });

  it('ya no hay slug adivinado `organization-<tenantId>`: la maqueta no lo resuelve, como la API', () => {
    const r = llamar('GET', `/community/profiles/by-slug/organization-${TENANT_FARMACIA}`, MOSTRADOR);
    expect(r.status).toBe(404);
  });

  it('el personal lee la bandeja de la farmacia; el hilo sembrado está del otro lado de la paciente', () => {
    const deLaFarmacia = llamar('GET', `/community/conversations?profileId=${FARMACIA_VIDA.id}`, MOSTRADOR);
    expect(deLaFarmacia.status).toBe(200);
    const filas = (deLaFarmacia.body as { items: { id: string; peers: { profileId: string }[] }[] }).items;
    const hilo = filas.find((c) => c.id === uuid('conv-paciente-farmacia-vida'));
    expect(hilo?.peers.map((p) => p.profileId)).toEqual([VITRINA_PACIENTE.id]);

    const deLaPaciente = llamar('GET', `/community/conversations?profileId=${VITRINA_PACIENTE.id}`, PACIENTE);
    const suyas = (deLaPaciente.body as { items: { id: string; peers: { profileId: string }[] }[] }).items;
    expect(suyas.find((c) => c.id === uuid('conv-paciente-farmacia-vida'))?.peers[0]?.profileId).toBe(FARMACIA_VIDA.id);
  });

  it('nadie más escribe como la farmacia: ni la paciente ni el visitador del mismo tenant (403 NOT_OWN_PROFILE)', () => {
    for (const user of [PACIENTE, VISITADOR]) {
      const r = llamar('GET', `/community/conversations?profileId=${FARMACIA_VIDA.id}`, user);
      expect(r.status).toBe(403);
      expect((r.body as { reason: string }).reason).toBe('NOT_OWN_PROFILE');
    }
    const envio = llamar('POST', `/community/conversations/${uuid('conv-paciente-farmacia-vida')}/messages`, PACIENTE, {
      senderProfileId: FARMACIA_VIDA.id,
      bodyText: 'suplantando',
    });
    expect(envio.status).toBe(403);
  });

  it('el personal abre el hilo de un pedido y recibe la vitrina con la que escribe', () => {
    const r = llamar('POST', `/pharmacy/orders/${uuid('pharmacy-order-1')}/conversation`, MOSTRADOR);
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ conversationId: uuid('conv-paciente-farmacia-vida'), pharmacyProfileId: FARMACIA_VIDA.id });
    expect(conversaciones.get(uuid('conv-paciente-farmacia-vida'))).toBeDefined();
  });

  it('sin PHARMACY_STAFF, ser del tenant no alcanza para abrir el chat del pedido', () => {
    expect(llamar('POST', `/pharmacy/orders/${uuid('pharmacy-order-1')}/conversation`, VISITADOR).status).toBe(403);
  });

  it('un paciente sin perfil de mensajería da 422 PATIENT_CHAT_PROFILE_MISSING', () => {
    // Marta Quispe: paciente de la farmacia, sin vitrina en la red.
    const r = llamar('POST', `/pharmacy/orders/${ID_PEDIDO_CON_SEGURO}/conversation`, MOSTRADOR);
    expect(r.status).toBe(422);
    expect((r.body as { reason: string }).reason).toBe('PATIENT_CHAT_PROFILE_MISSING');
  });

  it('el leído que manda el cliente (recipientProfileId) apaga el contador de la farmacia', () => {
    const id = uuid('conv-paciente-farmacia-vida');
    llamar('POST', `/community/conversations/${id}/read`, MOSTRADOR, { recipientProfileId: FARMACIA_VIDA.id });
    expect(conversaciones.get(id)?.noLeidosPor[FARMACIA_VIDA.id]).toBe(0);
  });
});
