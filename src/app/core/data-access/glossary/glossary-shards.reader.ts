/** Cómo se leen los archivos: `fetch` en el navegador, un doble en las pruebas. */
export type LectorDeArchivos = (ruta: string) => Promise<unknown>;

/** El error que distingue «no existe» de «falló»: la raíz completa puede faltar. */
export class ArchivoAusente extends Error {}

/**
 * El lector del navegador: `fetch` relativo a la base del documento.
 *
 * Fuera del navegador (SSR, pruebas sin doble) no hay de dónde leer: se dice
 * con un error explícito y el manejador contesta 503, en vez de colgar el
 * render esperando un archivo que nunca llega.
 */
export const leerConFetch: LectorDeArchivos = async (ruta) => {
  if (typeof fetch === 'undefined' || typeof document === 'undefined') {
    throw new Error('El glosario de la maqueta sólo se lee en el navegador.');
  }
  const respuesta = await fetch(new URL(ruta, document.baseURI).toString());
  if (respuesta.status === 404) throw new ArchivoAusente(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}: ${respuesta.status}`);
  // El servidor de desarrollo devuelve `index.html` con 200 para cualquier
  // ruta que no conoce: si no es JSON, el archivo no existe.
  if (!(respuesta.headers.get('content-type') ?? '').includes('json')) {
    throw new ArchivoAusente(ruta);
  }
  return respuesta.json();
};
