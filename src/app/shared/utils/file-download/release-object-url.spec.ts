import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CsvExportService } from '../csv-export/csv-export';
import { FileDownloadService } from './file-download.service';
import { OBJECT_URL_RELEASE_MS, releaseObjectUrlLater } from './release-object-url';

/**
 * F8 (revisión de seguridad del front): una Blob URL no se revoca en el mismo tick que `click()`. En Safari y Firefox la
 * descarga aún no empezó y se cancela: la exportación auditada «ya quedó registrada» pero el archivo no baja.
 */
describe('releaseObjectUrlLater', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('no revoca en el acto: espera a que el navegador inicie la descarga', () => {
    const revoke = vi.fn();
    releaseObjectUrlLater('blob:x', revoke);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(OBJECT_URL_RELEASE_MS - 1);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:x');
  });

  it('un fallo al revocar no rompe nada (la URL ya se liberó o la página se cerró)', () => {
    releaseObjectUrlLater('blob:x', () => {
      throw new Error('boom');
    });
    expect(() => vi.advanceTimersByTime(OBJECT_URL_RELEASE_MS)).not.toThrow();
  });
});

describe('descargas por Blob URL: revocan después del clic y no durante', () => {
  let creadas: string[];
  let revocadas: string[];
  let original: { create: typeof URL.createObjectURL; revoke: typeof URL.revokeObjectURL };

  beforeEach(() => {
    vi.useFakeTimers();
    creadas = [];
    revocadas = [];
    original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:descarga-${creadas.length + 1}`;
      creadas.push(url);
      return url;
    });
    URL.revokeObjectURL = vi.fn((url: string) => {
      revocadas.push(url);
    });
  });
  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    vi.useRealTimers();
  });

  it('FileDownloadService.save', () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    TestBed.inject(FileDownloadService).save(new Blob(['x']), 'a.pdf');
    expect(clic).toHaveBeenCalledOnce();
    expect(creadas).toHaveLength(1);
    expect(revocadas).toEqual([]);
    vi.advanceTimersByTime(OBJECT_URL_RELEASE_MS);
    expect(revocadas).toEqual(creadas);
    clic.mockRestore();
  });

  it('CsvExportService.download', () => {
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    TestBed.inject(CsvExportService).download(
      [{ a: 1 }],
      [{ header: 'A', value: (f) => String(f.a) }],
      'x',
    );
    expect(clic).toHaveBeenCalledOnce();
    expect(revocadas).toEqual([]);
    vi.advanceTimersByTime(OBJECT_URL_RELEASE_MS);
    expect(revocadas).toEqual(creadas);
    clic.mockRestore();
  });

  it('FileDownloadService sigue usando el documento inyectado', () => {
    expect(TestBed.inject(DOCUMENT)).toBe(document);
  });
});
