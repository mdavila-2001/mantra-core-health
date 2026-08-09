/**
 * Lo primero por lo que pasa cualquier URL antes de tocar un span.
 *
 * No es una precaución general. En este repositorio hay **dos rutas** cuyo
 * query string lleva una credencial:
 *
 *   /auth/verificar?token=…      el enlace de verificación del correo
 *   /auth/nueva-clave?token=…    el enlace de recuperación de contraseña
 *
 * Si la URL entrara entera a un atributo, esos tokens quedarían guardados en
 * Jaeger, legibles por cualquiera con acceso al panel, durante todo el tiempo
 * de retención. Y seguirían sirviendo para verificar el correo o cambiar la
 * contraseña de esa persona.
 *
 * La regla que se aplica es la más simple que cierra el caso: **el query string
 * no viaja**. Ni recortado, ni con las claves «seguras» conservadas, ni con el
 * valor sustituido por su longitud. Cualquier lista de claves permitidas
 * envejece mal — la clave nueva que alguien agregue mañana no estará en ella—.
 */

/**
 * La ruta de una URL, sin query, sin fragmento y sin credenciales.
 *
 * Funciona con URLs absolutas y relativas, que es lo que llega desde
 * `HttpClient`: en desarrollo las peticiones salen relativas (`/iam/…`, las
 * resuelve el proxy) y en un despliegue con la API en otro dominio salen
 * absolutas.
 */
export function sanitizeUrl(url: string): string {
  /**
   * La comprobación de tipo no sobra aunque la firma diga `string`.
   *
   * Esta función es la frontera de privacidad y la cruzan valores que vienen
   * del framework y de dobles de prueba, donde `state.url` puede llegar sin
   * definir. Un `TypeError` acá haría que la telemetría **rompiera un guard**,
   * que es la peor forma posible de fallar: la aplicación dejaría de navegar
   * por culpa de la observabilidad.
   */
  const raw = typeof url === 'string' ? url : '';
  if (raw === '') {
    return '/';
  }

  const [withoutFragment = ''] = raw.split('#');
  const [withoutQuery = ''] = withoutFragment.split('?');

  if (!withoutQuery.includes('://')) {
    return withoutQuery === '' ? '/' : withoutQuery;
  }

  try {
    // `usuario:contraseña@` no sobrevive: `pathname` no lo incluye.
    return new URL(withoutQuery).pathname;
  } catch {
    // Una URL que no se puede analizar no se adivina: se descarta entera. Un
    // recorte a mano de algo con forma desconocida es cómo se filtra un token.
    return '/';
  }
}

/**
 * El host de una URL absoluta, o `null` si es relativa.
 *
 * Se usa para `server.address`. Con raíz vacía —el caso normal— la petición es
 * del mismo origen y el atributo no se pone: escribir ahí el host de la propia
 * aplicación no diría nada que el recurso no diga ya.
 */
export function hostOf(url: string): string | null {
  if (!url.includes('://')) {
    return null;
  }

  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** El esquema de una URL absoluta (`https`), o `null` si es relativa. */
export function schemeOf(url: string): string | null {
  if (!url.includes('://')) {
    return null;
  }

  try {
    return new URL(url).protocol.replace(':', '');
  } catch {
    return null;
  }
}

/**
 * La ruta de la API, con los identificadores sustituidos por su forma.
 *
 * `app.api.route.template` tiene que agrupar: `/profiles/8a3f…` y
 * `/profiles/b71c…` son la misma operación y en Jaeger deben aparecer juntas.
 * Sin esto, cada perfil consultado sería una operación distinta y la lista
 * crecería hasta ser inútil.
 *
 * Se reconocen las dos formas que la API usa hoy —UUID y entero— y nada más.
 * Un reemplazo más agresivo (todo segmento largo) confundiría partes fijas de
 * la ruta con identificadores.
 */
export function apiRouteTemplate(url: string): string {
  return sanitizeUrl(url)
    .split('/')
    .map((segment) => {
      if (UUID.test(segment)) return ':id';
      if (/^\d+$/.test(segment)) return ':id';
      return segment;
    })
    .join('/');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
