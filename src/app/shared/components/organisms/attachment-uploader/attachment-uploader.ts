import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';

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
 * Cuántos archivos entran en una tanda.
 *
 * Diez y no uno: el cliente pidió «un gestor para subir archivos de todo tipo y
 * formato **y en varias cantidades**». El tope existe igual porque cada archivo
 * es una petición —el backend recibe de a uno
 * (`FileInterceptor('file', { files: 1 })`)— y una tanda de cien sería una
 * espera sin fin sin nada que la explique.
 */
const MAX_ARCHIVOS = 10;

/**
 * Los tipos que el backend admite hoy, dichos en palabras.
 *
 * Salen de `UPLOAD_MIME_ALLOWLIST` (`file-upload.service.ts`), que además
 * **verifica la firma de bytes** y no la extensión. Decirlos evita el 422 con
 * un archivo que nunca iba a entrar; prometer «todo tipo y formato» sería
 * mentir hasta que la lista crezca (P25 en `PENDIENTES-BACKEND.md`).
 */
const FORMATOS_ADMITIDOS = 'PDF, imágenes (JPG, PNG, WebP, GIF), Word, Excel y texto';

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

  /**
   * Reemplaza el vínculo genérico (`POST /common/files/:id/links`) por uno
   * propio del dominio.
   *
   * `POST /common/files/:id/links` es infraestructura compartida y no exige
   * rol ni verifica que el propietario exista — es a propósito, sirve a
   * cualquier contexto. Un consumidor cuyo dominio SÍ tiene su propia regla de
   * quién puede adjuntar qué (p. ej. `clinical` con sus diagnósticos) manda
   * acá su propio endpoint en vez de confiar en que el genérico alcance.
   */
  readonly linkVia = input<((fileId: string, ownerId: string) => Observable<unknown>) | null>(
    null,
  );

  /**
   * Cuántos archivos se aceptan de una vez.
   *
   * Quien monta el subidor puede bajarlo a uno donde de verdad sólo tenga
   * sentido uno; el valor por omisión es la tanda.
   */
  readonly maxFiles = input(MAX_ARCHIVOS);

  /** Se emite por **cada** archivo que quedó subido y vinculado. */
  readonly attached = output<void>();

  /** Se emite una vez, cuando la tanda entera terminó. */
  readonly attachedAll = output<void>();

  protected readonly seleccionados = signal<readonly File[]>([]);
  protected readonly sensibilidad = signal<FileSensitivity>('PHI');
  protected readonly enviando = signal(false);
  protected readonly error = signal('');
  protected readonly rechazados = signal<readonly string[]>([]);

  /** Cuántos van y cuántos son, mientras la tanda corre. */
  protected readonly subidos = signal(0);

  protected readonly maxBytes = MAX_BYTES;
  protected readonly formatos = FORMATOS_ADMITIDOS;
  protected readonly puedeSubir = computed(
    () => this.seleccionados().length > 0 && !this.enviando(),
  );

  /** «Adjuntando 3 de 7…», para que la espera diga en qué va. */
  protected readonly progreso = computed(() =>
    this.enviando() ? `Adjuntando ${this.subidos() + 1} de ${this.seleccionados().length}…` : '',
  );

  protected readonly hint = computed(
    () =>
      `Hasta ${this.maxFiles()} ${this.maxFiles() === 1 ? 'archivo' : 'archivos'} de 10 MB cada uno. ` +
      `${FORMATOS_ADMITIDOS}. Se registran con tu nombre y la hora.`,
  );

  /**
   * La categoría del archivo, **deducida de su tipo**.
   *
   * Era un par de radios que quien adjunta tenía que responder por cada tanda,
   * y la respuesta ya está en el archivo: el backend admite las imágenes en las
   * dos categorías, así que lo único que la elección podía hacer era
   * equivocarse. La sensibilidad sí se pregunta: eso no lo dice el archivo.
   */
  private categoriaDe(archivo: File): FileCategory {
    return archivo.type.startsWith('image/') ? 'IMAGE' : 'DOCUMENT';
  }

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

  /**
   * Sube y vincula la tanda, **uno por uno y en orden**.
   *
   * En secuencia y no en paralelo por dos motivos: el backend recibe un archivo
   * por petición, y una tanda paralela de diez subidas de 10 MB compite consigo
   * misma. En orden, además, «3 de 7» significa algo.
   *
   * **Un fallo no detiene la tanda.** Si el tercero no entra, los otros seis
   * siguen y al final se nombra el que no pudo: cancelar todo por uno obligaría
   * a volver a elegir los que sí habían entrado.
   */
  protected async subir(): Promise<void> {
    const archivos = this.seleccionados();
    if (archivos.length === 0 || this.enviando()) return;

    this.enviando.set(true);
    this.error.set('');
    this.rechazados.set([]);
    this.subidos.set(0);

    const fallidos: string[] = [];
    for (const archivo of archivos) {
      const problema = await this.subirUno(archivo);
      if (problema !== null) fallidos.push(`${archivo.name}: ${problema}`);
      else this.attached.emit();
      this.subidos.update((n) => n + 1);
    }

    this.enviando.set(false);
    this.seleccionados.set([]);
    this.rechazados.set(fallidos);
    if (fallidos.length < archivos.length) this.attachedAll.emit();
  }

  /**
   * Sube y vincula un archivo. Devuelve el motivo del fallo, o `null`.
   *
   * Los dos pasos se distinguen a propósito: si el vínculo falla el archivo
   * **ya está subido**, y decir «no se pudo subir» llevaría a reintentar y
   * duplicarlo.
   */
  private async subirUno(archivo: File): Promise<string | null> {
    let fileId: string;
    try {
      const subido = await firstValueFrom(
        this.files.upload(archivo, this.categoriaDe(archivo), this.sensibilidad()),
      );
      fileId = subido.id;
    } catch {
      return 'no se pudo subir';
    }

    const enlazar = this.linkVia();
    try {
      await firstValueFrom(
        enlazar
          ? enlazar(fileId, this.ownerId())
          : this.files.link(fileId, { ownerType: this.ownerType(), ownerId: this.ownerId() }),
      );
      return null;
    } catch {
      return 'se subió pero no se pudo adjuntar; reintentá desde la lista de archivos, no volviendo a subirlo';
    }
  }
}
