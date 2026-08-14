import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import type {
  FileCategory,
  FileSensitivity,
} from '../../../../core/data-access/files/files.client';
import type { OwnerType } from '../../../../core/data-access/files/files.types';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../../molecules/alert/alert';
import { FileInput } from '../../molecules/file-input/file-input';
import { FormField } from '../../molecules/form-field/form-field';
import { Radio } from '../../molecules/radio/radio';
import { RadioGroup } from '../../molecules/radio-group/radio-group';

/** Tope de tamaño, espejo del que el backend impone en la subida. */
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Adjunta un archivo a un recurso: lo sube y lo vincula.
 *
 * ## De dónde sale el diseño
 *
 * De la maqueta `V02-common/sesion-autenticada/V02-01-archivos-subir.html`: el
 * campo de archivo, categoría y sensibilidad como grupos de radio, y el aviso
 * de error arriba. Se usan los componentes del banco —`app-form-field`,
 * `app-radio-group`, `app-file-input`— porque son los mismos selectores que la
 * maqueta declara.
 *
 * ## Son dos operaciones, no una
 *
 * `POST /common/files/upload` deja el archivo en el sistema; `POST
 * /common/files/:id/links` lo cuelga del recurso. Están separadas en el backend
 * porque el mismo archivo puede adjuntarse en varios lados. Acá se encadenan,
 * pero **si la segunda falla el archivo ya existe**: se avisa con ese matiz en
 * vez de decir «no se pudo subir», que sería mentira y llevaría a reintentar y
 * duplicarlo.
 *
 * ## Genérico a propósito
 *
 * No sabe de fichas clínicas: recibe `ownerType`/`ownerId` y ya. Los carriles de
 * presupuestos, procedimientos y laboratorios van a querer adjuntar archivos y
 * no deberían reconstruir esto.
 */
@Component({
  selector: 'app-attachment-uploader',
  imports: [AppButton, Alert, FileInput, FormField, Radio, RadioGroup],
  templateUrl: './attachment-uploader.html',
  styleUrl: './attachment-uploader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentUploader {
  private readonly files = inject(FilesClient);

  /** A qué tipo de recurso se adjunta. */
  readonly ownerType = input.required<OwnerType>();
  /** El recurso concreto. */
  readonly ownerId = input.required<string>();

  /** Se emite cuando el archivo quedó subido **y** vinculado. */
  readonly attached = output<void>();

  protected readonly seleccionados = signal<readonly File[]>([]);
  protected readonly categoria = signal<FileCategory>('DOCUMENT');
  protected readonly sensibilidad = signal<FileSensitivity>('PHI');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly rechazados = signal<readonly string[]>([]);

  protected readonly maxBytes = MAX_BYTES;
  protected readonly puedeSubir = computed(
    () => this.seleccionados().length > 0 && !this.enviando(),
  );

  /**
   * Los archivos que el control rechazó, dichos con su motivo.
   *
   * Se muestran en vez de descartarse en silencio: alguien que arrastró un
   * archivo de 40 MB tiene que enterarse de por qué no pasó nada.
   */
  protected alRechazar(rechazados: readonly { file: File; reason: string }[]): void {
    this.rechazados.set(
      rechazados.map(({ file, reason }) => `${file.name}: ${reason}`),
    );
  }

  protected subir(): void {
    const archivo = this.seleccionados()[0];
    if (archivo === undefined || this.enviando()) {
      return;
    }

    this.enviando.set(true);
    this.error.set('');

    this.files.upload(archivo, this.categoria(), this.sensibilidad()).subscribe({
      next: ({ id }) => this.vincular(id),
      error: () => {
        this.enviando.set(false);
        this.error.set('No pudimos subir el archivo. Reintentá.');
      },
    });
  }

  private vincular(fileId: string): void {
    this.files
      .link(fileId, { ownerType: this.ownerType(), ownerId: this.ownerId() })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.seleccionados.set([]);
          this.rechazados.set([]);
          this.attached.emit();
        },
        error: () => {
          this.enviando.set(false);
          // El archivo YA se subió: decirlo evita que reintenten y lo dupliquen.
          this.error.set(
            'El archivo se subió pero no se pudo adjuntar. Reintentá desde la lista de archivos, no volviendo a subirlo.',
          );
        },
      });
  }
}
