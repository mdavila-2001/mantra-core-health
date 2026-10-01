import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { FirmaYSelloClient } from './firma-y-sello.client';

const RUTA = '/profiles/practitioners/me/signature-assets';

/**
 * Con el `FilesClient` sustituido por un doble: lo que se prueba es que la fachada
 * habla con **una** ruta y con el cliente de archivos, no con el simulador.
 */
describe('FirmaYSelloClient', () => {
  const archivos = { imageDataUrl: vi.fn(), upload: vi.fn() };
  let cliente: FirmaYSelloClient;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.resetAllMocks();
    archivos.imageDataUrl.mockImplementation((id: string) => of(`data:image/png;base64,${id}`));
    archivos.upload.mockReturnValue(of({ id: 'file-nuevo' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FilesClient, useValue: archivos },
      ],
    });
    cliente = TestBed.inject(FirmaYSelloClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('obtener', () => {
    it('lee las dos imágenes y las devuelve como data URL', () => {
      let resultado: unknown = null;
      cliente.obtener().subscribe((r) => (resultado = r));
      http.expectOne(RUTA).flush({ signatureFileId: 'f1', sealFileId: 's1' });

      expect(resultado).toEqual({
        firmaUrl: 'data:image/png;base64,f1',
        selloUrl: 'data:image/png;base64,s1',
      });
    });

    it('si una de las dos no está cargada, esa viene en null y la otra sí', () => {
      let resultado: unknown = null;
      cliente.obtener().subscribe((r) => (resultado = r));
      http.expectOne(RUTA).flush({ signatureFileId: 'f1', sealFileId: null });

      expect(resultado).toEqual({ firmaUrl: 'data:image/png;base64,f1', selloUrl: null });
      expect(archivos.imageDataUrl).toHaveBeenCalledTimes(1);
    });

    it('si falla la lectura devuelve «nada cargado» y no rompe', () => {
      let resultado: unknown = null;
      let error: unknown = null;
      cliente.obtener().subscribe({ next: (r) => (resultado = r), error: (e) => (error = e) });
      http.expectOne(RUTA).flush('boom', { status: 500, statusText: 'x' });

      expect(error).toBeNull();
      expect(resultado).toEqual({ firmaUrl: null, selloUrl: null });
    });

    it('si falla una imagen, esa queda en null y no arrastra a la otra', () => {
      archivos.imageDataUrl.mockImplementation((id: string) =>
        id === 'f1' ? throwError(() => new Error('403')) : of('data:image/png;base64,ok'),
      );
      let resultado: unknown = null;
      cliente.obtener().subscribe((r) => (resultado = r));
      http.expectOne(RUTA).flush({ signatureFileId: 'f1', sealFileId: 's1' });

      expect(resultado).toEqual({ firmaUrl: null, selloUrl: 'data:image/png;base64,ok' });
    });
  });

  describe('subir', () => {
    it('sube como imagen de sensibilidad normal y devuelve sólo el id', () => {
      const archivo = new File(['x'], 'firma.png', { type: 'image/png' });
      let id = '';
      cliente.subir(archivo).subscribe((valor) => (id = valor));

      expect(archivos.upload).toHaveBeenCalledWith(archivo, 'IMAGE', 'NORMAL');
      expect(id).toBe('file-nuevo');
    });
  });

  describe('guardar', () => {
    it('manda sólo lo que cambió: una clave ausente deja lo que había', () => {
      cliente.guardar({ firmaFileId: 'f2' }).subscribe();

      const req = http.expectOne(RUTA);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ signatureFileId: 'f2' });
      req.flush({ signatureFileId: 'f2', sealFileId: 's1' });
    });

    it('con null quita esa imagen', () => {
      cliente.guardar({ selloFileId: null }).subscribe();

      const req = http.expectOne(RUTA);
      expect(req.request.body).toEqual({ sealFileId: null });
      req.flush({ signatureFileId: 'f1', sealFileId: null });
    });

    it('puede cambiar las dos a la vez', () => {
      cliente.guardar({ firmaFileId: 'f2', selloFileId: 's2' }).subscribe();

      const req = http.expectOne(RUTA);
      expect(req.request.body).toEqual({ signatureFileId: 'f2', sealFileId: 's2' });
      req.flush({ signatureFileId: 'f2', sealFileId: 's2' });
    });
  });
});
