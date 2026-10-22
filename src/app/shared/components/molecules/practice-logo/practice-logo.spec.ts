import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PracticeLogo } from './practice-logo';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

describe('LogoConsultorio', () => {
  let fixture: ComponentFixture<PracticeLogo>;

  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(PracticeLogo);
  });

  it('sin logo dibuja el marcador «Sin logo» y ninguna imagen', async () => {
    await fixture.whenStable();

    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('[data-testid="logo-consultorio-vacio"]')?.textContent).toContain(
      'Sin logo',
    );
  });

  it('con logo dibuja la imagen con su texto alternativo', async () => {
    fixture.componentRef.setInput('src', PNG_1X1);
    fixture.componentRef.setInput('nombre', 'Consultorio Rojas');
    await fixture.whenStable();

    const img = el().querySelector('img');
    expect(img?.getAttribute('alt')).toBe('Logo de Consultorio Rojas');
    expect(el().querySelector('[data-testid="logo-consultorio-vacio"]')).toBeNull();
  });

  it('sin nombre el texto alternativo sigue siendo válido', async () => {
    fixture.componentRef.setInput('src', PNG_1X1);
    await fixture.whenStable();

    expect(el().querySelector('img')?.getAttribute('alt')).toBe('Logo del consultorio');
  });

  it('una imagen que no carga cae al marcador en vez de dejar un hueco', async () => {
    fixture.componentRef.setInput('src', 'data:image/png;base64,no-es-una-imagen');
    await fixture.whenStable();

    el().querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('[data-testid="logo-consultorio-vacio"]')).not.toBeNull();
  });

  it('un src nuevo tras un fallo vuelve a intentar la imagen', async () => {
    fixture.componentRef.setInput('src', 'data:image/png;base64,roto');
    await fixture.whenStable();
    el().querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    fixture.componentRef.setInput('src', PNG_1X1);
    await fixture.whenStable();

    expect(el().querySelector('img')).not.toBeNull();
  });
});
