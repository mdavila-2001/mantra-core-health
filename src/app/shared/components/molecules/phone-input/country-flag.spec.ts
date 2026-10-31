import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CountryFlag } from './country-flag';
import { ISO_COUNTRIES } from './phone-input.countries';

/**
 * La bandera del selector de país del teléfono: decorativa (el país se dice
 * en texto), una por cada país admitido, y con un `clipPath` de id propio por
 * instancia —dos banderas en la misma página no pueden compartir id, o una
 * recorta con la forma de la otra—.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CountryFlag],
  template: `<app-country-flag iso="BO" /><app-country-flag iso="AR" />`,
})
class DosBanderas {}

describe('CountryFlag', () => {
  it('cada país admitido tiene su bandera, decorativa', () => {
    const dibujos = ISO_COUNTRIES.map((iso) => {
      const fixture = TestBed.createComponent(CountryFlag);
      fixture.componentRef.setInput('iso', iso);
      fixture.detectChanges();
      const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden')).toBe('true');
      const g = svg.querySelector('g')!;
      expect(g.children.length).toBeGreaterThan(0);
      return g.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
    });
    expect(new Set(dibujos).size).toBe(ISO_COUNTRIES.length);
  });

  it('dos banderas en la página usan clipPath con ids distintos y cada una apunta al suyo', () => {
    const fixture = TestBed.createComponent(DosBanderas);
    fixture.detectChanges();
    const svgs = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('svg'));
    const ids = svgs.map((s) => s.querySelector('clipPath')!.getAttribute('id'));

    expect(new Set(ids).size).toBe(2);
    svgs.forEach((s, i) => expect(s.querySelector('g')!.getAttribute('clip-path')).toBe(`url(#${ids[i]})`));
  });
});
