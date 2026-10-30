import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { NavigationService } from '../../core/navigation/navigation.service';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { FormBuilder } from '../form-builder/form-builder';
import { SurveysHome } from '../questionnaires/questionnaires';

/** Las dos rutas que dibujan este centro. La pestaña sale de cuál se abrió. */
const RUTA_FORMULARIOS = '/form-builder';
const RUTA_ENCUESTAS = '/questionnaires';

interface PestanaDelCentro {
  readonly ruta: typeof RUTA_FORMULARIOS | typeof RUTA_ENCUESTAS;
  readonly label: string;
  /** El `path` de la sección del registro que la respalda: es lo que decide si se ofrece. */
  readonly seccion: 'form-builder' | 'questionnaires';
}

const PESTANAS: readonly PestanaDelCentro[] = [
  { ruta: RUTA_FORMULARIOS, label: 'Formularios', seccion: 'form-builder' },
  { ruta: RUTA_ENCUESTAS, label: 'Encuestas', seccion: 'questionnaires' },
];

/**
 * «Formularios» y «Encuestas» en una sola pantalla con dos pestañas (pedido del
 * propietario, 28/10/2026): las dos son «lo que se le pide al paciente y lo que
 * se completa en la consulta», y como dos renglones del menú el médico tenía que
 * adivinar cuál abrir.
 *
 * **Las dos rutas siguen existiendo** (`/form-builder` y `/questionnaires`) y las
 * dos dibujan este centro: así los enlaces guardados, el breadcrumb de la ficha
 * de una encuesta y los guards por sección no cambian. La pestaña activa sale de
 * la ruta, no de un estado propio; cambiar de pestaña navega a la otra.
 *
 * Qué pestañas se ofrecen sale de `visibleSections()` —la misma lista que usa el
 * guard—: quien sólo puede entrar a «Encuestas» (`CLINICIAN`) ve una sola. Esto
 * no autoriza nada: la API sigue siendo la autoridad.
 */
@Component({
  selector: 'app-forms-hub',
  imports: [FormBuilder, PageHeader, SurveysHome, Tab, Tabs],
  templateUrl: './forms-hub.html',
  styleUrl: './forms-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormsHub {
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

  /** Las pestañas que esta sesión puede abrir, en el orden de siempre. */
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

  protected readonly esFormularios = computed(
    () => this.pestanas()[this.activa()]?.ruta === RUTA_FORMULARIOS,
  );

  protected elegir(indice: number): void {
    const destino = this.pestanas()[indice];
    if (destino === undefined || indice === this.activa()) {
      return;
    }
    void this.router.navigateByUrl(destino.ruta);
  }
}
