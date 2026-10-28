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

  const fileInput = (): HTMLInputElement =>
    byTestId('registration-practitioner-office-logo-input') as HTMLInputElement;

  async function pick(file: File): Promise<void> {
    const input = fileInput();
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  /** El nombre accesible del selector: lo que apunta `aria-labelledby`, o su `aria-label`. */
  function accessibleName(input: HTMLInputElement): string {
    const labelledBy = input.getAttribute('aria-labelledby');
    if (labelledBy) {
      return labelledBy
        .split(' ')
        .map((id) => host().querySelector(`#${id}`)?.textContent?.trim() ?? '')
        .join(' ');
    }
    return input.getAttribute('aria-label') ?? '';
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

  it('el selector se llama «Logo del consultorio» y empieza sin error que lo describa', () => {
    expect(accessibleName(fileInput())).toBe('Logo del consultorio');
    expect(fileInput().getAttribute('aria-invalid')).toBe('false');
    expect(fileInput().getAttribute('aria-describedby')).toBeNull();
  });

  it('con un PDF el motivo queda asociado al selector: aria-invalid y aria-describedby lo apuntan', async () => {
    await pick(fileOf('logo.pdf', 'application/pdf'));

    const error = byTestId('registration-practitioner-office-logo-error');
    expect(error?.id).toBeTruthy();
    expect(fileInput().getAttribute('aria-describedby')?.split(' ')).toContain(error?.id);
    expect(fileInput().getAttribute('aria-invalid')).toBe('true');
    expect(accessibleName(fileInput())).toBe('Logo del consultorio');

    // Una imagen válida retira el motivo, y con él la descripción.
    await pick(fileOf('logo.png', 'image/png'));
    expect(byTestId('registration-practitioner-office-logo-error')).toBeNull();
    expect(fileInput().getAttribute('aria-describedby')).toBeNull();
    expect(fileInput().getAttribute('aria-invalid')).toBe('false');
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
