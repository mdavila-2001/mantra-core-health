import { signal } from '@angular/core';

/* ============================================================================
    El idioma de la interfaz — sólo para diccionarios de producto como el de
    tipos societarios, no para la API.

    Hoy es fijo `'es'`: no hay selector en la barra (`LOCALE_ID` está fijo en
    `es-BO`, ver `app.config.ts`, y el catálogo de terminología lo pide con
    `IDIOMA_DEL_CATALOGO = 'ES'` constante, `terminology.client.ts`). Esta
    señal existe para que un diccionario que YA declara sus tres idiomas
    (`legal-entity-types.dictionary.ts`) no tenga que inventar el suyo propio
    el día que exista el selector: ese día, quien lo agregue escribe acá, y
    todo lo que ya lee esta señal se actualiza solo.

    Mientras tanto, es un valor constante en la práctica: nadie la muta.
    ========================================================================== */

/** Los tres idiomas que el diccionario de tipos societarios declara. */
export const UI_LANGUAGES = ['es', 'en', 'pt'] as const;

export type UiLanguage = (typeof UI_LANGUAGES)[number];

/**
 * El idioma activo de la interfaz, para los diccionarios de producto que lo
 * necesiten. Por defecto `'es'`: es el idioma del producto hoy.
 */
export const uiLanguage = signal<UiLanguage>('es');
