/**
 * El motor del editor de imagen: geometría y dibujo sobre `<canvas>`, sin
 * Angular y sin tocar `document`.
 *
 * ## Por qué se guardan operaciones y no fotos del lienzo
 *
 * Deshacer podía resolverse guardando una copia del lienzo por paso, pero una
 * foto de 12 MP son 48 MB por copia. Acá se guarda la **lista de
 * operaciones** —girar, recortar, un trazo, un texto— y se vuelve a pintar
 * desde la imagen original cada vez: deshacer es sacar la última y repintar.
 * Cada operación se expresa en los píxeles de la imagen **tal como estaba en
 * ese paso**, así que repintar da siempre lo mismo.
 */

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect extends Point, Size {}

export type EditOperation =
  /** Un cuarto de vuelta en el sentido del reloj. */
  | { readonly kind: 'rotate' }
  | { readonly kind: 'crop'; readonly rect: Rect }
  | {
      readonly kind: 'stroke';
      readonly color: string;
      readonly width: number;
      readonly points: readonly Point[];
    }
  | {
      readonly kind: 'text';
      readonly text: string;
      readonly color: string;
      readonly size: number;
      readonly font: string;
      readonly at: Point;
    };

/** Lo que se toma con el puntero en el recorte: el área entera o una esquina. */
export type CropHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

/** El recorte más chico que se deja, en píxeles de la imagen. */
export const MIN_CROP = 24;

/** Crea un lienzo del tamaño pedido. En el navegador, `document.createElement`. */
export type CanvasFactory = (width: number, height: number) => HTMLCanvasElement;

export function fullRect(size: Size): Rect {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

export function isFullRect(rect: Rect, size: Size): boolean {
  return (
    Math.round(rect.x) === 0 &&
    Math.round(rect.y) === 0 &&
    Math.round(rect.width) === size.width &&
    Math.round(rect.height) === size.height
  );
}

/** El tamaño de la imagen después de aplicar las operaciones. */
export function sizeAfter(source: Size, operations: readonly EditOperation[]): Size {
  let size: Size = { width: source.width, height: source.height };
  for (const operation of operations) {
    if (operation.kind === 'rotate') {
      size = { width: size.height, height: size.width };
    } else if (operation.kind === 'crop') {
      size = { width: Math.round(operation.rect.width), height: Math.round(operation.rect.height) };
    }
  }
  return size;
}

/** Encierra el rectángulo dentro de la imagen sin achicarlo por debajo del mínimo. */
export function clampRect(rect: Rect, bounds: Size): Rect {
  const min = Math.min(MIN_CROP, bounds.width, bounds.height);
  const width = Math.min(Math.max(rect.width, min), bounds.width);
  const height = Math.min(Math.max(rect.height, min), bounds.height);
  const x = Math.min(Math.max(rect.x, 0), bounds.width - width);
  const y = Math.min(Math.max(rect.y, 0), bounds.height - height);
  return { x, y, width, height };
}

/**
 * Mueve el área o una de sus esquinas. La relación de aspecto es libre: cada
 * esquina arrastra sólo sus dos lados, y el opuesto se queda quieto.
 *
 * @param rect - El recorte al empezar el gesto.
 * @param handle - Qué se tomó.
 * @param dx - Cuánto se movió el puntero, en píxeles de la imagen.
 * @param dy - Ídem, en vertical.
 */
export function adjustCrop(rect: Rect, handle: CropHandle, dx: number, dy: number, bounds: Size): Rect {
  if (handle === 'move') {
    return clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, bounds);
  }
  const min = Math.min(MIN_CROP, bounds.width, bounds.height);
  let left = rect.x;
  let top = rect.y;
  let right = rect.x + rect.width;
  let bottom = rect.y + rect.height;
  if (handle === 'nw' || handle === 'sw') left = Math.min(Math.max(0, left + dx), right - min);
  if (handle === 'ne' || handle === 'se') right = Math.max(Math.min(bounds.width, right + dx), left + min);
  if (handle === 'nw' || handle === 'ne') top = Math.min(Math.max(0, top + dy), bottom - min);
  if (handle === 'sw' || handle === 'se') bottom = Math.max(Math.min(bounds.height, bottom + dy), top + min);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Un trazo a mano alzada, con las puntas y las uniones redondas. */
export function drawStroke(context: CanvasRenderingContext2D, operation: Extract<EditOperation, { kind: 'stroke' }>): void {
  const [first, ...rest] = operation.points;
  if (first === undefined) return;
  context.save();
  context.strokeStyle = operation.color;
  context.fillStyle = operation.color;
  context.lineWidth = operation.width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (rest.length === 0) {
    // Un toque sin arrastre deja un punto, como un lápiz apoyado.
    context.beginPath();
    context.arc(first.x, first.y, operation.width / 2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(first.x, first.y);
    for (const point of rest) context.lineTo(point.x, point.y);
    context.stroke();
  }
  context.restore();
}

/** Un texto centrado en su punto, una línea por renglón. */
export function drawText(context: CanvasRenderingContext2D, operation: Extract<EditOperation, { kind: 'text' }>): void {
  const lines = operation.text.split('\n');
  const lineHeight = operation.size * 1.2;
  const firstLineY = operation.at.y - ((lines.length - 1) * lineHeight) / 2;
  context.save();
  context.font = `700 ${operation.size}px ${operation.font}`;
  context.fillStyle = operation.color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) => context.fillText(line, operation.at.x, firstLineY + index * lineHeight));
  context.restore();
}

/**
 * Pinta la imagen con todas las operaciones, desde cero.
 *
 * @returns Un lienzo nuevo, del tamaño final. Si el navegador no da contexto
 * 2D (jsdom, un lienzo demasiado grande), el lienzo vuelve en blanco y quien
 * exporta lo nota por el `Blob` nulo.
 */
export function renderEdits(
  source: CanvasImageSource,
  sourceSize: Size,
  operations: readonly EditOperation[],
  createCanvas: CanvasFactory,
): HTMLCanvasElement {
  let canvas = createCanvas(sourceSize.width, sourceSize.height);
  let context = canvas.getContext('2d');
  context?.drawImage(source, 0, 0, sourceSize.width, sourceSize.height);

  for (const operation of operations) {
    switch (operation.kind) {
      case 'rotate': {
        const next = createCanvas(canvas.height, canvas.width);
        const nextContext = next.getContext('2d');
        nextContext?.translate(next.width, 0);
        nextContext?.rotate(Math.PI / 2);
        nextContext?.drawImage(canvas, 0, 0);
        release(canvas);
        canvas = next;
        context = nextContext;
        break;
      }
      case 'crop': {
        const { x, y } = operation.rect;
        const width = Math.round(operation.rect.width);
        const height = Math.round(operation.rect.height);
        const next = createCanvas(width, height);
        const nextContext = next.getContext('2d');
        nextContext?.drawImage(canvas, Math.round(x), Math.round(y), width, height, 0, 0, width, height);
        release(canvas);
        canvas = next;
        context = nextContext;
        break;
      }
      case 'stroke':
        if (context) drawStroke(context, operation);
        break;
      case 'text':
        if (context) drawText(context, operation);
        break;
    }
  }
  return canvas;
}

/** El lienzo intermedio ya copiado no se necesita más: en cero no ocupa memoria. */
function release(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * El tipo con el que se exporta: el mismo del original cuando el lienzo lo
 * sabe escribir, PNG cuando no (un BMP o un AVIF).
 */
export function exportType(originalType: string): string {
  return originalType === 'image/jpeg' || originalType === 'image/webp' ? originalType : 'image/png';
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, 0.92);
    } catch {
      // Un lienzo «contaminado» o sin soporte: no hay archivo que devolver.
      resolve(null);
    }
  });
}
