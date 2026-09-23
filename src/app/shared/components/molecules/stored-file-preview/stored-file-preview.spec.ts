import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { StoredFilePreview } from './stored-file-preview';

/**
 * Lo que estas pruebas fijan.
 *
 * Este componente es un **adaptador**: su único trabajo es traducir un `fileId`
 * al `File` que `app-file-preview` ya sabe pintar, y mostrar lo que el archivo
 * dice de sí mismo. Por eso las pruebas no verifican que un PDF se rasterice
 * —eso es del motor, y tiene su propio arnés en `playwright/file-upload-preview`—
 * sino lo que sí es responsabilidad de acá: qué metadata se muestra, qué se
 * hace cuando falta, y que un archivo que no se puede leer no termine en una
 * pantalla rota ni en un acceso que no corresponde.
 */
@Component({
  imports: [StoredFilePreview],
  template: `<app-stored-file-preview [fileId]="id()" nombreDeReserva="Evidencia adjunta" />`,
})
class HostComponent {
  readonly id = signal('f-1');
}

describe('StoredFilePreview', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** Responde la petición pendiente del contenido de `fileId`. */
  function responder(
    fileId: string,
    blob: Blob,
    contentDisposition?: string,
  ): void {
    const req = http.expectOne((r) => r.url === `/common/files/${fileId}/content`);
    req.flush(
      blob,
      contentDisposition === undefined
        ? undefined
        : { headers: { 'Content-Disposition': contentDisposition } },
    );
    fixture.detectChanges();
  }

  function imagen(bytes = 2048): Blob {
    return new Blob([new Uint8Array(bytes)], { type: 'image/png' });
  }

  it('muestra nombre real, tipo en palabras y tamaño de una imagen', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen(2048), "attachment; filename*=UTF-8''radiografia.png");

    expect(texto()).toContain('radiografia.png');
    expect(texto()).toContain('Imagen PNG');
    expect(texto()).toContain('2 KB');
    expect(texto()).not.toContain('nombre no disponible');
  });

  it('reconoce un PDF y lo entrega al motor de vista previa', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder(
      'f-1',
      new Blob([new Uint8Array(10)], { type: 'application/pdf' }),
      "attachment; filename*=UTF-8''consentimiento.pdf",
    );

    expect(texto()).toContain('Documento PDF');
    // El motor existente recibe el archivo; rasterizarlo es cosa suya.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('app-file-preview'),
    ).not.toBeNull();
  });

  it('un tipo que el navegador no muestra sigue teniendo metadata', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder(
      'f-1',
      new Blob([new Uint8Array(5000)], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
      "attachment; filename*=UTF-8''informe.docx",
    );

    // Sin vista previa posible, pero el nombre, el tipo y el peso siguen ahí:
    // es lo que deja decidir si vale la pena descargarlo.
    expect(texto()).toContain('informe.docx');
    expect(texto()).toContain('Documento Word');
    expect(texto()).toContain('4.9 KB');
  });

  it('conserva un nombre Unicode tal cual', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen(), "attachment; filename*=UTF-8''citolog%C3%ADa-a%C3%B1o.png");

    expect(texto()).toContain('citología-año.png');
  });

  it('acepta un nombre sin extensión', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen(), "attachment; filename*=UTF-8''receta");

    expect(texto()).toContain('receta');
  });

  /**
   * El caso que ocurre hoy con el backend simulado y con todo archivo cuyo
   * `original_name` sea `NULL`. Se usa el nombre de reserva **y se dice que lo
   * es**: mostrarlo como si fuera el real haría creer que el archivo se llama
   * «Evidencia adjunta».
   */
  it('sin Content-Disposition usa el nombre de reserva y lo declara', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen());

    expect(texto()).toContain('Evidencia adjunta');
    expect(texto()).toContain('nombre no disponible');
  });

  it('sin tipo declarado lo dice en vez de inventarlo', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', new Blob([new Uint8Array(3)]));

    expect(texto()).toContain('Tipo desconocido');
  });

  it('un archivo de 0 bytes no rompe el formato del tamaño', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', new Blob([], { type: 'image/png' }));

    expect(texto()).toContain('0 bytes');
  });

  /**
   * 403 por adjunto ajeno. Lo que importa no es sólo que no se rompa: es que
   * **no haya un segundo intento por otra ruta**. Un componente que ante el 403
   * probara `/download-url` convertiría un control de acceso en un rodeo.
   */
  it('ante un 403 avisa y no intenta ninguna otra ruta', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === '/common/files/f-1/content')
      .flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos abrir este archivo');
    // `http.verify()` en el afterEach falla si quedó cualquier petición viva.
    http.expectNone(() => true);
  });

  it('un archivo borrado se ve igual que uno sin permiso', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    http
      .expectOne((r) => r.url === '/common/files/f-1/content')
      .flush(null, { status: 412, statusText: 'Precondition Failed' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos abrir este archivo');
  });

  /**
   * Relectura: la lista de adjuntos puede reordenarse y reusar la instancia con
   * otro `fileId`. Sin el `effect`, la fila nueva mostraría el archivo viejo.
   */
  it('al cambiar de archivo vuelve a leer y no arrastra el anterior', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen(1024), "attachment; filename*=UTF-8''primero.png");
    expect(texto()).toContain('primero.png');

    host.id.set('f-2');
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-2', imagen(4096), "attachment; filename*=UTF-8''segundo.png");

    expect(texto()).toContain('segundo.png');
    expect(texto()).not.toContain('primero.png');
  });

  it('nunca pide la URL firmada ni expone rutas internas', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    responder('f-1', imagen(), "attachment; filename*=UTF-8''estudio.png");

    http.expectNone((r) => r.url.includes('download-url'));
    expect(texto()).not.toContain('s3://');
    expect(texto()).not.toContain('file://');
  });
});
