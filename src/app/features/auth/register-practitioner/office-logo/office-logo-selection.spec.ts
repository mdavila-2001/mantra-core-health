import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';

import { PracticeLogoClient } from '../../../../core/data-access/practice-sites/practice-logo.client';
import { OfficeLogoSelection } from './office-logo-selection';

/** Un archivo del tipo y el peso pedidos, sin tener que fabricar sus bytes. */
function fileOf(name: string, type: string, bytes = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

/**
 * El logo elegido en el alta: qué se acepta, qué se dice cuando no, y cuándo se
 * sube. La pre-carga es un doble: lo que se prueba es la regla, no la red.
 */
describe('OfficeLogoSelection', () => {
  const logos = { uploadForRegistration: vi.fn() };
  let selection: OfficeLogoSelection;

  beforeEach(() => {
    vi.resetAllMocks();
    logos.uploadForRegistration.mockReturnValue(of('logo-alta'));
    TestBed.configureTestingModule({
      providers: [OfficeLogoSelection, { provide: PracticeLogoClient, useValue: logos }],
    });
    selection = TestBed.inject(OfficeLogoSelection);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp'])('acepta %s y prepara su vista previa', async (type) => {
    const logo = fileOf('logo', type);

    selection.choose(logo);

    expect(selection.file()).toBe(logo);
    expect(selection.error()).toBeNull();
    await vi.waitFor(() => expect(selection.preview()).toMatch(/^data:/));
  });

  it('un PDF no se acepta: lo dice y no queda nada elegido', () => {
    selection.choose(fileOf('logo.pdf', 'application/pdf'));

    expect(selection.file()).toBeNull();
    expect(selection.error()).toContain('PNG, JPG o WebP');
  });

  it('una imagen de 3 MB no se acepta: lo dice con el tope', () => {
    selection.choose(fileOf('logo.png', 'image/png', 3 * 1024 * 1024));

    expect(selection.file()).toBeNull();
    expect(selection.error()).toContain('2 MB');
  });

  it('un rechazo no borra el logo que ya estaba elegido', () => {
    const logo = fileOf('logo.png', 'image/png');
    selection.choose(logo);

    selection.choose(fileOf('logo.pdf', 'application/pdf'));

    expect(selection.file()).toBe(logo);
    expect(selection.error()).toContain('PNG, JPG o WebP');
  });

  it('elegir uno válido después de un rechazo borra el aviso', () => {
    selection.reject('size');

    selection.choose(fileOf('logo.png', 'image/png'));

    expect(selection.error()).toBeNull();
  });

  it('quitar deja el alta sin logo y sin aviso', () => {
    selection.choose(fileOf('logo.png', 'image/png'));
    selection.reject('type');

    selection.remove();

    expect(selection.file()).toBeNull();
    expect(selection.preview()).toBeNull();
    expect(selection.error()).toBeNull();
  });

  describe('la subida', () => {
    it('sin logo no pide nada', async () => {
      await firstValueFrom(selection.upload());

      expect(logos.uploadForRegistration).not.toHaveBeenCalled();
      expect(selection.fileId()).toBeNull();
    });

    it('con un archivo rechazado no pide nada', async () => {
      selection.choose(fileOf('logo.pdf', 'application/pdf'));

      await firstValueFrom(selection.upload());

      expect(logos.uploadForRegistration).not.toHaveBeenCalled();
    });

    it('sube lo elegido una sola vez y recuerda su id para el reintento', async () => {
      const logo = fileOf('logo.png', 'image/png');
      selection.choose(logo);

      await firstValueFrom(selection.upload());
      await firstValueFrom(selection.upload());

      expect(logos.uploadForRegistration).toHaveBeenCalledTimes(1);
      expect(logos.uploadForRegistration).toHaveBeenCalledWith(logo);
      expect(selection.fileId()).toBe('logo-alta');
    });

    it('cambiar el archivo olvida el id anterior y vuelve a subir', async () => {
      selection.choose(fileOf('uno.png', 'image/png'));
      await firstValueFrom(selection.upload());
      logos.uploadForRegistration.mockReturnValue(of('logo-dos'));

      selection.choose(fileOf('dos.png', 'image/png'));
      expect(selection.fileId()).toBeNull();
      await firstValueFrom(selection.upload());

      expect(logos.uploadForRegistration).toHaveBeenCalledTimes(2);
      expect(selection.fileId()).toBe('logo-dos');
    });

    it('si la pre-carga falla, el error sube y no queda ningún id', async () => {
      logos.uploadForRegistration.mockReturnValue(throwError(() => new Error('422')));
      selection.choose(fileOf('logo.png', 'image/png'));

      await expect(firstValueFrom(selection.upload())).rejects.toThrow('422');
      expect(selection.fileId()).toBeNull();
    });
  });
});
