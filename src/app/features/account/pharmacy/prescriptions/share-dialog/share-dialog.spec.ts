import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { SHARE_QR_DRAWER, ShareDialog } from './share-dialog';

const CREATE_URL = '/clinical/prescription-shares';
const SHARE_URL = 'https://app.example.test/rx/TkSynthetic0123456789abcdefghijklmnopqrstuv';

const CREATED = {
  shareId: 'sh-1',
  url: SHARE_URL,
  token: 'TkSynthetic0123456789abcdefghijklmnopqrstuv',
  expiresAt: '2026-11-29T12:00:00.000Z',
  itemCount: 2,
};

/**
 * «Compartir» (FAR-01, REQ-017).
 *
 * Lo que fijan estas pruebas: el enlace se crea una sola vez al abrir; el QR
 * se dibuja con el enlace que dio la API; «Compartir…» aparece solo si el
 * navegador tiene la hoja de compartir; WhatsApp lleva el enlace codificado y
 * sale sin `Referer`; copiar avisa; un 422 muestra el mensaje de la API; la
 * carga y el error recuperable.
 */
describe('ShareDialog', () => {
  let http: HttpTestingController;
  let draw: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    draw = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SHARE_QR_DRAWER, useValue: draw },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'share');
  });

  function mount(): ComponentFixture<ShareDialog> {
    const fixture = TestBed.createComponent(ShareDialog);
    fixture.componentRef.setInput('target', { encounterId: 'enc-1' });
    fixture.detectChanges();
    return fixture;
  }

  function byTestId(fixture: ComponentFixture<ShareDialog>, id: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);
  }

  function created(fixture: ComponentFixture<ShareDialog>): void {
    http.expectOne(CREATE_URL).flush(CREATED);
    fixture.detectChanges();
  }

  it('crea el enlace una sola vez, con la receta elegida', () => {
    const fixture = mount();
    expect(fixture.nativeElement.querySelector('.view-state-host__loading')).not.toBeNull();

    const req = http.expectOne(CREATE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ encounterId: 'enc-1' });
    req.flush(CREATED);
    fixture.detectChanges();
    fixture.detectChanges();

    http.expectNone(CREATE_URL);
    expect(byTestId(fixture, 'prescription-share-dialog-url')?.textContent).toContain(SHARE_URL);
    expect(byTestId(fixture, 'prescription-share-dialog-expiry')?.textContent).toContain(
      '2 medicamentos',
    );
  });

  it('dibuja el QR con el enlace que dio la API', () => {
    const fixture = mount();
    created(fixture);

    expect(draw).toHaveBeenCalledTimes(1);
    const [canvas, content] = draw.mock.calls[0] as [HTMLCanvasElement, string];
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(content).toBe(SHARE_URL);
  });

  it('si el QR no se puede dibujar, queda el enlace', async () => {
    draw.mockRejectedValue(new Error('sin lienzo'));
    const fixture = mount();
    created(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(byTestId(fixture, 'prescription-share-dialog-qr')).toBeNull();
    expect(byTestId(fixture, 'prescription-share-dialog-url')).not.toBeNull();
  });

  it('el enlace de WhatsApp es wa.me con el enlace codificado, y sale sin Referer', () => {
    const fixture = mount();
    created(fixture);

    const anchor = byTestId(fixture, 'prescription-share-dialog-whatsapp') as HTMLAnchorElement;
    const href = anchor.getAttribute('href') ?? '';
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(href).toContain(encodeURIComponent(SHARE_URL));
    expect(anchor.getAttribute('rel')).toContain('noreferrer');
  });

  it('«Compartir…» no aparece sin la hoja de compartir del navegador', () => {
    const fixture = mount();
    created(fixture);

    expect(byTestId(fixture, 'prescription-share-dialog-native-share')).toBeNull();
  });

  it('«Compartir…» usa navigator.share con el enlace cuando existe', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const fixture = mount();
    created(fixture);

    byTestId(fixture, 'prescription-share-dialog-native-share')?.click();
    await fixture.whenStable();

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: SHARE_URL }));
  });

  it('cancelar la hoja de compartir (AbortError) no hace nada más', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const toasts = TestBed.inject(ToastService);
    const success = vi.spyOn(toasts, 'success');
    const error = vi.spyOn(toasts, 'error');
    const fixture = mount();
    created(fixture);

    byTestId(fixture, 'prescription-share-dialog-native-share')?.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(share).toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('si la hoja de compartir falla por otra cosa, cae en «Copiar enlace»', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no permitido', 'NotAllowedError'));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const fixture = mount();
    created(fixture);

    byTestId(fixture, 'prescription-share-dialog-native-share')?.click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
    expect(success).toHaveBeenCalledWith('Enlace copiado');
  });

  it('copiar escribe el enlace y avisa', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const success = vi.spyOn(TestBed.inject(ToastService), 'success');
    const fixture = mount();
    created(fixture);

    byTestId(fixture, 'prescription-share-dialog-copy')?.click();
    await fixture.whenStable();

    expect(writeText).toHaveBeenCalledWith(SHARE_URL);
    expect(success).toHaveBeenCalledWith('Enlace copiado');
  });

  it('copiar sin portapapeles lo dice, no finge éxito', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const error = vi.spyOn(TestBed.inject(ToastService), 'error');
    const fixture = mount();
    created(fixture);

    byTestId(fixture, 'prescription-share-dialog-copy')?.click();
    await fixture.whenStable();

    expect(error).toHaveBeenCalled();
  });

  it('un 422 sin ítems vigentes muestra el mensaje de la API y no ofrece compartir', () => {
    const fixture = mount();
    http.expectOne(CREATE_URL).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La receta no tiene medicamentos emitidos y vigentes.',
        details: { reason: 'PRESCRIPTION_SHARE_NO_ACTIVE_ITEMS' },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La receta no tiene medicamentos emitidos y vigentes.',
    );
    expect(byTestId(fixture, 'prescription-share-dialog-copy')).toBeNull();
  });

  it('un fallo inesperado se reintenta y recién ahí crea de nuevo', () => {
    const fixture = mount();
    http
      .expectOne(CREATE_URL)
      .flush(
        { code: 'INTERNAL', message: 'x', correlationId: 'req-9' },
        { status: 500, statusText: 'Server Error' },
      );
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('req-9');

    const retry = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (button) => button.textContent?.includes('Reintentar'),
    );
    retry?.click();
    fixture.detectChanges();
    created(fixture);

    expect(byTestId(fixture, 'prescription-share-dialog-url')).not.toBeNull();
  });
});
