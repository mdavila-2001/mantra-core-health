import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { SessionStore } from '../../../core/auth/session.store';
import {
  BookingApprovalClient,
  type AgendaApproval,
} from '../../../core/data-access/scheduling/booking-approval.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AGENDA_CREATE_ROUTE } from '../../agenda/agenda.routes';

/** Row captions, depending on how the agenda receives requests. */
export const AUTO_CONFIRM_TEXT = 'Las solicitudes se confirman en el acto.';
export const REVIEW_EACH_TEXT = 'Usted acepta o rechaza cada solicitud.';

/**
 * Settings › Agenda: how the practitioner receives booking requests.
 *
 * Client request (2026-11-05): the practitioner chooses whether requests are
 * confirmed automatically or wait for them. It is per agenda, so a doctor can
 * auto-confirm at their own office and keep reviewing at the hospital. The
 * switch reads the way the person turns it on ("confirm automatically") while
 * the API stores `requiresApproval`; the inversion lives in `autoConfirms`.
 * After saving, the row shows what the server stored, not what was asked.
 */
@Component({
  selector: 'app-agenda-preferences',
  imports: [Alert, NavIcon, Switch, ViewStateHost],
  templateUrl: './agenda-preferences.html',
  styleUrl: './agenda-preferences.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaPreferences {
  private readonly approvals = inject(BookingApprovalClient);
  private readonly session = inject(SessionStore);

  protected readonly state = signal<ViewState<readonly AgendaApproval[]>>(loading());

  /**
   * In-flight changes and the value asked for each. The switch shows the asked
   * value while saving; dropping it on failure really changes `checked`, so
   * Angular moves the native control back to what is still stored.
   */
  protected readonly pending = signal<ReadonlyMap<string, boolean>>(new Map());

  protected readonly saved = signal('');
  protected readonly saveError = signal('');

  protected readonly agendas = computed<readonly AgendaApproval[]>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : [];
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    const tenantId = this.session.activeTenantId();
    if (this.session.practitionerProfileId() === null || tenantId === null) {
      this.state.set(this.noAgenda());
      return;
    }
    this.state.set(loading());
    this.approvals.listMine(tenantId).subscribe({
      next: ({ items }) => this.state.set(items.length === 0 ? this.noAgenda() : ready(items)),
      error: (error: unknown) => this.state.set(errorToViewState<readonly AgendaApproval[]>(error)),
    });
  }

  protected autoConfirms(agenda: AgendaApproval): boolean {
    return this.pending().get(agenda.id) ?? !agenda.requiresApproval;
  }

  protected isSaving(agenda: AgendaApproval): boolean {
    return this.pending().has(agenda.id);
  }

  /** The caption tells what is stored, not what was asked. */
  protected captionOf(agenda: AgendaApproval): string {
    return agenda.requiresApproval ? REVIEW_EACH_TEXT : AUTO_CONFIRM_TEXT;
  }

  protected change(agenda: AgendaApproval, autoConfirm: boolean): void {
    if (this.isSaving(agenda)) return;
    this.saved.set('');
    this.saveError.set('');
    this.pending.update((current) => new Map(current).set(agenda.id, autoConfirm));

    this.approvals.setRequiresApproval(agenda.id, !autoConfirm).subscribe({
      next: (stored) => {
        this.state.update((state) =>
          state.status === 'ready'
            ? ready(state.data.map((a) => (a.id === stored.id ? stored : a)))
            : state,
        );
        this.release(agenda.id);
        this.saved.set(
          stored.requiresApproval
            ? `Guardado. En «${stored.name}» usted vuelve a aceptar cada solicitud.`
            : `Guardado. En «${stored.name}» las solicitudes nuevas se confirman solas.`,
        );
      },
      error: () => {
        this.release(agenda.id);
        this.saveError.set('No pudimos guardar el cambio. Lo que ve es lo que sigue vigente.');
      },
    });
  }

  private release(id: string): void {
    this.pending.update((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }

  /** Empty state with its next action: without an agenda there is nothing to configure. */
  private noAgenda(): ViewState<readonly AgendaApproval[]> {
    return empty(
      { label: 'Publicar mi agenda', route: AGENDA_CREATE_ROUTE },
      'Todavía no publicó una agenda en esta organización.',
    );
  }
}
