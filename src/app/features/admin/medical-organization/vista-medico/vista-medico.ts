import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { MembershipsTab } from '../memberships-tab/memberships-tab';
import { SolicitudesDeIngreso } from '../solicitudes-de-ingreso/solicitudes-de-ingreso';

/**
 * «Mis organizaciones» para quien **no administra** ninguna: el médico.
 *
 * Antes veía las siete pestañas administrativas de una organización que no
 * tiene —vacías, con el aviso de que dependían de ella— y la lista de sus
 * vinculaciones escondida al final. Acá la lista es lo primero, con sus
 * acciones (retirarse, salir de la fila), y el buzón de solicitudes de ingreso
 * es la pestaña de al lado.
 *
 * Son sólo esas dos pestañas, también para quien además tiene un consultorio.
 */
@Component({
  selector: 'app-vista-medico',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MembershipsTab, SolicitudesDeIngreso, Tab, Tabs],
  templateUrl: './vista-medico.html',
})
export class VistaMedico {
  protected readonly pestana = signal(0);
  protected readonly invitaciones = signal(0);

  /** El contador va en la etiqueta: una invitación sin responder no debe pasar desapercibida. */
  protected readonly etiquetaDelBuzon = computed(() =>
    this.invitaciones() > 0
      ? `Solicitudes de ingreso (${this.invitaciones()})`
      : 'Solicitudes de ingreso',
  );
}
