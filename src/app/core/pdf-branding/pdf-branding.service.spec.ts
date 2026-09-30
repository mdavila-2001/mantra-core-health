import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { establecerLogoDeDocumentos, logoDeDocumentos } from '../../shared/utils/pdf-export/pdf-logo';
import { AuthService } from '../auth/auth.service';
import { LogoDelConsultorioClient } from '../data-access/practice-sites/logo-del-consultorio.client';
import { PdfBrandingService, PREPARAR_LOGO } from './pdf-branding.service';

const LOGO = { dataUrl: 'data:image/png;base64,AAAA', formato: 'PNG' as const, ancho: 3, alto: 1 };

describe('PdfBrandingService', () => {
  const perfil = signal<string | null>(null);
  const cliente = { obtenerUrl: vi.fn() };
  const prepararLogo = vi.fn();

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
    cliente.obtenerUrl.mockReturnValue(of('data:image/svg+xml;utf8,x'));
    prepararLogo.mockResolvedValue(LOGO);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { practitionerProfileId: perfil } },
        { provide: LogoDelConsultorioClient, useValue: cliente },
        { provide: PREPARAR_LOGO, useValue: prepararLogo },
      ],
    });
  });

  it('sin profesional en la sesión no pide nada y deja los PDF sin logo', async () => {
    TestBed.inject(PdfBrandingService);
    await asentar();

    expect(cliente.obtenerUrl).not.toHaveBeenCalled();
    expect(logoDeDocumentos()).toBeNull();
  });

  it('con profesional deja listo su logo para todos los documentos', async () => {
    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();

    expect(cliente.obtenerUrl).toHaveBeenCalledWith('per-1');
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
    cliente.obtenerUrl.mockReturnValue(of(null));
    TestBed.inject(PdfBrandingService);
    perfil.set('per-1');
    await asentar();
    expect(logoDeDocumentos()).toBeNull();

    prepararLogo.mockResolvedValue(null);
    cliente.obtenerUrl.mockReturnValue(of('data:image/png;base64,roto'));
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
    cliente.obtenerUrl.mockClear();

    servicio.recargar();
    await asentar();

    expect(cliente.obtenerUrl).toHaveBeenCalledTimes(1);
  });
});
