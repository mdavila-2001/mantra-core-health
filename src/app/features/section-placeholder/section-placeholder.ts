import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

import { NavigationService } from '../../core/navigation/navigation.service';
import { SECTION_ROUTE_DATA, type AppSection } from '../../core/navigation/navigation.types';
import { empty } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../shared/components/organisms/view-state-host/view-state-host';

/**
 * La pantalla de una sección que todavía no tiene pantalla.
 *
 * No es relleno: es lo que permite **recorrer el armazón entero hoy**, con su
 * menú, su ruta de navegación y su título, antes de que existan las 693 vistas
 * del vault. Cada sección `planificada` del registro aterriza acá, y encenderla
 * es reemplazar su entrada en `app.routes.ts` por el componente real — sin
 * tocar el menú, que sale del mismo registro.
 *
 * ## Por qué S3 y no una pantalla de «en construcción»
 *
 * Porque el contrato del M34 ya tiene un estado para «no hay nada que mostrar y
 * hay que ofrecer una salida», y usarlo evita inventar una pantalla que después
 * habría que desinventar. El estado dice de qué es la sección —el `summary` del
 * registro—, que es lo que hace la diferencia entre un vacío informativo y un
 * callejón.
 *
 * Es deliberadamente **mudo respecto de los datos**: no pide nada a la API. Una
 * sección sin pantalla tampoco tiene contrato de lectura confirmado, y pedir
 * «algo» para llenarla sería exactamente el defecto que P1 está cazando.
 */
@Component({
  selector: 'app-section-placeholder',
  imports: [PageHeader, ViewStateHost],
  templateUrl: './section-placeholder.html',
  styleUrl: './section-placeholder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionPlaceholder {
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);

  /**
   * La sección viene por `data` de la ruta, no por una entrada del componente:
   * así el mismo componente sirve a todas las secciones planificadas y el
   * registro sigue siendo el único que sabe cuáles son.
   *
   * `requireSync` es seguro acá —`ActivatedRoute.data` emite el valor actual al
   * suscribirse— y a cambio evita que el tipo sea `AppSection | undefined` en
   * toda la plantilla.
   */
  protected readonly section = toSignal(
    this.route.data.pipe(map((data) => data[SECTION_ROUTE_DATA] as AppSection)),
    { requireSync: true },
  );

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /**
   * El estado nunca transporta datos —de ahí `never`— porque esta pantalla no
   * consulta nada: el vacío es su única verdad posible.
   */
  protected readonly state = computed<ViewState<never>>(() =>
    empty(
      { label: 'Volver al panel', route: '/dashboard' },
      `${this.section().summary} La pantalla todavía no está construida.`,
    ),
  );
}
