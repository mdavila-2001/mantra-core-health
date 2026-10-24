import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';

describe('comunidad demo: publicaciones, grupos y conversación', () => {
  const router = new MockRouter();
  const medicalUser = buscarUsuario('medica')!;
  const storageKeys = [
    'mock.comunidad.vitrinas', 'mock.comunidad.publicaciones', 'mock.comunidad.comentarios',
    'mock.comunidad.resenas', 'mock.comunidad.grupos', 'mock.comunidad.miembrosDeGrupo',
    'mock.comunidad.muroDeGrupo', 'mock.comunidad.conversaciones', 'mock.comunidad.mensajes',
  ];
  const previous = new Map<string, string | null>();
  let previousAutoReply: string | null = null;
  let medicalProfileId: string;
  let patientProfileId: string;

  beforeAll(async () => {
    for (const key of storageKeys) {
      previous.set(key, sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
    }
    previousAutoReply = localStorage.getItem('alovida.chat-respuesta-automatica');
    localStorage.removeItem('alovida.chat-respuesta-automatica');
    vi.resetModules();
    const [{ MEDICAL_SHOWCASE: VITRINA_MEDICA, PATIENT_SHOWCASE: VITRINA_PACIENTE }, { registrarComunidad }] = await Promise.all([
      import('../fixtures/community'), import('./community.handlers'),
    ]);
    medicalProfileId = VITRINA_MEDICA.id;
    patientProfileId = VITRINA_PACIENTE.id;
    registrarComunidad(router);
  });

  afterAll(() => {
    for (const key of storageKeys) {
      const value = previous.get(key);
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    }
    if (previousAutoReply === null) localStorage.removeItem('alovida.chat-respuesta-automatica');
    else localStorage.setItem('alovida.chat-respuesta-automatica', previousAutoReply);
    vi.resetModules();
  });

  function request(
    method: MockMethod,
    path: string,
    body: unknown = {},
    query = new URLSearchParams(),
    user: MockUser | null = medicalUser,
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method, path, params: match.params, query, body, headers: new HttpHeaders(), user,
    } satisfies MockRequest);
  }

  const status = (response: unknown) => isMockReply(response) ? response.status : 200;
  const data = <T>(response: unknown) => (isMockReply(response) ? response.body : response) as T;

  it('publica, reacciona, comenta y gestiona seguimiento y guardados', () => {
    const post = data<{ id: string }>(request('POST', `/community/profiles/${medicalProfileId}/posts`, {
      bodyText: 'Publicación sintética de prueba', hashtags: ['articulomedico'], commentsEnabled: true,
    }));
    expect(data<{ bodyText: string }>(request('GET', `/community/posts/${post.id}`)).bodyText)
      .toBe('Publicación sintética de prueba');
    const reaction = {
      actorProfileId: patientProfileId, reactableType: 'POST', reactableRefId: post.id, reactionType: 'LIKE',
    };
    expect(status(request('PUT', '/community/reactions', reaction))).toBe(200);
    expect(data<{ total: number; actorReactionType: string }>(request(
      'GET', `/community/posts/${post.id}/reactions`, {}, new URLSearchParams({ actorProfileId: patientProfileId }),
    ))).toMatchObject({ total: 1, actorReactionType: 'LIKE' });
    expect(status(request('PUT', '/community/reactions', reaction))).toBe(200);
    expect(data<{ total: number }>(request('GET', `/community/posts/${post.id}/reactions`)).total).toBe(0);

    const comment = data<{ id: string }>(request('POST', '/community/comments', {
      authorProfileId: patientProfileId, commentableRefId: post.id, bodyText: 'Comentario de prueba',
    }));
    expect(status(request('POST', '/community/comments', {
      authorProfileId: medicalProfileId, commentableRefId: post.id,
      bodyText: 'Respuesta sintética', parentCommentId: comment.id,
    }))).toBe(201);
    expect(data<{ items: { id: string }[] }>(request('GET', `/community/posts/${post.id}/comments`)).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: comment.id })]));
    expect(data<{ commentCount: number }>(request('GET', `/community/posts/${post.id}`)).commentCount).toBe(2);

    const follow = { followerProfileId: patientProfileId, followableRefId: medicalProfileId };
    expect(status(request('POST', '/community/follows', follow))).toBe(201);
    expect(data<{ items: { followableRefId: string }[] }>(request(
      'GET', '/community/follows', {}, new URLSearchParams({ followerProfileId: patientProfileId }),
    )).items.some((item) => item.followableRefId === medicalProfileId)).toBe(true);
    expect(data<{ items: { sourceRefId: string }[] }>(request(
      'GET', '/community/feed', {}, new URLSearchParams({ profileId: patientProfileId }),
    )).items.some((item) => item.sourceRefId === post.id)).toBe(true);
    expect(data<{ removed: boolean }>(request('DELETE', '/community/follows', follow)).removed).toBe(true);

    const bookmark = { profileId: patientProfileId, bookmarkableRefId: post.id };
    expect(status(request('POST', '/community/bookmarks', bookmark))).toBe(201);
    expect(data<{ items: { bookmarkableRefId: string }[] }>(request(
      'GET', '/community/bookmarks', {}, new URLSearchParams({ profileId: patientProfileId }),
    )).items.some((item) => item.bookmarkableRefId === post.id)).toBe(true);
    expect(data<{ removed: boolean }>(request('DELETE', '/community/bookmarks', bookmark)).removed).toBe(true);
    expect(status(request('GET', '/community/posts/missing'))).toBe(404);
  });

  it('mantiene membresía pendiente en grupo privado hasta aprobarla', () => {
    expect(status(request('POST', '/community/groups', { slug: 'public-invalid', name: 'Público inválido' }, new URLSearchParams(), null))).toBe(422);
    const group = data<{ id: string }>(request('POST', '/community/groups', {
      slug: 'grupo-sintetico', name: 'Grupo sintético', visibility: 'PRIVATE', ownerProfileId: medicalProfileId,
    }));
    const path = `/community/groups/${group.id}`;
    expect(data<{ viewer: { isMember: boolean; canAdminister: boolean } }>(request(
      'GET', path, {}, new URLSearchParams({ actorProfileId: medicalProfileId }),
    )).viewer).toMatchObject({ isMember: true, canAdminister: true });
    const member = data<{ id: string; joinStatusConceptId: string }>(request(
      'POST', `${path}/members`, { memberProfileId: patientProfileId },
    ));
    expect(data<{ viewer: { isMember: boolean } }>(request(
      'GET', path, {}, new URLSearchParams({ actorProfileId: patientProfileId }),
    )).viewer.isMember).toBe(false);
    expect(data<{ id: string }>(request('PATCH', `${path}/members/${member.id}`, { decision: 'APPROVE', role: 'MODERATOR' })).id)
      .toBe(member.id);
    expect(data<{ viewer: { isMember: boolean; canAdminister: boolean } }>(request(
      'GET', path, {}, new URLSearchParams({ actorProfileId: patientProfileId }),
    )).viewer).toMatchObject({ isMember: true, canAdminister: true });
    expect(data<{ items: { id: string }[] }>(request(
      'GET', `${path}/members`, {}, new URLSearchParams({ joinStatus: 'ACTIVE' }),
    )).items.some((item) => item.id === member.id)).toBe(true);

    const root = data<{ id: string }>(request('POST', `${path}/posts`, {
      authorProfileId: medicalProfileId, bodyText: 'Tema sintético',
    }));
    expect(status(request('POST', `${path}/posts`, {
      authorProfileId: patientProfileId, bodyText: 'Respuesta sintética', parentCommentId: root.id,
    }))).toBe(201);
    expect(data<{ items: { id: string; replies: unknown[] }[] }>(request('GET', `${path}/posts`)).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: root.id, replies: expect.any(Array) })]));
    expect(data<{ removed: boolean }>(request('DELETE', `${path}/members/${member.id}`)).removed).toBe(true);
    expect(status(request('PATCH', `${path}/members/missing`, { decision: 'APPROVE' }))).toBe(404);
    expect(status(request('POST', '/community/groups/missing/members', { memberProfileId: patientProfileId }))).toBe(404);
    expect(status(request('GET', '/community/groups/missing'))).toBe(404);
  });

  it('abre una conversación, edita solo mensaje propio y registra lectura', () => {
    const conversation = data<{ id: string }>(request('POST', '/community/conversations', {
      participantProfileIds: [medicalProfileId, 'synthetic-peer'],
    }));
    expect(data<{ id: string }>(request('POST', '/community/conversations', {
      participantProfileIds: ['synthetic-peer', medicalProfileId],
    })).id).toBe(conversation.id);
    const path = `/community/conversations/${conversation.id}`;
    const sent = data<{ id: string }>(request('POST', `${path}/messages`, {
      senderProfileId: medicalProfileId, bodyText: 'Hola de prueba',
    }));
    expect(data<{ items: { id: string }[] }>(request('GET', `${path}/messages`)).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: sent.id })]));
    expect(status(request('PATCH', `${path}/messages/${sent.id}`, {
      senderProfileId: 'synthetic-peer', bodyText: 'Edición ajena',
    }))).toBe(400);
    expect(status(request('PATCH', `${path}/messages/${sent.id}`, {
      senderProfileId: medicalProfileId, bodyText: ' ',
    }))).toBe(400);
    expect(data<{ bodyText: string; isEdited: boolean }>(request('PATCH', `${path}/messages/${sent.id}`, {
      senderProfileId: medicalProfileId, bodyText: '  Texto corregido  ',
    }))).toMatchObject({ bodyText: 'Texto corregido', isEdited: true });
    expect(data<{ receiptsRecorded: number; lastReadMessageId: string }>(request(
      'POST', `${path}/read`, { readerProfileId: 'synthetic-peer' },
    )).lastReadMessageId).toBe(sent.id);
    expect(status(request('PATCH', `${path}/messages/missing`, { bodyText: 'Nada' }))).toBe(404);
    expect(status(request('POST', '/community/conversations/missing/messages', { bodyText: 'Nada' }))).toBe(404);
  });
});
