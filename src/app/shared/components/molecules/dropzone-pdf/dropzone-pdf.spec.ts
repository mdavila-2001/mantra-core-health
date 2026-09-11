import { HttpErrorResponse, HttpEventType, type HttpEvent } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { DropzonePdf } from './dropzone-pdf';
import type { PdfUploader, UploadedDocument } from './dropzone-pdf.types';

/** jsdom no trae DataTransfer: alcanza con lo que `app-file-input` realmente lee. */
function dropEvent(files: File[]): DragEvent {
  const event = new Event('drop', { bubbles: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

function pdf(name: string, size = 1024): File {
  const file = new File(['%PDF-1.7'], name, { type: 'application/pdf' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

function noPdf(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

describe('DropzonePdf', () => {
  let fixture: ComponentFixture<DropzonePdf>;
  let subida$: Subject<HttpEvent<UploadedDocument>>;
  let uploader: PdfUploader;
  let llamadas: File[];
  let fileIdEmitido: (string | null)[];

  function dropzone(): HTMLElement {
    return fixture.nativeElement.querySelector('.dropzone');
  }

  function estado(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="doc-estado"]');
  }

  function error(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="doc-error"]');
  }

  function progreso(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[data-testid="doc-progreso"]');
  }

  async function soltar(files: File[]): Promise<void> {
    dropzone().dispatchEvent(dropEvent(files));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    subida$ = new Subject<HttpEvent<UploadedDocument>>();
    llamadas = [];
    fileIdEmitido = [];
    uploader = (file: File) => {
      llamadas.push(file);
      return subida$.asObservable();
    };

    await TestBed.configureTestingModule({ imports: [DropzonePdf] }).compileComponents();
    fixture = TestBed.createComponent(DropzonePdf);
    fixture.componentRef.setInput('uploader', uploader);
    fixture.componentRef.setInput('label', 'Escritura de constitución');
    fixture.componentRef.setInput('testId', 'doc');
    fixture.componentInstance.fileId.subscribe((id) => fileIdEmitido.push(id));
    await fixture.whenStable();
  });

  it('un archivo que no es PDF se rechaza sin llamar al uploader', async () => {
    await soltar([noPdf('foto.png')]);

    expect(llamadas).toHaveLength(0);
    expect(error()?.textContent).toContain('Solo se admiten documentos PDF de hasta 10 MB.');
  });

  it('un PDF que excede el tamaño máximo se rechaza sin llamar al uploader', async () => {
    fixture.componentRef.setInput('maxSizeBytes', 1000);
    await fixture.whenStable();

    await soltar([pdf('grande.pdf', 5000)]);

    expect(llamadas).toHaveLength(0);
    expect(error()?.textContent).toContain('Solo se admiten documentos PDF de hasta 10 MB.');
  });

  it('un PDF válido dispara la subida y muestra el progreso', async () => {
    await soltar([pdf('escritura.pdf')]);

    expect(llamadas).toHaveLength(1);
    expect(estado().textContent).toContain('Subiendo escritura.pdf');

    subida$.next({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 } as HttpEvent<UploadedDocument>);
    await fixture.whenStable();

    const barra = progreso();
    expect(barra).toBeTruthy();
    expect(barra?.getAttribute('aria-valuenow')).toBe('50');
  });

  it('al completarse muestra el nombre, el peso y el check, y emite el fileId', async () => {
    await soltar([pdf('escritura.pdf', 2048)]);

    subida$.next({
      type: HttpEventType.Response,
      body: { fileId: 'file-1', originalName: 'escritura.pdf', sizeBytes: 2048, mimeType: 'application/pdf' },
    } as HttpEvent<UploadedDocument>);
    await fixture.whenStable();

    expect(estado().textContent).toContain('escritura.pdf');
    expect(estado().textContent).toContain('2 KB');
    expect(fixture.nativeElement.querySelector('.dropzone-pdf__check')).toBeTruthy();
    expect(fixture.componentInstance.fileId()).toBe('file-1');
    expect(fileIdEmitido).toContain('file-1');
  });

  it('un rechazo 422 del backend muestra el mensaje del servidor', async () => {
    await soltar([pdf('escritura.pdf')]);

    subida$.error(
      new HttpErrorResponse({ status: 422, error: { message: 'Solo se admiten documentos PDF' } }),
    );
    await fixture.whenStable();

    expect(error()?.getAttribute('role')).toBe('alert');
    expect(error()?.textContent).toContain('Solo se admiten documentos PDF');
    expect(fixture.componentInstance.fileId()).toBeNull();
  });

  it('un 413 del backend dice que el archivo supera los 10 MB', async () => {
    await soltar([pdf('escritura.pdf')]);

    subida$.error(new HttpErrorResponse({ status: 413 }));
    await fixture.whenStable();

    expect(error()?.textContent).toContain('El archivo supera los 10 MB.');
  });

  it('quitar vuelve al estado vacío y emite fileId null', async () => {
    await soltar([pdf('escritura.pdf', 2048)]);
    subida$.next({
      type: HttpEventType.Response,
      body: { fileId: 'file-1', originalName: 'escritura.pdf', sizeBytes: 2048, mimeType: 'application/pdf' },
    } as HttpEvent<UploadedDocument>);
    await fixture.whenStable();

    const quitar: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="doc-quitar"]',
    );
    quitar.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.fileId()).toBeNull();
    expect(fixture.nativeElement.querySelector('.dropzone-pdf__check')).toBeFalsy();
  });
});
