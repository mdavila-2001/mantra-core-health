import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { DataQualityClient } from '../../../../../core/data-access/admin-portal/data-quality.client';
import type { QualityRuleDetail } from '../../../../../core/data-access/admin-portal/data-quality.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { dateOnly, dateTime } from '../../governance/governance-labels';
import { portalUrl } from '../../portal-nav';
import { pathParamsSignal, patchQuery, paramValue, queryParamsSignal } from '../../support/route-query';
import { conceptText, countText, severityLabel } from '../quality-labels';

const LIST_URL = portalUrl('data-quality/rules');
const ISSUES_URL = portalUrl('data-quality/issues');
const VIEWS = ['resumen', 'expresion', 'corridas', 'incidencias'] as const;

/**
 * La ficha de una regla de calidad: qué comprueba, su expresión, las últimas corridas del
 * conjunto al que pertenece y cuántas incidencias tiene en cada estado. Una sola tarjeta con
 * pestañas; la pestaña vigente queda en la URL.
 */
@Component({
  selector: 'app-portal-quality-rule-detail-page',
  imports: [RouterLink, BackLink, Badge, Link, Card, FactList, Tab, Tabs, PageHeader, ViewStateHost],
  templateUrl: './rule-detail-page.html',
  styleUrl: './rule-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleDetailPage {
  private readonly client = inject(DataQualityClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly listUrl = LIST_URL;
  protected readonly issuesUrl = ISSUES_URL;
  protected readonly severity = severityLabel;
  protected readonly when = dateTime;
  protected readonly count = countText;

  private readonly id = paramValue(pathParamsSignal(this.route), 'ruleId');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() => Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])));

  protected readonly detail = signal<ViewState<QualityRuleDetail>>(loading());
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data.ruleCode : 'Regla de calidad';
  });

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected reload(): void {
    this.load(this.id());
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  protected facts(rule: QualityRuleDetail): readonly Hecho[] {
    return [
      { etiqueta: 'Nombre', valor: rule.name },
      { etiqueta: 'Dimensión', valor: conceptText(rule.dimension) },
      { etiqueta: 'Estado de la regla', valor: conceptText(rule.state) },
      { etiqueta: 'Conjunto de reglas', valor: `${rule.ruleSet.name} (${rule.ruleSet.code}), versión ${rule.ruleSet.version}` },
      { etiqueta: 'Actualizada', valor: dateOnly(rule.updatedAt) },
      { etiqueta: 'Incidencias abiertas', valor: `${rule.openIssues} de ${rule.totalIssues}` },
    ];
  }

  private load(id: string): void {
    this.pending?.unsubscribe();
    if (id === '') return;
    this.detail.set(loading());
    this.pending = this.client.getRule(id).subscribe({
      next: (rule) => this.detail.set(ready(rule)),
      error: (e: unknown) => this.detail.set(errorToViewState<QualityRuleDetail>(e)),
    });
  }
}
