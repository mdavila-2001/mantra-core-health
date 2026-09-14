import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { WorkHistory } from '../../account/my-profile/work-history/work-history';

/**
 * **Mi consultorio propio** — dónde atiende el profesional por su cuenta.
 *
 * ## Por qué existe
 *
 * Ocupa el lugar que tenía «Tu organización» en Administración (pedido del
 * propietario, 2026-09-10). Aquella pantalla mostraba la organización del
 * *tenant activo* —la clínica donde el médico está afiliado—, que no es suya:
 * junto a «Mis organizaciones» y «Organización médica» eran tres tarjetas
 * parecidas y ninguna contestaba «¿dónde atiendo yo?».
 *
 * `organization-panel` **no se borró**: la sigue viendo quien administra un
 * tenant, que es de quien es. Lo que cambió es la puerta del médico.
 *
 * ## Por qué no tiene formulario propio
 *
 * Crear un consultorio, ubicarlo en el mapa, elegir su municipio y retirarlo ya
 * vive en `WorkHistory`, con su catálogo, su confirmación y sus 31 pruebas.
 * Copiarlo acá habría garantizado que el arreglo de uno no llegara al otro
 * —regla 50-frontend §3—. Se monta con `secciones="consultorios"`, que suprime el
 * historial laboral: acá la pregunta es dónde atiende hoy, no dónde ejerció.
 *
 * Es también la respuesta al «igualmente desde el perfil se puede hacer lo
 * mismo»: es **el mismo componente** el que se ve en «Mi perfil», así que las
 * dos entradas no pueden divergir.
 */
@Component({
  selector: 'app-my-practice',
  imports: [PageHeader, WorkHistory],
  templateUrl: './my-practice.html',
  styleUrl: './my-practice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPractice {
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
}
