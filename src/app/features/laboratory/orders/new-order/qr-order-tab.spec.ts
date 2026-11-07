import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { orderQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { QrReader } from '../../../../shared/utils/qr/qr-reader';
import type { NewOrderResult } from './new-order.types';
import { QrOrderTab } from './qr-order-tab';

const ID = '3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f';
const ORDER = { orderId: ID, patientName: 'Ana Pérez', status: 'DRAFT' } as LabOrder;

interface Internal {
  manualCode: { set: (v: string) => void };
  useManualCode: () => void;
  onFileChosen: (e: Event) => Promise<void>;
  onPaste: (e: ClipboardEvent) => void;
  onDrop: (e: DragEvent) => void;
  error: () => string | null;
  busy: () => boolean;
}

describe('QrOrderTab (way 1: the patient QR)', () => {
  const readImage = vi.fn();
  let createOrderFromQr: ReturnType<typeof vi.fn>;
  const results: NewOrderResult[] = [];
  let tab: Internal;

  beforeEach(() => {
    results.length = 0;
    readImage.mockReset();
    createOrderFromQr = vi.fn(() => of({ order: ORDER, created: true }));
    TestBed.configureTestingModule({
      providers: [
        { provide: LabPortalClient, useValue: { createOrderFromQr } },
        { provide: QrReader, useValue: { readImage, startCamera: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(QrOrderTab);
    fixture.componentInstance.created.subscribe((r) => results.push(r));
    fixture.detectChanges();
    tab = fixture.componentInstance as unknown as Internal;
  });

  const fileInput = (file: File) => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    return { target: input } as unknown as Event;
  };
  const png = () => new File(['x'], 'qr.png', { type: 'image/png' });
  const clipboard = (data: Partial<DataTransfer>, target: EventTarget = document.body) =>
    ({ clipboardData: data, target, preventDefault: vi.fn() }) as unknown as ClipboardEvent;

  it('a typed code creates the order and says whether it was new', () => {
    tab.manualCode.set(orderQrCode(ID));
    tab.useManualCode();
    expect(createOrderFromQr).toHaveBeenCalledExactlyOnceWith(orderQrCode(ID));
    expect(results).toEqual([{ order: ORDER, created: true }]);
  });

  it('a code already loaded comes back with created=false', () => {
    createOrderFromQr.mockReturnValue(of({ order: ORDER, created: false }));
    tab.manualCode.set(orderQrCode(ID));
    tab.useManualCode();
    expect(results[0]?.created).toBe(false);
  });

  it('a foreign text never reaches the API and says why', () => {
    tab.manualCode.set('https://elsewhere.com');
    tab.useManualCode();
    expect(createOrderFromQr).not.toHaveBeenCalled();
    expect(tab.error()).toBe('Ese código no es el de una orden de AloVida.');
  });

  it('an image with a QR is read and creates the order; one without says so', async () => {
    readImage.mockResolvedValueOnce(orderQrCode(ID)).mockResolvedValueOnce(null);
    await tab.onFileChosen(fileInput(png()));
    expect(results.length).toBe(1);
    await tab.onFileChosen(fileInput(png()));
    expect(tab.error()).toContain('No encontramos un QR');
    expect(createOrderFromQr).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+V: text uses the code, an image is read, and inside a text field it does nothing', async () => {
    tab.onPaste(clipboard({ files: [] as unknown as FileList, getData: () => orderQrCode(ID) }));
    expect(createOrderFromQr).toHaveBeenCalledTimes(1);

    createOrderFromQr.mockClear();
    tab.onPaste(clipboard({ files: [] as unknown as FileList, getData: () => orderQrCode(ID) }, document.createElement('input')));
    expect(createOrderFromQr).not.toHaveBeenCalled();

    readImage.mockResolvedValue(orderQrCode(ID));
    tab.onPaste(clipboard({ files: [png()] as unknown as FileList, getData: () => '' }));
    await Promise.resolve();
    expect(readImage).toHaveBeenCalledTimes(1);
  });

  it('dropping something that is not an image says so', () => {
    tab.onDrop({ preventDefault: vi.fn(), dataTransfer: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } } as unknown as DragEvent);
    expect(tab.error()).toBe('Suelte una imagen con el QR.');
  });

  it('an API refusal is shown with its message; no double submit while it runs', () => {
    const pending = new Subject<{ order: LabOrder; created: boolean }>();
    createOrderFromQr.mockReturnValue(pending);
    tab.manualCode.set(orderQrCode(ID));
    tab.useManualCode();
    tab.useManualCode();
    expect(createOrderFromQr).toHaveBeenCalledTimes(1);
    expect(tab.busy()).toBe(true);

    pending.error(new HttpErrorResponse({ status: 409, error: { statusCode: 409, code: 'CONFLICT', message: 'Esa orden ya está dirigida a otro centro.' } }));
    expect(tab.error()).toBe('Esa orden ya está dirigida a otro centro.');
    expect(tab.busy()).toBe(false);
  });

  it('a network failure without a message falls back to a generic one', () => {
    createOrderFromQr.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    tab.manualCode.set(orderQrCode(ID));
    tab.useManualCode();
    expect(tab.error()).toBe('No pudimos crear la orden con ese código.');
  });
});
