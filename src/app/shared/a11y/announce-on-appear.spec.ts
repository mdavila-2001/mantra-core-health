import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AnnounceOnAppear } from './announce-on-appear';

/**
 * Esta directiva cierra el hallazgo de accesibilidad más repetido del proyecto:
 * las seis pantallas de `auth/` mostraban errores y confirmaciones **sin
 * anunciarlos**, porque no usan `ViewStateHost` —que sí lo hace— sino un
 * `app-alert` propio.
 *
 * El caso más grave era el acuse de `/auth/recuperar`, que **es toda la
 * respuesta** que recibe la persona: aparecía en pantalla y un lector de
 * pantalla no decía nada.
 */
@Component({
  imports: [AnnounceOnAppear],
  template: `
    @if (visible()) {
      <p appAnuncio [asertivo]="asertivo()" [enfocar]="enfocar()" id="mensaje">Algo pasó</p>
    }
  `,
})
class Anfitrion {
  readonly visible = signal(false);
  readonly asertivo = signal(true);
  readonly enfocar = signal(true);
}

describe('AnnounceOnAppear', () => {
  async function montar(config: { asertivo?: boolean; enfocar?: boolean } = {}) {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();

    const fixture = TestBed.createComponent(Anfitrion);
    if (config.asertivo !== undefined) fixture.componentInstance.asertivo.set(config.asertivo);
    if (config.enfocar !== undefined) fixture.componentInstance.enfocar.set(config.enfocar);

    fixture.detectChanges();
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    await fixture.whenStable();

    return {
      fixture,
      elemento: (fixture.nativeElement as HTMLElement).querySelector('#mensaje'),
    };
  }

  it('un error se anuncia como alerta: interrumpe', async () => {
    const { elemento } = await montar({ asertivo: true });

    expect(elemento?.getAttribute('role')).toBe('alert');
    expect(elemento?.getAttribute('aria-live')).toBe('assertive');
  });

  it('una confirmación se anuncia sin interrumpir', async () => {
    const { elemento } = await montar({ asertivo: false });

    expect(elemento?.getAttribute('role')).toBe('status');
    expect(elemento?.getAttribute('aria-live')).toBe('polite');
  });

  it('es enfocable por script pero NO entra en el orden de tabulación', async () => {
    // `-1` y no `0`: la persona no debe tropezarse con el mensaje al tabular
    // después de haberlo leído.
    const { elemento } = await montar();

    expect(elemento?.getAttribute('tabindex')).toBe('-1');
  });

  it('lleva el foco al mensaje, para no tener que buscarlo', async () => {
    const { elemento } = await montar({ enfocar: true });

    expect(document.activeElement).toBe(elemento);
  });

  it('con `enfocar` en falso anuncia pero no roba el foco', async () => {
    // Es lo que hace `ViewStateHost` con S2 y S7: robar el foco durante una
    // carga sería perder el lugar en la página.
    const { elemento } = await montar({ enfocar: false });

    expect(elemento?.getAttribute('tabindex')).toBeNull();
    expect(document.activeElement).not.toBe(elemento);
  });

  it('no anuncia nada mientras el mensaje no exista', async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#mensaje')).toBeNull();
  });
});
