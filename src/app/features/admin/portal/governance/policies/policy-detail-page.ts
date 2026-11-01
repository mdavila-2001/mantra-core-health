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
import type {
  ChangeLogEntry,
  PolicyDetail,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, notFound, ready } from '../../../../../core/view-state/view-state';
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
  appliedKind,
  appliedName,
  changeAction,
  historyFrom,
  isPolicyType,
  policyControl,
  policyFacts,
  policyState,
  policyType,
} from './policies.model';

const LIST_ROUTE = portalUrl('governance/policies');
const VIEWS = ['resumen', 'aplica', 'historial'] as const;

/** Cuántos cambios de la bitácora se piden para la pestaña «Historial». */
const HISTORY_LIMIT = 20;

/**
 * La ficha de una política de gobierno, en una tarjeta con pestañas: qué controla, a qué
 * tablas o columnas se aplica y cómo ha cambiado. Sólo lectura: modificar una política es
 * una acción de la API que exige su propio rol.
 *
 * El detalle y la bitácora son dos lecturas distintas de la API: si la bitácora falla, la ficha
 * se dibuja igual y el historial dice que no se pudo leer (estado parcial), en vez de tumbarla.
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

  protected readonly listUrl = LIST_ROUTE;
  protected readonly type = policyType;
  protected readonly state = policyState;
  protected readonly control = policyControl;
  protected readonly when = dateTime;
  protected readonly appliedKind = appliedKind;
  protected readonly appliedName = appliedName;
  protected readonly action = changeAction;

  private readonly id = paramValue(pathParamsSignal(this.route), 'id');
  /** La API busca por tipo e id: el tipo viaja en `?tipo=` desde la lista. */
  private readonly tipo = paramValue(queryParamsSignal(this.route), 'tipo');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly detail = signal<ViewState<PolicyDetail>>(loading());
  protected readonly history = signal<ViewState<readonly ChangeLogEntry[]>>(loading());
  /** Sin fecha de alta la API mira sólo 30 días, y la pestaña tiene que decirlo. */
  protected readonly historyIsPartial = signal(false);
  protected readonly facts = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? policyFacts(s.data.settings) : [];
  });
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? s.data.code : 'Política de gobierno';
  });

  private pending: Subscription | null = null;
  private pendingHistory: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.pending?.unsubscribe();
      this.pendingHistory?.unsubscribe();
    });
    effect(() => {
      const id = this.id();
      const tipo = this.tipo();
      untracked(() => this.load(tipo, id));
    });
  }

  protected reload(): void {
    this.load(this.tipo(), this.id());
  }

  protected reloadHistory(): void {
    const s = this.detail();
    if (s.status === 'ready') this.loadHistory(s.data);
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  private load(tipo: string, id: string): void {
    this.pending?.unsubscribe();
    this.pendingHistory?.unsubscribe();
    // Sin un tipo que la API conozca no hay política que pedir: es una ficha que no existe.
    if (!isPolicyType(tipo)) {
      this.detail.set(notFound({ label: 'Volver a las políticas', route: LIST_ROUTE }));
      return;
    }
    this.detail.set(loading());
    this.history.set(loading());
    this.pending = this.client.getPolicy(tipo, id).subscribe({
      next: (policy) => {
        this.detail.set(ready(policy));
        this.loadHistory(policy);
      },
      error: (e: unknown) => this.detail.set(errorToViewState<PolicyDetail>(e)),
    });
  }

  private loadHistory(policy: PolicyDetail): void {
    this.pendingHistory?.unsubscribe();
    this.history.set(loading());
    const from = historyFrom(policy);
    this.historyIsPartial.set(from === null);
    this.pendingHistory = this.client
      .listChangeLog({ targetId: policy.id, limit: HISTORY_LIMIT, ...(from ? { from } : {}) })
      .subscribe({
        next: (page) =>
          this.history.set(
            page.items.length === 0
              ? empty(
                  { label: 'Ver todas las políticas', route: LIST_ROUTE },
                  'La bitácora de gobierno no registra cambios sobre esta política.',
                )
              : ready(page.items),
          ),
        error: (e: unknown) => this.history.set(errorToViewState<readonly ChangeLogEntry[]>(e)),
      });
  }
}
