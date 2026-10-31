import { ChangeDetectionStrategy, Component, PLATFORM_ID, inject, input } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AppButton } from '../../atoms/button/button';

/**
 * El **código de soporte** de un fallo (el `requestId` de S4, S5 o S9): el
 * puente entre quien reporta el problema y quien lo busca en los registros.
 *
 * ```html
 * <app-support-code [code]="estado.requestId" />
 * <app-support-code [code]="estado.requestId" [copyable]="false" />
 * ```
 *
 * Una sola forma de mostrarlo en toda la aplicación: el código se distingue,
 * no se corta en dos renglones y se selecciona entero. Con `copyable` ofrece
 * «Copiar código» al lado; `view-state-host` lo apaga en S9 porque ahí el
 * botón vive en las acciones del aviso, junto a «Reintentar».
 */
@Component({
  selector: 'app-support-code',
  imports: [AppButton],
  templateUrl: './support-code.html',
  styleUrl: './support-code.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportCode {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** El identificador de la petición que falló. */
  readonly code = input.required<string>();

  /** Si ofrece «Copiar código» junto al código. */
  readonly copyable = input(true);

  protected async copy(): Promise<void> {
    if (!this.isBrowser || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(this.code());
    } catch {
      // El código queda visible y seleccionable: no hay nada que recuperar.
    }
  }
}
