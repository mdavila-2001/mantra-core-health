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

  const elegirArchivo = (): void => {
    const archivo = new File(['bytes'], 'estudio.pdf', {
      type: 'application/pdf',
    });
    (fixture.componentInstance as unknown as {
      seleccionados: { set: (v: readonly File[]) => void };
    }).seleccionados.set([archivo]);
    fixture.detectChanges();
  };

  /**
   * Por `data-testid` y no por el texto: el rótulo dice la cantidad y cambia a
   * «Reintentar N archivos» después de un fallo parcial. Buscarlo por «Adjuntar»
   * dejaba de encontrarlo justo en el caso que hay que probar.
   */
  const subir = (): void => {
    const boton = fixture.nativeElement.querySelector('[data-testid="adjuntar-confirmar"]');
    (boton as HTMLButtonElement).click();
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

  it('sube y después vincula: son dos peticiones', () => {
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    subir();

    const subida = http.expectOne((r) => r.url === '/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'f-1' });

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

    expect(avisos.length).toBe(1);
  });

  /**
   * `linkVia` es la vía de escape para un dominio con su propia regla de quién
   * puede adjuntar qué (ALV-033: `clinical` liga por su propio endpoint, no
   * por el genérico de `common`, que no verifica rol ni que el dueño exista).
   */
  it('con `linkVia`, el vínculo pasa por ahí y no por el genérico', () => {
    const enlazar = vi.fn((_fileId: string, _ownerId: string) => of(undefined));
    fixture.componentRef.setInput('linkVia', enlazar);
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirArchivo();
    subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });

    expect(enlazar).toHaveBeenCalledWith('f-1', 'p-1');
    http.expectNone((r) => r.url === '/common/files/f-1/links');
    expect(avisos.length).toBe(1);
  });

  /**
   * El caso del medio. Si acá dijera «no se pudo subir», quien lo lea vuelve a
   * subir el mismo archivo y quedan dos copias en el sistema.
   */
  it('si falla el vínculo dice que el archivo YA se subió', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-1' });
    http
      .expectOne((r) => r.url === '/common/files/f-1/links')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('se subió pero no se pudo adjuntar');
    // El matiz que evita la copia duplicada: reintentar NO vuelve a subir. Y
    // ahora es cierto de verdad, no sólo un consejo — el `fileId` queda
    // guardado en la cola y el reintento retoma en el vínculo.
    expect(texto()).toContain('no se vuelve a subir');
  });

  it('si falla la subida no intenta vincular nada', () => {
    elegirArchivo();
    subir();

    http
      .expectOne((r) => r.url === '/common/files/upload')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos subir el archivo');
    http.expectNone((r) => r.url.includes('/links'));
  });

  /** Sensibilidad `PHI` por defecto: en dato clínico se protege de más. */
  it('el valor por defecto de sensibilidad es PHI', () => {
    elegirArchivo();
    subir();

    const req = http.expectOne((r) => r.url === '/common/files/upload');
    expect((req.request.body as FormData).get('sensitivity')).toBe('PHI');
    req.flush({ id: 'f-1' });
    http.expectOne((r) => r.url === '/common/files/f-1/links').flush({
      id: 'l-1',
      fileId: 'f-1',
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('sin archivo elegido no manda nada', () => {
    subir();
    http.expectNone((r) => r.url === '/common/files/upload');
    expect(texto()).toContain('Todavía no seleccionaste archivos');
  });

  /* ═══ El lote — corrección del 10/09/2026 ════════════════════════════════ */

  /** Elige varios archivos, como haría el control al soltar o al seleccionar. */
  const elegirVarios = (
    entradas: readonly { readonly nombre: string; readonly tipo: string }[],
  ): void => {
    const archivos = entradas.map(
      ({ nombre, tipo }) => new File(['bytes'], nombre, { type: tipo }),
    );
    (
      fixture.componentInstance as unknown as {
        seleccionados: { set: (v: readonly File[]) => void };
      }
    ).seleccionados.set(archivos);
    fixture.detectChanges();
  };

  /** Cierra el vínculo de un archivo ya subido. */
  const responderVinculo = (fileId: string): void => {
    http.expectOne((r) => r.url === `/common/files/${fileId}/links`).flush({
      id: `l-${fileId}`,
      fileId,
      ownerId: 'p-1',
      ownerType: 'PATIENT',
      createdAt: '2026-09-10T10:00:00.000Z',
    });
    fixture.detectChanges();
  };

  /** Responde bien la subida en vuelo y su vínculo. */
  const responderBien = (fileId: string): void => {
    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: fileId });
    responderVinculo(fileId);
  };

  it('manda TODOS los archivos elegidos, uno por petición', () => {
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirVarios([
      { nombre: 'estudio.pdf', tipo: 'application/pdf' },
      { nombre: 'lunar.jpg', tipo: 'image/jpeg' },
      { nombre: 'holter.png', tipo: 'image/png' },
    ]);
    // El rótulo dice la cantidad: no es un «Adjuntar» que esconde cuántos van.
    expect(texto()).toContain('Adjuntar 3 archivos');

    subir();
    responderBien('f-1');
    responderBien('f-2');
    responderBien('f-3');

    // Una sola vez y al final: `attached` significa «entró el lote entero».
    expect(avisos.length).toBe(1);
    expect(texto()).toContain('3 ya adjuntados');
  });

  it('la categoría sale del tipo real del archivo, y nadie la elige', () => {
    elegirVarios([
      { nombre: 'lunar.jpg', tipo: 'image/jpeg' },
      { nombre: 'estudio.pdf', tipo: 'application/pdf' },
    ]);

    // Los dos controles que la corrección manda sacar del formulario.
    expect(texto()).not.toContain('Categoría');
    expect(texto()).not.toContain('Sensibilidad');

    subir();

    const imagen = http.expectOne((r) => r.url === '/common/files/upload');
    expect((imagen.request.body as FormData).get('category')).toBe('IMAGE');
    // Sacar el selector no rebajó la protección del contenido.
    expect((imagen.request.body as FormData).get('sensitivity')).toBe('PHI');
    imagen.flush({ id: 'f-1' });
    responderVinculo('f-1');

    const documento = http.expectOne((r) => r.url === '/common/files/upload');
    expect((documento.request.body as FormData).get('category')).toBe('DOCUMENT');
    documento.flush({ id: 'f-2' });
    responderVinculo('f-2');
  });

  /**
   * El caso que la interfaz anterior no podía ni representar: uno entra, otro
   * falla. Decir «adjuntados correctamente» acá es cómo se pierde un estudio.
   */
  it('un fallo parcial no se anuncia como éxito y el reintento no duplica', () => {
    const avisos: number[] = [];
    fixture.componentInstance.attached.subscribe(() => avisos.push(1));

    elegirVarios([
      { nombre: 'uno.pdf', tipo: 'application/pdf' },
      { nombre: 'dos.pdf', tipo: 'application/pdf' },
    ]);
    subir();

    responderBien('f-1');
    // El segundo falla en la subida: no llegó a tener `fileId`.
    http
      .expectOne((r) => r.url === '/common/files/upload')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(avisos.length).toBe(0);
    expect(texto()).toContain('Algunos archivos no se pudieron adjuntar');
    expect(texto()).toContain('Reintentar 1 archivo');

    // El reintento toca **uno**: el que ya entró no se vuelve a mandar.
    subir();
    responderBien('f-2');

    expect(avisos.length).toBe(1);
    expect(texto()).toContain('2 ya adjuntados');
  });

  /**
   * El vínculo fallado deja el archivo subido. El reintento retoma en el
   * vínculo, no en la subida: lo contrario dejaba dos copias del mismo estudio.
   */
  it('reintentar un vínculo fallado NO vuelve a subir el archivo', () => {
    elegirArchivo();
    subir();

    http.expectOne((r) => r.url === '/common/files/upload').flush({ id: 'f-9' });
    http
      .expectOne((r) => r.url === '/common/files/f-9/links')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    subir();

    http.expectNone((r) => r.url === '/common/files/upload');
    responderVinculo('f-9');
  });

  it('quitar un archivo del medio conserva los otros', () => {
    elegirVarios([
      { nombre: 'uno.pdf', tipo: 'application/pdf' },
      { nombre: 'dos.pdf', tipo: 'application/pdf' },
      { nombre: 'tres.pdf', tipo: 'application/pdf' },
    ]);

    const quitar: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="adjuntar-quitar"]'),
    );
    expect(quitar.length).toBe(3);
    quitar[1]!.click();
    fixture.detectChanges();

    expect(texto()).toContain('uno.pdf');
    expect(texto()).not.toContain('dos.pdf');
    expect(texto()).toContain('tres.pdf');
    expect(texto()).toContain('Adjuntar 2 archivos');
  });

  /** El contexto heredado se muestra; no se vuelve a pedir. */
  it('muestra los vínculos que hereda del registro padre', () => {
    fixture.componentRef.setInput('contexto', [
      { rotulo: 'Paciente', valor: 'Ana Pérez' },
      { rotulo: 'Diagnóstico', valor: 'Hipertensión esencial' },
      { rotulo: 'Encuentro', valor: 'Ambulatorio · 4 sept 2026' },
    ]);
    fixture.detectChanges();

    expect(texto()).toContain('Hipertensión esencial');
    expect(texto()).toContain('Estos vínculos se aplican a todos los archivos seleccionados');
  });
});
