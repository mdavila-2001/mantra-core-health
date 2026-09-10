import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { FORM_CONTROL_CONTEXT, nextControlId } from '@shared/forms/form-control.context';

import { matchesFileAccept } from '../../../forms/file-accept';
import { FilePreview } from '../file-preview/file-preview';

const BYTES_PER_UNIT = 1024;
const SIZE_UNITS = ['bytes', 'KB', 'MB', 'GB', 'TB'] as const;

/** Motivo por el que un archivo quedó fuera; se muestra al usuario. */
export interface RejectedFile {
  readonly file: File;
  readonly reason: 'tipo' | 'tamaño' | 'duplicado' | 'cupo';
}

/**
 * Carga de archivos con área de soltar. `accept`, `maxSizeBytes` y `maxFiles`
 * se validan **también al soltar**: el atributo `accept` nativo solo filtra el
 * diálogo del sistema, y arrastrar lo esquiva por completo.
 */
@Component({
  selector: 'app-file-input',
  standalone: true,
  imports: [FilePreview],
  templateUrl: './file-input.html',
  styleUrl: './file-input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-file-input-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class FileInput {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly files = model<readonly File[]>([]);
  readonly testId = input<string | null>(null);
  readonly removeTestId = input<string | null>(null);
  readonly label = input('Adjuntar archivo');
  readonly accessibleLabel = input('');
  readonly hasError = input(false);
  readonly required = input(false);
  readonly feedback = signal<readonly string[]>([]);
  readonly multiple = input<boolean>(false);
  readonly disabled = input<boolean>(false);
  /** Lista al estilo del atributo nativo: `image/*,.pdf`. */
  readonly accept = input<string>('');
  readonly maxSizeBytes = input<number | null>(null);
  readonly maxFiles = input<number | null>(null);

  /**
   * Si dibuja la lista de lo seleccionado.
   *
   * `false` cuando quien lo usa lleva su propia cola —con estado por archivo,
   * como el adjunto clínico—: dos listas de lo mismo, una con estado y otra
   * sin, se leen como dos selecciones distintas.
   */
  readonly showList = input(true);

  /** Lo descartado en el último intento, para poder explicarlo. */
  readonly rejected = output<readonly RejectedFile[]>();

  protected readonly isDragging = signal(false);

  /* -- Los textos, en plural cuando corresponde (§9.9 de la corrección) ----- */

  protected readonly textoDeArrastre = computed(() => {
    if (this.isDragging()) {
      return this.multiple() ? 'Soltá los archivos acá' : 'Soltá el archivo acá';
    }
    return this.multiple() ? 'Arrastrá uno o varios archivos acá' : 'Arrastrá tu archivo acá';
  });

  protected readonly textoSecundario = computed(() =>
    this.multiple()
      ? 'o seleccioná archivos desde tu dispositivo'
      : 'o seleccioná desde tu dispositivo',
  );

  /**
   * El rótulo del control nativo.
   *
   * Con varios ya elegidos dice «Añadir más archivos», que es lo que hace: la
   * selección se acumula y no reemplaza. Con uno solo sigue diciendo
   * «Reemplazar archivo», que es lo que hace en ese modo.
   */
  protected readonly textoDelBoton = computed(() => {
    if (!this.multiple()) {
      return this.files().length > 0 ? 'Reemplazar archivo' : this.label();
    }
    return this.files().length > 0 ? 'Añadir más archivos' : this.label();
  });

  private readonly ownId = nextControlId('file');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly labelId = computed(() => this.field?.labelId() ?? null);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() || this.feedback().length > 0,
  );
  protected readonly isRequired = computed(
    () => this.required() || (this.field?.required() ?? false),
  );
  protected readonly feedbackId = computed(() => `${this.controlId()}-feedback`);
  protected readonly describedBy = computed(
    () =>
      [this.field?.describedBy(), this.feedback().length ? this.feedbackId() : null]
        .filter(Boolean)
        .join(' ') || null,
  );

  protected handleFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.acceptFiles(Array.from(target.files ?? []));
    // Permite volver a elegir el mismo archivo tras quitarlo de la lista.
    target.value = '';
  }

  protected handleDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.disabled()) {
      this.isDragging.set(true);
    }
  }

  protected handleDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  protected handleDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.acceptFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected removeFile(index: number): void {
    if (this.disabled()) {
      return;
    }
    this.feedback.set([]);
    this.files.set(this.files().filter((_, position) => position !== index));
  }

  protected formatFileSize(bytes: number): string {
    if (bytes <= 0) {
      return `0 ${SIZE_UNITS[0]}`;
    }
    const exponent = Math.min(
      Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
      SIZE_UNITS.length - 1,
    );
    const size = bytes / BYTES_PER_UNIT ** exponent;
    return `${Number.parseFloat(size.toFixed(1))} ${SIZE_UNITS[exponent]}`;
  }

  private acceptFiles(incoming: File[]): void {
    if (this.disabled() || incoming.length === 0) {
      return;
    }

    const kept = this.multiple() ? [...this.files()] : [];
    const rejected: RejectedFile[] = [];

    for (const file of incoming) {
      const reason = this.rejectionReason(file, kept);
      if (reason) {
        rejected.push({ file, reason });
        continue;
      }
      kept.push(file);
      if (!this.multiple()) {
        break;
      }
    }

    // Una sustitución rechazada no debe borrar el documento válido anterior.
    if (kept.length > 0 || this.multiple()) this.files.set(kept);
    this.feedback.set(
      rejected.map(({ file, reason }) => {
        const messages = {
          tipo: 'Formato no permitido.',
          tamaño: `Supera el límite de ${this.formatFileSize(this.maxSizeBytes() ?? 0)}.`,
          duplicado: 'Este archivo ya está adjunto.',
          cupo: 'Alcanzaste el máximo de archivos.',
        };
        return `${file.name}: ${messages[reason]}`;
      }),
    );
    if (rejected.length > 0) {
      this.rejected.emit(rejected);
    }
  }

  private rejectionReason(file: File, kept: readonly File[]): RejectedFile['reason'] | null {
    if (!matchesFileAccept(file, this.accept())) {
      return 'tipo';
    }
    const maxSize = this.maxSizeBytes();
    if (maxSize !== null && file.size > maxSize) {
      return 'tamaño';
    }
    if (kept.some((existing) => this.isSameFile(existing, file))) {
      return 'duplicado';
    }
    const maxFiles = this.maxFiles();
    if (this.multiple() && maxFiles !== null && kept.length >= maxFiles) {
      return 'cupo';
    }
    return null;
  }

  /** El navegador no da un id de archivo: se compara la terna que sí expone. */
  private isSameFile(a: File, b: File): boolean {
    return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
  }
}
