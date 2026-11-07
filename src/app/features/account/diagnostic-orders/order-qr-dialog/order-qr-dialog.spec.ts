import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { OrderQrDialog } from './order-qr-dialog';

const ID = '3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f';

describe('OrderQrDialog', () => {
  const toasts = { success: vi.fn(), error: vi.fn() };

  function create() {
    toasts.success.mockReset();
    toasts.error.mockReset();
    TestBed.configureTestingModule({ providers: [{ provide: ToastService, useValue: toasts }] });
    const fixture = TestBed.createComponent(OrderQrDialog);
    fixture.componentRef.setInput('orderId', ID);
    fixture.componentRef.setInput('studyLabel', 'Hemograma completo');
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('muestra el código de la orden en texto, para escribirlo si el lector no anda', () => {
    const fixture = create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="mis-ordenes-qr-codigo"]')?.textContent).toBe(
      `ALOVIDA-ORDEN:v1:${ID}`,
    );
    expect(el.textContent).toContain('Hemograma completo');
  });

  it('copiar el código lo escribe en el portapapeles y avisa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const fixture = create();

    await (fixture.componentInstance as unknown as { copyCode: () => Promise<void> }).copyCode();

    expect(writeText).toHaveBeenCalledExactlyOnceWith(`ALOVIDA-ORDEN:v1:${ID}`);
    expect(toasts.success).toHaveBeenCalledWith('Código copiado.');
  });

  it('si el navegador no deja copiar, lo dice y no finge', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    const fixture = create();

    await (fixture.componentInstance as unknown as { copyCode: () => Promise<void> }).copyCode();

    expect(toasts.success).not.toHaveBeenCalled();
    expect(toasts.error).toHaveBeenCalledWith('No pudimos copiar. Selecciónelo y cópielo a mano.');
  });

  it('descargar sin imagen dibujada avisa en vez de bajar un archivo vacío', async () => {
    const fixture = create();
    // jsdom no dibuja canvas: simulamos un `toBlob` que no produce imagen.
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null));
    await (fixture.componentInstance as unknown as { download: () => Promise<void> }).download();
    expect(toasts.error).toHaveBeenCalledWith('No pudimos preparar la imagen.');
  });
});
