import { expect, test, type Page } from '@playwright/test';

import { entrar } from './support/sesion';

/**
 * The server sends `attachmentFileId: null` on a live message without a file.
 * The thread took that for an attachment and asked for
 * `/attachments/null/content`, a 400 on every message received.
 *
 * The mockup opens no socket, so a fake one goes in through the service's own
 * factory (dev build exposes `window.ng`): the message then walks the real
 * path from the socket listener to the bubble.
 */
interface ChatStoreInTheBrowser {
  activaId(): string;
  perfilPropio(): string;
  community: {
    conversationAttachmentDataUrl: (...args: unknown[]) => unknown;
  };
  socket: {
    fabrica: () => unknown;
    disconnect(): void;
    joinConversation(conversationId: string, profileId: string): void;
  };
}

interface TestGlobals {
  ng: { getComponent(el: Element): { store: ChatStoreInTheBrowser } };
  requestedFiles: unknown[];
  pushMessage(bodyText: string): void;
}

async function plugFakeSocket(page: Page): Promise<void> {
  await page.evaluate(() => {
    const globals = window as unknown as TestGlobals;
    const { store } = globals.ng.getComponent(document.querySelector('app-composer')!);

    globals.requestedFiles = [];
    const readBytes = store.community.conversationAttachmentDataUrl.bind(store.community);
    store.community.conversationAttachmentDataUrl = (...args: unknown[]) => {
      globals.requestedFiles.push(args[2]);
      return readBytes(...args);
    };

    const listeners = new Map<string, (payload: unknown) => void>();
    store.socket.fabrica = () => ({
      connected: true,
      active: true,
      on(event: string, listener: (payload: unknown) => void) {
        listeners.set(event, listener);
        return this;
      },
      emit() {
        return this;
      },
      disconnect() {
        return this;
      },
    });
    store.socket.disconnect();
    store.socket.joinConversation(store.activaId(), store.perfilPropio());

    globals.pushMessage = (bodyText: string) =>
      listeners.get('conversation:message')!({
        id: crypto.randomUUID(),
        conversationId: store.activaId(),
        senderProfileId: crypto.randomUUID(),
        contentTypeConceptId: 'TEXT',
        bodyText,
        attachmentFileId: null,
        replyToMessageId: null,
        sentAt: new Date().toISOString(),
        deletedAt: null,
      });
  });
}

test('un mensaje en vivo sin adjunto se muestra y no pide ningún archivo', async ({ page }) => {
  await entrar(page, { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mockup', nombre: 'Paciente' });
  await page.goto('/messaging');
  await page.getByTestId('conversacion').first().click();
  await expect(page.locator('app-composer')).toBeVisible({ timeout: 30_000 });
  await plugFakeSocket(page);

  const text = 'Mensaje en vivo sin adjunto';
  await page.evaluate((body) => (window as unknown as TestGlobals).pushMessage(body), text);

  const bubble = page.getByTestId('mensaje').filter({ hasText: text });
  await expect(bubble).toBeVisible();
  await expect(bubble.locator('img')).toHaveCount(0);

  const requested = await page.evaluate(() => (window as unknown as TestGlobals).requestedFiles);
  expect(requested).toEqual([]);
});
