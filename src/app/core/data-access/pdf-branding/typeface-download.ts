/** Cómo se bajan los bytes de un archivo. Sustituible en pruebas. */
export type DownloadFile = (url: string) => Promise<ArrayBuffer | null>;

/** Baja un archivo público con `fetch`; `null` si no hay `fetch` o la respuesta no es 200. */
export async function downloadWithFetch(url: string): Promise<ArrayBuffer | null> {
  if (typeof fetch === 'undefined') {
    return null;
  }
  const respuesta = await fetch(url);
  return respuesta.ok ? respuesta.arrayBuffer() : null;
}
