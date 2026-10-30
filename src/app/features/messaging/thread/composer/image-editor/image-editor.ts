import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Tooltip } from '../../../../../shared/components/atoms/tooltip/tooltip';
import { editedFileName } from '../attachment-draft';
import {
  adjustCrop,
  canvasToBlob,
  type CropHandle,
  drawStroke,
  type EditOperation,
  exportType,
  fullRect,
  isFullRect,
  type Point,
  type Rect,
  renderEdits,
  type Size,
  sizeAfter,
} from './image-edit';
import { LoadingState } from '../../../../../shared/components/molecules/loading-state/loading-state';

export type EditorTool = 'crop' | 'draw' | 'text';

/**
 * Los colores del lápiz y del texto, como tokens de rampa.
 *
 * Rampa y no semánticos: el trazo queda **dentro de la foto**, así que no
 * puede cambiar con el tema de quien la mira. El valor se lee del CSS al
 * usarlo, para que el lienzo pinte exactamente el color del sistema.
 */
export const EDITOR_SWATCHES = [
  { token: '--c-error-600', label: 'Rojo' },
  { token: '--c-amber-300', label: 'Ámbar' },
  { token: '--c-success-600', label: 'Verde' },
  { token: '--c-info-600', label: 'Azul' },
  { token: '--c-petrol-900', label: 'Petróleo' },
  { token: '--surface-white', label: 'Blanco' },
  { token: '--c-neutral-900', label: 'Negro' },
] as const;

/** El lado más largo con el que se trabaja: más que esto no lo pinta Safari. */
const MAX_WORKING_SIDE = 4096;

interface LoadedImage {
  readonly image: CanvasImageSource;
  readonly size: Size;
}

/**
 * Lee la imagen sin pasar por un `<img>`.
 *
 * `createImageBitmap` decodifica el `Blob` directo —respeta la orientación
 * EXIF y no depende de la CSP de imágenes— y, si la foto es enorme, la achica
 * en el mismo paso.
 */
async function loadImage(file: File): Promise<LoadedImage> {
  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  if (longest <= MAX_WORKING_SIDE) {
    return { image: bitmap, size: { width: bitmap.width, height: bitmap.height } };
  }
  const ratio = MAX_WORKING_SIDE / longest;
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  bitmap.close();
  const resized = await createImageBitmap(file, { resizeWidth: width, resizeHeight: height, resizeQuality: 'high' });
  return { image: resized, size: { width, height } };
}

function closeImage(loaded: LoadedImage | null): void {
  const image = loaded?.image;
  if (image !== undefined && 'close' in image && typeof image.close === 'function') image.close();
}

/** Un lienzo en cero no retiene memoria: Safari cuenta los vivos contra un tope. */
function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * El editor de imagen de la vista previa: recortar (relación libre y giro de
 * 90°), dibujar a mano alzada, poner texto y deshacer.
 *
 * Lienzo nativo y sin librerías: las cuatro herramientas son una pila de
 * operaciones que se repintan sobre la imagen original (ver `image-edit.ts`).
 * «Listo» exporta el lienzo a un `Blob` del mismo tipo y lo devuelve como un
 * `File` nuevo; la vista previa lo pone en lugar del que había.
 *
 * Bajo SSR no hace nada: la imagen se carga en un `effect` que sólo corre en
 * el navegador, y el lienzo no se toca hasta tenerla.
 */
@Component({
  selector: 'app-image-editor',
  imports: [AppButton, NgTemplateOutlet, Tooltip, LoadingState],
  templateUrl: './image-editor.html',
  styleUrl: './image-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'editor',
    '(keydown)': 'handleKeydown($event)',
  },
})
export class ImageEditor {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly file = input.required<File>();
  /** Con qué herramienta se abre: la que se tocó en la barra de la vista previa. */
  readonly initialTool = input<EditorTool>('crop');

  /** La imagen editada, ya como archivo. */
  readonly applied = output<File>();
  /** Se cerró sin cambios. */
  readonly cancelled = output<void>();

  private readonly stage = viewChild<ElementRef<HTMLCanvasElement>>('stage');

  protected readonly swatches = EDITOR_SWATCHES;
  protected readonly corners: readonly CropHandle[] = ['nw', 'ne', 'sw', 'se'];

  protected readonly tool = linkedSignal<EditorTool>(() => this.initialTool());
  protected readonly status = signal<'loading' | 'ready' | 'failed' | 'saving'>('loading');
  protected readonly error = signal('');
  protected readonly operations = signal<readonly EditOperation[]>([]);
  protected readonly color = signal<string>(EDITOR_SWATCHES[0].token);
  /** En píxeles de pantalla: se traduce a los de la imagen al trazar. */
  protected readonly strokeWidth = signal(6);
  protected readonly textSize = signal(32);
  protected readonly draftText = signal('');

  private readonly source = signal<LoadedImage | null>(null);

  /** El tamaño de la imagen tal como está ahora, con todo lo aplicado. */
  protected readonly size = computed(() => {
    const source = this.source();
    return source === null ? null : sizeAfter(source.size, this.operations());
  });

  /** El recorte en curso, todavía sin aplicar. Arranca en la imagen entera. */
  protected readonly crop = linkedSignal<Rect | null>(() => {
    const size = this.size();
    return size === null ? null : fullRect(size);
  });

  protected readonly cropPending = computed(() => {
    const crop = this.crop();
    const size = this.size();
    return crop !== null && size !== null && !isFullRect(crop, size);
  });

  /** El recuadro de recorte en porcentajes del lienzo, que es como se ve. */
  protected readonly cropBox = computed(() => {
    const crop = this.crop();
    const size = this.size();
    if (crop === null || size === null) return null;
    return {
      left: (crop.x / size.width) * 100,
      top: (crop.y / size.height) * 100,
      width: (crop.width / size.width) * 100,
      height: (crop.height / size.height) * 100,
    };
  });

  protected readonly canUndo = computed(() => this.operations().length > 0 || this.cropPending());

  /** El gesto del puntero en curso: un trazo o un arrastre del recorte. */
  private gesture:
    | { readonly kind: 'stroke'; readonly points: Point[]; readonly color: string; readonly width: number }
    | { readonly kind: 'crop'; readonly handle: CropHandle; readonly start: Point; readonly rect: Rect }
    | null = null;

  constructor() {
    effect((onCleanup) => {
      const file = this.file();
      if (!this.isBrowser) return;
      let alive = true;
      let loadedHere: LoadedImage | null = null;
      onCleanup(() => {
        alive = false;
        // La imagen decodificada no la junta el recolector a tiempo: son
        // decenas de MB por foto, y se cierra apenas deja de usarse.
        closeImage(loadedHere);
      });
      untracked(() => {
        this.status.set('loading');
        this.operations.set([]);
        this.source.set(null);
      });
      loadImage(file).then(
        (loaded) => {
          if (!alive) {
            closeImage(loaded);
            return;
          }
          loadedHere = loaded;
          this.source.set(loaded);
          this.status.set('ready');
        },
        () => {
          if (alive) this.status.set('failed');
        },
      );
    });

    // El foco entra al editor: el botón que lo abrió ya no existe, y sin esto
    // quedaba en el <body>, donde ni Escape ni Ctrl+Z llegan.
    afterNextRender(() => this.focusInitialControl());

    // Repinta cuando cambia la imagen o la pila; nada más lo dispara.
    effect(() => {
      const source = this.source();
      const operations = this.operations();
      const canvas = this.stage()?.nativeElement;
      if (source === null || canvas === undefined) return;
      untracked(() => this.paint(canvas, source, operations));
    });
  }

  /* --- Herramientas ------------------------------------------------------ */

  protected selectTool(tool: EditorTool): void {
    if (this.tool() === 'crop' && tool !== 'crop') {
      this.commitCrop();
    }
    this.tool.set(tool);
  }

  protected rotate(): void {
    this.commitCrop();
    this.push({ kind: 'rotate' });
  }

  protected resetCrop(): void {
    const size = this.size();
    if (size !== null) this.crop.set(fullRect(size));
  }

  /** Deshace primero el recorte sin aplicar; después, la última operación. */
  protected undo(): void {
    if (this.cropPending()) {
      this.resetCrop();
      return;
    }
    this.operations.update((list) => list.slice(0, -1));
  }

  protected placeTextAtCenter(): void {
    const size = this.size();
    if (size !== null) this.placeText({ x: size.width / 2, y: size.height / 2 });
  }

  /** «Listo»: aplica lo pendiente, exporta y devuelve el archivo nuevo. */
  protected async apply(): Promise<void> {
    if (this.status() !== 'ready') return;
    this.commitCrop();
    const source = this.source();
    const operations = this.operations();
    if (source === null || operations.length === 0) {
      // Nada cambió: no hay archivo nuevo que subir.
      this.cancelled.emit();
      return;
    }
    this.status.set('saving');
    this.error.set('');
    const original = this.file();
    const type = exportType(original.type);
    const canvas = renderEdits(source.image, source.size, operations, this.createCanvas);
    const blob = await canvasToBlob(canvas, type);
    releaseCanvas(canvas);
    if (blob === null) {
      this.status.set('ready');
      this.error.set('No pudimos guardar la edición. Intente de nuevo.');
      return;
    }
    const finalType = blob.type || type;
    this.applied.emit(
      new File([blob], editedFileName(original.name, finalType), { type: finalType, lastModified: Date.now() }),
    );
  }

  /* --- Puntero ----------------------------------------------------------- */

  protected startOnCanvas(event: PointerEvent): void {
    if (this.status() !== 'ready') return;
    const point = this.toImagePoint(event);
    if (point === null) return;
    if (this.tool() === 'text') {
      this.placeText(point);
      return;
    }
    if (this.tool() !== 'draw') return;
    event.preventDefault();
    this.capture(event);
    const scale = this.scale();
    this.gesture = {
      kind: 'stroke',
      points: [point],
      color: this.resolveColor(this.color()),
      width: Math.max(1, this.strokeWidth() * scale),
    };
  }

  protected startCrop(event: PointerEvent, handle: CropHandle): void {
    const point = this.toImagePoint(event);
    const rect = this.crop();
    if (point === null || rect === null) return;
    event.preventDefault();
    event.stopPropagation();
    this.capture(event);
    this.gesture = { kind: 'crop', handle, start: point, rect };
  }

  protected move(event: PointerEvent): void {
    const gesture = this.gesture;
    if (gesture === null) return;
    const point = this.toImagePoint(event);
    if (point === null) return;
    if (gesture.kind === 'crop') {
      const size = this.size();
      if (size !== null) {
        this.crop.set(adjustCrop(gesture.rect, gesture.handle, point.x - gesture.start.x, point.y - gesture.start.y, size));
      }
      return;
    }
    const previous = gesture.points[gesture.points.length - 1];
    gesture.points.push(point);
    // En vivo se pinta sólo el último tramo; al soltar se repinta todo.
    const context = this.stage()?.nativeElement.getContext('2d');
    if (context && previous) {
      drawStroke(context, { kind: 'stroke', color: gesture.color, width: gesture.width, points: [previous, point] });
    }
  }

  protected end(): void {
    const gesture = this.gesture;
    this.gesture = null;
    if (gesture?.kind === 'stroke') {
      this.push({ kind: 'stroke', color: gesture.color, width: gesture.width, points: [...gesture.points] });
    }
  }

  /* --- Teclado ----------------------------------------------------------- */

  /**
   * El recorte por teclado: las flechas mueven el área y, con Mayúsculas,
   * estiran la esquina de abajo a la derecha. Un paso es el 2 % del lado
   * corto; con Alt, un píxel.
   */
  protected cropKey(event: KeyboardEvent): void {
    const directions: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    const rect = this.crop();
    const size = this.size();
    if (direction === undefined || rect === null || size === null) return;
    event.preventDefault();
    const step = event.altKey ? 1 : Math.max(1, Math.round(Math.min(size.width, size.height) * 0.02));
    this.crop.set(
      adjustCrop(rect, event.shiftKey ? 'se' : 'move', direction.x * step, direction.y * step, size),
    );
  }

  /** Escape cierra el editor y no la vista previa entera. */
  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancelled.emit();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && this.canUndo()) {
      const target = event.target;
      // En el campo de texto, Ctrl+Z deshace lo escrito, no la imagen.
      if (target instanceof HTMLInputElement && target.type === 'text') return;
      event.preventDefault();
      this.undo();
    }
  }

  protected textKey(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.placeTextAtCenter();
    }
  }

  /* --- Internos ---------------------------------------------------------- */

  private push(operation: EditOperation): void {
    this.operations.update((list) => [...list, operation]);
  }

  private commitCrop(): void {
    const crop = this.crop();
    if (crop !== null && this.cropPending()) {
      this.push({ kind: 'crop', rect: crop });
    }
  }

  private placeText(at: Point): void {
    const text = this.draftText().trim();
    if (text === '') return;
    this.push({
      kind: 'text',
      text,
      at,
      color: this.resolveColor(this.color()),
      size: Math.max(8, this.textSize() * this.scale()),
      font: this.resolveToken('--font-body') || 'sans-serif',
    });
    this.draftText.set('');
  }

  private paint(canvas: HTMLCanvasElement, source: LoadedImage, operations: readonly EditOperation[]): void {
    const result = renderEdits(source.image, source.size, operations, this.createCanvas);
    canvas.width = result.width;
    canvas.height = result.height;
    canvas.getContext('2d')?.drawImage(result, 0, 0);
    releaseCanvas(result);
  }

  /** El campo de texto si se abrió con «Texto»; si no, la herramienta en uso. */
  private focusInitialControl(): void {
    const host = this.host.nativeElement;
    const target =
      this.tool() === 'text'
        ? host.querySelector<HTMLElement>('[data-testid="editor-texto-campo"]')
        : host.querySelector<HTMLElement>('.editor__herramientas [aria-pressed="true"]');
    (target ?? host.querySelector<HTMLElement>('[data-testid="editor-cancelar"]'))?.focus();
  }

  private readonly createCanvas = (width: number, height: number): HTMLCanvasElement => {
    const canvas = this.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  /** Cuántos píxeles de la imagen hay en uno de pantalla. */
  private scale(): number {
    const canvas = this.stage()?.nativeElement;
    const shown = canvas?.getBoundingClientRect().width ?? 0;
    return canvas !== undefined && shown > 0 ? canvas.width / shown : 1;
  }

  private toImagePoint(event: PointerEvent): Point | null {
    const canvas = this.stage()?.nativeElement;
    if (canvas === undefined) return null;
    const box = canvas.getBoundingClientRect();
    const scale = this.scale();
    return { x: (event.clientX - box.left) * scale, y: (event.clientY - box.top) * scale };
  }

  private capture(event: PointerEvent): void {
    const target = event.target;
    if (target instanceof Element && typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Un puntero sintético no se puede capturar; el gesto sigue igual.
      }
    }
  }

  private resolveColor(token: string): string {
    return this.resolveToken(token) || token;
  }

  private resolveToken(token: string): string {
    const view = this.document.defaultView;
    return view === null ? '' : view.getComputedStyle(this.host.nativeElement).getPropertyValue(token).trim();
  }
}
