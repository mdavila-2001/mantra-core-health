import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import type { Subscription } from 'rxjs';

import { FileInput, type RejectedFile } from '../file-input/file-input';
import { Progress } from '../../atoms/progress/progress';
import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';
import type { DropzonePdfState, PdfUploader, UploadedDocument } from './dropzone-pdf.types';

const MENSAJE_FORMATO_O_TAMANO = 'Solo se admiten documentos PDF de hasta 10 MB.';

/** Un tamaño en palabras, mismo criterio que `app-file-input`. */
function formatearTamano(bytes: number): string {
  if (bytes <= 0) return '0 bytes';
  const unidades = ['bytes', 'KB', 'MB', 'GB'] as const;
  const exponente = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
  const tamano = bytes / 1024 ** exponente;
  return `${Number.parseFloat(tamano.toFixed(1))} ${unidades[exponente]}`;
}

/**
 * Un documento legal en PDF: elegir o soltar, subir con progreso, y recordar
 * el `fileId` que devuelve la pre-carga (subtarea 1.2).
 *
 * Envuelve `app-file-input` —que ya valida `accept`/`maxSizeBytes` al soltar
 * y emite `rejected` cuando algo no pasa— y `app-progress` para el avance.
 * No conoce IAM ni ningún cliente de dominio: recibe **cómo subir** por
 * `uploader`, así que cualquier alta que necesite el mismo patrón puede
 * reusarla sin que esta molécula dependa de un endpoint concreto.
 *
 * ```html
 * <app-dropzone-pdf
 *   [uploader]="subirDocumento"
 *   [label]="'Escritura de constitución'"
 *   [required]="true"
 *   [testId]="'registro-organizacion-doc-constitution'"
 *   (fileIdChange)="registrarDocumento('constitutionFileId', $event)"
 * />
 * ```
 *
 * ## `documentoInicial`: sobrevivir a ir y volver
 *
 * Un asistente de varios pasos destruye y recrea el contenido de una página
 * al alejarse de ella (`app-paginated-form` sólo renderiza la página
 * vigente). Una instancia nueva de esta molécula nace en `empty`, así que
 * sin este input un documento ya subido —su `fileId` sigue en el
 * `FormControl`, eso no se pierde— se vería vacío al volver a esa página,
 * aunque el alta lo enviara igual. `documentoInicial` deja que quien
 * orquesta el formulario (que sí sobrevive a la navegación) le devuelva lo
 * que ya sabe de ese documento, y la molécula arranca en `ready` en vez de
 * en `empty`. Sólo siembra el estado una vez; después manda lo que el
 * usuario haga en esta instancia.
 */
@Component({
  selector: 'app-dropzone-pdf',
  imports: [FileInput, Progress],
  templateUrl: './dropzone-pdf.html',
  styleUrl: './dropzone-pdf.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropzonePdf {
  private readonly destroyRef = inject(DestroyRef);

  readonly uploader = input.required<PdfUploader>();
  readonly label = input.required<string>();
  readonly testId = input.required<string>();
  readonly required = input(false);
  readonly hasError = input(false);
  readonly disabled = input(false);
  readonly maxSizeBytes = input<number>(UPLOAD_MAX_BYTES);

  /**
   * Un documento ya subido en una visita anterior a esta página, si lo hay.
   * Ver el JSDoc de la clase.
   */
  readonly documentoInicial = input<UploadedDocument | null>(null);

  /** El `fileId` vigente, o `null` mientras no hay uno utilizable. */
  readonly fileId = model<string | null>(null);
  readonly uploaded = output<UploadedDocument>();
  readonly failed = output<string>();

  protected readonly state = signal<DropzonePdfState>({ kind: 'empty' });

  /** `app-file-input` necesita su propio arreglo de archivos elegidos. */
  protected readonly archivos = signal<readonly File[]>([]);

  private suscripcion: Subscription | undefined;
  private sembrado = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.suscripcion?.unsubscribe());

    // Siembra el estado UNA sola vez, la primera vez que `documentoInicial`
    // trae algo: después de eso manda lo que pase en esta instancia (subir
    // uno nuevo, quitarlo), no lo que el padre siga recordando.
    effect(() => {
      const inicial = this.documentoInicial();
      if (inicial && !this.sembrado && this.state().kind === 'empty') {
        this.sembrado = true;
        this.state.set({
          kind: 'ready',
          fileName: inicial.originalName,
          fileId: inicial.fileId,
          sizeBytes: inicial.sizeBytes,
        });
        this.fileId.set(inicial.fileId);
      }
    });
  }

  protected readonly progresoParaBarra = (): number | null => {
    const actual = this.state();
    return actual.kind === 'uploading' ? actual.progress : null;
  };

  protected readonly nombreDelArchivo = (): string => {
    const actual = this.state();
    return actual.kind === 'uploading' || actual.kind === 'ready' ? actual.fileName : '';
  };

  protected readonly pesoDelArchivo = (): string => {
    const actual = this.state();
    return actual.kind === 'ready' ? formatearTamano(actual.sizeBytes) : '';
  };

  protected readonly mensajeDeError = (): string => {
    const actual = this.state();
    return actual.kind === 'error' ? actual.message : '';
  };

  /** `app-file-input` ya validó tipo y tamaño: esto es un PDF admisible. */
  protected aceptar(archivos: readonly File[]): void {
    const archivo = archivos[0];
    if (!archivo) return;

    this.archivos.set([archivo]);
    this.subir(archivo);
  }

  /** `app-file-input` rechazó el archivo (formato o tamaño): un solo mensaje para los dos casos. */
  protected rechazar(_motivos: readonly RejectedFile[]): void {
    this.suscripcion?.unsubscribe();
    this.archivos.set([]);
    this.fileId.set(null);
    this.state.set({ kind: 'error', message: MENSAJE_FORMATO_O_TAMANO });
    this.failed.emit(MENSAJE_FORMATO_O_TAMANO);
  }

  protected quitar(): void {
    this.suscripcion?.unsubscribe();
    this.archivos.set([]);
    this.fileId.set(null);
    this.state.set({ kind: 'empty' });
  }

  private subir(archivo: File): void {
    this.suscripcion?.unsubscribe();
    this.state.set({ kind: 'uploading', fileName: archivo.name, progress: null });

    this.suscripcion = this.uploader()(archivo).subscribe({
      next: (evento) => {
        if (evento.type === HttpEventType.UploadProgress) {
          const progreso = evento.total
            ? Math.round((100 * evento.loaded) / evento.total)
            : null;
          this.state.set({ kind: 'uploading', fileName: archivo.name, progress: progreso });
          return;
        }
        if (evento.type === HttpEventType.Response && evento.body) {
          const subido = evento.body;
          this.state.set({
            kind: 'ready',
            fileName: subido.originalName,
            fileId: subido.fileId,
            sizeBytes: subido.sizeBytes,
          });
          this.fileId.set(subido.fileId);
          this.uploaded.emit(subido);
        }
      },
      error: (error: unknown) => {
        const mensaje = this.mensajeDeSubida(error);
        this.archivos.set([]);
        this.fileId.set(null);
        this.state.set({ kind: 'error', message: mensaje });
        this.failed.emit(mensaje);
      },
    });
  }

  private mensajeDeSubida(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 413) {
        return 'El archivo supera los 10 MB.';
      }
      if (error.status === 422) {
        const mensajeDelBackend = (error.error as { message?: string } | null)?.message;
        if (mensajeDelBackend) return mensajeDelBackend;
      }
      if (error.status === 0) {
        return 'No pudimos subir el archivo: revisá tu conexión.';
      }
    }
    return 'No pudimos subir el archivo. Reintentá.';
  }
}
