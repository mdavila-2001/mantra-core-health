/**
 * Forma del entorno. Vive aparte de los dos archivos que la implementan porque
 * `fileReplacements` sustituye `environment.ts` entero al compilar: si el tipo
 * viviera ahí, el archivo de desarrollo no podría importarlo sin quedar
 * atado al que va a ser reemplazado.
 *
 * Anotar ambos con este tipo es lo que impide que se separen sin que nadie se
 * entere.
 *
 * **Todo campo de esta interfaz es público.** Termina literal en el JavaScript
 * que descarga el navegador, legible con abrir las herramientas de desarrollo.
 * Agregar acá una clave de API, una contraseña o un token no es una filtración
 * potencial: es publicarlo. Lo que necesite secreto se resuelve en la API, que
 * es donde hay dónde guardarlo.
 *
 * Los valores concretos no se escriben en los archivos de entorno: los inyecta
 * `scripts/generate-env.mjs` desde el entorno del proceso y `.env` (ver
 * `env.generated.ts`), que además rechaza lo que tenga forma de credencial.
 */
export interface Environment {
  /**
   * Raíz de la API.
   *
   * Vacío significa **rutas relativas**, que es lo correcto cuando algo delante
   * de la aplicación resuelve el destino: en desarrollo lo hace el proxy del
   * servidor de Angular (`proxy.conf.json`), y en un despliegue de mismo origen
   * lo hace el servidor web.
   *
   * Se define por entorno con `PUBLIC_API_BASE_URL`. El generador la valida:
   * absoluta con http/https, sin query ni fragmento y sin `usuario:contraseña@`
   * embebidos —esa forma de autenticación acabaría en el paquete y en el
   * historial de peticiones—.
   *
   * Ningún componente ni servicio arma una URL absoluta a mano: siempre sale de
   * acá.
   */
  readonly apiBaseUrl: string;
}
