import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { setDocumentSignature, documentSignature } from '../../shared/utils/pdf-export/pdf-signature';
import {
  setDocumentFonts,
  documentFonts,
} from '../../shared/utils/pdf-export/pdf-fonts';
import { establecerLogoDeDocumentos, logoDeDocumentos } from '../../shared/utils/pdf-export/pdf-logo';
import { AuthService } from '../auth/auth.service';
import { SignatureAndSealClient } from '../data-access/profiles/signature-and-seal.client';
import { ProfilesClient } from '../data-access/profiles/profiles.client';
import { PracticeLogoClient } from '../data-access/practice-sites/practice-logo.client';
import { PdfBrandingService, PREPARAR_FUENTES, PREPARAR_LOGO } from './pdf-branding.service';

const LOGO = { dataUrl: 'data:image/png;base64,AAAA', formato: 'PNG' as const, ancho: 3, alto: 1 };
const FUENTES = {
  titulos: { archivo: 'poppins-600.ttf', base64: 'AA==' },
  cuerpo: { archivo: 'inter-400.ttf', base64: 'AA==' },
};

describe('PdfBrandingService', () => {
  const perfil = signal<string | null>(null);
  const cliente = { getUrl: vi.fn() };
  const prepararLogo = vi.fn();
  const prepararFuentes = vi.fn();
  const firmaYSello = { get: vi.fn() };
  const perfiles = { getOwnPractitionerProfile: vi.fn() };

  /** Deja correr los efectos y las promesas pendientes. */
  const asentar = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    vi.resetAllMocks();
    perfil.set(null);
    establecerLogoDeDocumentos(null);
    setDocumentSignature(null);
    setDocumentFonts(null);
    prepararFuentes.mockResolvedValue(FUENTES);
    firmaYSello.get.mockReturnValue(of({ firmaUrl: null, selloUrl: null }));
    perfiles.getOwnPractitionerProfile.mockReturnValue(
      of({ displayName: 'Dra. Valeria Rojas', licenses: [{ licenseNumber: 'M-1234' }] }),
    );
    cliente.getUrl.mockReturnValue(of('data:image/svg+xml;utf8,x'));
    prepararLogo.mockResolvedValue(LOGO);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { practitionerProfileId: perfil } },
        { provide: PracticeLogoClient, useValue: cliente },
        { provide: PREPARAR_LOGO, useValue: prepararLogo },
        { provide: PREPARAR_FUENTES, useValue: prepararFuentes },
        { provide: SignatureAndSealClient, useValue: firmaYSello },
        { provide: ProfilesClient, useValue: perfiles },
      ],
    });
  });

  /**
   * Las fuentes no son de nadie: se bajan una vez por sesión y no se limpian
   * al cambiar de profesional ni al cerrar sesión.
   */
  it('baja las fuentes de marca una sola vez, haya o no profesional', async () => {
    TestBed.inject(PdfBrandingService);
    await asentar();
    expect(documentFonts()).toEqual(FUENTES);

    perfil.set('per-1');
    await asentar();
    perfil.set(null);
    await asentar();

    expect(prepararFuentes).toHaveBeenCalledTimes(1);
    expect(documentFonts()).toEqual(FUENTES);
  });

  it('si las fuentes no se pudieron bajar, los PDF salen en Helvetica', async () => {
    prepararFuentes.mockResolvedValue(null);
    TestBed.inject(PdfBrandingService);
    await asentar();

    expect(documentFonts()).toBeNull();
  });

  it('sin profesional en la sesión no pide nada y deja los PDF sin logo', async () => {
    TestBed.inject(PdfBrandingService);
    await asentar();

    expect(cliente.getUrl).not.toHaveBeenCalled();
    expect(logoDeDocumentos()).toBeNull();
  });

  it('con profesional deja listo su logo para todos los documentos', async () => {
    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();

    expect(cliente.getUrl).toHaveBeenCalledWith('per-1');
    expect(logoDeDocumentos()).toEqual(LOGO);
  });

  it('al cerrar sesión limpia el logo: no sobrevive a su dueño', async () => {
    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();

    perfil.set(null);
    await asentar();

    expect(logoDeDocumentos()).toBeNull();
  });

  it('sin logo cargado o con una imagen ilegible los PDF salen sin logo', async () => {
    cliente.getUrl.mockReturnValue(of(null));
    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();
    expect(logoDeDocumentos()).toBeNull();

    prepararLogo.mockResolvedValue(null);
    cliente.getUrl.mockReturnValue(of('data:image/png;base64,roto'));
    TestBed.inject(PdfBrandingService).recargar();
    await asentar();
    expect(logoDeDocumentos()).toBeNull();
  });

  it('una respuesta lenta del profesional anterior no pisa al vigente', async () => {
    let soltarLento: (logo: typeof LOGO | null) => void = () => undefined;
    prepararLogo
      .mockReturnValueOnce(new Promise((resolver) => (soltarLento = resolver)))
      .mockResolvedValue({ ...LOGO, dataUrl: 'data:image/png;base64,BBBB' });

    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();
    perfil.set('per-2');
    await asentar();

    soltarLento(LOGO);
    await asentar();

    expect(logoDeDocumentos()?.dataUrl).toBe('data:image/png;base64,BBBB');
  });

  it('recargar vuelve a leer el logo, para cuando se guarda uno nuevo', async () => {
    const servicio = TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();
    cliente.getUrl.mockClear();

    servicio.recargar();
    await asentar();

    expect(cliente.getUrl).toHaveBeenCalledTimes(1);
  });

  describe('la firma y el sello de los documentos', () => {
    it('sin profesional en la sesión no hay bloque de firma', async () => {
      TestBed.inject(PdfBrandingService);
      await asentar();

      expect(documentSignature()).toBeNull();
    });

    it('con profesional y sin imágenes deja el nombre y la matrícula, con la línea vacía', async () => {
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      expect(documentSignature()).toEqual({
        nombre: 'Dra. Valeria Rojas',
        matricula: 'M-1234',
        firma: null,
        sello: null,
      });
    });

    it('con las dos imágenes las deja listas para el PDF', async () => {
      firmaYSello.get.mockReturnValue(of({ firmaUrl: 'data:image/png;base64,F', selloUrl: 'data:image/png;base64,S' }));
      prepararLogo.mockImplementation(async (url: string) => ({ ...LOGO, dataUrl: url }));
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      expect(documentSignature()?.firma?.dataUrl).toBe('data:image/png;base64,F');
      expect(documentSignature()?.sello?.dataUrl).toBe('data:image/png;base64,S');
    });

    it('si el perfil no se puede leer el bloque sale igual, sin nombre ni matrícula', async () => {
      perfiles.getOwnPractitionerProfile.mockReturnValue(throwError(() => new Error('500')));
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      expect(documentSignature()).toEqual({ nombre: '', matricula: null, firma: null, sello: null });
    });

    it('sin matrícula cargada la deja en null', async () => {
      perfiles.getOwnPractitionerProfile.mockReturnValue(of({ displayName: 'Dra. R', licenses: [] }));
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      expect(documentSignature()?.matricula).toBeNull();
    });

    it('una imagen ilegible queda en null y no impide el bloque', async () => {
      firmaYSello.get.mockReturnValue(of({ firmaUrl: 'data:image/png;base64,roto', selloUrl: null }));
      prepararLogo.mockResolvedValue(null);
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      expect(documentSignature()).toMatchObject({ nombre: 'Dra. Valeria Rojas', firma: null });
    });

    it('al cerrar sesión limpia el bloque: no sobrevive a su dueño', async () => {
      TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();

      perfil.set(null);
      await asentar();

      expect(documentSignature()).toBeNull();
    });

    it('recargar vuelve a leer la firma, para cuando se guarda una nueva', async () => {
      const servicio = TestBed.inject(PdfBrandingService);
      perfil.set('per-1');
      await asentar();
      firmaYSello.get.mockClear();

      servicio.recargar();
      await asentar();

      expect(firmaYSello.get).toHaveBeenCalledTimes(1);
    });
  });
});
