import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { FilesClient } from '../files/files.client';
import { PracticeLogoClient } from './practice-logo.client';
import { PracticeSitesClient } from './practice-sites.client';

/**
 * La fachada se prueba con **dobles** de los dos clientes que usa, no con el
 * simulador: es lo que garantiza que ficha, editor y PDF no dependen de él. El
 * día que el logo viva en el backend real, estas pruebas siguen valiendo
 * cambiando sólo el doble.
 */
describe('LogoDelConsultorioClient', () => {
  const PROPIA = { id: 'site-1', isOwnSite: true, logoFileId: 'file-logo' };
  const AJENA = { id: 'site-2', isOwnSite: false, logoFileId: 'file-ajeno' };

  const sitios = { listSitesOfPractitioner: vi.fn(), setSiteLogo: vi.fn() };
  const archivos = { imageDataUrl: vi.fn(), upload: vi.fn() };
  let cliente: PracticeLogoClient;

  beforeEach(() => {
    vi.resetAllMocks();
    sitios.listSitesOfPractitioner.mockReturnValue(of({ items: [AJENA, PROPIA], count: 2 }));
    sitios.setSiteLogo.mockReturnValue(of(PROPIA));
    archivos.imageDataUrl.mockReturnValue(of('data:image/png;base64,AAAA'));
    archivos.upload.mockReturnValue(of({ id: 'file-nuevo' }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PracticeSitesClient, useValue: sitios },
        { provide: FilesClient, useValue: archivos },
      ],
    });
    cliente = TestBed.inject(PracticeLogoClient);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  describe('obtenerUrl', () => {
    it('lee el logo del consultorio PROPIO, no el de una sede ajena', () => {
      let url: string | null = '';
      cliente.getUrl('per-1').subscribe((valor) => (url = valor));

      expect(archivos.imageDataUrl).toHaveBeenCalledWith('file-logo');
      expect(url).toBe('data:image/png;base64,AAAA');
    });

    it('sin logo cargado devuelve null y no pide ningún archivo', () => {
      sitios.listSitesOfPractitioner.mockReturnValue(
        of({ items: [{ ...PROPIA, logoFileId: null }], count: 1 }),
      );
      let url: string | null = 'x';
      cliente.getUrl('per-1').subscribe((valor) => (url = valor));

      expect(url).toBeNull();
      expect(archivos.imageDataUrl).not.toHaveBeenCalled();
    });

    it('sin consultorio propio devuelve null', () => {
      sitios.listSitesOfPractitioner.mockReturnValue(of({ items: [AJENA], count: 1 }));
      let url: string | null = 'x';
      cliente.getUrl('per-1').subscribe((valor) => (url = valor));

      expect(url).toBeNull();
    });

    it.each([
      ['la lista de sedes', () => sitios.listSitesOfPractitioner.mockReturnValue(throwError(() => new Error('500')))],
      ['el archivo', () => archivos.imageDataUrl.mockReturnValue(throwError(() => new Error('403')))],
    ])('si falla %s devuelve null: un logo que no carga no rompe nada', (_donde, romper) => {
      romper();
      let url: string | null = 'x';
      let error: unknown = null;
      cliente.getUrl('per-1').subscribe({ next: (valor) => (url = valor), error: (e) => (error = e) });

      expect(error).toBeNull();
      expect(url).toBeNull();
    });
  });

  describe('subir', () => {
    it('sube como imagen de sensibilidad normal y devuelve sólo el id', () => {
      const archivo = new File(['x'], 'logo.png', { type: 'image/png' });
      let id = '';
      cliente.upload(archivo).subscribe((valor) => (id = valor));

      expect(archivos.upload).toHaveBeenCalledWith(archivo, 'IMAGE', 'NORMAL');
      expect(id).toBe('file-nuevo');
    });
  });

  describe('guardar', () => {
    it('asocia el archivo al consultorio propio', () => {
      cliente.save('per-1', 'file-nuevo').subscribe();

      expect(sitios.setSiteLogo).toHaveBeenCalledWith('site-1', 'file-nuevo');
    });

    it('con null quita el logo', () => {
      cliente.save('per-1', null).subscribe();

      expect(sitios.setSiteLogo).toHaveBeenCalledWith('site-1', null);
    });

    it('sin consultorio propio no falla ni escribe nada', () => {
      sitios.listSitesOfPractitioner.mockReturnValue(of({ items: [AJENA], count: 1 }));
      let terminó = false;
      cliente.save('per-1', 'file-nuevo').subscribe({ complete: () => (terminó = true) });

      expect(terminó).toBe(true);
      expect(sitios.setSiteLogo).not.toHaveBeenCalled();
    });
  });

  /**
   * La pre-carga del alta: no hay sesión, así que no va por
   * `POST /common/files/upload` sino por la ruta pública que el alta reclama.
   */
  describe('subir para el alta', () => {
    it('manda el archivo por multipart a la pre-carga pública y devuelve el id a reenviar', async () => {
      const http = TestBed.inject(HttpTestingController);
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      const fileId = firstValueFrom(cliente.uploadForRegistration(file));

      const req = http.expectOne('/iam/auth/upload-registration-logo');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      expect((req.request.body as FormData).get('file')).toBe(file);
      req.flush({
        fileId: 'logo-alta',
        originalName: 'logo.png',
        sizeBytes: 1,
        mimeType: 'image/png',
      });

      expect(await fileId).toBe('logo-alta');
      expect(archivos.upload).not.toHaveBeenCalled();
    });

    it('sin un id confirmado falla con un motivo, en vez de seguir sin logo', async () => {
      const http = TestBed.inject(HttpTestingController);
      const fileId = firstValueFrom(cliente.uploadForRegistration(new File(['x'], 'logo.png')));

      http.expectOne('/iam/auth/upload-registration-logo').flush({ fileId: '' });

      await expect(fileId).rejects.toThrow('No pudimos confirmar la carga del logo');
    });
  });
});

/**
 * La misma fachada contra la **forma** que responde la API
 * (`PractitionerSiteDto` de `GET /practitioners/:id/sites`), con el cliente de
 * sedes de verdad: lo que se comprueba es que el `logoFileId` que manda la API
 * es el que la ficha termina pidiendo, y que el cambio sale por su ruta.
 */
describe('PracticeLogoClient contra la forma de la API', () => {
  const OWN_SITE = {
    id: 'site-1',
    practiceId: 'practice-1',
    code: 'CONSULTORIO',
    name: 'Consultorio Rojas',
    timeZone: 'America/La_Paz',
    addressText: null,
    latitude: null,
    longitude: null,
    contactPhone: null,
    isOwnSite: true,
    bankQrFileId: null,
    logoFileId: 'file-logo',
    status: 'status-active',
  };
  const files = { imageDataUrl: vi.fn(), upload: vi.fn() };
  let client: PracticeLogoClient;
  let http: HttpTestingController;

  beforeEach(() => {
    vi.resetAllMocks();
    files.imageDataUrl.mockReturnValue(of('data:image/png;base64,AAAA'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: FilesClient, useValue: files },
      ],
    });
    client = TestBed.inject(PracticeLogoClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee el logoFileId de la sede propia tal como lo manda la API', async () => {
    const url = firstValueFrom(client.getUrl('per-1'));

    http.expectOne('/practitioners/per-1/sites').flush({
      items: [{ ...OWN_SITE, id: 'site-2', isOwnSite: false, logoFileId: 'file-ajeno' }, OWN_SITE],
      count: 2,
    });

    expect(await url).toBe('data:image/png;base64,AAAA');
    expect(files.imageDataUrl).toHaveBeenCalledWith('file-logo');
  });

  it('con logoFileId null de la API no pide ningún archivo', async () => {
    const url = firstValueFrom(client.getUrl('per-1'));

    http
      .expectOne('/practitioners/per-1/sites')
      .flush({ items: [{ ...OWN_SITE, logoFileId: null }], count: 1 });

    expect(await url).toBeNull();
    expect(files.imageDataUrl).not.toHaveBeenCalled();
  });

  it('guarda el logo en la sede propia con el PUT de la API', async () => {
    const saved = firstValueFrom(client.save('per-1', 'file-nuevo'));

    http.expectOne('/practitioners/per-1/sites').flush({ items: [OWN_SITE], count: 1 });
    const req = http.expectOne('/practitioners/me/sites/site-1/logo');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fileId: 'file-nuevo' });
    req.flush({ ...OWN_SITE, logoFileId: 'file-nuevo' });

    await saved;
  });
});
