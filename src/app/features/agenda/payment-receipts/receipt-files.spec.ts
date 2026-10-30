import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';

import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';
import { objectUrlOf, previewUrlOf, ReceiptFiles } from './receipt-files';

const IMAGE = { id: 'r-img', mimeType: 'image/png' } as const;

/**
 * Los archivos de un modal viven lo que vive el modal: cada URL de objeto que
 * se crea se revoca, y lo que se dibuja lleva el tipo que declaró la lista.
 */
describe('ReceiptFiles', () => {
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  let created: Blob[];
  let content: Subject<Blob>;
  let modal: EnvironmentInjector;
  let files: ReceiptFiles;

  beforeEach(() => {
    // jsdom no trae URL de objeto: se finge una por archivo y se guarda qué bytes la pidieron.
    created = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return `blob:receipt-${created.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    content = new Subject<Blob>();
    // Un inyector propio hace de modal: destruirlo es cerrarlo.
    modal = createEnvironmentInjector(
      [ReceiptFiles, { provide: PaymentReceiptsClient, useValue: { content: () => content } }],
      TestBed.inject(EnvironmentInjector),
    );
    files = modal.get(ReceiptFiles);
  });

  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it('si el modal se cierra antes de que lleguen los bytes, no queda ninguna URL sin revocar', () => {
    files.request('b-1', IMAGE);

    modal.destroy();
    content.next(new Blob(['png'], { type: 'image/png' }));

    expect(URL.createObjectURL).toHaveBeenCalledTimes(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(0);
    // Y la descarga se cortó: nadie sigue escuchando la respuesta.
    expect(content.observed).toBe(false);
  });

  it('lo que llegó antes de cerrar se revoca al cerrar: cada URL creada, una revocada', () => {
    files.request('b-1', IMAGE);
    content.next(new Blob(['png'], { type: 'image/png' }));

    modal.destroy();

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:receipt-1');
  });

  it('los bytes se vuelven a tipar con el formato que declaró la lista', () => {
    files.request('b-1', { id: 'r-pdf', mimeType: 'application/pdf' });
    content.next(new Blob(['%PDF-1.4'], { type: 'application/octet-stream' }));

    expect(created[0]?.type).toBe('application/pdf');
    expect(files.stateOf('r-pdf')).toEqual({ status: 'ready', url: 'blob:receipt-1', previewable: true });
  });

  it('un formato que no admite un comprobante no se muestra: queda sólo para descargar', () => {
    files.request('b-1', { id: 'r-html', mimeType: 'text/html' });
    content.next(new Blob(['<script></script>'], { type: 'text/html' }));

    const state = files.stateOf('r-html');
    expect(created[0]?.type).toBe('application/octet-stream');
    expect(state).toEqual({ status: 'ready', url: 'blob:receipt-1', previewable: false });
    expect(previewUrlOf(state)).toBeNull();
    expect(objectUrlOf(state)).toBe('blob:receipt-1');
  });

  it('sólo una URL de objeto pasa: cualquier otra no se dibuja', () => {
    const elsewhere = { status: 'ready', url: 'https://otro.sitio/comprobante.pdf', previewable: true } as const;

    expect(objectUrlOf(elsewhere)).toBeNull();
    expect(previewUrlOf(elsewhere)).toBeNull();
    expect(objectUrlOf({ status: 'loading' })).toBeNull();
  });
});
