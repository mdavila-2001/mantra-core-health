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
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { GovernancePoliciesClient } from '../../../../../core/data-access/admin-portal/governance-policies.client';
import type { PolicyDetail } from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { BackLink } from '../../../../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../../shared/components/molecules/fact-list/fact-list';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../../portal-nav';
import {
  paramValue,
  patchQuery,
  pathParamsSignal,
  queryParamsSignal,
} from '../../support/route-query';
import { dateTime } from '../governance-labels';
import {
  APPLIES_TO_LABELS,
  configurationText,
  policyControl,
  policyFacts,
  policyState,
  policyType,
} from './policies.model';

const LIST_ROUTE = portalUrl('governance/policies');
const VIEWS = ['resumen', 'aplica', 'historial'] as const;

/**
 * La ficha de una política de gobierno, en una tarjeta con pestañas: qué controla, a qué
 * tablas o campos se aplica y cómo ha cambiado. Sólo lectura: modificar una política es
 * una acción de la API que exige su propio rol.
 */
@Component({
  selector: 'app-portal-policy-detail-page',
  imports: [BackLink, Badge, Card, FactList, Tab, Tabs, PageHeader, ViewStateHost],
  templateUrl: './policy-detail-page.html',
  styleUrl: './policy-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyDetailPage {
  private readonly client = inject(GovernancePoliciesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly listUrl = LIST_ROUTE;
  protected readonly type = policyType;
  protected readonly state = policyState;
  protected readonly control = policyControl;
  protected readonly when = dateTime;
  protected readonly appliesLabel = APPLIES_TO_LABELS;
  protected readonly configText = configurationText;

  private readonly id = paramValue(pathParamsSignal(this.route), 'id');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly detail = signal<ViewState<PolicyDetail>>(loading());
  protected readonly facts = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? policyFacts(s.data) : [];
  });
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data.code : 'Política de gobierno';
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

  private load(id: string): void {
    this.pending?.unsubscribe();
    this.detail.set(loading());
    this.pending = this.client.getPolicy(id).subscribe({
      next: (policy) => this.detail.set(ready(policy)),
      error: (e: unknown) => this.detail.set(errorToViewState<PolicyDetail>(e)),
    });
  }
}
