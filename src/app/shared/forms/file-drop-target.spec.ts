import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FileDropTarget } from './file-drop-target';

@Component({
  imports: [FileDropTarget],
  template: `<label [appFileDropTarget]="picker" (fileDropRejected)="error = $event">
    Foto <input #picker type="file" accept="image/*" (change)="changes = changes + 1" />
  </label>`,
})
class Host {
  error = '';
  changes = 0;
}

describe('FileDropTarget', () => {
  it('rechaza archivos incompatibles sin ejecutar la subida existente', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const event = new Event('drop', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })] },
    });
    fixture.nativeElement.querySelector('label').dispatchEvent(event);
    expect(fixture.componentInstance.changes).toBe(0);
    expect(fixture.componentInstance.error).toContain('formato');
  });

  it('un selector deshabilitado ignora arrastre y no dispara subida', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('input').disabled = true;
    const event = new Event('drop', { bubbles: true });
    Object.defineProperty(event, 'dataTransfer', {
      value: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
    });
    fixture.nativeElement.querySelector('label').dispatchEvent(event);
    expect(fixture.componentInstance.changes).toBe(0);
    expect(fixture.componentInstance.error).toBe('');
  });

  it('con el diálogo nativo abierto no acepta soltar, y vuelve a aceptar al cerrarse', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    const label: HTMLElement = fixture.nativeElement.querySelector('label');
    // jsdom no deja asignar un array a `files` (exige un FileList real):
    // el camino aceptado lo hace, así que se sombrea la propiedad.
    let assigned: unknown = null;
    Object.defineProperty(input, 'files', {
      configurable: true,
      get: () => assigned,
      set: (value) => (assigned = value),
    });
    const soltarFoto = () => {
      const event = new Event('drop', { bubbles: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] },
      });
      label.dispatchEvent(event);
    };

    input.dispatchEvent(new Event('click', { bubbles: true }));
    soltarFoto();
    expect(fixture.componentInstance.changes).toBe(0);
    expect(fixture.componentInstance.error).toBe('');

    input.dispatchEvent(new Event('cancel', { bubbles: true }));
    soltarFoto();
    expect(fixture.componentInstance.changes).toBe(1);
  });
});
