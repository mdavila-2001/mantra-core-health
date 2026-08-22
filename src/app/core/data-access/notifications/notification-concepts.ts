/**
 * Identificadores de canal y categoría del módulo `messaging` (Carril 18).
 *
 * ## Por qué son literales y no se piden a la API
 *
 * Son conceptos deterministas (UUIDv5) que el backend deriva de una clave
 * legible en `src/common/constants/concepts.ts` (`deterministicId`), no datos
 * que cambien en tiempo de ejecución. El backend no expone un catálogo
 * filtrado por «categorías de notificación» —`ConceptSelect` resolvería contra
 * el catálogo entero de `terminology.catalog_concepts`, sin forma de acotarlo
 * a estas cuatro— así que declararlas acá, con sus etiquetas en castellano, es
 * más seguro que adivinar un filtro que no existe.
 *
 * **Si cambia la clave de origen en el backend (`concepts.ts`), estos valores
 * quedan desincronizados** — no hay verificación automática cruzando los dos
 * repositorios. Confirmado contra el backend el 2026-08-15.
 */
export const NOTIFICATION_CATEGORY = {
  CLINICAL: '9d4c6353-075c-5714-b748-cddb904ee259',
  ADMINISTRATIVE: 'e5d685ec-3da5-5b8f-8f02-410805898395',
  ACCOUNTING: '9d6157fe-f393-5cb4-b839-88a5d71371cb',
  PROMOTIONAL: '13a0f238-3cfa-5a43-810d-4363b982388c',
} as const;

export const NOTIFICATION_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  [NOTIFICATION_CATEGORY.CLINICAL]: 'Clínicas',
  [NOTIFICATION_CATEGORY.ADMINISTRATIVE]: 'Administrativas',
  [NOTIFICATION_CATEGORY.ACCOUNTING]: 'Contables',
  [NOTIFICATION_CATEGORY.PROMOTIONAL]: 'Promocionales',
};

export const NOTIFICATION_CHANNEL_TYPE = {
  IN_APP: '41557f04-1334-5b20-a794-16bf070f64fb',
  EMAIL: '91a8ccd8-39f8-5381-8e79-d319598c8a96',
  WHATSAPP: 'a7df2062-a02a-5d6c-a05d-62de20270c5d',
  SMS: '95dfb616-9966-51e5-a68c-29651705d1a1',
  PUSH: '16c99f7d-6299-5c85-a3f8-42fd65f46e53',
} as const;

/** Etiqueta legible por tipo de canal (`MessageChannels.channelTypeConceptId`). */
export function channelTypeLabel(channelTypeConceptId: string): string {
  switch (channelTypeConceptId) {
    case NOTIFICATION_CHANNEL_TYPE.IN_APP:
      return 'Notificación interna';
    case NOTIFICATION_CHANNEL_TYPE.EMAIL:
      return 'Correo electrónico';
    case NOTIFICATION_CHANNEL_TYPE.WHATSAPP:
      return 'WhatsApp';
    case NOTIFICATION_CHANNEL_TYPE.SMS:
      return 'SMS';
    case NOTIFICATION_CHANNEL_TYPE.PUSH:
      return 'Notificación push';
    default:
      return 'Canal';
  }
}

/**
 * Solo el canal interno entrega de verdad en este entorno: ningún proveedor
 * externo (correo con OAuth2 real aparte) está conectado para WhatsApp/SMS/push.
 * Se usa para no dejar que la pantalla insinúe que activar esos canales hace
 * que algo se envíe — la preferencia se guarda igual, pero la entrega real no
 * existe todavía.
 */
export function channelIsConfigured(channelTypeConceptId: string): boolean {
  return (
    channelTypeConceptId === NOTIFICATION_CHANNEL_TYPE.IN_APP ||
    channelTypeConceptId === NOTIFICATION_CHANNEL_TYPE.EMAIL
  );
}
