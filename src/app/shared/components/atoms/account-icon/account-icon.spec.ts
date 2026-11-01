import { TestBed } from '@angular/core/testing';

import { AccountIcon } from './account-icon';
import { ACCOUNT_ICON_NAMES, type AccountIconName } from './account-icon.types';

/**
 * Los íconos de tipo de cuenta del alta (paciente, médico, aseguradora…). Son
 * decorativos —el tipo se dice en texto— y cada uno tiene su dibujo: el que
 * elige su cuenta lo reconoce sin leer.
 */
function dibujo(name: AccountIconName): SVGElement | null {
  const fixture = TestBed.createComponent(AccountIcon);
  fixture.componentRef.setInput('name', name);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('svg');
}

describe('AccountIcon', () => {
  it.each(ACCOUNT_ICON_NAMES)('%s dibuja un SVG decorativo', (name) => {
    const svg = dibujo(name)!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
    expect(svg.children.length).toBeGreaterThan(0);
  });

  it('cada tipo de cuenta tiene un dibujo propio', () => {
    const dibujos = ACCOUNT_ICON_NAMES.map((n) => dibujo(n)!.innerHTML.replace(/<!--[\s\S]*?-->/g, ''));
    expect(new Set(dibujos).size).toBe(ACCOUNT_ICON_NAMES.length);
  });
});
