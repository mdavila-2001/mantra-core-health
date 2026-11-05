import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { InfrastructureCatalog } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { hasData, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';

/**
 * El catálogo de infraestructura, pedido **una vez** por sesión de pantalla.
 *
 * Formas, funciones, reglas y conceptos cambian con un despliegue de la API, no
 * mientras alguien edita: pedirlo en cada pantalla de F1 sería la misma
 * respuesta cinco veces. Si falla, el próximo `asegurar()` reintenta.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoDeInfraestructuraStore {
  private readonly client = inject(InfrastructureClient);

  private readonly estadoInterno = signal<ViewState<InfrastructureCatalog>>(loading());
  readonly estado = this.estadoInterno.asReadonly();
  private enCurso = false;

  /** Lo pide si todavía no lo tiene (o si la última vez falló). */
  asegurar(): void {
    if (hasData(this.estadoInterno()) || this.enCurso) return;
    this.enCurso = true;
    this.estadoInterno.set(loading());
    this.client
      .getCatalog()
      .pipe(
        map((catalogo) => ready(catalogo) as ViewState<InfrastructureCatalog>),
        catchError((error: unknown) => of(errorToViewState<InfrastructureCatalog>(error))),
      )
      .subscribe((estado) => {
        this.enCurso = false;
        this.estadoInterno.set(estado);
      });
  }
}
