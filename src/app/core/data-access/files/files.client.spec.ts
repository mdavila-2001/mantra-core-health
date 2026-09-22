import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FilesClient } from './files.client';
import type { LinkedFilePage, StoredFileContent } from './files.types';

/**
 * Lo que estas pruebas fijan.
 *
 * El subsistema de archivos tiene dos trampas propias que ninguna prueba de
 * componente puede ver: que **adjuntar son dos operaciones**, y que la URL de
 * descarga **vence**. Las dos se comprueban acá, en la frontera.
 *
 * Los cuerpos se escriben con la forma que el servidor manda de verdad —fechas
 * en texto, opcionales en `null`— y no con la del tipo de la vista.
 */
describe('FilesClient', () => {
  let client: FilesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(FilesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listLinked acota siempre por propietario', () => {
    client.listLinked({ ownerType: 'PATIENT', ownerId: 'p-1' }).subscribe();

    const req = http.expectOne((r) => r.url === '/common/files/links');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('ownerType')).toBe('PATIENT');
    expect(req.request.params.get('ownerId')).toBe('p-1');

    req.flush({ items: [], count: 0 });
  });

  /**
   * `new Date(null)` es 1970. Un adjunto sin fecha se mostraría como adjuntado
   * el 1 de enero de 1970, que en una ficha clínica se lee como un dato real.
   */
  it('listLinked convierte las fechas y elimina los nulos del archivo', () => {
    let pagina: LinkedFilePage | undefined;
    client
      .listLinked({ ownerType: 'PATIENT', ownerId: 'p-1' })
      .subscribe((p) => (pagina = p));

    http.expectOne((r) => r.url === '/common/files/links').flush({
      items: [
        {
          linkId: 'l-1',
          ownerId: 'p-1',
          ownerType: 'PATIENT',
          linkedAt: '2026-08-14T10:00:00.000Z',
          file: {
            id: 'f-1',
            currentVersionId: null,
            originalName: null,
            category: 'IMAGE',
            sensitivity: 'PHI',
            lifecycleStatusConceptId: 'c-activo',
            createdAt: '2026-08-13T09:00:00.000Z',
          },
        },
      ],
      count: 1,
    });

    const adjunto = pagina!.items[0]!;
    expect(adjunto.linkedAt).toEqual(new Date('2026-08-14T10:00:00.000Z'));
    expect(adjunto.file.createdAt).toEqual(new Date('2026-08-13T09:00:00.000Z'));
    expect('originalName' in adjunto.file).toBe(false);
    expect('currentVersionId' in adjunto.file).toBe(false);
    expect(adjunto.file.sensitivity).toBe('PHI');
  });

  /**
   * Adjuntar son **dos** peticiones: subir deja el archivo en el sistema,
   * vincular lo cuelga del recurso. Están separadas porque el mismo archivo
   * puede adjuntarse en más de un lado.
   */
  it('link es una operación aparte de upload', () => {
    client
      .link('f-1', { ownerType: 'PATIENT', ownerId: 'p-1' })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/common/files/f-1/links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ownerType: 'PATIENT', ownerId: 'p-1' });

    req.flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('los identificadores raros van escapados en la URL', () => {
    client.link('a/b', { ownerType: 'TENANT', ownerId: 't-1' }).subscribe();

    const req = http.expectOne((r) => r.url === '/common/files/a%2Fb/links');
    req.flush({
      id: 'l-1',
      fileId: 'a/b',
      ownerId: 't-1',
      ownerType: 'TENANT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
  });

  /**
   * La URL de descarga vence, y su vencimiento tiene que llegar como `Date`
   * para que alguien pueda decidir si sigue sirviendo. Como texto, la
   * comparación se haría alfabéticamente.
   */
  it('downloadUrl convierte el vencimiento', () => {
    let vence: Date | undefined;
    client.downloadUrl('f-1').subscribe((r) => (vence = r.expiresAt));

    const req = http.expectOne((r) => r.url === '/common/files/f-1/download-url');
    expect(req.request.method).toBe('POST');

    req.flush({
      url: 'https://almacen/f-1?firma=abc',
      expiresAt: '2026-08-14T10:15:00.000Z',
    });

    expect(vence).toEqual(new Date('2026-08-14T10:15:00.000Z'));
  });

  /**
   * El defecto que dejaba las fotos invisibles.
   *
   * `downloadUrl()` devuelve `file://local/<sha>?firma=…` en esta instalación
   * —comprobado en `common.file_versions`—, y eso en un `src` no carga nunca.
   * La foto se subía bien, el perfil la guardaba, el alta decía «Listo» y el
   * avatar seguía mostrando iniciales. `imageDataUrl` baja los bytes por la
   * ruta autenticada y los entrega como `data:`, que es lo único que la CSP
   * del proyecto (`img-src 'self' data:`) deja pintar.
   */
  it('imageDataUrl baja el contenido y lo entrega como data: URL', async () => {
    const recibido = new Promise<string>((resolve) => {
      client.imageDataUrl('f-1').subscribe(resolve);
    });

    const req = http.expectOne((r) => r.url === '/common/files/f-1/content');
    expect(req.request.method).toBe('GET');
    // Sin `blob` la respuesta llegaría como texto y el `data:` saldría con el
    // tipo equivocado: el MIME lo aporta el propio Blob.
    expect(req.request.responseType).toBe('blob');

    req.flush(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }));

    await expect(recibido).resolves.toMatch(/^data:image\/png;base64,/);
  });

  /**
   * 5.2 · la metadata sale de la respuesta que ya se pide.
   *
   * Esto es lo que hace innecesario un `GET /common/files/:id`: el tipo y el
   * tamaño son los del `Blob`, y el nombre viene en `Content-Disposition`. La
   * prueba va acá, en la frontera HTTP, porque lo que hay que demostrar no es
   * el parseo —eso está en `content-disposition.spec.ts`— sino que el método
   * **conserva la respuesta** (`observe: 'response'`) y llega a leer la
   * cabecera: con `responseType: 'blob'` a secas no hay `headers` que leer.
   */
  it('storedFileContent trae tipo, tamaño y nombre de la propia respuesta', async () => {
    const recibido = new Promise<StoredFileContent>((resolve) => {
      client.storedFileContent('f-1').subscribe(resolve);
    });

    const req = http.expectOne((r) => r.url === '/common/files/f-1/content');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');
    // Misma ruta que `contentDataUrl`: no se abre un camino nuevo al binario
    // ni se pasa por `/download-url`.
    expect(req.request.url).not.toContain('download-url');

    req.flush(new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/pdf' }), {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''an%C3%A1lisis.pdf" },
    });

    await expect(recibido).resolves.toMatchObject({
      mimeType: 'application/pdf',
      sizeBytes: 4,
      originalName: 'análisis.pdf',
    });
  });

  /**
   * El caso que ocurre hoy de verdad: `common.files.original_name` es nullable
   * y el backend simulado sirve los bytes sin emitir la cabecera. El contrato
   * debe dejar `originalName` **ausente** —ni vacío ni inventado— para que la
   * pantalla ponga su propio texto de reserva.
   */
  it('sin Content-Disposition no hay nombre, pero sí tipo y tamaño', async () => {
    const recibido = new Promise<StoredFileContent>((resolve) => {
      client.storedFileContent('f-2').subscribe(resolve);
    });

    http
      .expectOne((r) => r.url === '/common/files/f-2/content')
      .flush(new Blob([new Uint8Array([9])], { type: 'image/png' }));

    const contenido = await recibido;
    expect(contenido.mimeType).toBe('image/png');
    expect(contenido.sizeBytes).toBe(1);
    expect(contenido.originalName).toBeUndefined();
  });

  /**
   * Un adjunto ajeno responde 403 y el error tiene que **propagarse**: quien
   * llama degrada a un aviso. Convertirlo en un contenido vacío sería fabricar
   * un archivo que no se puede ver, y de paso disimular un control de acceso.
   */
  it('propaga el 403 en vez de devolver un contenido vacío', async () => {
    const fallo = new Promise<{ status: number }>((resolve) => {
      client.storedFileContent('f-ajeno').subscribe({ error: resolve });
    });

    http
      .expectOne((r) => r.url === '/common/files/f-ajeno/content')
      .flush(null, { status: 403, statusText: 'Forbidden' });

    await expect(fallo).resolves.toMatchObject({ status: 403 });
  });

  /**
   * Restaurada del spec original: la escribió quien construyó `upload()` y fija
   * un defecto real de multipart. Si alguien pone el `Content-Type` a mano, la
   * petición viaja **sin boundary** y el servidor la rechaza sin decir por qué.
   */
  it('no fija el Content-Type: el navegador debe poner el boundary', () => {
    client
      .upload(new File(['x'], 'informe.pdf', { type: 'application/pdf' }), 'DOCUMENT', 'NORMAL')
      .subscribe();

    const req = http.expectOne('/common/files/upload');
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush({ id: 'f-2' });
  });

  it('upload manda el archivo como multipart con categoría y sensibilidad', () => {
    const archivo = new File(['contenido'], 'estudio.pdf', {
      type: 'application/pdf',
    });
    client.upload(archivo, 'DOCUMENT', 'PHI').subscribe();

    const req = http.expectOne((r) => r.url === '/common/files/upload');
    const cuerpo = req.request.body as FormData;
    expect(cuerpo.get('category')).toBe('DOCUMENT');
    expect(cuerpo.get('sensitivity')).toBe('PHI');
    expect(cuerpo.get('file')).toBeInstanceOf(File);

    req.flush({ id: 'f-1' });
  });
});
