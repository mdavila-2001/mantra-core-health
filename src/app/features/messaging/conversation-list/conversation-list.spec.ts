import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConversationList } from './conversation-list';
import { PACK_DE_STICKERS } from '../../../core/messaging/sticker-pack.generated';
import type { ConversationListItem } from '../../../core/data-access/community/community.types';

/**
 * Lo que estas pruebas fijan de la fila de la bandeja.
 *
 * Que un sticker se anuncia **como sticker** y no como «Archivo adjunto»: son
 * dos cosas distintas y la fila es lo que se lee para decidir en qué chat
 * entrar. Se prueba acá y no en el navegador porque la maqueta siembra los
 * mensajes con hora fija del día —9:30—, así que a según qué hora se corra el
 * E2E el sticker recién mandado no queda último y la prueba mediría el reloj.
 */
describe('ConversationList', () => {
  let fixture: ComponentFixture<ConversationList>;

  const fila = (
    lastMessage: ConversationListItem['lastMessage'],
  ): ConversationListItem => ({
    id: 'c-1',
    conversationTypeConceptId: 'c-direct',
    lastMessageAt: new Date('2026-09-11T10:00:00.000Z'),
    messageCount: 1,
    lastMessage,
    unreadCount: 0,
    peers: [{ profileId: 'pp-2', displayName: 'Dra. Quispe' }],
  });

  const montar = (conversacion: ConversationListItem): void => {
    fixture = TestBed.createComponent(ConversationList);
    fixture.componentRef.setInput('conversaciones', [conversacion]);
    fixture.componentRef.setInput('perfilPropio', 'pp-1');
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ConversationList],
      providers: [provideRouter([])],
    });
  });

  it('dice «Sticker» cuando el último mensaje es uno', () => {
    montar(
      fila({
        id: 'm-1',
        senderProfileId: 'pp-2',
        attachmentFileId: PACK_DE_STICKERS[0].id,
      }),
    );

    const sticker = fixture.nativeElement.querySelector(
      '[data-testid="conversacion-sticker"]',
    );
    expect(sticker?.textContent?.trim()).toBe('Sticker');
    // Y no lo anuncia además como archivo: sería decir dos cosas del mismo.
    expect(fixture.nativeElement.textContent).not.toContain('Archivo adjunto');
  });

  it('un adjunto que no es del pack sigue siendo «Archivo adjunto»', () => {
    montar(
      fila({ id: 'm-1', senderProfileId: 'pp-2', attachmentFileId: 'file-cualquiera' }),
    );

    expect(
      fixture.nativeElement.querySelector('[data-testid="conversacion-sticker"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Archivo adjunto');
  });

  it('un mensaje de texto se muestra tal cual', () => {
    montar(fila({ id: 'm-1', senderProfileId: 'pp-2', bodyText: 'Nos vemos el jueves' }));

    expect(fixture.nativeElement.textContent).toContain('Nos vemos el jueves');
    expect(
      fixture.nativeElement.querySelector('[data-testid="conversacion-sticker"]'),
    ).toBeNull();
  });
});
