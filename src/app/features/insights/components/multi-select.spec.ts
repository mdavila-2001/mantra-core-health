import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { MultiSelect, type MultiOption } from './multi-select';

/**
 * Selector múltiple de los filtros de Insights: resume lo elegido («Todas»,
 * el nombre de una, «N seleccionados»), respeta un mínimo de elegidas, emite
 * en el orden de las opciones y se cierra con Escape devolviendo el foco.
 */

const OPCIONES: readonly MultiOption[] = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google', hint: 'Búsqueda' },
  { value: 'tiktok', label: 'TikTok' },
];

describe('MultiSelect', () => {
  let fixture: ComponentFixture<MultiSelect>;
  let emitidos: (readonly string[])[];

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const boton = (): HTMLButtonElement => root().querySelector('.ms__btn')!;

  function pintar(selected: readonly string[], min = 1): void {
    fixture = TestBed.createComponent(MultiSelect);
    fixture.componentRef.setInput('label', 'Canal');
    fixture.componentRef.setInput('options', OPCIONES);
    fixture.componentRef.setInput('selected', selected);
    fixture.componentRef.setInput('min', min);
    emitidos = [];
    fixture.componentInstance.changed.subscribe((v) => emitidos.push(v));
    document.body.appendChild(fixture.nativeElement);
    fixture.detectChanges();
  }

  afterEach(() => (fixture.nativeElement as HTMLElement).remove());

  function abrir(): void {
    boton().click();
    fixture.detectChanges();
  }

  function marcar(indice: number, valor: boolean): void {
    const caja = root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[indice]!;
    caja.checked = valor;
    caja.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it.each([
    [['meta', 'google', 'tiktok'], 'Todas'],
    [['google'], 'Google'],
    [['meta', 'tiktok'], '2 seleccionados'],
  ])('con %j resume «%s»', (sel, resumen) => {
    pintar(sel);
    expect(root().querySelector('.ms__value')?.textContent).toBe(resumen);
  });

  it('abre un grupo rotulado con una casilla por opción y su ayuda', () => {
    pintar(['meta']);
    abrir();
    expect(boton().getAttribute('aria-expanded')).toBe('true');
    expect(root().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Canal');
    expect(root().querySelectorAll('input[type="checkbox"]')).toHaveLength(3);
    expect(root().querySelector('.ms__hint')?.textContent).toBe('Búsqueda');
  });

  it('marcar suma en el orden de las opciones, no en el del clic', () => {
    pintar(['tiktok']);
    abrir();
    marcar(0, true);
    expect(emitidos).toEqual([['meta', 'tiktok']]);
  });

  it('no deja bajar del mínimo', () => {
    pintar(['meta']);
    abrir();
    marcar(0, false);
    expect(emitidos).toEqual([]);
  });

  it('«Seleccionar todas» emite todas', () => {
    pintar(['meta']);
    abrir();
    root().querySelector<HTMLButtonElement>('.ms__all')!.click();
    expect(emitidos).toEqual([['meta', 'google', 'tiktok']]);
  });

  it('Escape cierra y devuelve el foco al botón; un clic afuera también cierra', () => {
    pintar(['meta']);
    abrir();
    root().querySelector('.ms')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(root().querySelector('.ms__panel')).toBeNull();
    expect(document.activeElement).toBe(boton());

    abrir();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(root().querySelector('.ms__panel')).toBeNull();
  });
});
