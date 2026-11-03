import { describe, expect, it, vi } from 'vitest';
import { readQrFromSource } from './read-qr';

describe('readQrFromSource', () => {
  it('retorna null si BarcodeDetector no existe en el entorno', async () => {
    const original = (globalThis as Record<string, unknown>)['BarcodeDetector'];
    try {
      delete (globalThis as Record<string, unknown>)['BarcodeDetector'];
      const res = await readQrFromSource({} as ImageBitmapSource);
      expect(res).toBeNull();
    } finally {
      if (original) {
        (globalThis as Record<string, unknown>)['BarcodeDetector'] = original;
      }
    }
  });

  it('retorna el valor decodificado cuando BarcodeDetector detecta un QR', async () => {
    const mockDetector = class {
      detect() {
        return Promise.resolve([{ rawValue: 'https://alovidasalud.com/my-support#code=ABC1234' }]);
      }
    };
    (globalThis as Record<string, unknown>)['BarcodeDetector'] = mockDetector;
    try {
      const res = await readQrFromSource({} as ImageBitmapSource);
      expect(res).toBe('https://alovidasalud.com/my-support#code=ABC1234');
    } finally {
      delete (globalThis as Record<string, unknown>)['BarcodeDetector'];
    }
  });
});

describe('readQrFromSource sin BarcodeDetector', () => {
  it('lee el QR con jsqr (Firefox y Safari no traen BarcodeDetector)', async () => {
    vi.resetModules();
    vi.doMock('jsqr', () => ({ default: () => ({ data: ' https://alovidasalud.com/my-support#code=XYZ12345 ' }) }));
    const contexto = { drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(16) }) };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(contexto as never);
    try {
      const { readQrFromSource: leer } = await import('./read-qr');
      const res = await leer({ width: 2, height: 2 } as unknown as ImageBitmapSource);
      expect(res).toBe('https://alovidasalud.com/my-support#code=XYZ12345');
      expect(contexto.drawImage).toHaveBeenCalled();
    } finally {
      getContext.mockRestore();
      vi.doUnmock('jsqr');
    }
  });
});
