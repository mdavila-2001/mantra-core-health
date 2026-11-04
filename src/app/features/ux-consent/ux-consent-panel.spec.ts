import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { DecisionUx } from '../../core/observability/consent/ux-consent.service';
import { UxConsent } from '../../core/observability/consent/ux-consent.service';
import { UxConsentPanel } from './ux-consent-panel';

function montar(opciones: { disponible?: boolean; bloqueada?: boolean; decision?: DecisionUx } = {}) {
  const decision: WritableSignal<DecisionUx> = signal(opciones.decision ?? 'ninguna');
  const doble = {
    bloqueadaPorPrivacidad: opciones.bloqueada ?? false,
    disponible: signal(opciones.disponible ?? true),
    decision,
    ocupado: signal(false),
    error: signal<string | null>(null),
    otorgar: vi.fn(),
    retirar: vi.fn(),
  };
  TestBed.configureTestingModule({ providers: [{ provide: UxConsent, useValue: doble }] });
  const fixture = TestBed.createComponent(UxConsentPanel);
  fixture.detectChanges();
  return { fixture, doble, decision, el: fixture.nativeElement as HTMLElement };
}

const probar = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

describe('UxConsentPanel', () => {
  it('con la captura apagada o sin sesión no pinta nada', () => {
    const { el } = montar({ disponible: false });
    expect(probar(el, 'ux-consent-panel')).toBeNull();
  });

  it('con DNT o GPC lo explica y no ofrece ningún botón', () => {
    const { el } = montar({ bloqueada: true });
    expect(probar(el, 'ux-consent-bloqueado')).not.toBeNull();
    expect(el.querySelector('button')).toBeNull();
  });

  it('sin decidir ofrece «Permitir»', () => {
    const { el, doble } = montar({ decision: 'ninguna' });
    expect(probar(el, 'ux-consent-status')?.textContent).toContain('Sin decidir');
    (probar(el, 'ux-consent-otorgar') as HTMLButtonElement).click();
    expect(doble.otorgar).toHaveBeenCalledTimes(1);
    expect(probar(el, 'ux-consent-retirar')).toBeNull();
  });

  it('otorgado ofrece «Retirar permiso» y no «Permitir»', () => {
    const { el, doble } = montar({ decision: 'otorgada' });
    expect(probar(el, 'ux-consent-status')?.textContent).toContain('Permitido');
    (probar(el, 'ux-consent-retirar') as HTMLButtonElement).click();
    expect(doble.retirar).toHaveBeenCalledTimes(1);
    expect(probar(el, 'ux-consent-otorgar')).toBeNull();
  });

  it('retirado vuelve a ofrecer «Permitir», y el estado cambia al releer', () => {
    const { fixture, decision, el } = montar({ decision: 'retirada' });
    expect(probar(el, 'ux-consent-status')?.textContent).toContain('Retirado');
    expect(probar(el, 'ux-consent-otorgar')).not.toBeNull();
    decision.set('otorgada');
    fixture.detectChanges();
    expect(probar(el, 'ux-consent-status')?.textContent).toContain('Permitido');
  });
});
