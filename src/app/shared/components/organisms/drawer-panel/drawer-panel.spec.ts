import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { DrawerPanel } from './drawer-panel';

// Anfitrión de prueba: lee campos mutables a propósito, no es un componente de producto.
 
@Component({
  imports: [DrawerPanel],
  template: `
    <button id="origen" type="button">Abrir</button>
    <app-drawer-panel
      heading="Detalle"
      subheading="fila 7"
      [(open)]="abierto"
      (closed)="cierres = cierres + 1"
    >
      <p id="contenido">Cuerpo</p>
      <button drawer-footer type="button" id="pie">Guardar</button>
    </app-drawer-panel>
  `,
})
class Anfitrion {
  readonly abierto = signal(false);
  cierres = 0;
}

async function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  await fixture.whenStable();
  const dialogo = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
  return { fixture, dialogo };
}

describe('DrawerPanel', () => {
  it('cerrado no proyecta su contenido ni está abierto', async () => {
    const { fixture, dialogo } = await montar();
    expect(dialogo.open).toBe(false);
    expect(fixture.nativeElement.querySelector('#contenido')).toBeNull();
  });

  it('abre como diálogo modal con nombre accesible y proyecta cuerpo y pie', async () => {
    const { fixture, dialogo } = await montar();
    // el entorno de prueba no implementa `showModal`: un doble declarado que deja `open` como lo deja el navegador
    const modal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    Object.defineProperty(dialogo, 'showModal', { value: modal, configurable: true });
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(modal).toHaveBeenCalledTimes(1);
    expect(dialogo.hasAttribute('open')).toBe(true);
    const titulo = dialogo.querySelector('h2') as HTMLElement;
    expect(dialogo.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(titulo.textContent).toContain('Detalle');
    expect(fixture.nativeElement.querySelector('#contenido')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#pie')).not.toBeNull();
  });

  it('el botón de cerrar apaga el estado del padre y avisa una vez', async () => {
    const { fixture, dialogo } = await montar();
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    (dialogo.querySelector('[data-testid="cajon-cerrar"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.abierto()).toBe(false);
    expect(fixture.componentInstance.cierres).toBe(1);
    expect(dialogo.open).toBe(false);
  });

  it('Escape (evento cancel) cierra y no deja el padre abierto', async () => {
    const { fixture, dialogo } = await montar();
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const cancel = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(cancel);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cancel.defaultPrevented).toBe(true);
    expect(fixture.componentInstance.abierto()).toBe(false);
    expect(fixture.componentInstance.cierres).toBe(1);
  });

  it('un clic en el velo cierra; un clic dentro del panel no', async () => {
    const { fixture, dialogo } = await montar();
    fixture.componentInstance.abierto.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    (dialogo.querySelector('.drawer__panel') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.abierto()).toBe(true);
    dialogo.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.abierto()).toBe(false);
  });
});
