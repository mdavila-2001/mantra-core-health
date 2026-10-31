import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { PaymentReceiptsClient } from '../../../../core/data-access/scheduling/payment-receipts.client';
import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import { ReceiptFiles, type ReceiptFileState } from '../receipt-files';
import { PaymentReceiptViewer } from './payment-receipt-viewer';

/**
 * Detector de ejecución. Un doble de `window.alert` no sirve en este corredor:
 * jsdom corre los manejadores inline en su propio contexto y llama a SU `alert`,
 * no al del objeto que ven las pruebas (medido: el doble nunca se llamaba).
 * Por eso las cargas, en vez de `alert(1)`, escriben una marca en el DOM
 * —`data-xss` en `<html>`— que se ve desde cualquier contexto.
 */
const MARCA = 'data-xss';
function limpiarMarca(): void {
  document.documentElement.removeAttribute(MARCA);
}
/** Dispara los eventos que activan un manejador inline y dice si alguno corrió. */
function ejecutado(): boolean {
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    const conManejador = el.getAttributeNames().some((a) => /^on/i.test(a));
    for (const tipo of ['error', 'load', 'toggle', 'focus', 'mouseover', 'animationstart', ...(conManejador ? ['click'] : [])]) {
      el.dispatchEvent(new Event(tipo));
    }
  }
  return document.documentElement.hasAttribute(MARCA);
}

/**
 * M-4 / O3-5 — `payment-receipt-viewer.ts:82` pasa una URL a un `<iframe>`
 * **sin `sandbox`** con `bypassSecurityTrustResourceUrl`. Un marco sin sandbox
 * con un `text/html` adentro correría con el origen de la aplicación: es el
 * punto más delicado de los quince. Lo que se exige:
 *
 * - sólo una URL `blob:` llega al marco (nunca `javascript:`, `data:` ni http);
 * - los bytes de esa `blob:` están tipados con el formato que declaró la lista
 *   y que admite un comprobante, no con la cabecera de la respuesta: un HTML
 *   que dice ser PDF se sirve como `application/pdf`, y uno que dice ser HTML
 *   sólo se descarga como `octet-stream`.
 */

const PDF: PaymentReceipt = {
  id: 'r-1',
  bookingId: 'b-1',
  fileId: 'f-1',
  mimeType: 'application/pdf',
  originalName: 'comprobante.pdf',
  amount: '150.00',
  paidAt: new Date('2026-10-27T12:00:00.000Z'),
  note: null,
  uploadedAt: new Date('2026-10-27T13:00:00.000Z'),
  uploadedBy: { userId: 'u-paciente', displayName: 'Ana Pérez' },
  status: 'PENDING',
  reviewedAt: null,
  reviewedBy: null,
  rejectionReason: null,
};

const HTML_HOSTIL = '<!doctype html><body onload=document.documentElement.dataset.xss=1><script>parent.document.documentElement.dataset.xss=1</script>';

describe('PaymentReceiptViewer · marco del PDF (M-4)', () => {
  let fixture: ComponentFixture<PaymentReceiptViewer>;
  let objetos: Map<string, Blob>;
  const original = { crear: URL.createObjectURL, revocar: URL.revokeObjectURL };

  beforeEach(() => {
    objetos = new Map();
    let n = 0;
    URL.createObjectURL = vi.fn((b: Blob | MediaSource) => {
      const url = `blob:recibo-${(n += 1)}`;
      objetos.set(url, b as Blob);
      return url;
    });
    URL.revokeObjectURL = vi.fn();
    limpiarMarca();
    TestBed.configureTestingModule({
      providers: [
        ReceiptFiles,
        {
          provide: PaymentReceiptsClient,
          useValue: { content: () => of(new Blob([HTML_HOSTIL], { type: 'text/html' })) },
        },
      ],
    });
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 30));
    URL.createObjectURL = original.crear;
    URL.revokeObjectURL = original.revocar;
    expect(document.documentElement.hasAttribute(MARCA)).toBe(false);
  });

  function render(receipt: PaymentReceipt, file: ReceiptFileState | undefined): HTMLElement {
    fixture = TestBed.createComponent(PaymentReceiptViewer);
    fixture.componentRef.setInput('receipt', receipt);
    fixture.componentRef.setInput('file', file);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Lo que de verdad baja la pantalla: el servicio con la respuesta hostil. */
  function bajar(receipt: PaymentReceipt): ReceiptFileState | undefined {
    const files = TestBed.inject(ReceiptFiles);
    files.request(receipt.bookingId, receipt);
    return files.stateOf(receipt.id);
  }

  it.each([
    'javascript:document.documentElement.dataset.xss=1',
    'JaVaScRiPt:document.documentElement.dataset.xss=1',
    'data:text/html,<script>document.documentElement.dataset.xss=1</script>',
    'https://evil.example/recibo.pdf',
    '//evil.example/recibo.pdf',
    ' blob:recibo-1',
  ])('una URL «%s» nunca llega al marco ni a la descarga', (url) => {
    const root = render(PDF, { status: 'ready', url, previewable: true });

    expect(root.querySelector('iframe')).toBeNull();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('[data-testid="payment-receipt-download"]')).toBeNull();
    expect(root.innerHTML).not.toMatch(/javascript:|data:text/i);
  });

  it('un HTML hostil que la lista declara PDF entra al marco tipado como application/pdf', () => {
    const root = render(PDF, bajar(PDF));

    const marco = root.querySelector('iframe');
    expect(marco).not.toBeNull();
    const src = marco!.getAttribute('src') ?? '';
    expect(src.startsWith('blob:')).toBe(true);
    expect(objetos.get(src)?.type).toBe('application/pdf');
    expect(ejecutado()).toBe(false);
  });

  it('un comprobante declarado text/html no tiene marco ni imagen: se descarga como octet-stream', () => {
    const html = { ...PDF, mimeType: 'text/html', originalName: 'recibo.html' };
    const root = render(html, bajar(html));

    expect(root.querySelector('iframe, img, object, embed')).toBeNull();
    const href = root.querySelector('[data-testid="payment-receipt-download"]')?.getAttribute('href') ?? '';
    expect(href.startsWith('blob:')).toBe(true);
    expect(objetos.get(href)?.type).toBe('application/octet-stream');
  });

  it('un SVG (puede llevar script) tampoco se muestra: no está entre los formatos admitidos', () => {
    const svg = { ...PDF, mimeType: 'image/svg+xml', originalName: 'recibo.svg' };
    const root = render(svg, bajar(svg));

    expect(root.querySelector('iframe, img')).toBeNull();
    expect([...objetos.values()].every((b) => b.type === 'application/octet-stream')).toBe(true);
  });
});
