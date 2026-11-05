import { HttpHeaders } from '@angular/common/http';

import { conversationList, messageList, PATIENT_SHOWCASE, showcaseBySlug } from '../fixtures/community';
import { crearRouterSimulado } from './index';
import { isMockReply, type MockMethod } from '../mock-router';
import { uuid } from '../mock-store';
import { ID_ORDER_WITH_INSURANCE } from '../fixtures/pharmacy-orders';
import { MOCK_USERS, TENANT_FARMACIA, type MockUser } from '../mock-session';
import { pharmacyOrderFromDto } from '../../data-access/pharmacy-orders/pharmacy-orders.adapter';
import type { PharmacyOrderDto } from '../../data-access/pharmacy-orders/pharmacy-orders.dto';
import { textoDeContexto } from '../../messaging/chat-context';
import { contextoDePedido } from '../../messaging/order-chat-context';

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
const FARMACIA_VIDA = showcaseBySlug('farmacia-vida')!;

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
    expect(hilo?.peers.map((p) => p.profileId)).toEqual([PATIENT_SHOWCASE.id]);

    const deLaPaciente = llamar('GET', `/community/conversations?profileId=${PATIENT_SHOWCASE.id}`, PACIENTE);
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
    expect(conversationList.get(uuid('conv-paciente-farmacia-vida'))).toBeDefined();
  });

  it('sin PHARMACY_STAFF, ser del tenant no alcanza para abrir el chat del pedido', () => {
    expect(llamar('POST', `/pharmacy/orders/${uuid('pharmacy-order-1')}/conversation`, VISITADOR).status).toBe(403);
  });

  it('un paciente sin perfil de mensajería da 422 PATIENT_CHAT_PROFILE_MISSING', () => {
    // Marta Quispe: paciente de la farmacia, sin vitrina en la red.
    const r = llamar('POST', `/pharmacy/orders/${ID_ORDER_WITH_INSURANCE}/conversation`, MOSTRADOR);
    expect(r.status).toBe(422);
    expect((r.body as { reason: string }).reason).toBe('PATIENT_CHAT_PROFILE_MISSING');
  });

  it('el leído que manda el cliente (recipientProfileId) apaga el contador de la farmacia', () => {
    const id = uuid('conv-paciente-farmacia-vida');
    llamar('POST', `/community/conversations/${id}/read`, MOSTRADOR, { recipientProfileId: FARMACIA_VIDA.id });
    expect(conversationList.get(id)?.noLeidosPor[FARMACIA_VIDA.id]).toBe(0);
  });

  it('la tarjeta sembrada en el hilo es idéntica a la que arma `contextoDePedido` con el pedido de la maqueta', () => {
    const r = llamar('GET', `/pharmacy/orders/${uuid('pharmacy-order-1')}`, PACIENTE);
    expect(r.status).toBe(200);
    const esperada = textoDeContexto(contextoDePedido(pharmacyOrderFromDto(r.body as PharmacyOrderDto)));
    const primera = messageList
      .filtrar((m) => m.conversationId === uuid('conv-paciente-farmacia-vida'))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0];
    expect(primera?.bodyText).toBe(esperada);
  });

  it('el mostrador ve sólo los pedidos de su farmacia', () => {
    const r = llamar('GET', '/pharmacy/orders', MOSTRADOR);
    const items = (r.body as { items: { pharmacyId: string }[] }).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.pharmacyId === TENANT_FARMACIA)).toBe(true);
  });

  it('el personal lee un adjunto del hilo como la farmacia; quien no puede actuar con ese perfil recibe 404', () => {
    const conv = uuid('conv-paciente-farmacia-vida');
    const fileId = uuid('file-lunar');
    messageList.agregar({
      id: uuid('msg-adjunto-farmacia-spec'),
      conversationId: conv,
      senderProfileId: PATIENT_SHOWCASE.id,
      replyToMessageId: null,
      contentTypeConceptId: messageList.todos()[0]!.contentTypeConceptId,
      bodyText: '',
      attachmentFileId: fileId,
      isEdited: false,
      sentAt: new Date().toISOString(),
    });
    try {
      const ruta = `/community/conversations/${conv}/attachments/${fileId}/content?profileId=${FARMACIA_VIDA.id}`;
      expect(llamar('GET', ruta, MOSTRADOR).status).toBe(200);
      expect(llamar('GET', ruta, VISITADOR).status).toBe(404);
    } finally {
      messageList.borrar(uuid('msg-adjunto-farmacia-spec'));
    }
  });
});
