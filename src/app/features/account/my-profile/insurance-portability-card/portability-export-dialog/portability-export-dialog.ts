import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { readApiError } from '../../../../../core/http/api-error';
import { blobToDataUrl } from '../../../../../core/data-access/files/blob-to-data-url';
import { FileDownloader } from '../../../../../core/data-access/files/file-downloader';
import { InsurancePortabilityClient } from '../../../../../core/data-access/insurance/insurance-portability.client';
import type {
  PortabilityExportFormat,
  PortabilityExportResult,
} from '../../../../../core/data-access/insurance/insurance-portability.types';
import { AnnounceOnAppear } from '../../../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';

type DialogState = 'idle' | 'loading' | 'ready' | 'error';

/**
 * El diálogo de portabilidad de póliza y siniestralidad a 1 clic (subtarea
 * 3.3): pide el certificado, lo descarga en el formato elegido y muestra el
 * hash SHA-256 con el que quedó sellado.
 *
 * Es un componente de la `feature`, no una molécula compartida — mismo
 * criterio que `DuplicateStudyWarningDialog` (subtarea 3.2, TAREA-16 §5.5):
 * hoy tiene un solo consumidor (`InsurancePortabilityCard`).
 *
 * Sin `[formGroup]`: el formato es un `signal`, no un control reactivo, así
 * que `check-form-pages` ni lo mira.
 */
@Component({
  selector: 'app-portability-export-dialog',
  imports: [AnnounceOnAppear, AppButton, Alert, FormField, Select, Link, ContentDialog],
  templateUrl: './portability-export-dialog.html',
  styleUrl: './portability-export-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortabilityExportDialog {
  /** El perfil de paciente titular; siempre el propio (lo resuelve la tarjeta). */
  readonly patientProfileId = input.required<string>();

  /** Se cerró (Cancelar, fondo, Escape o después de emitir). */
  readonly closed = output<void>();

  private readonly portability = inject(InsurancePortabilityClient);
  private readonly downloader = inject(FileDownloader);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<DialogState>('idle');
  /**
   * `BUNDLE` es el default: CA-01 (portabilidad a 1 clic) pide que confirmar
   * en el diálogo descargue JSON y PDF, y elegir un solo formato es la
   * excepción, no la regla.
   */
  protected readonly format = signal<PortabilityExportFormat>('BUNDLE');

  /**
   * Los tres formatos, con las MISMAS palabras que tenían como radios: la
   * corrección C-21 cambia el control, no lo que dice cada opción.
   */
  protected readonly formatOptions: readonly SelectOption<PortabilityExportFormat>[] = [
    { value: 'PDF', label: 'PDF con código QR de verificación' },
    { value: 'JSON', label: 'Archivo JSON interoperable' },
    { value: 'BUNDLE', label: 'Paquete completo (PDF + JSON)' },
  ];
  protected readonly result = signal<PortabilityExportResult | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected setFormat(value: PortabilityExportFormat | null): void {
    if (value) this.format.set(value);
  }

  protected generate(): void {
    if (this.state() === 'loading') return;
    this.state.set('loading');
    this.errorMessage.set(null);

    this.portability
      .exportPortability({ patientProfileId: this.patientProfileId(), format: this.format() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.state.set('ready');
          this.copied.set(false);
          this.downloadChosen(result);
        },
        error: (error: unknown) => {
          this.state.set('error');
          this.errorMessage.set(this.exportErrorMessage(error));
        },
      });
  }

  private exportErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return (
        readApiError(error)?.message ??
        'No se pudo generar la exportación. Probá de nuevo.'
      );
    }
    return 'No se pudo generar la exportación. Probá de nuevo.';
  }

  /** Vuelve a descargar el/los archivo(s) del certificado ya emitido. */
  protected redownload(): void {
    const result = this.result();
    if (result) this.downloadChosen(result);
  }

  protected downloadPdfOnly(): void {
    const result = this.result();
    if (result) this.downloadPdf(result.certificateId);
  }

  protected downloadJsonOnly(): void {
    const result = this.result();
    if (result) this.downloadJson(result.certificateId);
  }

  private downloadChosen(result: PortabilityExportResult): void {
    if (result.format === 'PDF' || result.format === 'BUNDLE') {
      this.downloadPdf(result.certificateId);
    }
    if (result.format === 'JSON' || result.format === 'BUNDLE') {
      this.downloadJson(result.certificateId);
    }
  }

  private downloadPdf(certificateId: string): void {
    this.portability.downloadCertificatePdf(certificateId).subscribe({
      next: ({ blob, fileName }) =>
        this.saveBlob(blob, fileName ?? `portabilidad-${certificateId}.pdf`),
      error: () =>
        this.toasts.error(
          'No se pudo descargar el PDF. Probá de nuevo con "Volver a descargar".',
        ),
    });
  }

  private downloadJson(certificateId: string): void {
    this.portability.downloadCertificateJson(certificateId).subscribe({
      next: ({ blob, fileName }) =>
        this.saveBlob(blob, fileName ?? `portabilidad-${certificateId}.json`),
      error: () =>
        this.toasts.error(
          'No se pudo descargar el JSON. Probá de nuevo con "Volver a descargar".',
        ),
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    blobToDataUrl(blob).subscribe({
      next: (dataUrl) => this.downloader.trigger(dataUrl, filename),
      error: () => this.toasts.error('No se pudo preparar la descarga.'),
    });
  }

  protected async copyHash(): Promise<void> {
    const hash = this.result()?.manifestHash;
    if (!hash || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(hash);
      // Se reinicia antes de volver a marcarlo: si ya decía «copiado», un
      // segundo clic no cambiaría el contenido de la región viva y el lector
      // de pantalla no anunciaría nada.
      this.copied.set(false);
      this.copied.set(true);
    } catch {
      // El hash queda a la vista, seleccionable a mano: no hay nada más que
      // recuperar si el portapapeles no está disponible.
    }
  }

  /**
   * Intento de cierre por Escape o clic en el fondo (`(dismissAttempt)`).
   *
   * `[dismissible]="state() !== 'loading'"` sólo bloquea el botón "Cerrar"
   * del organismo — el propio `ContentDialog` sigue emitiendo
   * `dismissAttempt` ante Escape o el fondo aunque no sea "dismissible", así
   * que el consumidor tiene que ignorarlo mientras el pedido está en curso.
   * Sin esto, cerrar a mitad del `export()` desmontaba el diálogo entero
   * (`@if (dialogOpen())` en la tarjeta) con la suscripción todavía viva.
   */
  protected attemptClose(): void {
    if (this.state() === 'loading') return;
    this.close();
  }

  protected close(): void {
    this.closed.emit();
  }
}
