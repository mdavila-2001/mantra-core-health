import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FilesClient } from './files.client';

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

  afterEach(() => {
    http.verify();
  });

  it('sube el archivo como multipart con los tres campos del contrato', () => {
    const archivo = new File(['contenido'], 'carnet.png', { type: 'image/png' });

    client.upload(archivo, 'IMAGE', 'PHI').subscribe();

    const req = http.expectOne('/common/files/upload');
    expect(req.request.method).toBe('POST');

    const cuerpo = req.request.body as FormData;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get('file')).toBe(archivo);
    expect(cuerpo.get('category')).toBe('IMAGE');
    expect(cuerpo.get('sensitivity')).toBe('PHI');

    req.flush({ id: 'f-1' });
  });

  it('no fija el Content-Type: el navegador debe poner el boundary', () => {
    client
      .upload(new File(['x'], 'informe.pdf', { type: 'application/pdf' }), 'DOCUMENT', 'NORMAL')
      .subscribe();

    const req = http.expectOne('/common/files/upload');
    // Escribirlo a mano deja la peticion sin boundary y el servidor la rechaza.
    expect(req.request.headers.has('Content-Type')).toBe(false);

    req.flush({ id: 'f-2' });
  });
});
