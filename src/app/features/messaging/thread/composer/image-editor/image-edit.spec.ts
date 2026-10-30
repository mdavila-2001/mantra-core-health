import { adjustCrop, clampRect, MIN_CROP, renderEdits, sizeAfter, exportType, isFullRect } from './image-edit';
import { editedFileName, partitionFiles, MAX_DRAFTS, isEditableImage } from '../attachment-draft';

/**
 * Lo que estas pruebas fijan: que la geometría del recorte respeta la imagen
 * (nunca sale de ella ni baja del mínimo), que la relación de aspecto es
 * libre, que repintar la pila da el tamaño que anuncia `sizeAfter`, y que el
 * archivo editado conserva el tipo y lleva un nombre que se puede leer.
 */
describe('image-edit', () => {
  const bounds = { width: 400, height: 300 };

  it('mover el recorte no lo saca de la imagen', () => {
    const rect = { x: 300, y: 200, width: 100, height: 100 };
    expect(adjustCrop(rect, 'move', 80, 80, bounds)).toEqual({ x: 300, y: 200, width: 100, height: 100 });
    expect(adjustCrop(rect, 'move', -50, -20, bounds)).toEqual({ x: 250, y: 180, width: 100, height: 100 });
  });

  it('una esquina estira sólo sus dos lados: la relación es libre', () => {
    const rect = { x: 0, y: 0, width: 400, height: 300 };
    expect(adjustCrop(rect, 'se', -100, -10, bounds)).toEqual({ x: 0, y: 0, width: 300, height: 290 });
    expect(adjustCrop(rect, 'nw', 40, 120, bounds)).toEqual({ x: 40, y: 120, width: 360, height: 180 });
  });

  it('el recorte no baja del mínimo ni cruza el lado opuesto', () => {
    const rect = { x: 100, y: 100, width: 100, height: 100 };
    const chico = adjustCrop(rect, 'se', -500, -500, bounds);
    expect(chico.width).toBe(MIN_CROP);
    expect(chico.height).toBe(MIN_CROP);
    expect(clampRect({ x: -10, y: -10, width: 900, height: 900 }, bounds)).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('girar cambia ancho por alto y recortar deja el tamaño del recuadro', () => {
    expect(sizeAfter(bounds, [{ kind: 'rotate' }])).toEqual({ width: 300, height: 400 });
    expect(
      sizeAfter(bounds, [{ kind: 'rotate' }, { kind: 'crop', rect: { x: 10, y: 10, width: 120.4, height: 200.6 } }]),
    ).toEqual({ width: 120, height: 201 });
    expect(isFullRect({ x: 0, y: 0, width: 400, height: 300 }, bounds)).toBe(true);
  });

  it('repintar aplica las operaciones en orden sobre lienzos nuevos', () => {
    const contextos: Record<string, ReturnType<typeof vi.fn>>[] = [];
    const lienzo = (width: number, height: number) => {
      const contexto = {
        drawImage: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
      };
      contextos.push(contexto);
      return { width, height, getContext: () => contexto } as unknown as HTMLCanvasElement;
    };

    const final = renderEdits({} as CanvasImageSource, bounds, [
      { kind: 'stroke', color: 'red', width: 4, points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] },
      { kind: 'rotate' },
      { kind: 'crop', rect: { x: 0, y: 0, width: 100, height: 50 } },
      { kind: 'text', text: 'Hola', color: 'blue', size: 20, font: 'sans-serif', at: { x: 50, y: 25 } },
    ], lienzo);

    expect(contextos).toHaveLength(3);
    expect(contextos[0]['lineTo']).toHaveBeenCalledWith(5, 5);
    expect(contextos[1]['rotate']).toHaveBeenCalledWith(Math.PI / 2);
    expect(contextos[2]['fillText']).toHaveBeenCalledWith('Hola', 50, 25);
    expect([final.width, final.height]).toEqual([100, 50]);
  });

  it('exporta en el tipo original cuando el lienzo lo sabe escribir', () => {
    expect(exportType('image/jpeg')).toBe('image/jpeg');
    expect(exportType('image/webp')).toBe('image/webp');
    expect(exportType('image/bmp')).toBe('image/png');
  });
});

describe('attachment-draft', () => {
  it('el nombre editado es legible y sin la marca de tiempo', () => {
    expect(editedFileName('1792710466504_image.png', 'image/png')).toBe('imagen-editada.png');
    expect(editedFileName('Lunar brazo.jpeg', 'image/jpeg')).toBe('Lunar brazo-editada.jpg');
    // Editar dos veces no apila «-editada-editada».
    expect(editedFileName('Lunar brazo-editada.jpg', 'image/jpeg')).toBe('Lunar brazo-editada.jpg');
  });

  it('separa lo que se puede mandar y dice por qué no lo otro', () => {
    const foto = new File(['x'], 'a.png', { type: 'image/png' });
    // Lo que la API no guarda (un video) queda afuera; un texto sí entra.
    const video = new File(['x'], 'b.mp4', { type: 'video/mp4' });
    const { accepted, rejection } = partitionFiles([foto, video]);
    expect(accepted).toEqual([foto]);
    expect(rejection).toBe(
      '«b.mp4» no se puede mandar. Puede mandar fotos, PDF, documentos de Word o Excel y archivos de texto.',
    );
  });

  it('no deja pasar más del tope por envío', () => {
    const fotos = Array.from({ length: 3 }, (_, i) => new File(['x'], `${i}.png`, { type: 'image/png' }));
    const { accepted, rejection } = partitionFiles(fotos, 2);
    expect(accepted).toHaveLength(2);
    expect(rejection).toBe(`Puede mandar hasta ${MAX_DRAFTS} archivos por vez.`);
  });

  it('el GIF no se edita: el lienzo perdería la animación', () => {
    expect(isEditableImage(new File(['x'], 'a.gif', { type: 'image/gif' }))).toBe(false);
    expect(isEditableImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
  });
});
