import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { ImageEditor } from './image-editor';

/**
 * El editor sobre un lienzo de mentira: jsdom no pinta, así que el contexto 2D
 * y `toBlob` son dobles que registran lo que se les pide, y la imagen la
 * «decodifica» un `createImageBitmap` falso de 400 × 300.
 *
 * Lo que se fija es el contrato con la vista previa: que «Listo» devuelve un
 * `File` nuevo del mismo tipo y con nombre legible, que sin cambios no
 * devuelve nada, que girar y recortar cambian el tamaño de lo exportado y que
 * deshacer vuelve atrás.
 */
describe('ImageEditor', () => {
  let fixture: ComponentFixture<ImageEditor>;
  let exportados: { width: number; height: number; type: string }[];
  const contextos: Record<string, unknown>[] = [];
  const originales = {
    getContext: HTMLCanvasElement.prototype.getContext,
    toBlob: HTMLCanvasElement.prototype.toBlob,
    createImageBitmap: (globalThis as { createImageBitmap?: unknown }).createImageBitmap,
  };

  const consultar = (testid: string): HTMLElement =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const lienzo = (): HTMLCanvasElement => consultar('editor-lienzo') as HTMLCanvasElement;

  const montar = async (file: File, herramienta: 'crop' | 'draw' | 'text' = 'crop') => {
    fixture = TestBed.createComponent(ImageEditor);
    fixture.componentRef.setInput('file', file);
    fixture.componentRef.setInput('initialTool', herramienta);
    fixture.detectChanges();
    // `createImageBitmap` resuelve en una microtarea: se le da la vuelta.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    fixture.detectChanges();
  };

  const listo = async (): Promise<File | 'cancelado'> => {
    const resultado = new Promise<File | 'cancelado'>((resolve) => {
      fixture.componentInstance.applied.subscribe((f) => resolve(f));
      fixture.componentInstance.cancelled.subscribe(() => resolve('cancelado'));
    });
    consultar('editor-listo').click();
    return resultado;
  };

  beforeEach(() => {
    exportados = [];
    contextos.length = 0;
    HTMLCanvasElement.prototype.getContext = function () {
      const contexto: Record<string, unknown> = {};
      for (const metodo of ['drawImage', 'translate', 'rotate', 'save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc', 'fill', 'fillText']) {
        contexto[metodo] = vi.fn();
      }
      contextos.push(contexto);
      return contexto;
    } as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
      exportados.push({ width: this.width, height: this.height, type: type ?? '' });
      callback(new Blob(['editado'], { type }));
    };
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi.fn(async () => ({
      width: 400,
      height: 300,
      close: vi.fn(),
    }));
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originales.getContext;
    HTMLCanvasElement.prototype.toBlob = originales.toBlob;
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = originales.createImageBitmap;
  });

  it('carga la imagen y la pinta en el lienzo a su tamaño', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(lienzo().width).toBe(400);
    expect(lienzo().height).toBe(300);
    expect(consultar('editor-deshacer').getAttribute('aria-disabled')).toBe('true');
  });

  it('el foco entra al editor: al campo de texto o a la herramienta elegida', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }), 'text');
    expect(document.activeElement).toBe(consultar('editor-texto-campo'));
    fixture.destroy();

    await montar(new File(['x'], 'foto.png', { type: 'image/png' }), 'draw');
    expect(document.activeElement).toBe(consultar('editor-dibujar'));
  });

  it('cierra la imagen decodificada al irse', async () => {
    const cerrar = vi.fn();
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi.fn(async () => ({ width: 400, height: 300, close: cerrar }));
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    fixture.destroy();
    expect(cerrar).toHaveBeenCalled();
  });

  it('«Listo» sin cambios no devuelve un archivo nuevo', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(await listo()).toBe('cancelado');
    expect(exportados).toHaveLength(0);
  });

  it('girar 90° exporta con ancho y alto cambiados, mismo tipo y nombre legible', async () => {
    await montar(new File(['x'], '1792710466504_image.jpg', { type: 'image/jpeg' }));
    consultar('editor-girar').click();
    fixture.detectChanges();
    expect(lienzo().width).toBe(300);

    const archivo = await listo();
    expect(archivo).toBeInstanceOf(File);
    expect((archivo as File).name).toBe('imagen-editada.jpg');
    expect((archivo as File).type).toBe('image/jpeg');
    expect(exportados).toEqual([{ width: 300, height: 400, type: 'image/jpeg' }]);
  });

  it('el recorte por teclado achica lo exportado', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    const recorte = consultar('editor-recorte');
    for (let i = 0; i < 5; i += 1) {
      recorte.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }));
    }
    fixture.detectChanges();
    expect(consultar('editor-restablecer').getAttribute('aria-disabled')).toBe('false');

    await listo();
    // Cinco pasos del 2 % del lado corto (6 px cada uno) menos de ancho.
    expect(exportados).toEqual([{ width: 370, height: 300, type: 'image/png' }]);
  });

  it('un trazo a mano alzada entra en la pila y deshacer lo saca', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }), 'draw');
    const canvas = lienzo();
    canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 30, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    fixture.detectChanges();
    expect(canvas.getAttribute('aria-label')).toContain('1 cambio aplicado');
    expect(consultar('editor-deshacer').getAttribute('aria-disabled')).toBe('false');

    consultar('editor-deshacer').click();
    fixture.detectChanges();
    expect(canvas.getAttribute('aria-label')).toContain('0 cambios aplicados');
  });

  it('agrega un texto al centro y lo pinta con el color elegido', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }), 'text');
    const campo = consultar('editor-texto-campo') as HTMLInputElement;
    campo.value = 'Mancha nueva';
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    consultar('editor-texto-agregar').click();
    fixture.detectChanges();

    const pintado = contextos.some((c) =>
      (c['fillText'] as ReturnType<typeof vi.fn>).mock.calls.some((llamada) => llamada[0] === 'Mancha nueva' && llamada[1] === 200 && llamada[2] === 150),
    );
    expect(pintado).toBe(true);
    expect(campo.value).toBe('');
    expect(await listo()).toBeInstanceOf(File);
  });

  it('Escape cierra el editor sin tocar la vista previa', async () => {
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    let cancelado = false;
    fixture.componentInstance.cancelled.subscribe(() => (cancelado = true));
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const subio = vi.fn();
    document.body.addEventListener('keydown', subio);
    document.body.appendChild(fixture.nativeElement);
    consultar('editor-recorte').dispatchEvent(escape);
    document.body.removeEventListener('keydown', subio);
    expect(cancelado).toBe(true);
    expect(subio).not.toHaveBeenCalled();
  });

  it('si la imagen no se puede leer lo dice y no deja aplicar', async () => {
    (globalThis as { createImageBitmap?: unknown }).createImageBitmap = vi.fn(async () => {
      throw new Error('formato');
    });
    await montar(new File(['x'], 'foto.png', { type: 'image/png' }));
    expect(fixture.nativeElement.textContent).toContain('No pudimos abrir la imagen');
    expect(consultar('editor-listo').getAttribute('aria-disabled')).toBe('true');
  });
});
