import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import type { MySession } from '../../../core/data-access/iam/iam.types';
import { LOGIN_ROUTE } from '../../../core/http/auth.interceptor';
import { readApiError } from '../../../core/http/api-error';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Mínimo que acepta la API para una contraseña nueva (`ChangePasswordDto`). */
const LARGO_MINIMO = 8;

/** Qué se ve en la lista de sesiones. */
type EstadoDeSesiones = 'cargando' | 'listo' | 'error';

/**
 * **Seguridad de la cuenta** (ID-24, CV-22): cambiar la contraseña, ver dónde hay
 * sesiones abiertas y cerrarlas.
 *
 * - **Cambiar la contraseña** pide la actual y la nueva. La API cierra las otras
 *   sesiones, y acá se recarga la lista para que se vea. Una contraseña actual
 *   equivocada es un 422 con `details.reason` —nunca un 401, que sacaría a la
 *   persona de la sesión que acaba de demostrar que es suya—.
 * - **Sesiones abiertas**: la actual va marcada y no se puede cerrar desde acá
 *   (para eso está «Cerrar sesión»).
 * - **Cerrar sesión en todos lados** revoca todas, esta incluida, y lleva al
 *   inicio de sesión.
 *
 * Sin `@Roles` en la API y sin `roles` en el menú: es de cualquier persona con
 * sesión. La autoridad es la API.
 */
@Component({
  selector: 'app-account-security',
  imports: [
    AppButton,
    Alert,
    Card,
    DatePipe,
    EmptyState,
    FormField,
    Input,
    PageHeader,
    ReactiveFormsModule,
  ],
  templateUrl: './security.html',
  styleUrl: './security.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountSecurity {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(LARGO_MINIMO)],
    }),
    confirmation: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly guardando = signal(false);
  protected readonly errorDeContrasena = signal<string | null>(null);

  protected readonly estado = signal<EstadoDeSesiones>('cargando');
  protected readonly sesiones = signal<readonly MySession[]>([]);
  protected readonly cerrando = signal<string | null>(null);
  protected readonly cerrandoTodas = signal(false);

  constructor() {
    this.cargarSesiones();
  }

  protected noCoincide(): boolean {
    const { newPassword, confirmation } = this.form.getRawValue();
    return confirmation !== '' && newPassword !== confirmation;
  }

  protected cambiarContrasena(): void {
    this.errorDeContrasena.set(null);
    if (this.form.invalid || this.noCoincide() || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.guardando.set(true);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: (resultado) => {
        this.guardando.set(false);
        this.form.reset();
        this.toasts.success(
          resultado.revokedSessions > 0
            ? `Cambiamos tu contraseña y cerramos ${resultado.revokedSessions} sesión(es) en otros dispositivos.`
            : 'Cambiamos tu contraseña.',
        );
        this.cargarSesiones();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorDeContrasena.set(mensajeDeContrasena(error));
      },
    });
  }

  protected cargarSesiones(): void {
    this.estado.set('cargando');
    this.auth.mySessions().subscribe({
      next: (lista) => {
        this.sesiones.set(lista);
        this.estado.set('listo');
      },
      error: () => this.estado.set('error'),
    });
  }

  protected cerrarSesion(sesion: MySession): void {
    this.cerrando.set(sesion.id);
    this.auth.revokeSession(sesion.id).subscribe({
      next: () => {
        this.cerrando.set(null);
        this.toasts.success('Cerramos esa sesión.');
        this.cargarSesiones();
      },
      error: () => {
        this.cerrando.set(null);
        this.toasts.warning('No pudimos cerrar esa sesión. Probá de nuevo.');
      },
    });
  }

  protected async cerrarTodas(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Cerrar sesión en todos lados',
      message:
        'Vas a salir de todos tus dispositivos, incluido este. Para volver a entrar vas a necesitar tu contraseña.',
      confirmLabel: 'Cerrar todas las sesiones',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }

    this.cerrandoTodas.set(true);
    this.auth.logoutEverywhere().subscribe({
      next: () => {
        this.cerrandoTodas.set(false);
        void this.router.navigateByUrl(LOGIN_ROUTE);
      },
      error: () => {
        this.cerrandoTodas.set(false);
        this.toasts.warning('No pudimos cerrar las sesiones. Probá de nuevo.');
      },
    });
  }
}

/** Traduce el fallo de `change-password` a una frase que la persona pueda usar. */
function mensajeDeContrasena(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const motivo = readApiError(error)?.details?.['reason'];
    if (motivo === 'CURRENT_PASSWORD_INVALID') {
      return 'La contraseña actual no es correcta.';
    }
    if (motivo === 'PASSWORD_UNCHANGED') {
      return 'La contraseña nueva tiene que ser distinta de la actual.';
    }
    if (error.status === 429) {
      return 'Hiciste demasiados intentos seguidos. Esperá un minuto y volvé a probar.';
    }
    if (error.status === 0) {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
  }
  return 'No pudimos cambiar tu contraseña. Probá de nuevo.';
}
