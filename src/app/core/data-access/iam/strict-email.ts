/**
 * El correo necesita un dominio con su terminación (`.com`, `.bo`…), como lo
 * exige el `@IsEmail` del backend. `Validators.email` deja pasar `ana@gmail`, que la
 * API rechaza recién al enviar; este patrón lo frena en el paso.
 *
 * Lo usan las pantallas de alta (con `Validators.pattern`) y el simulador de la
 * API, para que los dos digan lo mismo que el `ValidationPipe`.
 */
export const CORREO_CON_DOMINIO = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;

/**
 * La terminación (TLD) que acepta `isEmail` de `class-validator`: sólo letras
 * (de 2 en adelante) o un TLD internacionalizado `xn--…`. Un TLD numérico como
 * en `a@b.12` o con dígitos (`a@b.c0m`) es un 400.
 */
const TLD_COMO_LA_API = /\.(?:[a-z¡-¨ª-퟿豈-﷏ﷰ-￯]{2,}|xn[a-z0-9-]{2,})$/i;

/**
 * Si un correo pasaría el `@IsEmail` de la API. Es **sólo para el simulador**:
 * el patrón de los formularios ({@link CORREO_CON_DOMINIO}) no cambia, y un
 * correo con TLD numérico llega a la API, que lo rechaza con 400, igual que
 * antes.
 */
export function esCorreoComoLaApi(correo: string): boolean {
  return CORREO_CON_DOMINIO.test(correo) && TLD_COMO_LA_API.test(correo);
}
