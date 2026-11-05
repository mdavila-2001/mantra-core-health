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

@Component({
  imports: [FileDropTarget],
  template: `<form [appFileDropTarget]="[archivo, camara]">
    <input #archivo type="file" accept="image/*" (change)="changes = changes + 1" />
    <input #camara type="file" accept="image/*" capture="environment" />
  </form>`,
})
class HostConDosSelectores {
  changes = 0;
}

function dropDe(file: File): Event {
  const event = new Event('drop', { bubbles: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
  return event;
}

/** jsdom exige un FileList real en `files`: se sombrea para el camino aceptado. */
function admitirAsignacionDeFiles(input: HTMLInputElement): void {
  let assigned: unknown = null;
  Object.defineProperty(input, 'files', {
    configurable: true,
    get: () => assigned,
    set: (value) => (assigned = value),
  });
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
    admitirAsignacionDeFiles(input);
    const soltarFoto = () =>
      label.dispatchEvent(dropDe(new File(['photo'], 'photo.png', { type: 'image/png' })));

    input.dispatchEvent(new Event('click', { bubbles: true }));
    soltarFoto();
    expect(fixture.componentInstance.changes).toBe(0);
    expect(fixture.componentInstance.error).toBe('');

    input.dispatchEvent(new Event('cancel', { bubbles: true }));
    soltarFoto();
    expect(fixture.componentInstance.changes).toBe(1);
  });

  it('con varios selectores, cualquiera abierto bloquea y lo soltado va al primero', async () => {
    const fixture = TestBed.createComponent(HostConDosSelectores);
    await fixture.whenStable();
    const [archivo, camara]: HTMLInputElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    );
    const form: HTMLElement = fixture.nativeElement.querySelector('form');
    admitirAsignacionDeFiles(archivo);
    const foto = new File(['photo'], 'photo.png', { type: 'image/png' });

    camara.dispatchEvent(new Event('click', { bubbles: true }));
    form.dispatchEvent(dropDe(foto));
    expect(fixture.componentInstance.changes).toBe(0);

    camara.dispatchEvent(new Event('cancel', { bubbles: true }));
    form.dispatchEvent(dropDe(foto));
    expect(fixture.componentInstance.changes).toBe(1);
    expect(archivo.files).toEqual([foto]);
  });
});
