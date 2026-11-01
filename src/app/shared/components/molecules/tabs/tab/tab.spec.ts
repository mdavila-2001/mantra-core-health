import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { TABS_PARENT } from '../tabs.types';
import { Tab } from './tab';

/**
 * Un panel de pestaña: rol `tabpanel`, rotulado por su pestaña, y **sólo el
 * activo renderiza su contenido** (un panel oculto no deja consultas vivas).
 * Sin `app-tabs` padre se considera activo.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Tab],
  template: `<app-tab label="Datos"><p class="contenido">Hola</p></app-tab>`,
})
class Solo {}

describe('Tab', () => {
  it('sin padre está activo: renderiza su contenido y entra al orden de tabulación', () => {
    const fixture: ComponentFixture<Solo> = TestBed.createComponent(Solo);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-tab')!;

    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('tabindex')).toBe('0');
    expect(panel.querySelector('.contenido')?.textContent).toBe('Hola');
  });

  it('con padre, sólo el activo renderiza; los ids enlazan panel y pestaña', () => {
    const activa = signal<unknown>(null);
    TestBed.configureTestingModule({ providers: [{ provide: TABS_PARENT, useValue: { activeTab: activa } }] });
    const fixture = TestBed.createComponent(Solo);
    fixture.detectChanges();
    const panel = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('app-tab')!;

    expect(panel.hidden).toBe(true);
    expect(panel.hasAttribute('tabindex')).toBe(false);
    expect(panel.querySelector('.contenido')).toBeNull();

    const tab = fixture.debugElement.children[0]!.componentInstance as Tab;
    expect(panel.id).toBe(tab.panelId);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.tabId);

    activa.set(tab);
    fixture.detectChanges();
    expect(panel.hidden).toBe(false);
    expect(panel.querySelector('.contenido')).not.toBeNull();
  });
});
