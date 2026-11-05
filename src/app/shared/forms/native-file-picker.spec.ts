import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { NativeFilePicker } from './native-file-picker';

@Component({
  imports: [NativeFilePicker],
  template: `<input #picker appNativeFilePicker type="file" [disabled]="disabled" />`,
})
class Host {
  disabled = false;
  readonly picker = viewChild.required(NativeFilePicker);
}

describe('NativeFilePicker', () => {
  function montar(disabled = false) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.disabled = disabled;
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    return { fixture, input, open: () => fixture.componentInstance.picker().open() };
  }

  it('arranca cerrado y se abre con el clic del control', () => {
    const { input, open } = montar();
    expect(open()).toBe(false);

    input.dispatchEvent(new Event('click', { bubbles: true }));

    expect(open()).toBe(true);
  });

  it('un control deshabilitado no abre nada', () => {
    const { input, open } = montar(true);

    input.dispatchEvent(new Event('click', { bubbles: true }));

    expect(open()).toBe(false);
  });

  it('se cierra cuando se eligió algo (change)', () => {
    const { input, open } = montar();
    input.dispatchEvent(new Event('click', { bubbles: true }));

    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(open()).toBe(false);
  });

  it('se cierra cuando se descartó el diálogo (cancel)', () => {
    const { input, open } = montar();
    input.dispatchEvent(new Event('click', { bubbles: true }));

    input.dispatchEvent(new Event('cancel', { bubbles: true }));

    expect(open()).toBe(false);
  });

  it('se cierra cuando la ventana recupera el foco (navegadores sin cancel)', () => {
    const { input, open } = montar();
    input.dispatchEvent(new Event('click', { bubbles: true }));

    window.dispatchEvent(new Event('focus'));

    expect(open()).toBe(false);
  });

  it('refleja el estado en la clase is-picker-open del control', async () => {
    const { fixture, input } = montar();

    input.dispatchEvent(new Event('click', { bubbles: true }));
    await fixture.whenStable();

    expect(input.classList.contains('is-picker-open')).toBe(true);
  });

  it('deja de escuchar la ventana al destruirse', () => {
    const { fixture, input, open } = montar();
    input.dispatchEvent(new Event('click', { bubbles: true }));
    fixture.destroy();

    window.dispatchEvent(new Event('focus'));

    expect(open()).toBe(true);
  });
});
