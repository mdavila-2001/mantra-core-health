import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { catchError, forkJoin, map, of } from 'rxjs';

import { InsightsWorkspaceClient } from '../../core/data-access/insights/insights-workspace.client';
import type {
  InsightsAlertRule,
  InsightsAlertStatus,
  InsightsAlertWorkflow,
  InsightsNotificationPreferences,
  InsightsOwnerTeam,
  InsightsRuleCode,
  PatchAlertRuleBody,
  PutNotificationPreferencesBody,
} from '../../core/data-access/insights/insights.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { snapshotOf } from './domain/alert-workflow';
import type { MarketingAlert } from './domain/insights.types';

/**
 * Lo que las personas hacen en Insights y el API guarda: estado y responsable de las alertas,
 * reglas y preferencias de aviso. Lo provee el marco; Panel y Alertas lo leen.
 *
 * Una escritura que choca (412: otra persona cambió lo mismo) no pisa nada: recarga el estado y
 * avisa. Un fallo de red o de permiso deja el estado como estaba y lo dice en `notice`.
 */
@Injectable()
export class InsightsWorkflow {
  private readonly client = inject(InsightsWorkspaceClient);

  readonly state = signal<ViewState<null>>(loading());
  readonly workflow = signal<Readonly<Record<string, InsightsAlertWorkflow>>>({});
  readonly rules = signal<readonly InsightsAlertRule[]>([]);
  readonly notifications = signal<InsightsNotificationPreferences | null>(null);
  /** Último aviso para la persona (conflicto, fallo): se muestra y se descarta. */
  readonly notice = signal<string | null>(null);
  readonly busy = signal(false);

  readonly ready = computed(() => this.state().status === 'ready');

  constructor() {
    this.load();
  }

  load(): void {
    this.state.set(loading());
    forkJoin({ wf: this.client.listAlertWorkflow(), rules: this.client.listAlertRules(), notif: this.client.getNotificationPreferences() })
      .pipe(
        map(({ wf, rules, notif }): ViewState<null> => {
          this.workflow.set(Object.fromEntries(wf.data.map((w) => [w.fingerprint, w])));
          this.rules.set(rules.data);
          this.notifications.set(notif.data);
          return ready(null);
        }),
        catchError((error: unknown) => of(errorToViewState<null>(error))),
      )
      .subscribe((s) => this.state.set(s));
  }

  statusOf(alertId: string): InsightsAlertStatus {
    return this.workflow()[alertId]?.status ?? 'new';
  }

  ownerOf(alertId: string): InsightsOwnerTeam | null {
    return this.workflow()[alertId]?.ownerTeam ?? null;
  }

  /** Cambia estado y/o responsable de una alerta. La primera vez la da de alta con su descripción. */
  setAlert(alert: MarketingAlert, status: InsightsAlertStatus, owner: InsightsOwnerTeam | null, note?: string): void {
    const current = this.workflow()[alert.id];
    this.busy.set(true);
    this.client
      .putAlertWorkflow(alert.id, { status, ownerTeam: owner, snapshot: snapshotOf(alert), ...(note ? { note } : {}) }, current?.rowVersion ?? null)
      .subscribe({
        next: (res) => {
          this.workflow.update((w) => ({ ...w, [alert.id]: res.data }));
          this.busy.set(false);
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  patchRule(code: InsightsRuleCode, body: PatchAlertRuleBody): void {
    const rule = this.rules().find((r) => r.code === code);
    if (!rule) return;
    this.busy.set(true);
    this.client.patchAlertRule(code, body, rule.rowVersion).subscribe({
      next: (res) => {
        this.rules.update((list) => list.map((r) => (r.code === code ? res.data : r)));
        this.busy.set(false);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  saveNotifications(body: PutNotificationPreferencesBody): void {
    this.busy.set(true);
    this.client.putNotificationPreferences(body, this.notifications()?.rowVersion ?? null).subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.busy.set(false);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.busy.set(false);
    if (error instanceof HttpErrorResponse && error.status === 412) {
      this.notice.set('Otra persona cambió esto antes que usted. Se cargó el estado vigente: revíselo y vuelva a intentar.');
      this.load();
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 422) {
      this.notice.set('El valor no es válido. Revise el dato e inténtelo de nuevo.');
      return;
    }
    this.notice.set('No se pudo guardar el cambio. Nada se modificó; inténtelo de nuevo.');
  }
}
