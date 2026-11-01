import { HttpErrorResponse } from '@angular/common/http';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PrivacyRequestsClient } from '../../../../core/data-access/admin-portal/privacy-requests.client';
import type {
  PrivacyRequest,
  PrivacyStatus,
  PrivacyTransition,
} from '../../../../core/data-access/admin-portal/privacy-requests.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { dateTime } from '../governance/governance-labels';
import { portalUrl } from '../portal-nav';
import { pathParamsSignal, patchQuery, paramValue, queryParamsSignal } from '../support/route-query';
import {
  TRANSITION_ACTIONS,
  daysSince,
  jurisdictionLabel,
  privacyStatusLabel,
  privacyTypeLabel,
} from './privacy-labels';
import { transitionFailure } from './privacy-requests.model';

const LIST_URL = portalUrl('governance/privacy-requests');
const VIEWS = ['resumen', 'tramitar'] as const;

/**
 * La ficha de una solicitud de privacidad (`GET /privacy/dsar/:id`): qué se pidió, desde cuándo
 * espera, cuándo vence y a qué estados se puede mover. La lectura no publica las transiciones:
 * se ofrecen las de `allowedTransitions` (copia de lo que admite `PATCH /privacy/dsar/:id`) y la
 * API decide: un estado terminal responde 422 y la ficha lo dice. Una sola tarjeta con pestañas.
 */
@Component({
  selector: 'app-portal-privacy-request-detail-page',
  imports: [AppButton, BackLink, Badge, Alert, Card, FactList, Tab, Tabs, PageHeader, ViewStateHost],
  templateUrl: './privacy-request-detail-page.html',
  styleUrl: './privacy-request-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyRequestDetailPage {
  private readonly client = inject(PrivacyRequestsClient);
  private readonly dialogs = inject(DialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listUrl = LIST_URL;
  protected readonly status = privacyStatusLabel;
  protected readonly type = privacyTypeLabel;
  protected readonly actions = TRANSITION_ACTIONS;

  private readonly id = paramValue(pathParamsSignal(this.route), 'requestId');
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() => Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])));

  protected readonly detail = signal<ViewState<PrivacyRequest>>(loading());
  protected readonly notice = signal<{ tone: 'success' | 'error'; text: string } | null>(null);
  /** Mientras se guarda, los botones quedan apagados: no hay doble envío. */
  protected readonly saving = signal(false);
  protected readonly title = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? privacyTypeLabel(s.data.type) : 'Solicitud de privacidad';
  });

  private pending: Subscription | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.pending?.unsubscribe());
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

  /** Sólo las transiciones que admite el estado actual y que esta pantalla sabe pedir. */
  protected transitions(request: PrivacyRequest): readonly PrivacyTransition[] {
    return request.allowedTransitions.filter((s): s is PrivacyTransition => s in TRANSITION_ACTIONS);
  }

  protected isOpen(status: PrivacyStatus | null): boolean {
    return status === 'RECEIVED' || status === 'IN_PROGRESS';
  }

  protected facts(r: PrivacyRequest): readonly Hecho[] {
    return [
      { etiqueta: 'Tipo', valor: privacyTypeLabel(r.type) },
      { etiqueta: 'Jurisdicción', valor: jurisdictionLabel(r.jurisdiction) },
      { etiqueta: 'Recibida', valor: dateTime(r.requestedAt) },
      {
        etiqueta: 'Vence',
        valor: `${dateTime(r.dueAt)}${r.overdue ? ' (vencida)' : ''}`,
      },
      this.isOpen(r.status)
        ? { etiqueta: 'Sin cerrar desde hace', valor: `${daysSince(r.requestedAt)} días` }
        : { etiqueta: 'Cerrada', valor: r.completedAt ? dateTime(r.completedAt) : null },
      { etiqueta: 'Última actualización', valor: dateTime(r.updatedAt) },
      { etiqueta: 'Titular (identificador)', valor: r.subjectUserId },
      {
        etiqueta: 'Paquete de datos entregado',
        valor: r.type === 'ACCESS' || r.type === 'PORTABILITY' ? (r.hasResultFile ? 'Sí, adjunto' : 'Todavía sin adjuntar') : null,
      },
    ];
  }

  protected async move(request: PrivacyRequest, to: PrivacyTransition): Promise<void> {
    if (this.saving()) return;
    const copy = TRANSITION_ACTIONS[to];
    const ok = await this.dialogs.confirm({
      title: copy.label,
      message: copy.effect,
      confirmLabel: copy.label,
      cancelLabel: 'Volver',
      destructive: to === 'REJECTED',
    });
    if (!ok) return;
    this.saving.set(true);
    this.notice.set(null);
    this.client
      .transition(request.id, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notice.set({ tone: 'success', text: `La solicitud quedó: ${privacyStatusLabel(to).label.toLowerCase()}.` });
          this.reload();
        },
        error: (e: unknown) => {
          this.saving.set(false);
          const failure = transitionFailure(e instanceof HttpErrorResponse ? e.status : null);
          this.notice.set({ tone: 'error', text: failure.message });
          if (failure.reload) this.reload();
        },
      });
  }

  private load(id: string): void {
    this.pending?.unsubscribe();
    if (id === '') return;
    this.detail.set(loading());
    this.pending = this.client.get(id).subscribe({
      next: (r) => this.detail.set(ready(r)),
      error: (e: unknown) => this.detail.set(errorToViewState<PrivacyRequest>(e)),
    });
  }
}
