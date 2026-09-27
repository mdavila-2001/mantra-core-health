import type { Injector } from '@angular/core';

import { ChatAutoReply } from './core/messaging/chat-auto-reply';
import { MessageTemplates } from './core/messaging/message-templates';
import { TarifariosRecordados } from './features/admin/medical-laboratory/tarifarios-recordados';

/**
 * Lo sensible que otras piezas dejan en el navegador y que **cerrar sesión debe
 * olvidar** (TX-31): las plantillas de mensajes del médico, la copia local de la
 * respuesta automática y los tarifarios recordados.
 *
 * Vive en su propio archivo porque `app.config.ts` lo trae con `import()` **al
 * cerrar sesión**: importarlo de forma estática arrastraba las tres clases al
 * paquete inicial, que tiene presupuesto. Está en la raíz de `app/` y no en
 * `core/auth` para que la sesión no dependa de las pantallas (la capa `core` no
 * importa de `features`).
 */
export function olvidarLoSensibleDelNavegador(injector: Injector): void {
  injector.get(MessageTemplates).olvidar();
  injector.get(ChatAutoReply).olvidar();
  injector.get(TarifariosRecordados).olvidar();
}
