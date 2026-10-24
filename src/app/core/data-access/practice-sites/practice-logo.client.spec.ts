import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

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
        { provide: PracticeSitesClient, useValue: sitios },
        { provide: FilesClient, useValue: archivos },
      ],
    });
    cliente = TestBed.inject(PracticeLogoClient);
  });

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
});
