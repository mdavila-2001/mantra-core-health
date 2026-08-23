import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { GETTING_STARTED_ROUTE } from '../getting-started.routes';

/**
 * Cuántas organizaciones se miran para saber si hay alguna real.
 *
 * Con dos alcanza: el tenant semilla más una. Es una pregunta de sí o no, no un
 * listado.
 */
const ORGANIZACIONES_A_MIRAR = 2;

/**
 * El código del tenant que siembra el arranque.
 *
 * No es una organización real: existe para que el administrador tenga dónde
 * estar y para que las escrituras sin contexto tengan a qué apuntar. Contarlo
 * daría por hecha una puesta en marcha que no ocurrió. Su valor vive en
 * `SEED.tenantCode` del backend.
 */
const CODIGO_DEL_TENANT_SEMILLA = 'DEFAULT';

/**
 * El aviso de que la plataforma todavía no tiene ninguna organización.
 *
 * ## Por qué es un componente aparte y no un bloque del panel
 *
 * Por peso. `Dashboard` y `Login` se importan **eagerly** en `app.routes.ts`, así
 * que todo lo que tocan viaja en el paquete inicial —que ya estaba a 994 kB de
 * un techo de 1 MB—. Inyectar `DirectoryClient` ahí para responder un sí o un no
 * lo pasaba de largo.
 *
 * Acá el cliente entra en un paquete diferido: el panel lo pide con `@defer`, y
 * quien no puede aprovisionar organizaciones —que es casi todo el mundo— no
 * descarga nada de esto nunca.
 *
 * ## Es un aviso, no una puerta
 *
 * Quien administra puede hacer otras cosas mientras tanto; encerrarlo en un
 * asistente sería impedírselo. Y si no hay nada que avisar, no se dibuja nada:
 * una plataforma ya puesta en marcha no tiene por qué ver este bloque.
 */
@Component({
  selector: 'app-setup-notice',
  imports: [Alert, AppButtonLink, RouterLink],
  templateUrl: './setup-notice.html',
  styleUrl: './setup-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupNotice {
  private readonly directory = inject(DirectoryClient);

  /** Si la plataforma todavía no tiene ninguna organización real. */
  protected readonly pendiente = signal(false);

  /** A dónde lleva el aviso. */
  protected readonly ruta = GETTING_STARTED_ROUTE;

  constructor() {
    this.directory.searchTenants({ limit: ORGANIZACIONES_A_MIRAR }).subscribe({
      next: (pagina) => {
        const hayOrganizacion = pagina.items.some(
          (tenant) => tenant.code !== CODIGO_DEL_TENANT_SEMILLA,
        );
        this.pendiente.set(!hayOrganizacion);
      },
      // Un fallo acá no muestra nada: inventar un aviso porque una lectura
      // secundaria falló sería decirle a alguien que le falta algo sin saberlo.
      error: () => this.pendiente.set(false),
    });
  }
}
