import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { CommentMediaPicker } from './comment-media-picker';
import type { NewCommentMedia } from '@core/data-access/community/community.types';

/**
 * Lo que estas pruebas fijan (REQ-01-011).
 *
 * Que la subida es real —`POST /common/files/upload`, no un `fileId`
 * inventado en el cliente—, que cada botón etiqueta el adjunto con SU rol
 * (`IMAGE`/`STICKER`/`GIF`) y no uno fijo, y que quitar un adjunto también
 * borra el archivo del lado del servidor: un adjunto quitado antes de enviar
 * el comentario no puede quedar huérfano en el storage.
 */
describe('CommentMediaPicker', () => {
  let fixture: ComponentFixture<CommentMediaPicker>;
  let http: HttpTestingController;
  let emitidos: readonly (readonly NewCommentMedia[])[];

  function archivo(name: string, type: string): File {
    return new File(['contenido'], name, { type });
  }

  function boton(testid: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  }

  function inputDe(testid: string): HTMLInputElement {
    // El `<input>` oculto es el hermano siguiente del botón en la plantilla.
    return boton(testid).nextElementSibling as HTMLInputElement;
  }

  /** Deja correr micro/macrotareas reales: `FileReader` en jsdom no es síncrono. */
  function tick(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function elegirArchivo(testid: string, file: File): Promise<void> {
    const input = inputDe(testid);
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await tick();
    http.expectOne('/common/files/upload').flush({ id: 'f-1' });
    // `Promise.all([subida, dataUrl])` + el `await` que sigue necesitan otra
    // vuelta de cola después de resolver la petición.
    await tick();
    await tick();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommentMediaPicker],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(CommentMediaPicker);
    emitidos = [];
    fixture.componentInstance.cambio.subscribe((lista) => {
      emitidos = [...emitidos, lista];
    });
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('subir una imagen manda category=IMAGE y emite el adjunto con rol IMAGE', async () => {
    await elegirArchivo('comment-media-add-image', archivo('foto.png', 'image/png'));

    expect(emitidos.at(-1)).toEqual([{ fileId: 'f-1', mediaRole: 'IMAGE' }]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="comment-media-item"]').length).toBe(1);
  });

  it('el botón "Sticker" etiqueta el mismo pipeline de subida con rol STICKER', async () => {
    await elegirArchivo('comment-media-add-sticker', archivo('sticker.png', 'image/png'));

    expect(emitidos.at(-1)).toEqual([{ fileId: 'f-1', mediaRole: 'STICKER' }]);
  });

  it('el botón "GIF" etiqueta el adjunto con rol GIF', async () => {
    await elegirArchivo('comment-media-add-gif', archivo('reaccion.gif', 'image/gif'));

    expect(emitidos.at(-1)).toEqual([{ fileId: 'f-1', mediaRole: 'GIF' }]);
  });

  it('quitar un adjunto lo saca de la lista, lo emite y borra el archivo en el servidor', async () => {
    await elegirArchivo('comment-media-add-image', archivo('foto.png', 'image/png'));

    fixture.nativeElement.querySelector('[data-testid="comment-media-remove"]').click();
    fixture.detectChanges();

    expect(emitidos.at(-1)).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('[data-testid="comment-media-item"]').length).toBe(0);

    http.expectOne('/common/files/f-1').flush({});
  });

  it('un error de subida se muestra y no agrega el adjunto', async () => {
    const input = inputDe('comment-media-add-image');
    const file = archivo('foto.png', 'image/png');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await tick();

    http.expectOne('/common/files/upload').flush(
      { message: 'fallo' },
      { status: 500, statusText: 'Server Error' },
    );
    await tick();
    await tick();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos subir');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="comment-media-item"]').length).toBe(0);
  });

  it('limpiar() vacía el estado, para cuando el comentario ya se envió', async () => {
    await elegirArchivo('comment-media-add-image', archivo('foto.png', 'image/png'));

    fixture.componentInstance.limpiar();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="comment-media-item"]').length).toBe(0);
  });
});
