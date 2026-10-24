import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { SignatureOrSeal } from './signature-or-seal';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';

describe('FirmaOSello', () => {
  let fixture: ComponentFixture<SignatureOrSeal>;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function montar(tipo: 'firma' | 'sello', src: string | null = null): void {
    fixture = TestBed.createComponent(SignatureOrSeal);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.componentRef.setInput('src', src);
  }

  it.each([
    ['firma', 'Sin firma'],
    ['sello', 'Sin sello'],
  ] as const)('sin imagen dibuja el marcador «%s» y ninguna imagen', async (tipo, texto) => {
    montar(tipo);
    await fixture.whenStable();

    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector(`[data-testid="firma-o-sello-vacio-${tipo}"]`)?.textContent).toContain(
      texto,
    );
  });

  it.each([
    ['firma', 'Firma del médico'],
    ['sello', 'Sello del médico'],
  ] as const)('con imagen de %s la dibuja con su texto alternativo', async (tipo, alt) => {
    montar(tipo, PNG_1X1);
    await fixture.whenStable();

    expect(el().querySelector('img')?.getAttribute('alt')).toBe(alt);
    expect(el().querySelector('[data-testid^="firma-o-sello-vacio"]')).toBeNull();
  });

  it('la firma y el sello llevan su propia clase de proporción', async () => {
    montar('firma');
    await fixture.whenStable();
    expect(el().classList).toContain('firma-o-sello--firma');

    montar('sello');
    await fixture.whenStable();
    expect(el().classList).toContain('firma-o-sello--sello');
  });

  it('una imagen que no carga cae al marcador en vez de dejar un hueco', async () => {
    montar('firma', 'data:image/png;base64,roto');
    await fixture.whenStable();

    el().querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('[data-testid="firma-o-sello-vacio-firma"]')).not.toBeNull();
  });

  it('un src nuevo tras un fallo vuelve a intentar la imagen', async () => {
    montar('sello', 'data:image/png;base64,roto');
    await fixture.whenStable();
    el().querySelector('img')?.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    fixture.componentRef.setInput('src', PNG_1X1);
    await fixture.whenStable();

    expect(el().querySelector('img')).not.toBeNull();
  });
});
