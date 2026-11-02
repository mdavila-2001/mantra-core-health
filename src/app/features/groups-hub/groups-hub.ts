import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { NavigationService } from '../../core/navigation/navigation.service';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { Groups } from '../groups/groups';
import { MedicalGroupList } from '../medical-groups/medical-group-list/medical-group-list';

/** Las dos rutas que dibujan este centro. La pestaña sale de cuál se abrió. */
const RUTA_GRUPOS = '/groups';
const RUTA_GRUPOS_MEDICOS = '/my-medical-groups';

interface PestanaDelCentro {
  readonly ruta: typeof RUTA_GRUPOS | typeof RUTA_GRUPOS_MEDICOS;
  readonly label: string;
  /** El `path` de la sección del registro que la respalda: es lo que decide si se ofrece. */
  readonly seccion: 'groups' | 'my-medical-groups';
}

const PESTANAS: readonly PestanaDelCentro[] = [
  { ruta: RUTA_GRUPOS, label: 'Grupos y foros', seccion: 'groups' },
  { ruta: RUTA_GRUPOS_MEDICOS, label: 'Grupos médicos', seccion: 'my-medical-groups' },
];

/**
 * «Grupos y foros» y «Grupos médicos» en una sola pantalla con dos pestañas (pedido del
 * propietario, 01/11/2026): se unifican las comunidades y los equipos médicos de
 * atención en un solo destino para no duplicar entradas de grupos en el menú lateral.
 *
 * **Las dos rutas siguen existiendo** (`/groups` y `/my-medical-groups`) y las dos
 * dibujan este centro: así los enlaces guardados, el detalle de grupo y los guards
 * por sección no cambian. La pestaña activa sale de la ruta, no de un estado propio;
 * cambiar de pestaña navega a la otra.
 *
 * Qué pestañas se ofrecen sale de `visibleSections()` —la misma lista que usa el
 * guard—: quien sólo puede entrar a «Grupos y foros» ve una sola pestaña.
 */
@Component({
  selector: 'app-groups-hub',
  imports: [Groups, MedicalGroupList, PageHeader, Tab, Tabs],
  templateUrl: './groups-hub.html',
  styleUrl: './groups-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupsHub {
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Las pestañas que esta sesión puede abrir. */
  protected readonly pestanas = computed<readonly PestanaDelCentro[]>(() => {
    const alcanzables = new Set(this.navigation.visibleSections().map((seccion) => seccion.path));
    const ofrecidas = PESTANAS.filter((pestana) => alcanzables.has(pestana.seccion));
    return ofrecidas.length > 0 ? ofrecidas : PESTANAS;
  });

  protected readonly activa = computed(() => {
    const ruta = this.url().split(/[?#]/)[0];
    const indice = this.pestanas().findIndex(
      (pestana) => ruta === pestana.ruta || ruta.startsWith(`${pestana.ruta}/`),
    );
    return indice < 0 ? 0 : indice;
  });

  protected readonly esGrupos = computed(
    () => this.pestanas()[this.activa()]?.ruta === RUTA_GRUPOS,
  );

  protected elegir(indice: number): void {
    const destino = this.pestanas()[indice];
    if (destino === undefined || indice === this.activa()) {
      return;
    }
    void this.router.navigateByUrl(destino.ruta);
  }
}
