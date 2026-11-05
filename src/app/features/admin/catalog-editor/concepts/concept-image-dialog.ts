import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ConceptAdminClient, type ConceptWithProperties } from '../../../../core/data-access/terminology/concept-admin.client';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { IMAGE_PROPERTY, defaultSpecialtyImage, safeImageValue } from '../../../../shared/specialties/specialty-images';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Spinner } from '../../../../shared/components/atoms/spinner/spinner';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { toThumbnail } from './image-thumbnail';

/**
 * Cambia la imagen de un concepto del catálogo: sube una propia (se recorta a
 * 16:9 y se comprime en el navegador) o vuelve a la ilustración original.
 * Guarda en la propiedad `image` del concepto; la API la audita.
 */
@Component({
  selector: 'app-concept-image-dialog',
  imports: [AppButton, Alert, ContentDialog, Spinner],
  templateUrl: './concept-image-dialog.html',
  styleUrl: './concept-image-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConceptImageDialog {
  private readonly client = inject(ConceptAdminClient);

  readonly concept = input.required<ConceptWithProperties>();
  readonly saved = output<{ readonly conceptId: string; readonly url: string }>();
  readonly closed = output<void>();

  protected readonly pendiente = signal<string | null>(null);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly original = computed(() => defaultSpecialtyImage(this.concept().display));
  protected readonly actual = computed(() => safeImageValue(this.concept().properties?.[IMAGE_PROPERTY]) ?? this.original());
  protected readonly vista = computed(() => this.pendiente() ?? this.actual());

  protected async elegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo === undefined) return;
    const resultado = await toThumbnail(archivo);
    if (resultado.ok) {
      this.error.set(null);
      this.pendiente.set(resultado.dataUrl);
    } else {
      this.error.set(resultado.reason);
    }
  }

  protected restaurar(): void {
    this.error.set(null);
    this.pendiente.set(this.original());
  }

  protected guardar(): void {
    const url = this.pendiente();
    if (url === null || this.guardando()) return;
    this.guardando.set(true);
    this.error.set(null);
    this.client.setProperty(this.concept().conceptId, IMAGE_PROPERTY, url).subscribe({
      next: () => this.saved.emit({ conceptId: this.concept().conceptId, url }),
      error: (e: unknown) => {
        this.guardando.set(false);
        const estado = errorToViewState<void>(e);
        this.error.set(estado.status === 'error' ? (estado.message ?? estado.title ?? 'No se pudo guardar la imagen.') : 'No se pudo guardar la imagen.');
      },
    });
  }
}
