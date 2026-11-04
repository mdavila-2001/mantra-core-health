import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SearchCorrection } from './search-correction';

@Component({
  imports: [SearchCorrection],
  template: `<app-search-correction
    original="ibopofeno"
    corrected="ibuprofeno"
    (literalRequested)="pedido.set($event)"
  />`,
})
class Host {
  readonly pedido = signal<string | null>(null);
}

describe('SearchCorrection', () => {
  it('says what was searched and offers the literal text', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('app-search-correction')?.getAttribute('role')).toBe('status');
    expect(element.textContent).toContain('Mostrando resultados para «ibuprofeno»');
    expect(element.textContent).toContain('«ibopofeno»');

    element.querySelector<HTMLButtonElement>('[data-testid="search-correction-literal"]')?.click();
    expect(fixture.componentInstance.pedido()).toBe('ibopofeno');
  });
});
