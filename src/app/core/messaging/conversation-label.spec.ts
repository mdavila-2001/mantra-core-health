import { conversationAvatar, conversationLabel, conversationVerification } from './conversation-label';
import type { ConversationListItem } from '../data-access/community/community.types';

function conversacion(peers: ConversationListItem['peers']): ConversationListItem {
  return {
    id: 'c-1',
    conversationTypeConceptId: 'ct',
    unreadCount: 0,
    peers,
  };
}

describe('conQuien', () => {
  it('sin ningún nombre resuelto dice «Conversación», no el uuid', () => {
    expect(conversationLabel(conversacion([{ profileId: 'p-1' }]))).toBe('Conversación');
  });

  it('con un nombre lo usa', () => {
    expect(conversationLabel(conversacion([{ profileId: 'p-1', displayName: 'Andrea Peña' }]))).toBe(
      'Andrea Peña',
    );
  });
});

describe('avatarDeConQuien', () => {
  it('en una directa usa el avatar del único peer', () => {
    const url = conversationAvatar(
      conversacion([{ profileId: 'p-1', avatarUrl: '/public/media/f-1' }]),
    );
    expect(url).toBe('/public/media/f-1');
  });

  it('sin avatar cargado da null, no undefined ni cadena vacía', () => {
    expect(conversationAvatar(conversacion([{ profileId: 'p-1' }]))).toBeNull();
  });

  it('en un grupo no elige la cara de nadie', () => {
    const url = conversationAvatar(
      conversacion([
        { profileId: 'p-1', avatarUrl: '/public/media/f-1' },
        { profileId: 'p-2', avatarUrl: '/public/media/f-2' },
      ]),
    );
    expect(url).toBeNull();
  });
});

describe('conversationVerification', () => {
  it('en una directa devuelve la verificación que la API envió en el peer', () => {
    const info = conversationVerification(
      conversacion([{ profileId: 'p-1', verification: { status: 'VERIFIED', validUntil: '2099-01-01' } }]),
    );
    expect(info?.status).toBe('VERIFIED');
  });

  it('un peer sin `verification` no se promueve: no hay insignia', () => {
    expect(conversationVerification(conversacion([{ profileId: 'p-1' }]))).toBeNull();
    expect(
      conversationVerification(conversacion([{ profileId: 'p-1', verification: { status: null } }])),
    ).toBeNull();
  });

  it('un grupo no tiene una identidad que verificar', () => {
    const verificado = { status: 'VERIFIED' };
    expect(
      conversationVerification(
        conversacion([
          { profileId: 'p-1', verification: verificado },
          { profileId: 'p-2', verification: verificado },
        ]),
      ),
    ).toBeNull();
  });

  it('una vigencia vencida se degrada a EXPIRED', () => {
    const info = conversationVerification(
      conversacion([{ profileId: 'p-1', verification: { status: 'VERIFIED', validUntil: '2020-01-01' } }]),
    );
    expect(info?.status).toBe('EXPIRED');
  });
});
