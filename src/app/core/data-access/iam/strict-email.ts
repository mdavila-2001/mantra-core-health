/**
 * El correo necesita un dominio con su terminación (`.com`, `.bo`…), como lo
 * exige el `@IsEmail` del backend. `Validators.email` deja pasar `ana@gmail`, que la
 * API rechaza recién al enviar; este patrón lo frena en el paso.
 *
 * Lo usan las pantallas de alta (con `Validators.pattern`) y el simulador de la
 * API, para que los dos digan lo mismo que el `ValidationPipe`.
 */
export const CORREO_CON_DOMINIO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
