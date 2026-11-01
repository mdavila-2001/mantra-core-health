import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { AccountExistsCheck } from './account-exists-check';

/**
 * El aviso «ya existe este usuario», con el botón que lleva a iniciar sesión.
 * Va una vez por pantalla de registro; se abre solo cuando
 * {@link AccountExistsCheck} encuentra un duplicado.
 */
@Component({
  selector: 'app-account-exists-dialog',
  imports: [ContentDialog, AppButton],
  template: `
    @if (check.encontrado(); as kind) {
      <app-content-dialog
        [heading]="titulo()"
        size="sm"
        closeLabel="Cerrar"
        data-testid="cuenta-existente"
        (closed)="check.cerrar()"
      >
        <p data-testid="cuenta-existente-texto">{{ texto() }}</p>
        <button
          dialog-actions
          app-button
          type="button"
          data-testid="cuenta-existente-login"
          (clicked)="iniciarSesion()"
        >
          Iniciar sesión
        </button>
      </app-content-dialog>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountExistsDialog {
  protected readonly check = inject(AccountExistsCheck);
  private readonly router = inject(Router);

  protected readonly titulo = computed(() =>
    this.check.encontrado() === 'ORG_NAME' ? 'Ya existe esta institución' : 'Ya existe este usuario',
  );

  protected readonly texto = computed(() => {
    switch (this.check.encontrado()) {
      case 'NATIONAL_ID':
        return 'Ya existe una cuenta con este documento de identidad. Inicie sesión para continuar.';
      case 'EMAIL':
        return 'Ya existe una cuenta con este correo. Inicie sesión para continuar.';
      default:
        return 'Ya existe una institución registrada con este nombre. Inicie sesión para continuar.';
    }
  });

  protected iniciarSesion(): void {
    this.check.cerrar();
    void this.router.navigateByUrl('/auth');
  }
}
