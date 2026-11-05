import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  InjectionToken,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';

import { PrescriptionSharesClient } from '../../../../../core/data-access/prescription-shares/prescription-shares.client';
import type {
  CreatedPrescriptionShare,
  PrescriptionShareTarget,
} from '../../../../../core/data-access/prescription-shares/prescription-shares.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { drawQr } from '../../../../../shared/utils/qr/draw-qr';
import { PRESCRIPTION_SHARE_TESTIDS } from '../../../../prescription-share/prescription-share.testids';

/** Lado del QR en píxeles: se escanea desde otro teléfono, a un palmo. */
const QR_SIDE = 220;

/** Lo que arma `wa.me`: abre WhatsApp con el texto escrito, sin elegir contacto. */
const WHATSAPP_BASE = 'https://wa.me/?text=';

/**
 * Quién dibuja el QR. Es `drawQr`, el único mecanismo de QR del front; va por
 * token solo para que la prueba pueda comprobar **qué** se dibuja sin cargar
 * la librería en jsdom, que no tiene lienzo.
 */
export const SHARE_QR_DRAWER = new InjectionToken<
  (canvas: HTMLCanvasElement, content: string, side: number) => Promise<void>
>('SHARE_QR_DRAWER', { providedIn: 'root', factory: () => drawQr });

/**
 * «Compartir» una receta (FAR-01, REQ-FAR-01-017).
 *
 * Al abrirse crea el enlace **una sola vez** (`POST /clinical/prescription-shares`):
 * el token sale solo en esa respuesta, así que cerrar y volver a abrir crea
 * otro enlace —el anterior sigue en la lista, donde se revoca—. Muestra el QR,
 * el enlace, cuándo vence y cuatro salidas: la hoja de compartir del teléfono
 * (solo si el navegador la tiene), WhatsApp, copiar y cerrar.
 *
 * Los rechazos de la API llegan por el mapeo común (S-9): un 422 sin ítems
 * vigentes sale con el mensaje en castellano que manda la API; un 403 o 404,
 * con sus estados.
 */
@Component({
  selector: 'app-share-dialog',
  imports: [AppButton, AppButtonLink, ContentDialog, DatePipe, ViewStateHost],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareDialog {
  private readonly shares = inject(PrescriptionSharesClient);
  private readonly toasts = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly drawer = inject(SHARE_QR_DRAWER);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** La receta a compartir: su consulta o el fármaco suelto. */
  readonly target = input.required<PrescriptionShareTarget>();

  /** Se emite al cerrar el diálogo. */
  readonly closed = output<void>();

  protected readonly testids = PRESCRIPTION_SHARE_TESTIDS;
  protected readonly qrSide = QR_SIDE;

  protected readonly state = signal<ViewState<CreatedPrescriptionShare>>(loading());
  protected readonly share = computed(() => dataOf(this.state()));

  /** `false` si la librería del QR no cargó: queda el enlace, que alcanza. */
  protected readonly qrAvailable = signal(true);

  /** La hoja de compartir del sistema existe en teléfonos y en pocos navegadores de escritorio. */
  protected readonly canShareNatively =
    this.isBrowser && typeof this.document.defaultView?.navigator.share === 'function';

  protected readonly whatsappHref = computed(() => {
    const share = this.share();
    return share === null ? null : WHATSAPP_BASE + encodeURIComponent(shareMessage(share.url));
  });

  private readonly qrCanvas = viewChild<ElementRef<HTMLCanvasElement>>('qrCanvas');

  constructor() {
    // El lienzo aparece recién con el enlace creado: se dibuja cuando están los dos.
    effect(() => {
      const canvas = this.qrCanvas();
      const share = this.share();
      if (!this.isBrowser || canvas === undefined || share === null) {
        return;
      }
      this.drawer(canvas.nativeElement, share.url, QR_SIDE).catch(() =>
        this.qrAvailable.set(false),
      );
    });
  }

  /**
   * `false` hasta que la persona pide el enlace. Abrir el diálogo no crea nada:
   * cada enlace es un token vivo hasta 30 días, y abrirlo «para ver» dejaba
   * otro en la lista cada vez.
   */
  protected readonly requested = signal(false);

  /** Crea el enlace, a pedido. Se reintenta solo desde un estado de error. */
  protected create(): void {
    this.requested.set(true);
    this.state.set(loading());
    this.shares
      .create(this.target())
      .pipe(
        map((share) => ready(share)),
        catchError((error: unknown) => of(errorToViewState<CreatedPrescriptionShare>(error))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => this.state.set(state));
  }

  /**
   * La hoja de compartir del teléfono. Cancelarla lanza `AbortError`, que no
   * es un error: la persona decidió no compartir. Cualquier otro fallo cae en
   * copiar, igual que el menú de una publicación.
   */
  protected async shareNatively(): Promise<void> {
    const share = this.share();
    const navigator = this.document.defaultView?.navigator;
    if (share === null || navigator === undefined || typeof navigator.share !== 'function') {
      return;
    }
    try {
      await navigator.share({ title: 'Receta de AloVida', text: shareMessage(''), url: share.url });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      await this.copyLink();
    }
  }

  /** Copia y avisa: sin el aviso, copiar no cambia nada en pantalla. */
  protected async copyLink(): Promise<void> {
    const share = this.share();
    if (share === null) {
      return;
    }
    try {
      await this.document.defaultView?.navigator.clipboard.writeText(share.url);
      this.toasts.success('Enlace copiado');
    } catch {
      this.toasts.error('No se pudo copiar el enlace. Selecciónelo y cópielo a mano.');
    }
  }
}

/** El texto que acompaña al enlace en WhatsApp y en la hoja de compartir. */
function shareMessage(url: string): string {
  return `Le comparto mi receta de AloVida. ${url}`.trim();
}
