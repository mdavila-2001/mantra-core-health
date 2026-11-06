import { signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import type { DiagnosticsClient } from '../../../../../core/data-access/diagnostics/diagnostics.client';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import type { FileDownloadService } from '../../../../../shared/utils/file-download/file-download.service';
import type { ArchivoDeInforme } from '../red-clinica.types';

/**
 * The download of a released report's file through the practitioner route
 * (`/common/files` only serves whoever uploaded the file), with its states.
 * One at a time: a new download, or switching node, cancels the previous one.
 */
export class DescargaDelInforme {
  readonly estado = signal<{ readonly fileId: string; readonly estado: ViewState<null> } | null>(null);
  private suscripcion: Subscription | null = null;

  constructor(
    private readonly diagnostics: DiagnosticsClient,
    private readonly downloads: FileDownloadService,
  ) {}

  abrir(paciente: string, informeId: string, archivo: ArchivoDeInforme): void {
    this.cancelar();
    this.estado.set({ fileId: archivo.fileId, estado: { status: 'loading' } });
    // The client already re-reads the error's Blob body (`parseBlobError`): a
    // contract 403 shows as a 403 and not as a generic error.
    this.suscripcion = this.diagnostics.downloadPractitionerResultFile(paciente, informeId, archivo.fileId).subscribe({
      next: ({ blob, fileName }) => {
        this.downloads.save(blob, fileName ?? archivo.nombre);
        this.estado.set({ fileId: archivo.fileId, estado: { status: 'ready', data: null } });
      },
      error: (error: unknown) => this.estado.set({ fileId: archivo.fileId, estado: errorToViewState<null>(error) }),
    });
  }

  cancelar(): void {
    this.suscripcion?.unsubscribe();
    this.suscripcion = null;
    this.estado.set(null);
  }
}
