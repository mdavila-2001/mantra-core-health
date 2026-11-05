import { Directive, effect, inject, input, output, Renderer2, signal } from '@angular/core';

import { matchesFileAccept } from './file-accept';
import { observeNativeFilePicker } from './native-file-picker';

/**
 * Añade arrastre a selectores compactos (avatar/chat), conservando su handler
 * nativo. Con el diálogo del sistema abierto no acepta soltar
 * (`observeNativeFilePicker`).
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
  readonly target = input.required<HTMLInputElement>({ alias: 'appFileDropTarget' });
  readonly fileDropRejected = output<string>();
  protected readonly dragging = signal(false);
  private readonly pickerOpen = signal(false);

  constructor() {
    const renderer = inject(Renderer2);
    effect((onCleanup) => {
      const stop = observeNativeFilePicker(this.target(), renderer, (open) =>
        this.pickerOpen.set(open),
      );
      onCleanup(stop);
    });
  }

  protected dragOver(event: DragEvent): void {
    if (!event.dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    const blocked = this.target().disabled || this.pickerOpen();
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
    const target = this.target();
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
