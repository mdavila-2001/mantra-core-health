import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ConversationList } from './conversation-list';
import { PACK_DE_STICKERS } from '../../../core/messaging/sticker-pack.generated';
import type { ConversationListItem } from '../../../core/data-access/community/community.types';
import { textoDeContexto } from '../../../core/messaging/contexto-de-chat';
import {
  empty,
  forbidden,
  loading,
  offline,
  stale,
  unexpectedError,
} from '../../../core/view-state/view-state';
import type { EstadoDeBandeja } from './conversation-list';

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

  it('una tarjeta de pedido se lee como «Pedido · Farmacia», sin la ruta', () => {
    montar(
      fila({
        id: 'm-1',
        senderProfileId: 'pp-2',
        bodyText: textoDeContexto({
          tipo: 'pedido',
          titulo: 'Farmacia Chávez',
          detalle: '2 productos · Bs 69,00',
          ruta: '/my-account/pharmacy-orders/7f3c1e2a-5b6d-4c7e-8f90-a1b2c3d4e5f6',
        }),
      }),
    );

    const contexto = fixture.nativeElement.querySelector(
      '[data-testid="conversacion-contexto"]',
    );
    expect(contexto?.textContent?.trim()).toBe('Pedido · Farmacia Chávez');
    expect(fixture.nativeElement.textContent).not.toContain('/my-account');
  });

  it('la conversación abierta lleva aria-current', () => {
    fixture = TestBed.createComponent(ConversationList);
    fixture.componentRef.setInput('conversaciones', [fila(undefined)]);
    fixture.componentRef.setInput('activaId', 'c-1');
    fixture.detectChanges();

    const enlace = fixture.nativeElement.querySelector('[data-testid="conversacion"]');
    expect(enlace?.getAttribute('aria-current')).toBe('page');
  });

  describe('estados que reemplazan a la lista (ViewState del M34)', () => {
    const conEstado = (estado: EstadoDeBandeja, filas: ConversationListItem[] = []): void => {
      fixture = TestBed.createComponent(ConversationList);
      fixture.componentRef.setInput('conversaciones', filas);
      fixture.componentRef.setInput('estado', estado);
      fixture.detectChanges();
    };
    const buscar = (testid: string): HTMLElement | null =>
      fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
    const texto = (): string => fixture.nativeElement.textContent as string;
    const pedidosDeReintento = (): (() => number) => {
      let pedidos = 0;
      fixture.componentInstance.reintentar.subscribe(() => pedidos++);
      return () => pedidos;
    };

    it('cargando (S2) pinta esqueletos y lo anuncia a los lectores', () => {
      conEstado(loading());
      expect(buscar('bandeja-cargando')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
        'Cargando tus conversaciones',
      );
      expect(buscar('conversacion')).toBeNull();
    });

    it('vacío (S3) ofrece una próxima acción que lleva a buscar', () => {
      conEstado(empty({ label: 'Buscar medicamentos', route: '/search/medications' }));
      expect(buscar('bandeja-vacia')?.textContent).toContain('Todavía no tenés chats');
      const destinos = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="bandeja-vacia"] a'),
      ).map((a) => (a as HTMLAnchorElement).getAttribute('href'));
      expect(destinos).toContain('/search/medications');
    });

    it('sin conexión (S8) dice «Sin conexión» y ofrece reintentar', () => {
      conEstado(offline());
      const pedidos = pedidosDeReintento();
      expect(buscar('bandeja-sin-conexion')?.textContent).toContain('Sin conexión');
      expect(texto()).not.toContain('Todavía no tenés chats');
      buscar('bandeja-reintentar')?.click();
      expect(pedidos()).toBe(1);
    });

    it('sin permiso (S5) lo dice y ofrece una salida: volver a pedir la bandeja', () => {
      conEstado(forbidden({ message: 'Con este perfil no podés leer estos chats.' }));
      const pedidos = pedidosDeReintento();
      expect(buscar('bandeja-sin-permiso')?.textContent).toContain('Con este perfil no podés leer estos chats.');
      // No es el «Reintentar» de un fallo de red: es la próxima acción de S5.
      expect(buscar('bandeja-reintentar')).toBeNull();
      buscar('bandeja-sin-permiso-reintentar')?.click();
      expect(pedidos()).toBe(1);
    });

    it('error inesperado (S9) muestra el código de la petición, el motivo una sola vez, y reintentar', () => {
      conEstado(unexpectedError('req-123', 'No pudimos leer tu bandeja.'));
      const pedidos = pedidosDeReintento();
      expect(buscar('bandeja-request-id')?.textContent).toBe('req-123');
      const veces = texto().split('No pudimos').length - 1;
      expect(veces).toBe(1);
      buscar('bandeja-reintentar')?.click();
      expect(pedidos()).toBe(1);
    });

    it('datos atrasados (S7) conservan las filas y dicen de cuándo son', () => {
      const una = fila({ id: 'm-1', senderProfileId: 'pp-2', bodyText: 'Hola' });
      conEstado(stale([una], new Date('2026-10-28T09:15:00')), [una]);
      expect(buscar('conversacion')).not.toBeNull();
      expect(texto()).toContain('28/10/2026 09:15');
    });
  });
});
