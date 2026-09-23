import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';

import { fileAttributes } from '../../observability/business/file-tracing';
import { TracingService } from '../../observability/tracing/tracing.service';
import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos } from '../wire';
import { blobToDataUrl } from './blob-to-data-url';
import { nombreDeContentDisposition } from './content-disposition';
import type {
  DownloadUrl,
  FileLink,
  LinkedFile,
  LinkedFilePage,
  LinkedFilesQuery,
  NewFileLink,
  StoredFileContent,
} from './files.types';

/** Los dos únicos valores que admite el backend. */
export type FileCategory = 'DOCUMENT' | 'IMAGE';

/**
 * Sensibilidad del contenido. `PHI` marca información de salud protegida y
 * cambia cómo se guarda y quién puede descargarla: no es una etiqueta
 * decorativa, así que se pide explícita en cada subida.
 */
export type FileSensitivity = 'NORMAL' | 'PHI';

export interface UploadedFile {
  readonly id: string;
}

/**
 * Cliente de archivos.
 *
 * La subida va como `multipart/form-data`: **no se fija el `Content-Type` a
 * mano**. El navegador tiene que ponerlo él para incluir el `boundary`, y
 * escribirlo rompe la petición del lado del servidor.
 */
@Injectable({
  providedIn: 'root',
})
export class FilesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly tracing = inject(TracingService);

  /**
   * `POST /common/files/upload`. El campo del archivo se llama `file`.
   *
   * El span `document.upload` mide la subida entera. De lo que se sube solo
   * viajan tres cosas: extensión, tipo MIME y **cubeta** de tamaño.
   *
   * **El nombre del archivo no.** En este sistema la gente sube cosas llamadas
   * `analisis-ana-perez-marzo.pdf`: ese texto solo lleva un nombre completo y
   * un diagnóstico. Y el tamaño va en cubetas porque un tamaño exacto, cruzado
   * con la hora, señala una subida concreta entre miles. Ver
   * `observability/business/file-tracing.ts`.
   *
   * `sensitivity` sí viaja, y es seguro: `NORMAL` o `PHI` describen **cómo se
   * guarda** el archivo, no qué contiene. Saber que fallan las subidas marcadas
   * `PHI` es exactamente el tipo de cosa para la que existe esto.
   */
  upload(
    file: File,
    category: FileCategory,
    sensitivity: FileSensitivity,
  ): Observable<UploadedFile> {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    form.append('sensitivity', sensitivity);

    return this.tracing.traceObservable(
      'document.upload',
      {
        ...fileAttributes(file),
        'file.category': category,
        'file.sensitivity': sensitivity,
        'app.feature': 'files',
        'ui.action': 'upload',
      },
      () => this.http.post<UploadedFile>(apiUrl(this.baseUrl, '/common/files/upload'), form),
    );
  }

  /**
   * `GET /common/files/links` — los adjuntos de un recurso.
   *
   * Los borrados lógicamente no vienen: el vínculo sobrevive al archivo, así
   * que el backend los filtra. Una lista que los incluyera ofrecería descargas
   * que terminan en 404.
   *
   * @param query - De qué recurso. Los dos campos obligatorios.
   * @returns Los adjuntos vigentes, del más reciente al más antiguo.
   */
  listLinked(query: LinkedFilesQuery): Observable<LinkedFilePage> {
    // Parámetro a parámetro: el backend valida con `forbidNonWhitelisted`.
    const params = new HttpParams()
      .set('ownerType', query.ownerType)
      .set('ownerId', query.ownerId);

    return this.http
      .get<WireLinkedFilePage>(apiUrl(this.baseUrl, '/common/files/links'), {
        params,
      })
      .pipe(map(toLinkedFilePage));
  }

  /**
   * `POST /common/files/:id/links` — adjunta un archivo ya subido.
   *
   * Es el **segundo** paso: primero `upload()` deja el archivo en el sistema,
   * después esto lo cuelga de un recurso. Están separados en el backend y acá
   * también, porque el mismo archivo puede adjuntarse en más de un lado.
   *
   * @param fileId - El archivo que devolvió `upload()`.
   * @param link - A qué recurso se adjunta.
   */
  link(fileId: string, link: NewFileLink): Observable<FileLink> {
    return this.http
      .post<WireFileLink>(
        apiUrl(this.baseUrl, `/common/files/${encodeURIComponent(fileId)}/links`),
        link,
      )
      .pipe(map(({ createdAt, ...resto }) => ({ ...resto, createdAt: new Date(createdAt) })));
  }

  /**
   * `POST /common/files/:id/download-url` — una URL firmada de vida corta.
   *
   * **Se pide al momento de descargar, no al pintar la lista.** La URL vence, y
   * emitir veinte al abrir una ficha deja veinte enlaces vivos a datos clínicos
   * de los que diecinueve nadie usó.
   *
   * @param fileId - El archivo a descargar.
   */
  downloadUrl(fileId: string): Observable<DownloadUrl> {
    return this.http
      .post<WireDownloadUrl>(
        apiUrl(this.baseUrl, `/common/files/${encodeURIComponent(fileId)}/download-url`),
        {},
      )
      .pipe(map(({ url, expiresAt }) => ({ url, expiresAt: new Date(expiresAt) })));
  }

  /**
   * La imagen de un archivo, lista para un `src`.
   *
   * ## Por qué no sirve `downloadUrl()` para pintar una foto
   *
   * Porque lo que devuelve **no es una URL de navegador**. El backend arma
   * `${storageUri}?fileId=…&signature=…` (`files.service.ts`), y en esta
   * instalación `storage_uri` vale `file://local/<sha256>`: verificado en la
   * base, las 5 subidas reales lo tienen así. Un `<img src="file://local/…">`
   * no carga en ningún navegador, y encima la CSP del proyecto declara
   * `img-src 'self' data:`. De ahí el síntoma que reportó el equipo: la subida
   * respondía bien, el perfil quedaba guardado —el alta marcaba «Listo»— y la
   * foto no aparecía nunca. La firma sigue sirviendo para lo suyo, que es
   * entregarle un puntero con vencimiento a otro sistema.
   *
   * ## Por qué `data:` y no `blob:`
   *
   * Un `blob:` sería más barato —no hay base64 de por medio— y la misma CSP lo
   * bloquea: `img-src` no lo declara. Se probó antes con la foto de perfil y
   * la imagen quedaba invisible con una violación en consola, que es peor que
   * no intentarlo.
   *
   * ## Por qué pasa por `HttpClient` y no por el atributo
   *
   * `GET /common/files/:id/content` exige `Authorization`, y un `<img>` no
   * manda cabeceras. Bajar los bytes acá deja que el interceptor de sesión
   * haga su trabajo.
   *
   * **Ojo con quién puede.** El backend sólo entrega el contenido a quien
   * subió el archivo o a un rol de revisión, así que esto resuelve la foto
   * *propia*. Para la foto de otra persona en un directorio público responde
   * 403 y hay que degradar a iniciales — y para el adjunto de un comentario
   * ajeno cuyo post sí se puede ver, la vía correcta es
   * `CommunityClient.commentMediaDataUrl()` (FND-01), no ésta: acá «quién
   * puede» es siempre «quien lo subió».
   *
   * @param fileId - El archivo a leer.
   * @returns La imagen como `data:` URL.
   */
  imageDataUrl(fileId: string): Observable<string> {
    return this.contentDataUrl(fileId);
  }

  /**
   * El contenido de un archivo propio, como `data:` URL — para ofrecerlo con
   * `<a download>` sin depender de una URL de navegador que la CSP bloquee
   * (mismo motivo que documenta `imageDataUrl`, que delega acá: es
   * exactamente el mismo `GET` autenticado, la única diferencia es la
   * intención de quien llama —pintar una miniatura o descargar un documento—).
   *
   * Sirve para "el archivo descargable" de una fila (FT-32-R02): el backend
   * ya exige ser quien lo subió o tener un rol revisor, así que no hace falta
   * un endpoint de descarga propio del dominio que lo referencia.
   *
   * @param fileId - El archivo a descargar.
   * @returns El contenido como `data:` URL, con su tipo MIME real.
   */
  contentDataUrl(fileId: string): Observable<string> {
    return this.http
      .get(apiUrl(this.baseUrl, `/common/files/${encodeURIComponent(fileId)}/content`), {
        responseType: 'blob',
      })
      .pipe(switchMap((bytes) => blobToDataUrl(bytes)));
  }

  /**
   * El contenido de un archivo propio **con la metadata que lo acompaña**.
   *
   * ## Por qué no hay un endpoint de metadata
   *
   * Porque no hace falta: el tipo, el tamaño y el nombre **ya vienen** en la
   * respuesta que hay que pedir de todos modos para mostrar el archivo. El
   * `Blob` trae el `Content-Type` en su `type` y los bytes en su `size`, y
   * `Content-Disposition` trae el nombre. Un `GET /common/files/:id` sería una
   * petición extra para volver a preguntar lo que ya está en la mano.
   *
   * ## Qué cambia respecto de `contentDataUrl`
   *
   * Sólo `observe: 'response'`. Aquél descarta la respuesta y se queda con los
   * bytes; éste la conserva para poder leer una cabecera. Misma ruta, mismo
   * método, misma autorización: **no abre ningún camino nuevo al binario**.
   *
   * ## Qué pasa si el nombre no viene
   *
   * `originalName` queda ausente y quien llama pone su propio texto. Pasa de
   * verdad y no es un caso raro: `common.files.original_name` es nullable, y el
   * backend simulado sirve los bytes sin emitir la cabecera. Inventar un nombre
   * ahí sería mostrar un dato falso en una pantalla clínica.
   *
   * **Quién puede.** Lo mismo que `contentDataUrl`: quien subió el archivo o un
   * rol de revisión. Para un adjunto ajeno responde 403, y quien llama degrada.
   *
   * @param fileId - El archivo a leer.
   * @returns Los bytes con su tipo, su tamaño y —si se pudo leer— su nombre.
   */
  storedFileContent(fileId: string): Observable<StoredFileContent> {
    return this.http
      .get(apiUrl(this.baseUrl, `/common/files/${encodeURIComponent(fileId)}/content`), {
        responseType: 'blob',
        observe: 'response',
      })
      .pipe(
        map((respuesta) => {
          const blob = respuesta.body ?? new Blob([]);
          return sinNulos({
            blob,
            mimeType: blob.type,
            sizeBytes: blob.size,
            originalName: nombreDeContentDisposition(
              respuesta.headers.get('Content-Disposition'),
            ),
          }) as StoredFileContent;
        }),
      );
  }

  /**
   * `DELETE /common/files/:id` — borrado **lógico** del archivo.
   *
   * Ojo con la semántica: borra el archivo, no el vínculo. Un archivo borrado
   * desaparece de todas las fichas donde estuviera adjunto, no sólo de ésta.
   *
   * @param fileId - El archivo a borrar.
   */
  softDelete(fileId: string): Observable<void> {
    return this.http
      .delete<unknown>(apiUrl(this.baseUrl, `/common/files/${encodeURIComponent(fileId)}`))
      .pipe(map(() => undefined));
  }
}

/* ============================================================================
    La forma del transporte: fechas en texto, opcionales que pueden ser `null`.
    Ver `wire.ts` para el porqué de normalizarlos en la frontera.
    ========================================================================== */

type WireStoredFile = Omit<LinkedFile['file'], 'createdAt'> & {
  readonly createdAt: string;
  readonly currentVersionId: string | null;
  readonly originalName: string | null;
};

type WireLinkedFile = Omit<LinkedFile, 'linkedAt' | 'file'> & {
  readonly linkedAt: string;
  readonly file: WireStoredFile;
};

interface WireLinkedFilePage {
  readonly items: readonly WireLinkedFile[];
  readonly count: number;
}

type WireFileLink = Omit<FileLink, 'createdAt'> & { readonly createdAt: string };

interface WireDownloadUrl {
  readonly url: string;
  readonly expiresAt: string;
}

function toLinkedFilePage(body: WireLinkedFilePage): LinkedFilePage {
  return {
    count: body.count,
    items: body.items.map(({ linkedAt, file, ...resto }) => ({
      ...resto,
      linkedAt: new Date(linkedAt),
      file: {
        ...sinNulos({
          ...file,
          createdAt: undefined as never,
        }),
        createdAt: new Date(file.createdAt),
      },
    })),
  };
}

