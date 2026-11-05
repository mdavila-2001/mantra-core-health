import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { InboxTab } from './inbox-model';
import { InboxTabs, type InboxTabOption } from './inbox-tabs';

const TABS: InboxTabOption[] = [
  { value: 'NEW', label: 'Nuevos', count: 4 },
  { value: 'MINE', label: 'Míos', count: 1 },
  { value: 'TEAM', label: 'Del equipo', count: 0 },
  { value: 'WAITING_DOCTOR', label: 'Esperando al doctor', count: 2 },
  { value: 'RESOLVED', label: 'Resueltos', count: 7 },
];

@Component({
  imports: [InboxTabs],
  template: `<app-inbox-tabs [tabs]="tabs" [value]="actual()" panelId="panel" (valueChange)="actual.set($event); elegidas.push($event)" />`,
})
class Host {
  readonly tabs = TABS;
  readonly actual = signal<InboxTab>('NEW');
  readonly elegidas: InboxTab[] = [];
}

describe('InboxTabs', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const botones = (): HTMLButtonElement[] => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const teclear = (indice: number, key: string): KeyboardEvent => {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    botones()[indice]!.dispatchEvent(evento);
    fixture.detectChanges();
    return evento;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('declara una lista de pestañas con su rótulo y su cuenta, y la cuenta se dice completa', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="tablist"]')).not.toBeNull();
    expect(botones().map((b) => b.querySelector('.pestana__rotulo')!.textContent)).toEqual(['Nuevos', 'Míos', 'Del equipo', 'Esperando al doctor', 'Resueltos']);
    expect(botones().map((b) => b.querySelector('.pestana__cuenta')!.getAttribute('aria-label'))).toEqual(['4 conversaciones', '1 conversación', '0 conversaciones', '2 conversaciones', '7 conversaciones']);
  });

  it('solo la elegida está seleccionada y entra en el orden de tabulación; todas apuntan a su panel', () => {
    expect(botones().map((b) => b.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false']);
    expect(botones().map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1', '-1']);
    expect(botones().every((b) => b.getAttribute('aria-controls') === 'panel')).toBe(true);
  });

  it('un clic elige; volver a pulsar la elegida no repite el aviso', () => {
    botones()[3]!.click();
    fixture.detectChanges();
    botones()[3]!.click();
    fixture.detectChanges();
    expect(host.elegidas).toEqual(['WAITING_DOCTOR']);
    expect(botones()[3]!.getAttribute('aria-selected')).toBe('true');
  });

  it('las flechas mueven y eligen, con vuelta al otro extremo; Inicio y Fin van a los extremos', () => {
    expect(teclear(0, 'ArrowRight').defaultPrevented).toBe(true);
    expect(host.actual()).toBe('MINE');
    teclear(1, 'ArrowLeft');
    teclear(0, 'ArrowLeft');
    expect(host.actual()).toBe('RESOLVED');
    teclear(4, 'ArrowRight');
    expect(host.actual()).toBe('NEW');
    teclear(0, 'End');
    expect(host.actual()).toBe('RESOLVED');
    teclear(4, 'Home');
    expect(host.actual()).toBe('NEW');
  });

  it('otras teclas no hacen nada', () => {
    expect(teclear(0, 'a').defaultPrevented).toBe(false);
    expect(host.elegidas).toEqual([]);
  });
});
