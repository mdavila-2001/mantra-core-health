import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FileDownloadService } from '../file-download/file-download.service';
import { ShareService } from './share.service';

describe('ShareService', () => {
  let service: ShareService;
  const save = vi.fn();

  beforeEach(() => {
    save.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: FileDownloadService, useValue: { save } }],
    });
    service = TestBed.inject(ShareService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pone y quita parámetros sin tocar el resto de la dirección', () => {
    const url = new URL(service.linkWith({ zona: 'pecho', vista: 'frente' }));
    expect(url.searchParams.get('zona')).toBe('pecho');
    expect(url.searchParams.get('vista')).toBe('frente');

    const sinZona = new URL(service.linkWith({ zona: null }));
    expect(sinZona.searchParams.has('zona')).toBe(false);
  });

  it('copia al portapapeles cuando el navegador lo permite', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(service.copy('https://x.test/a')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://x.test/a');
  });

  it('comparte el enlace por la hoja del sistema y, sin ella, lo copia', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    await expect(service.shareLink('https://x.test/a', 'T')).resolves.toBe('shared');

    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(service.shareLink('https://x.test/a', 'T')).resolves.toBe('copied');
  });

  it('cancelar la hoja de compartir no es un error ni copia nada', async () => {
    const abort = new DOMException('cancelado', 'AbortError');
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(abort) });
    await expect(service.shareLink('https://x.test/a', 'T')).resolves.toBe('cancelled');
  });

  it('en escritorio un archivo se descarga aunque el navegador sepa compartir', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const share = vi.fn();
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const blob = new Blob(['x'], { type: 'image/png' });
    await expect(service.shareFile(blob, 'cuerpo.png', 'Cuerpo')).resolves.toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
  });

  it('en el celular un archivo sale por la hoja del sistema', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: () => true, share });
    const blob = new Blob(['x'], { type: 'image/png' });
    await expect(service.shareFile(blob, 'cuerpo.png', 'Cuerpo')).resolves.toBe('shared');
  });

  it('un archivo que la hoja de compartir no acepta se descarga', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('navigator', { canShare: () => false });
    const blob = new Blob(['x'], { type: 'image/png' });
    await expect(service.shareFile(blob, 'cuerpo.png', 'Cuerpo')).resolves.toBe('downloaded');
    expect(save).toHaveBeenCalledWith(blob, 'cuerpo.png');
  });
});
