import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ChatStore } from './chat.store';

/**
 * Lo que estas pruebas fijan de los adjuntos del store:
 *
 * - `enviarAdjuntos` pinta **todas** las burbujas en el acto y en orden, sube
 *   **de a una** (la segunda no sale hasta que la primera terminó) y manda un
 *   mensaje por archivo, con el texto en el primero.
 * - Una subida que falla no frena a las siguientes.
 * - «Reintentar» una subida fallida **vuelve a subir el archivo**: antes
 *   despachaba el pendiente sin `fileId` y salía la leyenda sola.
 */
describe('ChatStore · adjuntos', () => {
  let store: ChatStore;
  let http: HttpTestingController;

  const perfilPropio = {
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'hp-1',
    slug: 'juan-paciente',
    displayName: 'Juan Paciente',
    headline: null,
    biography: null,
    acceptsReviews: null,
  };

  const foto = (nombre: string): File => new File(['x'], nombre, { type: 'image/jpeg' });

  const subidas = () => http.match((r) => r.url === '/common/files/upload');
  const envios = () => http.match((r) => r.url === '/community/conversations/c-1/messages' && r.method === 'POST');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ChatStore);
    store.iniciar();
    http.expectOne('/community/profiles/me').flush(perfilPropio);
    http
      .match((r) => r.url === '/community/conversations')
      .forEach((p) => p.flush({ items: [], count: 0, limit: 50, nextCursor: null }));
    store.activaId.set('c-1');
  });

  afterEach(() => {
    store.detener();
    http.match(() => true).forEach((pedido) => pedido.flush(null));
  });

  it('pinta todas en orden, sube de a una y la leyenda va con la primera', () => {
    store.enviarAdjuntos([foto('1.jpg'), foto('2.jpg'), foto('3.jpg')], '  Frente y dorso ');

    expect(store.pendientes().map((p) => [p.adjunto?.nombre, p.bodyText])).toEqual([
      ['1.jpg', 'Frente y dorso'],
      ['2.jpg', ''],
      ['3.jpg', ''],
    ]);

    // Sólo la primera está subiendo.
    const primera = subidas();
    expect(primera).toHaveLength(1);
    expect((primera[0].request.body as FormData).get('category')).toBe('IMAGE');
    primera[0].flush({ id: 'f-1' });

    // La primera se despacha con su archivo y su texto; recién ahí sube la segunda.
    const envio1 = envios();
    expect(envio1).toHaveLength(1);
    expect(envio1[0].request.body).toMatchObject({ bodyText: 'Frente y dorso', attachmentFileId: 'f-1' });
    const segunda = subidas();
    expect(segunda).toHaveLength(1);
    expect(((segunda[0].request.body as FormData).get('file') as File).name).toBe('2.jpg');
  });

  it('una subida fallida no frena a las siguientes', () => {
    store.enviarAdjuntos([foto('1.jpg'), foto('2.jpg')], '');
    subidas()[0].flush('boom', { status: 500, statusText: 'Error' });

    expect(store.pendientes()[0].estado).toBe('fallado');
    const segunda = subidas();
    expect(segunda).toHaveLength(1);
    expect(((segunda[0].request.body as FormData).get('file') as File).name).toBe('2.jpg');
  });

  it('reintentar una subida fallida vuelve a subir el archivo, no manda el texto solo', () => {
    store.enviarAdjunto(foto('receta.jpg'), 'Mi receta');
    subidas()[0].flush('boom', { status: 500, statusText: 'Error' });
    const fallado = store.pendientes()[0];
    expect(fallado.estado).toBe('fallado');

    store.reintentar(fallado);

    expect(envios()).toHaveLength(0);
    const otraVez = subidas();
    expect(otraVez).toHaveLength(1);
    expect(store.pendientes()[0].estado).toBe('enviando');
    otraVez[0].flush({ id: 'f-9' });
    expect(envios()[0].request.body).toMatchObject({ bodyText: 'Mi receta', attachmentFileId: 'f-9' });
  });

  it('descartar una subida fallida la saca del hilo', () => {
    store.enviarAdjunto(foto('receta.jpg'), '');
    subidas()[0].flush('boom', { status: 500, statusText: 'Error' });
    store.descartar(store.pendientes()[0]);
    expect(store.pendientes()).toEqual([]);
  });
});
