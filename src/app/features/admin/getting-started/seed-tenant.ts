/**
 * El código del tenant que siembra el arranque.
 *
 * No es una organización real: existe para que el administrador tenga dónde
 * estar y para que las escrituras sin contexto tengan a qué apuntar. Contarlo
 * daría por hecha una puesta en marcha que no ocurrió. Su valor vive en
 * `SEED.tenantCode` del backend.
 *
 * Vive acá y no en cada pantalla porque lo miran dos —el aviso del panel y el
 * recorrido— y una cadena mágica repetida es una cadena que un día se cambia en
 * un solo lado.
 */
export const CODIGO_DEL_TENANT_SEMILLA = 'DEFAULT';
