/**
 * Preparación compartida de las pruebas.
 *
 * Corre una vez por archivo de prueba, después de que el builder inicializa los
 * polyfills y el `TestBed`. Es el lugar para lo transversal: si mañana hace
 * falta un doble global o una comprobación común, va acá y no repetido en cada
 * spec.
 *
 * Hoy sostiene una sola cosa, y es deliberado.
 */

/**
 * `decodeAccessToken` decodifica el JWT con `atob` y `TextDecoder`. Los dos
 * existen tanto en el navegador como en Node, pero **si jsdom cambiara y alguno
 * faltara**, el síntoma sería un puñado de pruebas fallando por «token
 * ilegible» —porque la función devuelve `null` ante cualquier anomalía, que es
 * lo correcto en producción— y nadie miraría el entorno.
 *
 * Fallar acá, una vez y con el motivo escrito, ahorra esa cacería.
 */
if (typeof atob !== 'function' || typeof TextDecoder !== 'function') {
  throw new Error(
    'El entorno de pruebas no expone `atob` o `TextDecoder`, que la lectura del JWT necesita.',
  );
}
