import { HttpErrorResponse } from '@angular/common/http';

import type { AuthFailureCategory } from '../tracing/tracing.constants';

/**
 * Medir la autenticación sin registrar a quién autentica.
 *
 * ## La regla, escrita una vez
 *
 * De un flujo de autenticación se puede contar **qué pasó**, nunca **a quién**.
 * No viaja el usuario, ni el correo, ni el documento, ni la contraseña, ni el
 * código de segundo factor, ni el token, ni el refresh token, ni el `sid` del
 * JWT, ni el identificador de organización.
 *
 * Lo que sí viaja son tres cosas, y las tres son categorías cerradas: el método
 * (`email` o `national_id`), el resultado (`success` o `failure`) y —cuando
 * falla— el motivo en una de siete palabras.
 *
 * ## Por qué categorías y no el mensaje de la API
 *
 * El mensaje puede cambiar de redacción entre versiones, puede venir traducido
 * y puede citar el valor que falló. Un `auth.failure.category` de
 * `invalid_credentials` significa lo mismo hoy que dentro de un año, y no puede
 * llevar un correo dentro por accidente.
 *
 * Son además las mismas categorías con las que `errorToViewState` decide qué
 * pantalla mostrar, así que un pico de `network_error` en el panel se
 * corresponde exactamente con la gente que vio el estado «sin conexión».
 */

/**
 * Traduce un fallo de autenticación a su categoría.
 *
 * El `status` de la respuesta es la única entrada: **el cuerpo no se lee**. El
 * contrato de error de esta API trae un `message` que en un fallo de validación
 * puede citar el valor rechazado.
 */
export function authFailureCategory(error: unknown): AuthFailureCategory {
  if (!(error instanceof HttpErrorResponse)) {
    return 'unknown';
  }

  switch (true) {
    /**
     * `0` no es un código de estado: es lo que Angular pone cuando la petición
     * no salió o no volvió —sin red, DNS caído, CORS bloqueado—.
     */
    case error.status === 0:
      return 'network_error';

    /**
     * En el resto de la aplicación un 401 significa que la sesión se venció.
     * En el login significa que las credenciales no sirven, que es un caso
     * distinto y mucho más frecuente. Quien llama pasa `esLogin` para
     * distinguirlos; sin él se elige el significado general.
     */
    case error.status === 401:
      return 'expired_session';

    case error.status === 403:
      return 'invalid_credentials';
    case error.status === 422 || error.status === 400:
      return 'validation_error';
    case error.status === 429:
      return 'rate_limited';
    case error.status >= 500:
      return 'server_error';
    default:
      return 'unknown';
  }
}

/**
 * La categoría vista desde el login.
 *
 * Un 401 acá no es una sesión vencida: es alguien escribiendo mal su
 * contraseña. Contarlos juntos haría que un ataque de fuerza bruta se
 * confundiera con un pico de sesiones caducadas.
 */
export function loginFailureCategory(error: unknown): AuthFailureCategory {
  if (error instanceof HttpErrorResponse && error.status === 401) {
    return 'invalid_credentials';
  }
  return authFailureCategory(error);
}

/**
 * Con qué se identificó la persona. Del **tipo** de credencial, no del valor.
 *
 * `LoginCredentials` es una unión discriminada: se mira el discriminante, que
 * ya es una de dos palabras. En ningún momento se toca `email` ni `nationalId`.
 */
export function authMethodOf(credentials: { kind: 'email' | 'nationalId' }): string {
  return credentials.kind === 'email' ? 'email' : 'national_id';
}
