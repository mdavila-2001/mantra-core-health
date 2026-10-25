import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type { ServiceCatalogItem } from '../../../core/data-access/services-catalog/services-catalog.types';
import { readApiError } from '../../../core/http/api-error';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * Los términos y condiciones de un servicio (carril 22), en un diálogo que se
 * abre desde su tarjeta en «Mis servicios».
 *
 * Arriba, la tarjeta del servicio con lo principal; abajo, los términos. Si el
 * servicio no tiene términos propios usa los de por defecto, que provienen del
 * contrato general que configura el propietario. Ese texto todavía no está
 * cargado, y la pantalla lo dice en vez de inventarlo.
 *
 * Cambiar los términos por defecto pide confirmación antes de abrir la edición
 * (criterio 6): están pensados para cubrir la práctica de consulta médica. El
 * aviso no promete asesoría legal.
 *
 * La API (`PATCH /billing/service-catalog/:id`) decide quién puede editar;
 * acá sólo se pide y se muestra lo que devolvió.
 */
@Component({
  selector: 'app-service-terms',
  imports: [Alert, AppButton, ContentDialog, FormField, Textarea],
  templateUrl: './service-terms.html',
  styleUrl: './service-terms.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceTerms {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  readonly service = input.required<ServiceCatalogItem>();
  /** El precio ya formateado, como lo muestra la tarjeta de «Mis servicios». */
  readonly priceLabel = input.required<string>();

  /** El servicio tal como quedó guardado, para que la lista lo reemplace. */
  readonly updated = output<ServiceCatalogItem>();
  readonly closed = output<void>();

  protected readonly hasOwnTerms = computed(() => (this.service().termsText ?? '') !== '');
  protected readonly editing = signal(false);
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected async startEditing(): Promise<void> {
    if (!this.hasOwnTerms()) {
      const confirmed = await this.dialogs.confirm({
        title: '¿Cambiar los términos por defecto?',
        message:
          'Los términos por defecto están pensados para cubrir la práctica de consulta médica. ' +
          'Si los cambia, los nuevos valen sólo para este servicio.',
        confirmLabel: 'Cambiar los términos',
      });
      if (!confirmed) return;
    }
    this.draft.set(this.service().termsText ?? '');
    this.error.set(null);
    this.editing.set(true);
  }

  protected cancel(): void {
    this.editing.set(false);
    this.error.set(null);
  }

  protected save(): void {
    const text = this.draft().trim();
    if (text === '') {
      this.error.set('Escriba los términos, o vuelva a los de por defecto.');
      return;
    }
    this.persist(text, 'Guardamos los términos del servicio.');
  }

  protected async restoreDefault(): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: '¿Volver a los términos por defecto?',
      message: 'Se borran los términos propios de este servicio.',
      confirmLabel: 'Volver a los de por defecto',
      destructive: true,
    });
    if (!confirmed) return;
    this.persist(null, 'El servicio volvió a los términos por defecto.');
  }

  private persist(termsText: string | null, success: string): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    this.catalog.update(this.service().id, { termsText }).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.editing.set(false);
        this.updated.emit(saved);
        this.toasts.success(success, saved.name);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.error.set(serverMessage(error));
      },
    });
  }
}

function serverMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = readApiError(error);
    if (body !== null && body.message !== '') return body.message;
  }
  return 'No pudimos guardar los términos. Pruebe de nuevo.';
}
