import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AccountingTab } from './accounting/accounting-tab';
import { AuditTab } from './audit/audit-tab';
import { GlossaryTab } from './glossary/glossary-tab';
import { ServicesTab } from './services/services-tab';

/**
 * Editor de catálogos globales por tipo de usuario (H3 del plan «Perfil admin»).
 *
 * Composición según `docs/components/composition-rules.md` §5: **una** tarjeta
 * centrada y a lo ancho del área de contenido, con pestañas; nada de tarjetas
 * apiladas ni de una medida de formulario. Cada pestaña pide a la API por su
 * cuenta (`app-tab` no dibuja el panel cerrado): que una falle o no tenga
 * permiso no apaga a las otras. La autoridad es la API, no esta pantalla.
 */
@Component({
  selector: 'app-catalog-editor',
  imports: [Card, Tabs, Tab, PageHeader, ServicesTab, GlossaryTab, AccountingTab, AuditTab],
  templateUrl: './catalog-editor.html',
  styleUrl: './catalog-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogEditor {
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly pestana = signal(0);

  /**
   * Pestañas que ya se abrieron. `app-tab` proyecta su contenido aunque el panel
   * esté cerrado, así que sin esto las cuatro pestañas pedirían a la API al
   * entrar —la auditoría exige un permiso que no tiene quien sólo edita
   * servicios—. Una vez abierta, la pestaña conserva su estado al volver.
   */
  protected readonly abiertas = signal<ReadonlySet<number>>(new Set([0]));

  constructor() {
    effect(() => {
      const indice = this.pestana();
      untracked(() => this.abiertas.update((previas) => (previas.has(indice) ? previas : new Set([...previas, indice]))));
    });
  }
}
