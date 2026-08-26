import { avatarDeConQuien, conQuien } from './con-quien';
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
    expect(conQuien(conversacion([{ profileId: 'p-1' }]))).toBe('Conversación');
  });

  it('con un nombre lo usa', () => {
    expect(conQuien(conversacion([{ profileId: 'p-1', displayName: 'Andrea Peña' }]))).toBe(
      'Andrea Peña',
    );
  });
});

describe('avatarDeConQuien', () => {
  it('en una directa usa el avatar del único peer', () => {
    const url = avatarDeConQuien(
      conversacion([{ profileId: 'p-1', avatarUrl: '/public/media/f-1' }]),
    );
    expect(url).toBe('/public/media/f-1');
  });

  it('sin avatar cargado da null, no undefined ni cadena vacía', () => {
    expect(avatarDeConQuien(conversacion([{ profileId: 'p-1' }]))).toBeNull();
  });

  it('en un grupo no elige la cara de nadie', () => {
    const url = avatarDeConQuien(
      conversacion([
        { profileId: 'p-1', avatarUrl: '/public/media/f-1' },
        { profileId: 'p-2', avatarUrl: '/public/media/f-2' },
      ]),
    );
    expect(url).toBeNull();
  });
});
