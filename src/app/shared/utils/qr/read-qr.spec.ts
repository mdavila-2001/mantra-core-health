import { describe, expect, it } from 'vitest';
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
