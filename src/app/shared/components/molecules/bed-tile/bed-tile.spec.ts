import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BedTile } from './bed-tile';
import type { BedTileView } from './bed-tile.types';

@Component({
  imports: [BedTile],
  template: `<app-bed-tile [bed]="bed()" [selected]="selected()" (activated)="clicks = clicks + 1" />`,
})
class Host {
  readonly bed = signal<BedTileView>({
    code: '302-B', statusCode: 'C', statusLabel: 'No disponible', tone: 'unavailable',
    reason: 'Falla de equipo', until: 'hasta 02/11 18:00', age: 'hace 26 h',
  });
  readonly selected = signal(false);
  clicks = 0;
}

describe('BedTile', () => {
  it('es un botón con el estado escrito y el nombre accesible completo', () => {
    const f = TestBed.createComponent(Host);
    f.detectChanges();
    const boton = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(boton.textContent).toContain('No disponible');
    expect(boton.getAttribute('aria-label')).toBe('Cama 302-B, No disponible, motivo: Falla de equipo, hasta 02/11 18:00, último cambio hace 26 h');
    expect(boton.getAttribute('data-v2')).toBe('C');
    expect(boton.classList).toContain('bed-tile--unavailable');
  });

  it('avisa al activarse y refleja la selección', () => {
    const f = TestBed.createComponent(Host);
    f.componentInstance.selected.set(true);
    f.detectChanges();
    const boton = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    boton.click();
    expect(f.componentInstance.clicks).toBe(1);
  });
});
