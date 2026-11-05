import { computed, Directive, effect, inject, input, output, Renderer2, signal } from '@angular/core';

import { matchesFileAccept } from './file-accept';
import { observeNativeFilePicker } from './native-file-picker';

/**
 * Añade arrastre a selectores compactos (avatar/chat), conservando su handler
 * nativo. Con el diálogo del sistema abierto no acepta soltar
 * (`observeNativeFilePicker`).
 *
 * Recibe el `<input type="file">` que toma lo soltado, o una lista cuando la
 * misma zona tiene más de un selector nativo (el compositor del chat: archivo
 * y cámara): lo soltado va al primero y cualquiera de ellos abierto bloquea.
 */
@Directive({
  selector: '[appFileDropTarget]',
  host: {
    '[class.file-drop-target]': 'true',
    '[class.file-drop-target--active]': 'dragging()',
    '(dragover)': 'dragOver($event)',
    '(dragleave)': 'dragLeave($event)',
    '(drop)': 'drop($event)',
  },
})
export class FileDropTarget {
  readonly target = input.required<HTMLInputElement | readonly HTMLInputElement[]>({
    alias: 'appFileDropTarget',
  });
  readonly fileDropRejected = output<string>();
  protected readonly dragging = signal(false);
  private readonly pickerOpen = signal(false);

  private readonly pickers = computed<readonly HTMLInputElement[]>(() => {
    const target = this.target();
    return target instanceof HTMLInputElement ? [target] : target;
  });
  /** El que recibe lo soltado. */
  private readonly receiver = computed(() => this.pickers()[0]);

  constructor() {
    const renderer = inject(Renderer2);
    effect((onCleanup) => {
      const open = new Set<HTMLInputElement>();
      const stops = this.pickers().map((picker) =>
        observeNativeFilePicker(picker, renderer, (isOpen) => {
          if (isOpen) open.add(picker);
          else open.delete(picker);
          this.pickerOpen.set(open.size > 0);
        }),
      );
      onCleanup(() => {
        for (const stop of stops) stop();
      });
    });
  }

  protected dragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    const blocked = this.receiver().disabled || this.pickerOpen();
    event.dataTransfer.dropEffect = blocked ? 'none' : 'copy';
    this.dragging.set(!blocked);
  }

  protected dragLeave(event: DragEvent): void {
    if (
      event.currentTarget instanceof Node &&
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )
      return;
    this.dragging.set(false);
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const target = this.receiver();
    if (target.disabled || this.pickerOpen() || !event.dataTransfer?.files.length) return;
    const file = event.dataTransfer.files[0];
    if (!matchesFileAccept(file, target.accept)) {
      this.fileDropRejected.emit('El formato del archivo no está permitido para este campo.');
      return;
    }
    target.files = event.dataTransfer.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
