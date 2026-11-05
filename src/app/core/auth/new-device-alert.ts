import { Injectable, signal } from '@angular/core';

import type { NewDeviceNotice } from '../data-access/iam/iam-new-device';

/**
 * El aviso de **dispositivo nuevo** que el armazón muestra tras iniciar sesión.
 *
 * Lo enciende el login cuando la API lo indica (`Session.newDevice`) y lo apaga
 * quien lo resolvió —«Fui yo» o «No fui yo»— o el cierre de sesión. Vive en
 * memoria: un aviso que sobreviviera a una recarga volvería a preguntarle a
 * alguien algo que ya respondió, y uno que sobreviviera al cierre de sesión se
 * lo mostraría a la persona siguiente en un equipo compartido.
 */
@Injectable({ providedIn: 'root' })
export class NewDeviceAlert {
  private readonly current = signal<NewDeviceNotice | null>(null);

  /** El aviso pendiente, o `null`. */
  readonly notice = this.current.asReadonly();

  show(notice: NewDeviceNotice): void {
    this.current.set(notice);
  }

  dismiss(): void {
    this.current.set(null);
  }
}
