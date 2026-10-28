import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { PracticeLogoClient } from '../../../../core/data-access/practice-sites/practice-logo.client';
import { OfficeLogoField } from './office-logo-field';
import { OfficeLogoSelection } from './office-logo-selection';

function fileOf(name: string, type: string, bytes = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

/**
 * El campo, con su selector de verdad: el archivo entra por el `<input>` como
 * lo haría una persona, y lo que se comprueba es lo que queda en pantalla.
 */
describe('OfficeLogoField', () => {
  const logos = { uploadForRegistration: vi.fn() };
  let fixture: ComponentFixture<OfficeLogoField>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  async function pick(file: File): Promise<void> {
    const input = byTestId('registration-practitioner-office-logo-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    vi.resetAllMocks();
    logos.uploadForRegistration.mockReturnValue(of('logo-alta'));
    TestBed.configureTestingModule({
      imports: [OfficeLogoField],
      providers: [OfficeLogoSelection, { provide: PracticeLogoClient, useValue: logos }],
    });
    fixture = TestBed.createComponent(OfficeLogoField);
    await fixture.whenStable();
  });

  it('empieza sin logo: la caja dice «Sin logo» y no ofrece quitar nada', () => {
    expect(byTestId('logo-consultorio-vacio')?.textContent).toContain('Sin logo');
    expect(byTestId('registration-practitioner-office-logo-remove')).toBeNull();
    expect(byTestId('registration-practitioner-office-logo-error')).toBeNull();
  });

  it.each([
    ['un PDF', fileOf('logo.pdf', 'application/pdf'), 'PNG, JPG o WebP'],
    ['una imagen de 3 MB', fileOf('logo.png', 'image/png', 3 * 1024 * 1024), '2 MB'],
  ])('con %s muestra el error en el campo y no se elige ni se sube nada', async (_case, file, reason) => {
    await pick(file);

    const error = byTestId('registration-practitioner-office-logo-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain(reason);
    expect(TestBed.inject(OfficeLogoSelection).file()).toBeNull();
    expect(byTestId('logo-consultorio-vacio')).not.toBeNull();
    expect(logos.uploadForRegistration).not.toHaveBeenCalled();
  });

  it('con una imagen válida la muestra y ofrece quitarla; al quitarla vuelve «Sin logo»', async () => {
    await pick(fileOf('logo.png', 'image/png'));
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(byTestId('registration-practitioner-office-logo-preview')?.querySelector('img')).not.toBeNull();
    });

    const remove = byTestId('registration-practitioner-office-logo-remove') as HTMLButtonElement;
    remove.click();
    await fixture.whenStable();

    expect(byTestId('logo-consultorio-vacio')).not.toBeNull();
    expect(byTestId('registration-practitioner-office-logo-remove')).toBeNull();
    // Elegir no sube: la pre-carga es del envío del alta.
    expect(logos.uploadForRegistration).not.toHaveBeenCalled();
  });
});
