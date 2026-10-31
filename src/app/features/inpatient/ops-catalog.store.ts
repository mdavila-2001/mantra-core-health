import { inject, Injectable, signal } from '@angular/core';
import { catchError, map, of } from 'rxjs';

import { InfrastructureOpsClient } from '../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import type { InfrastructureOpsCatalog } from '../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import type { InfrastructureCatalog } from '../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, hasData, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';

type Catalog = InfrastructureCatalog & InfrastructureOpsCatalog;

/** El catálogo de F1 + la extensión de F2, pedido una vez (motivos, ejes, mapa v2). */
@Injectable({ providedIn: 'root' })
export class OpsCatalogStore {
  private readonly client = inject(InfrastructureOpsClient);
  private readonly estado = signal<ViewState<Catalog>>(loading());
  private enCurso = false;

  readonly state = this.estado.asReadonly();
  readonly catalog = (): Catalog | null => dataOf(this.estado());

  ensure(): void {
    if (hasData(this.estado()) || this.enCurso) return;
    this.enCurso = true;
    this.client
      .getCatalog()
      .pipe(
        map((c) => ready(c) as ViewState<Catalog>),
        catchError((e: unknown) => of(errorToViewState<Catalog>(e))),
      )
      .subscribe((s) => {
        this.enCurso = false;
        this.estado.set(s);
      });
  }
}
