import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { UiVisibilityRule } from '../../../../../core/data-access/ui-visibility/ui-visibility.types';
import { UiVisibilityService } from '../../../../../core/visibility/ui-visibility.service';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
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
  imports: [Card, MetricCard, Tab, Tabs, PageHeader, VisibilityNotice, RulesPanel, RuleFormPanel],
  template: `
    <!-- Una sola cabecera sobre el lienzo; las migas viven en la barra superior del portal. -->
    <app-page-header
      title="Reglas de visibilidad"
      subtitle="Mostrar u ocultar un elemento de la interfaz para una persona, una organización, un rol, un tipo de organización o todos. Cada regla lleva su motivo y su vigencia; no se borran, se terminan."
    />
    <div class="rules-page">
      <app-visibility-notice />
      <section class="rules-page__metrics" aria-label="Resumen de las reglas" data-testid="ui-rules-metrics">
        <app-metric-card label="Reglas vigentes" icon="sliders" [value]="metric(totals().rules)" hint="Según el catálogo; se actualiza con cada cambio" />
        <app-metric-card
          label="Elementos con reglas"
          icon="eye-off"
          [value]="metric(totals().withRules)"
          [hint]="totals().ready ? 'De ' + totals().elements + ' catalogados' : 'Elementos que hoy tienen alguna regla'"
        />
        <app-metric-card
          label="Ocultos por omisión"
          icon="eye"
          [value]="metric(totals().hiddenByDefault)"
          hint="No se muestran salvo que una regla los muestre"
        />
      </section>
      <app-card class="rules-page__card" variant="outlined" padding="md" data-testid="portal-ui-rules">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Reglas">
            <app-visibility-rules-panel [values]="filters()" [notice]="notice()" (changed)="index.refresh()" />
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
    /* Tres cifras en dos columnas (la primera a lo ancho); desde escritorio, tres. */
    .rules-page__metrics {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sp-3);
    }
    .rules-page__metrics > :first-child {
      grid-column: 1 / -1;
    }
    @media (min-width: 1024px) {
      .rules-page__metrics {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .rules-page__metrics > :first-child {
        grid-column: auto;
      }
    }
    .rules-page__metrics app-metric-card {
      min-inline-size: 0;
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
  protected readonly index = inject(UiElementIndex);
  private readonly visibility = inject(UiVisibilityService);

  private readonly params = queryParamsSignal(this.route);
  protected readonly filters = queryFilters(this.params, FILTER_KEYS);
  private readonly view = queryFilters(this.params, ['view']);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view().view as (typeof VIEWS)[number])),
  );
  protected readonly notice = signal<string | null>(null);

  /** Las cifras de la cabecera, del índice del catálogo que la pantalla ya pide (sin peticiones nuevas). */
  protected readonly totals = computed(() => {
    const all = this.index.elements();
    const status = this.index.state().status;
    return {
      ready: status === 'ready' || status === 'stale',
      elements: all.length,
      rules: all.reduce((sum, e) => sum + e.activeRuleCount, 0),
      withRules: all.filter((e) => e.activeRuleCount > 0).length,
      hiddenByDefault: all.filter((e) => !e.defaultVisible).length,
    };
  });
  /** Mientras el índice no llegó, la cifra es «sin dato», no un cero. */
  protected readonly metric = (n: number): number | null => (this.totals().ready ? n : null);

  constructor() {
    this.index.load();
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }

  protected created(rule: UiVisibilityRule): void {
    // La regla nueva puede tocar a quien la creó: su interfaz se pone al día sin recargar la página.
    this.visibility.refresh();
    // Las cifras de la cabecera salen del índice del catálogo: se relee para que cuenten la regla nueva.
    this.index.refresh();
    this.notice.set(
      `Se creó la regla: ${effectLabel(rule.effect).label.toLowerCase()} «${this.index.path(rule.elementKey)}» para ${rule.subjectLabel ?? 'todos'}.`,
    );
    void patchQuery(this.router, this.route, { view: null, element: rule.elementKey, subjectType: null, state: null });
  }
}
