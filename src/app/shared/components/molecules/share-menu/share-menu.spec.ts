import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ShareService } from '../../../utils/share/share.service';
import { ToastService } from '../toast/toast.service';
import { ShareMenu, type ShareFormat } from './share-menu';

describe('ShareMenu', () => {
  let fixture: ComponentFixture<ShareMenu>;
  const shareLink = vi.fn();
  const show = vi.fn();

  beforeEach(() => {
    shareLink.mockReset();
    show.mockReset();
    TestBed.configureTestingModule({
      imports: [ShareMenu],
      providers: [
        { provide: ShareService, useValue: { shareLink } },
        { provide: ToastService, useValue: { show } },
      ],
    });
    fixture = TestBed.createComponent(ShareMenu);
    fixture.componentRef.setInput('title', 'Zona: pecho');
  });

  const trigger = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="share-abrir"]');

  it('nombra el botón con lo que se comparte', () => {
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-label')).toBe('Compartir: Zona: pecho');
  });

  it('ofrece sólo los formatos que la vista sabe entregar', async () => {
    fixture.componentRef.setInput('formats', ['png'] satisfies ShareFormat[]);
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    const text = document.body.textContent ?? '';
    expect(text).toContain('Imagen (PNG)');
    expect(text).not.toContain('Documento (PDF)');
  });

  it('pide el archivo a quien monta la vista', async () => {
    const pedidos: ShareFormat[] = [];
    fixture.componentInstance.exported.subscribe((format) => pedidos.push(format));
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('[data-testid="share-svg"]')?.click();
    expect(pedidos).toEqual(['svg']);
  });

  it('avisa cuando el enlace quedó copiado', async () => {
    shareLink.mockResolvedValue('copied');
    fixture.componentRef.setInput('url', 'https://x.test/?zona=pecho');
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    document.querySelector<HTMLElement>('[data-testid="share-enlace"]')?.click();
    await fixture.whenStable();
    expect(shareLink).toHaveBeenCalledWith('https://x.test/?zona=pecho', 'Zona: pecho');
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('sin enlace no ofrece la opción del enlace', async () => {
    fixture.detectChanges();
    trigger().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('[data-testid="share-enlace"]')).toBeNull();
  });
});
