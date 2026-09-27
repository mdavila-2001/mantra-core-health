import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { readApiError } from '../../../core/http/api-error';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * El documento admite letras, dígitos, punto y guion; lo mismo que el alta.
 * Los espacios de los bordes se toleran porque se recortan al enviar: un CI
 * pegado desde otro lado suele traerlos.
 */
const DOCUMENTO = /^\s*[A-Za-z0-9.-]+\s*$/;

/**
 * Alta de un dependiente: sólo el CI.
 *
 * Si hay una cuenta registrada con ese CI, a esa cuenta le llega una
 * notificación y el vínculo nace cuando la acepta. Si no la hay, se dice acá,
 * junto al campo.
 */
@Component({
  selector: 'app-dependent-form-dialog',
  imports: [ReactiveFormsModule, AnnounceOnAppear, AppButton, Input, Alert, FormField, ContentDialog],
  templateUrl: './dependent-form-dialog.html',
  styleUrl: './dependents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DependentFormDialog {
  /** El CI al que se le envió la solicitud. */
  readonly sent = output<string>();
  readonly closed = output<void>();

  private readonly profiles = inject(ProfilesClient);
  private readonly fb = inject(FormBuilder);

  protected readonly dialog = viewChild.required(ContentDialog);

  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  /** El error del servidor que es sobre el CI escrito, para mostrarlo en el campo. */
  protected readonly errorDelCampo = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    nationalId: [
      '',
      [
        Validators.required,
        Validators.minLength(4),
        Validators.maxLength(40),
        Validators.pattern(DOCUMENTO),
      ],
    ],
  });

  constructor() {
    this.form.controls.nationalId.valueChanges.subscribe(() => this.errorDelCampo.set(null));
  }

  protected mensajeDelCampo(): string {
    const control = this.form.controls.nationalId;
    if (this.errorDelCampo() !== null) return this.errorDelCampo()!;
    if (!control.touched || control.valid) return '';
    if (control.hasError('required')) return 'Escribí el CI de la persona.';
    return 'El CI sólo admite letras, dígitos, punto y guion (4 a 40 caracteres).';
  }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.errorMessage.set(null);
    this.errorDelCampo.set(null);
    const documento = this.form.controls.nationalId.value.trim();

    this.profiles.requestDependentLink(documento).subscribe({
      next: () => {
        this.saving.set(false);
        this.sent.emit(documento);
        this.dialog().close();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const { mensaje, delCampo } = mensajeDeError(error);
        if (delCampo) {
          this.errorDelCampo.set(mensaje);
          this.form.controls.nationalId.markAsTouched();
        } else {
          this.errorMessage.set(mensaje);
        }
      },
    });
  }
}

/**
 * Qué decirle a quien no pudo enviar la solicitud, y si es sobre el CI.
 *
 * «No hay cuenta», «es tu propio CI» y «ya es tu dependiente» hablan del dato
 * escrito, así que van al campo. Lo demás es un fallo de la operación.
 */
function mensajeDeError(error: unknown): { mensaje: string; delCampo: boolean } {
  if (error instanceof HttpErrorResponse) {
    const api = readApiError(error);
    if (error.status === 404) {
      return {
        mensaje: api?.message ?? 'No hay ninguna cuenta registrada con ese CI.',
        delCampo: true,
      };
    }
    if (api !== null && (error.status === 409 || error.status === 422 || error.status === 400)) {
      return { mensaje: api.message, delCampo: true };
    }
    return {
      mensaje: api?.message ?? 'No se pudo enviar la solicitud. Intentá de nuevo.',
      delCampo: false,
    };
  }
  return { mensaje: 'No se pudo enviar la solicitud. Intentá de nuevo.', delCampo: false };
}
