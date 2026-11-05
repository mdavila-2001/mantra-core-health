import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UxConsent } from '../../core/observability/consent/ux-consent.service';
import { UxConsentNotice } from './ux-consent-notice';

function montar(visible: boolean) {
  const doble = {
    avisoVisible: signal(visible),
    ocupado: signal(false),
    error: signal<string | null>(null),
    otorgar: vi.fn(),
    descartarAviso: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: UxConsent, useValue: doble }],
  });
  const fixture = TestBed.createComponent(UxConsentNotice);
  fixture.detectChanges();
  return { fixture, doble, el: fixture.nativeElement as HTMLElement };
}

describe('UxConsentNotice', () => {
  it('sin aviso pendiente no pinta nada', () => {
    const { el } = montar(false);
    expect(el.querySelector('[data-testid="ux-consent-aviso"]')).toBeNull();
  });

  it('con aviso pendiente dice qué se mide, en «usted», y enlaza a Mi privacidad', () => {
    const { el } = montar(true);
    const texto = el.textContent ?? '';
    expect(texto).toContain('usted');
    expect(texto).toContain('Mi cuenta');
    expect(el.querySelector('a')?.getAttribute('href')).toContain('/my-account/privacy');
  });

  it('«Aceptar» otorga y «Ahora no» descarta, cada uno sin hacer lo del otro', () => {
    const { el, doble } = montar(true);
    (el.querySelector('[data-testid="ux-consent-ahora-no"]') as HTMLButtonElement).click();
    expect(doble.descartarAviso).toHaveBeenCalledTimes(1);
    expect(doble.otorgar).not.toHaveBeenCalled();

    (el.querySelector('[data-testid="ux-consent-aceptar"]') as HTMLButtonElement).click();
    expect(doble.otorgar).toHaveBeenCalledTimes(1);
  });

  it('muestra el error si registrar la decisión falló', () => {
    const { fixture, doble, el } = montar(true);
    doble.error.set('No pudimos registrar su decisión. Pruebe de nuevo.');
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="ux-consent-aviso-error"]')?.textContent).toContain('No pudimos');
  });
});
