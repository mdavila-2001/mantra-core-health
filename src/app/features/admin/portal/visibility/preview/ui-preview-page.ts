import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { UiElementIndex } from '../element-index';
import { VisibilityNotice } from '../visibility-notice';
import { PreviewPanel } from './preview-panel';

const VIEWS = ['user', 'role'] as const;

/**
 * «Ver como»: qué se le oculta a una persona o a un rol, regla por regla. Sirve para comprobar
 * una regla antes de confiar en ella y para entender por qué alguien no ve un botón. No cambia
 * nada, y mostrar lo oculto no concede nada: los permisos los decide el servidor.
 */
@Component({
  selector: 'app-portal-ui-preview-page',
  imports: [Card, Tab, Tabs, PageHeader, VisibilityNotice, PreviewPanel],
  template: `
    <app-page-header
      title="Ver como"
      subtitle="Previsualice qué se le oculta a una persona o a un rol, con la regla ganadora de cada elemento y si fue por cascada."
      [breadcrumbs]="breadcrumbs()"
    />
    <div class="preview-page">
      <app-visibility-notice />
      <app-card class="preview-page__card" variant="outlined" padding="md" data-testid="portal-ui-preview">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Una persona">
            @if (tabIndex() === 0) {
              <app-visibility-preview-panel mode="USER" [preset]="values().user" />
            }
          </app-tab>
          <app-tab label="Un rol">
            @if (tabIndex() === 1) {
              <app-visibility-preview-panel mode="ROLE" [preset]="values().role" />
            }
          </app-tab>
        </app-tabs>
      </app-card>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .preview-page {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      inline-size: 100%;
      margin-inline: auto;
    }
    .preview-page__card {
      display: block;
      inline-size: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiPreviewPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), ['view', 'user', 'role']);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );

  constructor() {
    // El índice del catálogo da la ruta legible de cada elemento; se pide una vez por visita.
    inject(UiElementIndex).load();
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]!, user: null, role: null });
  }
}
