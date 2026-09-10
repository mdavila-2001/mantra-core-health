import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FileInput, type RejectedFile } from './file-input';

/** jsdom no trae DataTransfer: alcanza con lo que el handler realmente lee. */
function dropEvent(files: File[]): DragEvent {
  const event = new Event('drop', { bubbles: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

function archivo(name: string, type: string, size = 1024, lastModified = 1): File {
  const file = new File(['x'], name, { type, lastModified });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('FileInput', () => {
  let fixture: ComponentFixture<FileInput>;
  let rechazados: readonly RejectedFile[];

  function dropzone(): HTMLElement {
    return fixture.nativeElement.querySelector('.dropzone');
  }

  async function soltar(files: File[]): Promise<void> {
    dropzone().dispatchEvent(dropEvent(files));
    await fixture.whenStable();
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FileInput] }).compileComponents();
    fixture = TestBed.createComponent(FileInput);
    rechazados = [];
    fixture.componentInstance.rejected.subscribe((lista) => (rechazados = lista));
    await fixture.whenStable();
  });

  describe('validación al soltar (el `accept` nativo no la cubre)', () => {
    it('acepta lo que coincide con un MIME exacto', async () => {
      await setInputs({ accept: 'application/pdf' });
      await soltar([archivo('estudio.pdf', 'application/pdf')]);

      expect(fixture.componentInstance.files().length).toBe(1);
    });

    it('rechaza al soltar un tipo no permitido', async () => {
      await setInputs({ accept: 'application/pdf' });
      await soltar([archivo('virus.exe', 'application/x-msdownload')]);

      expect(fixture.componentInstance.files().length).toBe(0);
      expect(rechazados[0].reason).toBe('tipo');
    });

    it('entiende los comodines tipo image/*', async () => {
      await setInputs({ accept: 'image/*' });
      await soltar([archivo('placa.png', 'image/png')]);

      expect(fixture.componentInstance.files().length).toBe(1);
    });

    it('entiende las extensiones tipo .pdf', async () => {
      await setInputs({ accept: '.pdf' });
      await soltar([archivo('orden.pdf', '')]);

      expect(fixture.componentInstance.files().length).toBe(1);
    });

    it('sin accept acepta cualquier cosa', async () => {
      await soltar([archivo('lo-que-sea.bin', 'application/octet-stream')]);

      expect(fixture.componentInstance.files().length).toBe(1);
    });
  });

  describe('límites', () => {
    it('rechaza lo que supera el tamaño máximo', async () => {
      await setInputs({ maxSizeBytes: 1000 });
      await soltar([archivo('grande.pdf', 'application/pdf', 5000)]);

      expect(fixture.componentInstance.files().length).toBe(0);
      expect(rechazados[0].reason).toBe('tamaño');
    });

    it('respeta el cupo de archivos', async () => {
      await setInputs({ multiple: true, maxFiles: 2 });
      await soltar([
        archivo('a.pdf', 'application/pdf', 10, 1),
        archivo('b.pdf', 'application/pdf', 10, 2),
        archivo('c.pdf', 'application/pdf', 10, 3),
      ]);

      expect(fixture.componentInstance.files().length).toBe(2);
      expect(rechazados[0].reason).toBe('cupo');
    });
  });

  describe('duplicados', () => {
    it('no agrega dos veces el mismo archivo', async () => {
      await setInputs({ multiple: true });
      const mismo = archivo('estudio.pdf', 'application/pdf', 2048, 99);

      await soltar([mismo]);
      await soltar([archivo('estudio.pdf', 'application/pdf', 2048, 99)]);

      expect(fixture.componentInstance.files().length).toBe(1);
      expect(rechazados[0].reason).toBe('duplicado');
    });
  });

  describe('modo simple', () => {
    it('el archivo nuevo reemplaza al anterior', async () => {
      await soltar([archivo('viejo.pdf', 'application/pdf', 10, 1)]);
      await soltar([archivo('nuevo.pdf', 'application/pdf', 10, 2)]);

      expect(fixture.componentInstance.files().length).toBe(1);
      expect(fixture.componentInstance.files()[0].name).toBe('nuevo.pdf');
    });
  });

  it('conserva el documento anterior y explica el rechazo de su reemplazo', async () => {
    await setInputs({ accept: 'application/pdf', maxSizeBytes: 2048 });
    const original = archivo('vigente.pdf', 'application/pdf');
    await soltar([original]);
    await soltar([archivo('invalido.exe', 'application/octet-stream')]);
    expect(fixture.componentInstance.files()).toEqual([original]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Formato no permitido');
    await soltar([archivo('grande.pdf', 'application/pdf', 3000)]);
    expect(fixture.componentInstance.files()).toEqual([original]);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Supera el límite');
  });

  it('deshabilitado ignora lo que se suelte', async () => {
    await setInputs({ disabled: true });
    await soltar([archivo('a.pdf', 'application/pdf')]);

    expect(fixture.componentInstance.files().length).toBe(0);
  });

  it('el input nativo tiene nombre accesible por su label', async () => {
    const label: HTMLLabelElement = fixture.nativeElement.querySelector('.dropzone-content');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
    expect(label.getAttribute('for')).toBe(input.id);
  });

  describe('formato de tamaño', () => {
    it('muestra el tamaño en la unidad legible', async () => {
      await soltar([archivo('a.pdf', 'application/pdf', 2048)]);

      const size = fixture.nativeElement.querySelector('.file-size').textContent.trim();
      expect(size).toBe('2 KB');
    });

    it('el botón de quitar nombra al archivo', async () => {
      await soltar([archivo('placa-torax.png', 'image/png')]);

      const quitar = fixture.nativeElement.querySelector('.remove-file-btn');
      expect(quitar.getAttribute('aria-label')).toBe('Quitar placa-torax.png');
    });
  });
});
