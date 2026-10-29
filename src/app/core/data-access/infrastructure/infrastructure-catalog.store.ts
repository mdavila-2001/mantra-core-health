import { inject, Injectable } from '@angular/core';
import { shareReplay, tap, type Observable } from 'rxjs';

import { InfrastructureClient } from './infrastructure.client';
import type { InfrastructureCatalog } from './infrastructure.types';

/**
 * El catálogo de infraestructura, pedido **una vez** por sesión.
 *
 * Formas, funciones, reglas y conceptos regulatorios cambian con un despliegue,
 * no con un clic: pedirlos de nuevo en cada diálogo sería una petición por
 * pestaña abierta para recibir lo mismo. Si la lectura falla no se guarda el
 * fallo — el siguiente intento vuelve a pedirla — y `refresh()` descarta lo
 * guardado.
 */
@Injectable({ providedIn: 'root' })
export class InfrastructureCatalogStore {
  private readonly client = inject(InfrastructureClient);
  private cached: Observable<InfrastructureCatalog> | null = null;

  catalog(): Observable<InfrastructureCatalog> {
    this.cached ??= this.client.getCatalog().pipe(
      tap({ error: () => (this.cached = null) }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.cached;
  }

  refresh(): void {
    this.cached = null;
  }
}
