import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { UiVisibilityRule } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { UiElementIndex } from '../element-index';
import { VisibilityNotice } from '../visibility-notice';
import { effectLabel } from '../visibility-labels';
import { RuleFormPanel } from './rule-form-panel';
import { RulesPanel } from './rules-panel';

const VIEWS = ['rules', 'new'] as const;
const FILTER_KEYS = ['element', 'subjectType', 'state'] as const;

/**
 * Reglas de visibilidad: qué se muestra u oculta, de qué elemento y a quién. Una tarjeta con dos
 * pestañas: las reglas (lista, edición con control de versión, terminar) y la regla nueva. Las
 * reglas deciden qué se presenta; la seguridad la deciden los permisos, en el servidor.
 */
@Component({
  selector: 'app-portal-ui-rules-page',
  imports: [Card, Tab, Tabs, PageHeader, VisibilityNotice, RulesPanel, RuleFormPanel],
  template: `
    <app-page-header
      title="Reglas de visibilidad"
      subtitle="Mostrar u ocultar un elemento de la interfaz para una persona, una organización, un rol, un tipo de organización o todos. Cada regla lleva su motivo y su vigencia; no se borran, se terminan."
      [breadcrumbs]="breadcrumbs()"
    />
    <div class="rules-page">
      <app-visibility-notice />
      <app-card class="rules-page__card" variant="outlined" padding="md" data-testid="portal-ui-rules">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Reglas">
            <app-visibility-rules-panel [values]="filters()" [notice]="notice()" />
          </app-tab>
          <app-tab label="Nueva regla">
            @if (tabIndex() === 1) {
              <div class="rules-page__new">
                <app-visibility-rule-form [presetElement]="filters().element" (created)="created($event)" />
              </div>
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
    .rules-page {
      display: flex;
      flex-direction: column;
      gap: var(--sp-4);
      inline-size: 100%;
      margin-inline: auto;
    }
    .rules-page__card {
      display: block;
      inline-size: 100%;
    }
    .rules-page__new {
      padding-block: var(--sp-4);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UiRulesPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly index = inject(UiElementIndex);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = queryParamsSignal(this.route);
  protected readonly filters = queryFilters(this.params, FILTER_KEYS);
  private readonly view = queryFilters(this.params, ['view']);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view().view as (typeof VIEWS)[number])),
  );
  protected readonly notice = signal<string | null>(null);

  constructor() {
    this.index.load();
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }

  protected created(rule: UiVisibilityRule): void {
    this.notice.set(
      `Se creó la regla: ${effectLabel(rule.effect).label.toLowerCase()} «${this.index.path(rule.elementKey)}» para ${rule.subjectLabel ?? 'todos'}.`,
    );
    void patchQuery(this.router, this.route, { view: null, element: rule.elementKey, subjectType: null, state: null });
  }
}
