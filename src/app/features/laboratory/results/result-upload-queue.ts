import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabResultFile,
  LabResultUploadSession,
} from '../../../core/data-access/lab-portal/lab-portal.types';

/** En qué anda un archivo de la cola. */
export type UploadStatus = 'queued' | 'uploading' | 'paused' | 'done' | 'error' | 'canceled';

/** A qué orden va un archivo, y qué se avisa al terminar. */
export interface UploadTarget {
  readonly orderId: string | null;
  readonly note: string | null;
  readonly notify: boolean;
}

/** Un archivo de la cola, tal como lo dibuja la pantalla. */
export interface UploadItem {
  readonly localId: string;
  readonly file: File;
  /** La ruta dentro de la carpeta soltada, o el nombre si vino suelto. */
  readonly displayName: string;
  readonly target: UploadTarget;
  readonly status: UploadStatus;
  readonly sentBytes: number;
  /** Bytes por segundo, medidos sobre la última parte enviada. */
  readonly bytesPerSecond: number | null;
  readonly error: string | null;
  readonly result: LabResultFile | null;
}

/** Un archivo elegido, con la ruta relativa si vino dentro de una carpeta. */
export interface PickedFile {
  readonly file: File;
  readonly path: string;
}

/** Cuántos archivos suben a la vez. Cada uno manda sus partes de a una. */
const PARALLEL_FILES = 2;
/** Reintentos automáticos de una parte antes de marcar el archivo con error. */
const PART_RETRIES = 3;

/**
 * **La cola de subida de resultados.**
 *
 * No hay tope de tamaño: cada archivo viaja en partes del tamaño que diga el
 * servidor (`chunkSizeBytes`), y cada parte es un `slice` del `File`, que el
 * navegador lee del disco al enviarlo. Un archivo de varios gigas no pasa
 * entero por la memoria ni choca con el límite de cuerpo de nginx.
 *
 * Por eso mismo se puede **pausar y reanudar**: la sesión de subida guarda qué
 * partes ya llegaron, y reanudar manda sólo las que faltan. Una parte que
 * falla se reintenta sola unas veces, con espera creciente; si sigue fallando
 * el archivo queda en «error» con «Reintentar», que retoma desde esa parte.
 *
 * Vive con la pantalla (`providers` del componente): salir de «Resultados»
 * cancela lo que esté en curso, y la pantalla avisa antes de dejar salir.
 */
@Injectable()
export class ResultUploadQueue {
  private readonly lab = inject(LabPortalClient);

  private readonly itemsState = signal<readonly UploadItem[]>([]);
  readonly items = this.itemsState.asReadonly();

  /** Las sesiones abiertas en el servidor, por archivo. */
  private readonly sessions = new Map<string, LabResultUploadSession>();
  /** Las partes que el servidor ya confirmó, por archivo. */
  private readonly sentParts = new Map<string, Set<number>>();
  /** Archivos a los que se les pidió parar (pausa o cancelación). */
  private readonly stopRequested = new Set<string>();
  /**
   * Archivos con un envío todavía en vuelo. Una pausa no corta la parte que
   * está viajando: si se reanuda antes de que llegue, el archivo espera acá a
   * que termine en vez de abrir un segundo envío en paralelo.
   */
  private readonly running = new Set<string>();

  private sequence = 0;
  private destroyed = false;

  /** Aviso a quien la usa cuando un archivo termina, para refrescar la lista. */
  private readonly finished = signal(0);
  readonly finishedCount = this.finished.asReadonly();

  readonly active = computed(() =>
    this.items().some((item) => item.status === 'uploading' || item.status === 'queued'),
  );

  readonly totals = computed(() => {
    const vivos = this.items().filter((item) => item.status !== 'canceled');
    const total = vivos.reduce((sum, item) => sum + item.file.size, 0);
    const sent = vivos.reduce((sum, item) => sum + item.sentBytes, 0);
    return {
      files: vivos.length,
      done: vivos.filter((item) => item.status === 'done').length,
      totalBytes: total,
      sentBytes: sent,
      percent: total === 0 ? (vivos.length > 0 ? 100 : 0) : Math.floor((sent / total) * 100),
    };
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      for (const item of this.items()) {
        if (item.status === 'uploading' || item.status === 'queued' || item.status === 'paused') {
          this.abortOnServer(item.localId);
        }
      }
    });
  }

  /** Suma archivos a la cola y arranca los que entren. */
  add(files: readonly PickedFile[], target: UploadTarget): void {
    const nuevos = files.map((picked) => ({
      localId: `upload-${++this.sequence}`,
      file: picked.file,
      displayName: picked.path === '' ? picked.file.name : picked.path,
      target,
      status: 'queued' as const,
      sentBytes: 0,
      bytesPerSecond: null,
      error: null,
      result: null,
    }));
    this.itemsState.update((items) => [...items, ...nuevos]);
    this.pump();
  }

  pause(localId: string): void {
    const item = this.find(localId);
    if (item?.status === 'uploading') {
      this.stopRequested.add(localId);
      this.patch(localId, { status: 'paused', bytesPerSecond: null });
    } else if (item?.status === 'queued') {
      this.patch(localId, { status: 'paused' });
    }
  }

  resume(localId: string): void {
    const item = this.find(localId);
    if (item?.status === 'paused' || item?.status === 'error') {
      // Si la parte en vuelo todavía no volvió, la orden de parar sigue en pie
      // para ese envío; el nuevo arranca cuando termine (ver `running`).
      if (!this.running.has(localId)) {
        this.stopRequested.delete(localId);
      }
      this.patch(localId, { status: 'queued', error: null });
      this.pump();
    }
  }

  cancel(localId: string): void {
    const item = this.find(localId);
    if (item === undefined || item.status === 'done' || item.status === 'canceled') {
      return;
    }
    this.stopRequested.add(localId);
    this.patch(localId, { status: 'canceled', bytesPerSecond: null });
    this.abortOnServer(localId);
    this.pump();
  }

  /** Quita de la lista lo terminado y lo cancelado. */
  clearFinished(): void {
    this.itemsState.update((items) =>
      items.filter((item) => item.status !== 'done' && item.status !== 'canceled'),
    );
  }

  /* ---- motor ------------------------------------------------------------ */

  private pump(): void {
    if (this.destroyed) {
      return;
    }
    const libres = PARALLEL_FILES - this.running.size;
    if (libres <= 0) {
      return;
    }
    const listos = this.items().filter(
      (item) => item.status === 'queued' && !this.running.has(item.localId),
    );
    for (const item of listos.slice(0, libres)) {
      this.patch(item.localId, { status: 'uploading' });
      this.running.add(item.localId);
      void this.run(item.localId);
    }
  }

  private async run(localId: string): Promise<void> {
    try {
      const item = this.find(localId)!;
      let session = this.sessions.get(localId);
      if (session === undefined) {
        session = await firstValueFrom(
          this.lab.startUpload({
            fileName: item.file.name,
            contentType: item.file.type,
            sizeBytes: item.file.size,
            orderId: item.target.orderId,
            note: item.target.note,
            notify: item.target.notify,
          }),
        );
        this.sessions.set(localId, session);
        this.sentParts.set(localId, new Set(session.receivedParts));
      }
      const sent = this.sentParts.get(localId)!;
      for (let index = 0; index < session.totalParts; index++) {
        if (sent.has(index)) {
          continue;
        }
        if (this.shouldStop(localId)) {
          return;
        }
        const start = index * session.chunkSizeBytes;
        const part = item.file.slice(start, Math.min(item.file.size, start + session.chunkSizeBytes));
        const began = performance.now();
        await this.sendPart(session.uploadId, index, part);
        sent.add(index);
        const seconds = Math.max(0.001, (performance.now() - began) / 1000);
        this.patch(localId, {
          sentBytes: Math.min(item.file.size, this.sentBytesOf(session, sent, item.file.size)),
          bytesPerSecond: part.size / seconds,
        });
      }
      if (this.shouldStop(localId)) {
        return;
      }
      const result = await firstValueFrom(this.lab.completeUpload(session.uploadId));
      this.sessions.delete(localId);
      this.sentParts.delete(localId);
      this.patch(localId, {
        status: 'done',
        sentBytes: item.file.size,
        bytesPerSecond: null,
        result,
      });
      this.finished.update((n) => n + 1);
    } catch (error: unknown) {
      if (this.find(localId)?.status === 'uploading') {
        // Una sesión que el servidor ya no conoce no se puede retomar: al
        // reintentar se abre una nueva desde el principio.
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.sessions.delete(localId);
          this.sentParts.delete(localId);
          this.patch(localId, { sentBytes: 0 });
        }
        this.patch(localId, { status: 'error', bytesPerSecond: null, error: messageOf(error) });
      }
    } finally {
      this.running.delete(localId);
      // La orden de parar era para este envío y ya se cumplió. Si mientras
      // tanto se reanudó, el archivo quedó en la cola y lo toma el `pump` de
      // abajo con un envío nuevo, sin la orden vieja.
      this.stopRequested.delete(localId);
      this.pump();
    }
  }

  private async sendPart(uploadId: string, index: number, part: Blob): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await firstValueFrom(this.lab.uploadPart(uploadId, index, part));
        return;
      } catch (error: unknown) {
        const retryable = !(error instanceof HttpErrorResponse) || error.status === 0 || error.status >= 500;
        if (!retryable || attempt >= PART_RETRIES) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** (attempt - 1)));
      }
    }
  }

  private sentBytesOf(session: LabResultUploadSession, sent: ReadonlySet<number>, size: number): number {
    let bytes = 0;
    for (const index of sent) {
      const start = index * session.chunkSizeBytes;
      bytes += Math.min(size, start + session.chunkSizeBytes) - start;
    }
    return bytes;
  }

  private shouldStop(localId: string): boolean {
    return this.destroyed || this.stopRequested.has(localId);
  }

  private abortOnServer(localId: string): void {
    const session = this.sessions.get(localId);
    this.sessions.delete(localId);
    this.sentParts.delete(localId);
    if (session !== undefined) {
      this.lab.abortUpload(session.uploadId).subscribe({ error: () => undefined });
    }
  }

  private find(localId: string): UploadItem | undefined {
    return this.items().find((item) => item.localId === localId);
  }

  private patch(localId: string, changes: Partial<UploadItem>): void {
    this.itemsState.update((items) =>
      items.map((item) => (item.localId === localId ? { ...item, ...changes } : item)),
    );
  }
}

function messageOf(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Se cortó la conexión. Reintentá: sigue desde donde quedó.';
    }
    const body = error.error as { message?: unknown } | null;
    if (body !== null && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    return `El servidor respondió ${error.status}.`;
  }
  return 'No se pudo subir el archivo.';
}
