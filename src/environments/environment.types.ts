/**
 * Forma del entorno. Vive aparte de los dos archivos que la implementan porque
 * `fileReplacements` sustituye `environment.ts` entero al compilar: si el tipo
 * viviera ahí, el archivo de desarrollo no podría importarlo sin quedar
 * atado al que va a ser reemplazado.
 *
 * Anotar ambos con este tipo es lo que impide que se separen sin que nadie se
 * entere.
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
   * Ningún componente ni servicio arma una URL absoluta a mano: siempre sale de
   * acá.
   */
  readonly apiBaseUrl: string;
}
