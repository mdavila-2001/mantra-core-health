import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FilePreviewImage } from './file-preview-image';

/**
 * FND-01/FND-02. Lo que este componente tiene que fijar y lo que el carril
 * anterior nunca ejercitó: que pide el adjunto por
 * `GET /community/comments/media/:fileId/content` —autorizado por «puedo ver
 * el post», no por «lo subí yo»— y **no** por `GET /common/files/:id/content`
 * (`FilesClient.imageDataUrl`, que sí exige ser el dueño y era exactamente el
 * 403 que dejaba el ícono roto para cualquiera que no fuera quien subió la
 * foto). Sin esta prueba, ese regreso al endpoint equivocado habría vuelto a
 * pasar los 91 tests que sí corrían.
 */
describe('FilePreviewImage', () => {
  let fixture: ComponentFixture<FilePreviewImage>;
  let http: HttpTestingController;

  function tick(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Espera a que salga de «carga», en vez de adivinar cuántas vueltas de cola
   * hacen falta. La respuesta HTTP simulada pasa por `switchMap` y después
   * por `FileReader.readAsDataURL` —ninguno de los dos síncrono en jsdom, y
   * cuántas vueltas toma no es un número estable entre corridas—, así que un
   * conteo fijo de `tick()` es exactamente el temporizador arbitrario que
   * `09_FAILURE_RECOVERY.md` pide no usar contra algo intermitente.
   */
  async function esperarHastaResolver(intentosMax = 50): Promise<void> {
    for (let intento = 0; intento < intentosMax; intento++) {
      await tick();
      fixture.detectChanges();
      if (estadoActual() !== 'carga') return;
    }
    throw new Error('Siguió en «carga» tras esperar la conversión a data: URL');
  }

  function estadoActual(): string | null {
    const raiz = fixture.nativeElement as HTMLElement;
    if (raiz.querySelector('img')) return 'listo';
    if (raiz.querySelector('.file-preview-image--error')) return 'error';
    if (raiz.querySelector('.file-preview-image--carga')) return 'carga';
    return null;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilePreviewImage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FilePreviewImage);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pide el adjunto por la ruta de comentarios, no por la de archivos propios', async () => {
    fixture.componentRef.setInput('fileId', 'f-1');
    fixture.detectChanges();

    expect(estadoActual()).toBe('carga');
    const peticion = http.expectOne('/community/comments/media/f-1/content');
    expect(peticion.request.method).toBe('GET');

    peticion.flush(new Blob(['bytes'], { type: 'image/png' }));
    await esperarHastaResolver();

    expect(estadoActual()).toBe('listo');
    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('src')).toMatch(/^data:image\/png/);
  });

  it('un 403 (u otro fallo) degrada al estado de error, no rompe la tarjeta', async () => {
    fixture.componentRef.setInput('fileId', 'f-ajeno');
    fixture.detectChanges();

    http
      .expectOne('/community/comments/media/f-ajeno/content')
      .flush(new Blob(['{"message":"No tiene acceso"}'], { type: 'application/json' }), {
        status: 403,
        statusText: 'Forbidden',
      });
    await esperarHastaResolver();

    expect(estadoActual()).toBe('error');
  });

  it('cambiar de fileId vuelve a pedir el adjunto nuevo: la instancia se reusa al reordenar', async () => {
    fixture.componentRef.setInput('fileId', 'f-1');
    fixture.detectChanges();
    http.expectOne('/community/comments/media/f-1/content').flush(new Blob(['a']));
    await esperarHastaResolver();

    fixture.componentRef.setInput('fileId', 'f-2');
    fixture.detectChanges();

    expect(estadoActual()).toBe('carga');
    http.expectOne('/community/comments/media/f-2/content').flush(new Blob(['b']));
    await esperarHastaResolver();

    expect(estadoActual()).toBe('listo');
  });

  it('el alt text pasa al <img>', async () => {
    fixture.componentRef.setInput('fileId', 'f-1');
    fixture.componentRef.setInput('altText', 'Radiografía de tórax');
    fixture.detectChanges();

    http.expectOne('/community/comments/media/f-1/content').flush(new Blob(['bytes']));
    await esperarHastaResolver();

    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Radiografía de tórax');
  });
});
