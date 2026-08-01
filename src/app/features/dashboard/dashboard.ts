import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import {
  PublicClient,
  type PublicProjection,
} from '../../core/data-access/public/public.client';
import { viewStateFromHttpError } from '../../core/http/api-error';
import { dataOf, empty, loading, ready, stale } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../shared/components/atoms/skeleton/skeleton';
import { Card } from '../../shared/components/molecules/card/card';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Panel de inicio de la aplicación autenticada.
 *
 * Reemplaza la pantalla de bienvenida que venía del generador de Angular —logo, «Congratulations!
 * Your app is running» y seis enlaces a angular.dev—, que era literalmente la primera pantalla que
 * veía cualquiera que abriera el proyecto.
 *
 * ## Qué muestra y por qué eso
 *
 * Dos cosas, y las dos son ciertas y verificables en el momento:
 *
 * 1. **La sesión**, tal como el token la declara: identificador, roles y organización activa. Sale
 *    entera de los claims, sin ninguna petición, porque la API no expone `/me` y no hace falta.
 * 2. **Una lectura real contra la API**, el directorio público, atravesando el proxy, el
 *    interceptor y la traducción de errores, y pintada por `app-view-state-host` con los estados
 *    del M34. Es la prueba de punta a punta de que el frontend habla con el backend.
 *
 * El directorio se eligió porque es la única ruta `@Public()` que devuelve una proyección: no
 * transporta ningún dato clínico, así que sirve de verificación sin riesgo.
 *
 * ## Los tres estados que el directorio produce de verdad
 *
 * - **S3 vacío** cuando la vista materializada existe pero no tiene registros — que es lo que
 *   devuelve hoy la base de desarrollo.
 * - **S7 atrasado** cuando la proyección declara `refreshedAt`: son vistas materializadas y el
 *   M34 obliga a exponer la antigüedad, no a esconderla.
 * - **S8/S9** cuando la API no está levantada, que es exactamente lo que hay que ver si alguien
 *   abre el frontend sin el backend.
 */
@Component({
  selector: 'app-dashboard',
  imports: [Badge, Card, PageHeader, Skeleton, ViewStateHost],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly auth = inject(AuthService);
  private readonly publicClient = inject(PublicClient);

  protected readonly user = this.auth.user;
  protected readonly roles = this.auth.roles;
  protected readonly activeTenantId = this.auth.activeTenantId;

  /**
   * La organización activa por su nombre, con el identificador al lado.
   *
   * Los dos: el nombre es lo que la persona reconoce, y el identificador es lo que sirve para
   * reportar un problema. Antes acá sólo estaba el uuid, porque el token no traía nombres.
   */
  protected readonly tenantName = computed(() => {
    const id = this.activeTenantId();
    if (id === null) {
      return null;
    }
    return this.auth.tenantOptions().find((tenant) => tenant.id === id)?.name ?? id;
  });

  protected readonly directory = signal<ViewState<PublicProjection>>(loading());

  /**
   * Cuántos registros hay para mostrar, o `null` si el estado no transporta datos.
   *
   * Se resuelve acá y no en la plantilla porque `dataOf` estrecha la unión de verdad; hacerlo
   * arriba obligaría a un `$any()` que apaga la comprobación de tipos justo donde importa.
   */
  protected readonly recordCount = computed<number | null>(() => {
    const data = dataOf(this.directory());
    return data === null ? null : data.records.length;
  });

  constructor() {
    this.loadDirectory();
  }

  /**
   * Pide el directorio y traduce el resultado a un estado.
   *
   * El fallo pasa por `viewStateFromHttpError`, así que un servidor caído se ve como S8 con su
   * botón de reintentar y un 500 como S9 con el identificador de la petición — sin que esta
   * pantalla escriba una sola línea sobre errores.
   */
  protected loadDirectory(): void {
    this.directory.set(loading());

    this.publicClient.searchDirectory().subscribe({
      next: (projection) => this.directory.set(toState(projection)),
      error: (error: unknown) =>
        this.directory.set(viewStateFromHttpError<PublicProjection>(error)),
    });
  }
}

/**
 * De la proyección al estado.
 *
 * El orden importa: **vacío gana sobre atrasado**. Una proyección sin registros no tiene nada que
 * mostrar, así que anunciar su antigüedad sería decirle a la persona cuán viejo es un dato que no
 * está viendo. Con registros, `refreshedAt` decide entre fresco y atrasado, y su ausencia se
 * resuelve como `ready`: la vista nunca se refrescó, así que no hay antigüedad que declarar y S7
 * exige una — inventar `new Date()` sería afirmar que se calculó recién.
 */
function toState(projection: PublicProjection): ViewState<PublicProjection> {
  if (projection.records.length === 0) {
    return empty(
      { label: 'Ver el sistema de diseño', route: '/design-system' },
      'El directorio público todavía no tiene registros publicados.',
    );
  }

  return projection.refreshedAt === null
    ? ready(projection)
    : stale(projection, projection.refreshedAt);
}
