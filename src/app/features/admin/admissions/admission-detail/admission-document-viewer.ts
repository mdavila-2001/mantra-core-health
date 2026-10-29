import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, type SafeUrl } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import type { Subscription } from 'rxjs';

import type { AdmissionDocument } from '@core/data-access/admissions/admissions.types';
import { AdmissionsClient } from '@core/data-access/admissions/admissions.client';
import { formatBytes, mimeLabel } from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '@shared/components/atoms/skeleton/skeleton';

type ViewerState = 'loading' | 'ready' | 'error' | 'forbidden' | 'not-found' | 'unsupported' | 'corrupt';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.25;
/** Desde cuántos megapíxeles se avisa que una imagen puede tardar. */
export const LARGE_IMAGE_MEGAPIXELS = 24;

/** Lo mínimo que se usa de pdf.js, para no depender de sus tipos en el componente. */
interface PdfDocument {
  readonly numPages: number;
  getPage(n: number): Promise<{
    getViewport(o: { scale: number; rotation?: number }): { width: number; height: number };
    render(o: { canvas: HTMLCanvasElement; viewport: unknown; transform?: number[] }): { promise: Promise<void> };
  }>;
  destroy(): Promise<void>;
}

/**
 * Un documento de la admisión, a tamaño de trabajo: imagen o PDF con zoom,
 * arrastre, rotación y página, más «Descargar» y «Abrir en pestaña nueva».
 *
 * Los bytes se piden a la API con la sesión (`GET /common/files/:id/content`)
 * y se muestran desde una URL de objeto: no hay enlace público que se pueda
 * copiar. Abrir en otra pestaña usa esa misma URL de objeto, así que el estado
 * de la revisión no se pierde (la ficha sigue donde estaba).
 *
 * Cubre los estados que un archivo real da: cargando, 403, 404, error de red
 * con reintento, formato sin vista previa (se ofrece la descarga) y archivo
 * dañado.
 */
@Component({
  selector: 'app-admission-document-viewer',
  imports: [AppButton, NavIcon, Skeleton],
  templateUrl: './admission-document-viewer.html',
  styleUrl: './admission-document-viewer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionDocumentViewer {
  private readonly admissions = inject(AdmissionsClient);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La admisión dueña del documento: el acceso queda registrado a su nombre. */
  readonly admissionId = input.required<string>();
  readonly document = input.required<AdmissionDocument>();

  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly state = signal<ViewerState>('loading');
  protected readonly errorStatus = signal<number | null>(null);
  protected readonly zoom = signal(1);
  protected readonly rotation = signal(0);
  protected readonly page = signal(1);
  protected readonly pages = signal(1);
  protected readonly natural = signal<{ w: number; h: number } | null>(null);
  protected readonly kind = signal<'image' | 'pdf' | 'other'>('other');
  protected readonly rawUrl = signal<string | null>(null);
  private readonly pdf = signal<PdfDocument | null>(null);

  protected readonly safeUrl = computed<SafeUrl | null>(() => {
    const url = this.rawUrl();
    return url === null ? null : this.sanitizer.bypassSecurityTrustUrl(url);
  });
  protected readonly zoomPercent = computed(() => `${Math.round(this.zoom() * 100)} %`);
  protected readonly megapixels = computed(() => {
    const n = this.natural();
    return n === null ? null : Math.round((n.w * n.h) / 1_000_000);
  });
  protected readonly isLarge = computed(() => (this.megapixels() ?? 0) >= LARGE_IMAGE_MEGAPIXELS);
  protected readonly sideways = computed(() => this.rotation() % 180 !== 0);
  protected readonly aspect = computed(() => {
    const n = this.natural();
    if (n === null) return '4 / 3';
    return this.sideways() ? `${n.h} / ${n.w}` : `${n.w} / ${n.h}`;
  });
  protected readonly sizeText = computed(() => formatBytes(this.document().sizeBytes));
  protected readonly typeText = computed(() => mimeLabel(this.document().mimeType));
  protected readonly alt = computed(() => `Documento ${this.document().name}`);

  private subscription: Subscription | null = null;
  private renderToken = 0;
  private drag: { x: number; y: number; left: number; top: number } | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.release());
    effect(() => {
      const fileId = this.document().fileId;
      const admissionId = this.admissionId();
      if (this.isBrowser) this.load(admissionId, fileId);
    });
    effect(() => {
      const canvas = this.canvas()?.nativeElement;
      const pdf = this.pdf();
      const page = this.page();
      const zoom = this.zoom();
      const rotation = this.rotation();
      if (canvas !== undefined && pdf !== null) void this.renderPage(canvas, pdf, page, zoom, rotation);
    });
  }

  protected retry(): void {
    this.load(this.admissionId(), this.document().fileId);
  }

  private release(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    const url = this.rawUrl();
    if (url !== null && this.isBrowser) URL.revokeObjectURL(url);
    this.rawUrl.set(null);
    const pdf = this.pdf();
    if (pdf !== null) void pdf.destroy().catch(() => undefined);
    this.pdf.set(null);
  }

  private load(admissionId: string, fileId: string): void {
    this.release();
    this.state.set('loading');
    this.errorStatus.set(null);
    this.zoom.set(1);
    this.rotation.set(0);
    this.page.set(1);
    this.pages.set(1);
    this.natural.set(null);
    this.subscription = this.admissions.documentContent(admissionId, fileId).subscribe({
      next: (content) => {
        const mime = content.blob.type || this.document().mimeType || '';
        this.rawUrl.set(URL.createObjectURL(content.blob));
        if (/^image\/(png|jpeg|webp|gif|avif|bmp)$/.test(mime)) {
          this.kind.set('image');
          this.state.set('ready');
        } else if (mime === 'application/pdf') {
          this.kind.set('pdf');
          this.state.set('ready');
          void this.openPdf(content.blob);
        } else {
          this.kind.set('other');
          this.state.set('unsupported');
        }
      },
      error: (error: unknown) => {
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.errorStatus.set(status);
        this.state.set(status === 403 ? 'forbidden' : status === 404 ? 'not-found' : 'error');
      },
    });
  }

  private async openPdf(blob: Blob): Promise<void> {
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdfjs/pdf.worker.min.mjs';
      const task = pdfjs.getDocument({ data: await blob.arrayBuffer() });
      const doc = (await task.promise) as unknown as PdfDocument;
      this.pages.set(doc.numPages);
      this.pdf.set(doc);
    } catch {
      this.state.set('corrupt');
    }
  }

  private async renderPage(
    canvas: HTMLCanvasElement,
    pdf: PdfDocument,
    page: number,
    zoom: number,
    rotation: number,
  ): Promise<void> {
    const token = ++this.renderToken;
    try {
      const pagina = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
      const natural = pagina.getViewport({ scale: 1, rotation });
      const ancho = Math.max((this.stage()?.nativeElement.clientWidth ?? 640) - 24, 240);
      const escala = (ancho / natural.width) * zoom;
      const viewport = pagina.getViewport({ scale: escala, rotation });
      const dpr = Math.min(this.isBrowser ? window.devicePixelRatio || 1 : 1, 2);
      canvas.width = Math.ceil(viewport.width * dpr);
      canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.inlineSize = `${Math.ceil(viewport.width)}px`;
      canvas.style.blockSize = `${Math.ceil(viewport.height)}px`;
      await pagina.render({ canvas, viewport, transform: dpr === 1 ? [1, 0, 0, 1, 0, 0] : [dpr, 0, 0, dpr, 0, 0] }).promise;
      if (token !== this.renderToken) return;
    } catch {
      if (token === this.renderToken) this.state.set('corrupt');
    }
  }

  protected onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.natural.set({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
  }

  protected onImageError(): void {
    this.state.set('corrupt');
  }

  /* ---- controles ------------------------------------------------------------ */

  protected zoomBy(delta: number): void {
    this.zoom.update((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 100) / 100)));
  }

  protected fit(): void {
    this.zoom.set(1);
    const el = this.stage()?.nativeElement;
    if (el) {
      el.scrollLeft = 0;
      el.scrollTop = 0;
    }
  }

  protected rotate(): void {
    this.rotation.update((r) => (r + 90) % 360);
  }

  protected goTo(delta: number): void {
    this.page.update((p) => Math.min(this.pages(), Math.max(1, p + delta)));
  }

  protected openInNewTab(): void {
    const url = this.rawUrl();
    if (url !== null && this.isBrowser) window.open(url, '_blank', 'noopener');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    switch (event.key) {
      case '+':
      case '=':
        this.zoomBy(ZOOM_STEP);
        break;
      case '-':
        this.zoomBy(-ZOOM_STEP);
        break;
      case '0':
        this.fit();
        break;
      case 'r':
      case 'R':
        this.rotate();
        break;
      case 'PageDown':
        if (this.kind() === 'pdf') this.goTo(1);
        break;
      case 'PageUp':
        if (this.kind() === 'pdf') this.goTo(-1);
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  protected onWheel(event: WheelEvent): void {
    if (!event.ctrlKey) return;
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
  }

  protected dragStart(event: PointerEvent): void {
    const el = this.stage()?.nativeElement;
    if (el === undefined || event.button !== 0) return;
    this.drag = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop };
    el.setPointerCapture?.(event.pointerId);
  }

  protected dragMove(event: PointerEvent): void {
    const el = this.stage()?.nativeElement;
    if (this.drag === null || el === undefined) return;
    el.scrollLeft = this.drag.left - (event.clientX - this.drag.x);
    el.scrollTop = this.drag.top - (event.clientY - this.drag.y);
  }

  protected dragEnd(): void {
    this.drag = null;
  }
}
