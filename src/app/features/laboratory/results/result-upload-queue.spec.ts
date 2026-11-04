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

  /** What the last upload declared to the API. */
  declarado: { orderId: string; contentType: string } | null = null;

  startUpload(start: { sizeBytes: number; orderId: string; contentType: string }) {
    this.declarado = { orderId: start.orderId, contentType: start.contentType };
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
  const destino = { orderId: 'o-1', note: null, notify: false };

  beforeEach(() => {
    cliente = new ClienteFalso();
    TestBed.configureTestingModule({
      providers: [ResultUploadQueue, { provide: LabPortalClient, useValue: cliente }],
    });
    queue = TestBed.inject(ResultUploadQueue);
  });

  it('manda el archivo en partes y lo marca subido', async () => {
    const file = new File(['0123456789'], 'a.txt');
    queue.add([{ file, path: '' }], destino);
    for (let i = 0; i < 10 && queue.items()[0]!.status !== 'done'; i++) await esperar();

    expect(cliente.partes).toEqual([0, 1, 2]);
    expect(queue.items()[0]).toMatchObject({ status: 'done', sentBytes: 10 });
    expect(queue.totals().percent).toBe(100);
    expect(queue.finishedCount()).toBe(1);
  });

  it('pausa entre partes y al seguir manda sólo las que faltan', async () => {
    cliente.compuerta = new Subject<void>();
    queue.add([{ file: new File(['0123456789'], 'b.txt'), path: '' }], destino);
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
    queue.add([{ file: new File(['abc'], 'c.txt'), path: '' }], destino);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    expect(queue.items()[0]!.status).toBe('done');
    expect(cliente.partes).toEqual([0]);
  });

  it('cancelar avisa al servidor y no termina la subida', async () => {
    cliente.compuerta = new Subject<void>();
    queue.add([{ file: new File(['0123456789'], 'd.txt'), path: '' }], destino);
    await esperar();
    queue.cancel(queue.items()[0]!.localId);
    cliente.compuerta.next();
    await esperar();
    expect(queue.items()[0]!.status).toBe('canceled');
    expect(cliente.abortadas).toEqual(['up-1']);
    expect(queue.finishedCount()).toBe(0);
  });

  it('declara la orden y un tipo de contenido aunque el navegador no dé ninguno', async () => {
    queue.add([{ file: new File(['abc'], 'e.pdf'), path: '' }], destino);
    for (let i = 0; i < 10 && queue.items()[0]!.status !== 'done'; i++) await esperar();
    expect(cliente.declarado).toEqual({ orderId: 'o-1', contentType: 'application/pdf' });
  });

  it('no encola lo que la API rechazaría: formato no admitido o más de 10 MB, cada uno con su motivo', () => {
    const grande = new File(['x'], 'grande.pdf');
    Object.defineProperty(grande, 'size', { value: 10 * 1024 * 1024 + 1 });
    const rechazados = queue.add(
      [
        { file: new File(['x'], 'eco.mp4', { type: 'video/mp4' }), path: 'carpeta/eco.mp4' },
        { file: new File(['x'], 'rx.dcm'), path: '' },
        { file: grande, path: '' },
        { file: new File(['x'], 'ok.png', { type: 'image/png' }), path: '' },
      ],
      destino,
    );

    expect(queue.items().map((i) => i.displayName)).toEqual(['ok.png']);
    expect(rechazados.map((r) => r.name)).toEqual(['carpeta/eco.mp4', 'rx.dcm', 'grande.pdf']);
    expect(rechazados[0]!.message).toContain('formato no admitido');
    expect(rechazados[0]!.message).toContain('PDF, JPG, PNG, WEBP, GIF, DOCX, XLSX y TXT');
    expect(rechazados[2]!.message).toBe('grande.pdf: pesa 10,0 MB y supera el máximo de 10 MB.');
  });

  it('un archivo justo de 10 MB entra', () => {
    const justo = new File(['x'], 'justo.pdf');
    Object.defineProperty(justo, 'size', { value: 10 * 1024 * 1024 });
    expect(queue.add([{ file: justo, path: '' }], destino)).toEqual([]);
    expect(queue.items()).toHaveLength(1);
  });
});
