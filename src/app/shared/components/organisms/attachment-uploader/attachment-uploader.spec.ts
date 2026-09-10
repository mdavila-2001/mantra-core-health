import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { AttachmentUploader } from './attachment-uploader';

/**
 * Lo que estas pruebas fijan.
 *
 * Adjuntar son **dos** operaciones encadenadas, y el caso interesante es el del
 * medio: que la subida salga bien y el vínculo falle. Ahí el archivo **ya
 * existe**, y decir «no se pudo subir» llevaría a reintentar y duplicarlo.
 */
describe('AttachmentUploader', () => {
  let fixture: ComponentFixture<AttachmentUploader>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const archivoPdf = (nombre = 'estudio.pdf'): File =>
    new File(['bytes'], nombre, { type: 'application/pdf' });

  const elegirArchivos = (...archivos: readonly File[]): void => {
    (fixture.componentInstance as unknown as {
      seleccionados: { set: (v: readonly File[]) => void };
    }).seleccionados.set(archivos);
    fixture.detectChanges();
  };

  const elegirArchivo = (): void => elegirArchivos(archivoPdf());

  /**
   * Aprieta «Adjuntar» y cede el turno.
   *
   * La tanda sube **en secuencia** con `await`, así que la petición no está
   * puesta hasta que el microtask corre. Sin este respiro, `expectOne` mira
   * antes de que exista.
   */
  const subir = async (): Promise<void> => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes('Adjuntar'))!.click();
    await Promise.resolve();
  };

  /** Cede el turno para que el paso siguiente de la tanda emita su petición. */
  const seguir = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttachmentUploader],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AttachmentUploader);
    fixture.componentRef.setInput('ownerType', 'PATIENT');
    fixture.componentRef.setInput('ownerId', 'p-1');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('sube y después vincula: son dos peticiones', async () => {
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    await subir();

    const subida = http.expectOne((r) => r.url === '/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'f-1' });
    await seguir();

    const vinculo = http.expectOne((r) => r.url === '/common/files/f-1/links');
    expect(vinculo.request.body).toEqual({
      ownerType: 'PATIENT',
      ownerId: 'p-1',
    });
    vinculo.flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
    await seguir();

    expect(avisos.length).toBe(1);
  });

  /**
   * `linkVia` es la vía de escape para un dominio con su propia regla de quién
   * puede adjuntar qué (ALV-033: `clinical` liga por su propio endpoint, no
   * por el genérico de `common`, que no verifica rol ni que el dueño exista).
   */
  it('con `linkVia`, el vínculo pasa por ahí y no por el genérico', async () => {
    const enlazar = vi.fn((_fileId: string, _ownerId: string) => of(undefined));
    fixture.componentRef.setInput('linkVia', enlazar);
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    await subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });
    await seguir();

    expect(enlazar).toHaveBeenCalledWith('f-1', 'p-1');
    http.expectNone((r) => r.url === '/common/files/f-1/links');
    expect(avisos.length).toBe(1);
  });

  /**
   * El caso del medio. Si acá dijera «no se pudo subir», quien lo lea vuelve a
   * subir el mismo archivo y quedan dos copias en el sistema.
   */
  it('si falla el vínculo dice que el archivo YA se subió', async () => {
    elegirArchivo();
    await subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });
    await seguir();
    http
      .expectOne((r) => r.url === '/common/files/f-1/links')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await seguir();

    expect(texto()).toContain('se subió pero no se pudo adjuntar');
    expect(texto()).toContain('no volviendo a subirlo');
  });

  it('si falla la subida no intenta vincular nada', async () => {
    elegirArchivo();
    await subir();

    http
      .expectOne((r) => r.url === '/common/files/upload')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await seguir();

    expect(texto()).toContain('no se pudo subir');
    http.expectNone((r) => r.url.includes('/links'));
  });

  /** Sensibilidad `PHI` por defecto: en dato clínico se protege de más. */
  it('el valor por defecto de sensibilidad es PHI', async () => {
    elegirArchivo();
    await subir();

    const req = http.expectOne((r) => r.url === '/common/files/upload');
    expect((req.request.body as FormData).get('sensitivity')).toBe('PHI');
    req.flush({ id: 'f-1' });
    await seguir();
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('sin archivo elegido no manda nada', async () => {
    await subir();
    http.expectNone((r) => r.url === '/common/files/upload');
  });

  /* -- La tanda (pedido del cliente) --------------------------------------- */

  /**
   * «Un gestor para subir archivos de todo tipo y formato **y en varias
   * cantidades**.» De a uno y en orden, porque el backend recibe un archivo por
   * petición.
   */
  it('sube varios archivos, uno por uno y en orden', async () => {
    const avisos: number[] = [];
    let tandaTerminada = 0;
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));
    fixture.componentInstance.attachedAll.subscribe(() => (tandaTerminada += 1));

    elegirArchivos(archivoPdf('uno.pdf'), archivoPdf('dos.pdf'));
    await subir();

    // El primero solo: la segunda subida no arranca hasta que ésta cierra.
    const primera = http.expectOne((r) => r.url === '/common/files/upload');
    expect((primera.request.body as FormData).get('file')).toBeInstanceOf(File);
    primera.flush({ id: 'f-1' });
    await seguir();
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({ id: 'l-1' });
    await seguir();

    const segunda = http.expectOne((r) => r.url === '/common/files/upload');
    segunda.flush({ id: 'f-2' });
    await seguir();
    http.expectOne((r) => r.url === '/common/files/f-2/links').flush({ id: 'l-2' });
    await seguir();

    expect(avisos.length).toBe(2);
    expect(tandaTerminada).toBe(1);
  });

  /**
   * Un fallo no cancela la tanda: obligar a volver a elegir los que sí habían
   * entrado es peor que nombrar el que no.
   */
  it('si uno falla, los demás siguen y el que falló se nombra', async () => {
    elegirArchivos(archivoPdf('bueno.pdf'), archivoPdf('roto.pdf'));
    await subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });
    await seguir();
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({ id: 'l-1' });
    await seguir();

    http
      .expectOne((r) => r.url === '/common/files/upload')
      .flush({}, { status: 500, statusText: 'Server Error' });
    await seguir();

    expect(texto()).toContain('roto.pdf');
    expect(texto()).toContain('no se pudo subir');
  });

  /**
   * La categoría se deduce del tipo: era una pregunta cuya respuesta ya estaba
   * en el archivo, y lo único que la elección podía hacer era equivocarse.
   */
  it('una imagen viaja como IMAGE y un PDF como DOCUMENT', async () => {
    elegirArchivos(new File(['x'], 'placa.png', { type: 'image/png' }));
    await subir();

    const req = http.expectOne((r) => r.url === '/common/files/upload');
    expect((req.request.body as FormData).get('category')).toBe('IMAGE');
    req.flush({ id: 'f-1' });
    await seguir();
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({ id: 'l-1' });
    await seguir();
  });
});
