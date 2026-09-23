import { Observable } from 'rxjs';

/**
 * Los bytes de una imagen convertidos a `data:` URL.
 *
 * Compartido entre `FilesClient.imageDataUrl()` (el archivo propio) y
 * `CommunityClient.commentMediaDataUrl()` (el adjunto de un comentario ajeno
 * cuyo post sí puede verse, FND-01): las dos bajan un `Blob` autenticado por
 * `HttpClient` y necesitan exactamente la misma conversión — duplicarla es
 * la clase de regla que diverge el día que sólo se corrige en un lado.
 *
 * `FileReader` y no `btoa(String.fromCharCode(...))`: el segundo revienta la
 * pila con archivos grandes —una foto de cámara son millones de argumentos en
 * una sola llamada— y además obliga a adivinar el tipo MIME, que el `Blob` ya
 * trae del `Content-Type` de la respuesta.
 *
 * Bajo SSR no existe `FileReader`; la lectura falla ahí y quien llama degrada
 * al estado vacío correcto en el servidor.
 */
export function blobToDataUrl(bytes: Blob): Observable<string> {
  return new Observable<string>((observer) => {
    if (typeof FileReader === 'undefined') {
      observer.error(new Error('FileReader no disponible'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      observer.next(String(lector.result));
      observer.complete();
    };
    lector.onerror = () => observer.error(lector.error);
    lector.readAsDataURL(bytes);
    // Cancelar la suscripción aborta la lectura: si la pantalla se cerró, no
    // tiene sentido seguir decodificando una foto que ya nadie va a ver.
    return () => lector.abort();
  });
}
