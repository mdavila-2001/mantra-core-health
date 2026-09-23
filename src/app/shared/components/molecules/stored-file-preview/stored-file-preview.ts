/* ============================================================================
    Un archivo YA ALMACENADO, con su metadata y su vista previa.

    ## Qué hace, y sobre todo qué no

    Traduce un `fileId` al `File` que `app-file-preview` sabe pintar, y muestra
    lo que el archivo dice de sí mismo: nombre, tipo y tamaño. **Nada más.**

    No renderiza PDF, no decodifica imágenes, no detecta MIME, no elige
    fallback y no autoriza nada: todo eso ya existe y funciona. El motor de
    vista previa es `app-file-preview` (imagen, PDF rasterizado con pdfjs,
    texto, audio/vídeo y su propio texto para lo que no se puede mostrar), y la
    autorización es la del endpoint de contenido, que entrega el archivo a
    quien lo subió o a un rol de revisión. Este componente es el adaptador
    entre esas dos cosas, y se mantiene pequeño a propósito.

    ## Por qué un `File` y no un `Blob`

    Porque `app-file-preview` decide qué hacer mirando `file.type` **y**
    `file.name` —el PDF lo reconoce por cualquiera de los dos—, y un `Blob`
    pelado no tiene nombre. Se construye un `File` con el nombre real cuando la
    respuesta lo trajo, y con el de reserva cuando no: así el PDF sin
    `Content-Disposition` se sigue reconociendo por su `type`.

    ## Lo que nunca se muestra

    Ni `storageUri`, ni bucket, ni object key, ni hash, ni ninguna URL interna.
    Este componente no los recibe: `StoredFileContent` no los transporta, y el
    endpoint de contenido tampoco los emite.
   ========================================================================== */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { FilesClient } from '@core/data-access/files/files.client';
import { formatearTamano } from '@core/data-access/files/upload-policy';
import type { StoredFileContent } from '@core/data-access/files/files.types';
import { FilePreview } from '../file-preview/file-preview';

/** En qué punto está la lectura del archivo. */
type Estado = 'carga' | 'listo' | 'error';

/**
 * Cómo se llama un tipo MIME en una pantalla.
 *
 * Sólo los formatos que el almacenamiento admite de verdad (su allowlist por
 * firma binaria). Lo que no esté acá se muestra por su MIME crudo, que es
 * información honesta aunque fea; inventar una etiqueta genérica escondería
 * que llegó algo inesperado.
 */
const NOMBRE_DEL_TIPO: Readonly<Record<string, string>> = {
  'image/jpeg': 'Imagen JPEG',
  'image/png': 'Imagen PNG',
  'image/webp': 'Imagen WEBP',
  'image/gif': 'Imagen GIF',
  'application/pdf': 'Documento PDF',
  'text/plain': 'Texto',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de cálculo Excel',
};

@Component({
  selector: 'app-stored-file-preview',
  imports: [FilePreview],
  templateUrl: './stored-file-preview.html',
  styleUrl: './stored-file-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoredFilePreview {
  private readonly files = inject(FilesClient);

  /** El archivo a mostrar (`common.files`). */
  readonly fileId = input.required<string>();

  /**
   * Cómo llamarlo cuando la respuesta no trae nombre.
   *
   * Lo pone quien usa el componente porque sólo él sabe qué es el archivo en su
   * pantalla: «Evidencia de la solicitud» dice bastante más que «Archivo».
   */
  readonly nombreDeReserva = input<string>('Archivo adjunto');

  protected readonly estado = signal<Estado>('carga');
  protected readonly contenido = signal<StoredFileContent | null>(null);

  /** El `File` que entiende `app-file-preview`, o `null` mientras no haya. */
  protected readonly archivo = computed<File | null>(() => {
    const leido = this.contenido();
    if (!leido) return null;
    return new File([leido.blob], leido.originalName ?? this.nombreDeReserva(), {
      type: leido.mimeType,
    });
  });

  /** El nombre que se muestra: el real si vino, el de reserva si no. */
  protected readonly nombre = computed(
    () => this.contenido()?.originalName ?? this.nombreDeReserva(),
  );

  /** Si el nombre mostrado es de reserva, para decirlo en vez de fingir. */
  protected readonly nombreEsDeReserva = computed(
    () => this.contenido()?.originalName === undefined,
  );

  /**
   * El tipo, en palabras. Vacío cuando la respuesta no declaró ninguno — que
   * pasa y no se disimula: sin tipo no hay vista previa que ofrecer.
   */
  protected readonly tipo = computed(() => {
    const mime = this.contenido()?.mimeType ?? '';
    if (mime === '') return 'Tipo desconocido';
    return NOMBRE_DEL_TIPO[mime] ?? mime;
  });

  /** El tamaño, con el mismo criterio que el resto del sistema. */
  protected readonly tamano = computed(() => {
    const bytes = this.contenido()?.sizeBytes ?? 0;
    return formatearTamano(bytes);
  });

  constructor() {
    // `effect` y no `ngOnInit`: `fileId` es un `input.required`, y una lista que
    // reordena adjuntos puede reusar la instancia con otro id. Mismo motivo que
    // documenta `app-file-preview-image`.
    effect(() => {
      const id = this.fileId();
      this.estado.set('carga');
      this.contenido.set(null);
      this.files
        .storedFileContent(id)
        .pipe(catchError(() => of(null)))
        .subscribe((leido) => {
          this.contenido.set(leido);
          this.estado.set(leido ? 'listo' : 'error');
        });
    });
  }
}
