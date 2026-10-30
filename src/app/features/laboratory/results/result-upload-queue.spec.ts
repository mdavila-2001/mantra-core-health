import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, of, Subject, throwError } from 'rxjs';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabResultFile } from '../../../core/data-access/lab-portal/lab-portal.types';
import { ResultUploadQueue } from './result-upload-queue';

/** Un cliente de mentira que registra qué partes llegaron y deja frenarlas. */
class ClienteFalso {
  readonly partes: number[] = [];
  /** Si se define, cada parte espera a que se emita acá. */
  compuerta: Subject<void> | null = null;
  /** Cuántas veces seguidas falla la próxima parte con un 500. */
  fallas = 0;
  abortadas: string[] = [];

  startUpload(start: { sizeBytes: number }) {
    return of({ uploadId: 'up-1', chunkSizeBytes: 4, totalParts: Math.max(1, Math.ceil(start.sizeBytes / 4)), receivedParts: [] });
  }

  uploadPart(_id: string, index: number): Observable<void> {
    if (this.fallas > 0) {
      this.fallas--;
      return throwError(() => new HttpErrorResponse({ status: 500 }));
    }
    const registrar = () => {
      this.partes.push(index);
    };
    if (this.compuerta !== null) {
      const c = this.compuerta;
      return new Observable<void>((sub) => {
        const s = c.subscribe(() => {
          registrar();
          sub.next();
          sub.complete();
        });
        return () => s.unsubscribe();
      });
    }
    registrar();
    return of(undefined);
  }

  completeUpload() {
    return of({ id: 'f-1', notified: false } as LabResultFile);
  }

  abortUpload(id: string) {
    this.abortadas.push(id);
    return of(undefined);
  }
}

const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('ResultUploadQueue', () => {
  let cliente: ClienteFalso;
  let queue: ResultUploadQueue;
  const destino = { orderId: null, note: null, notify: false };

  beforeEach(() => {
    cliente = new ClienteFalso();
    TestBed.configureTestingModule({
      providers: [ResultUploadQueue, { provide: LabPortalClient, useValue: cliente }],
    });
    queue = TestBed.inject(ResultUploadQueue);
  });

  it('manda el archivo en partes y lo marca subido', async () => {
    const file = new File(['0123456789'], 'a.bin');
    queue.add([{ file, path: '' }], destino);
    for (let i = 0; i < 10 && queue.items()[0]!.status !== 'done'; i++) await esperar();

    expect(cliente.partes).toEqual([0, 1, 2]);
    expect(queue.items()[0]).toMatchObject({ status: 'done', sentBytes: 10 });
    expect(queue.totals().percent).toBe(100);
    expect(queue.finishedCount()).toBe(1);
  });

  it('pausa entre partes y al seguir manda sólo las que faltan', async () => {
    cliente.compuerta = new Subject<void>();
    queue.add([{ file: new File(['0123456789'], 'b.bin'), path: '' }], destino);
    await esperar();
    const id = queue.items()[0]!.localId;

    queue.pause(id);
    cliente.compuerta.next(); // la parte 0 en vuelo llega igual
    await esperar();
    expect(queue.items()[0]!.status).toBe('paused');
    expect(cliente.partes).toEqual([0]);

    cliente.compuerta = null;
    queue.resume(id);
    for (let i = 0; i < 10 && queue.items()[0]!.status !== 'done'; i++) await esperar();
    expect(cliente.partes).toEqual([0, 1, 2]);
    expect(queue.items()[0]!.status).toBe('done');
  });

  it('reintenta solo una parte que falla con 500 y sigue', async () => {
    vi.useFakeTimers();
    cliente.fallas = 1;
    queue.add([{ file: new File(['abc'], 'c.bin'), path: '' }], destino);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(queue.items()[0]!.status).toBe('done');
    expect(cliente.partes).toEqual([0]);
  });

  it('cancelar avisa al servidor y no termina la subida', async () => {
    cliente.compuerta = new Subject<void>();
    queue.add([{ file: new File(['0123456789'], 'd.bin'), path: '' }], destino);
    await esperar();
    queue.cancel(queue.items()[0]!.localId);
    cliente.compuerta.next();
    await esperar();
    expect(queue.items()[0]!.status).toBe('canceled');
    expect(cliente.abortadas).toEqual(['up-1']);
    expect(queue.finishedCount()).toBe(0);
  });
});
