import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import type { LinkedFile } from '../../../../core/data-access/files/files.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { AttachmentUploader } from '../../../../shared/components/organisms/attachment-uploader/attachment-uploader';

/**
 * Los adjuntos de la ficha del paciente: estudios, imágenes, consentimientos.
 *
 * ## Cuelgan del paciente, no del encuentro
 *
 * `file_links.owner_type` admite `USER`, `PATIENT` y `TENANT` — **no hay
 * `ENCOUNTER`**. Así que los adjuntos son de la ficha entera y no del episodio
 * concreto. Es una restricción del modelo, no una decisión de esta pantalla:
 * quien quiera adjuntos por episodio tiene que promoverlo al `.puml` primero.
 *
 * ## Un archivo `PHI` que no se puede ver se dice, no se esconde
 *
 * El backend decide quién puede descargar qué. Cuando la descarga vuelve 403,
 * la pantalla lo dice con esas palabras en vez de no hacer nada — el mismo
 * criterio que ya usa la agenda para distinguir «no hay» de «no podés ver».
 * Una lista que oculta en silencio le hace creer al profesional que el estudio
 * no existe, y eso en una consulta es peor que un mensaje incómodo.
 *
 * ## Por qué la URL de descarga se pide al hacer clic
 *
 * Es firmada y vence. Emitir una por adjunto al pintar la lista dejaría veinte
 * enlaces vivos a datos clínicos de los que diecinueve nadie abrió.
 */
@Component({
  selector: 'app-attachments-block',
  imports: [Alert, AppButton, AttachmentUploader, Badge, Card, DatePipe],
  templateUrl: './attachments-block.html',
  styleUrl: './attachments-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentsBlock {
  private readonly files = inject(FilesClient);

  /** De qué paciente son los adjuntos. */
  readonly patientProfileId = input.required<string>();

  protected readonly adjuntos = signal<readonly LinkedFile[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal('');
  /** Id del adjunto cuya descarga se está pidiendo, para el spinner del botón. */
  protected readonly descargando = signal<string | null>(null);
  protected readonly sinPermiso = signal<string | null>(null);

  constructor() {
    effect(() => {
      const profileId = this.patientProfileId();
      if (profileId) {
        this.cargar(profileId);
      }
    });
  }

  protected cargar(profileId = this.patientProfileId()): void {
    this.cargando.set(true);
    this.error.set('');

    this.files
      .listLinked({ ownerType: 'PATIENT', ownerId: profileId })
      .subscribe({
        next: (pagina) => {
          this.adjuntos.set(pagina.items);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('No pudimos leer los adjuntos de esta ficha.');
        },
      });
  }

  /**
   * Abre un adjunto pidiendo su URL firmada en el momento.
   *
   * Un 403 no es un fallo de la aplicación: es la respuesta correcta cuando el
   * archivo es `PHI` y quien mira no tiene permiso. Se dice con esas palabras.
   */
  protected abrir(adjunto: LinkedFile): void {
    this.descargando.set(adjunto.linkId);
    this.sinPermiso.set(null);

    this.files.downloadUrl(adjunto.file.id).subscribe({
      next: ({ url }) => {
        this.descargando.set(null);
        window.open(url, '_blank', 'noopener');
      },
      error: (fallo: { status?: number }) => {
        this.descargando.set(null);
        if (fallo.status === 403) {
          this.sinPermiso.set(adjunto.linkId);
          return;
        }
        this.error.set('No pudimos abrir el archivo. Reintentá.');
      },
    });
  }

  protected nombre(adjunto: LinkedFile): string {
    return adjunto.file.originalName ?? 'Archivo sin nombre';
  }

  protected esProtegido(adjunto: LinkedFile): boolean {
    return adjunto.file.sensitivity === 'PHI';
  }
}
