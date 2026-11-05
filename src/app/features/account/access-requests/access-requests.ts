import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import type { Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { PRACTITIONER_INBOX_ROLES, type AccessRequestItem } from '../../../core/data-access/authz/authz.types';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { describeApiFailure } from '../../../core/http/api-failure';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { AccessRequestActions } from './access-request-actions';
import { AccessRequestCard, type AccessRequestDecision } from './access-request-card/access-request-card';
import { INBOX_COPY, splitByTab, type InboxRole } from './access-requests.copy';

/**
 * **Buzón de solicitudes** — the inbox of access requests, for the patient
 * and for the practitioner (where the «a professional asks to see your
 * record» notice leads).
 *
 * One card with three tabs: what waits for the reader (Recibidas), what waits
 * for the other side (Enviadas) and what is decided (Historial). Every action
 * re-reads the inbox, so what stays on screen is what the API kept. The API
 * decides who may do what; the screen only offers what each side can do.
 */
@Component({
  selector: 'app-access-requests',
  imports: [AccessRequestCard, Alert, AppButton, Card, EmptyState, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './access-requests.html',
  styleUrl: './access-requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessRequests {
  private readonly auth = inject(AuthService);
  private readonly actions = inject(AccessRequestActions);
  private readonly specialties = inject(MedicalSpecialtiesCatalog);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);

  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  /** Inside «Mis solicitudes» (as its tab): the host page owns the header. */
  readonly embebido = input(false);
  protected readonly role = computed<InboxRole>(() =>
    this.auth.roles().some((role) => PRACTITIONER_INBOX_ROLES.includes(role)) ? 'practitioner' : 'patient',
  );
  protected readonly copy = computed(() => INBOX_COPY[this.role()]);
  protected readonly state = signal<ViewState<readonly AccessRequestItem[]>>(loading());
  /** The three tabs, each with its count in the label and its own empty line. */
  protected readonly sections = computed(() => {
    const { received, sent, history } = splitByTab(dataOf(this.state()) ?? []);
    const copy = this.copy();
    return [
      { key: 'received', label: `Recibidas (${received.length})`, items: received, none: copy.receivedEmpty },
      { key: 'sent', label: `Enviadas (${sent.length})`, items: sent, none: copy.sentEmpty },
      { key: 'history', label: `Historial (${history.length})`, items: history, none: copy.historyEmpty },
    ];
  });
  protected readonly activeTab = signal(0);
  protected readonly specialtyNames = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly specialtiesError = signal<string | null>(null);
  /** The request whose action is on its way; its buttons wait meanwhile. */
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    this.loadSpecialties();
    this.reload();
  }

  protected retry(): void {
    this.state.set(loading());
    this.reload();
  }

  protected loadSpecialties(): void {
    this.specialtiesError.set(null);
    this.specialties.listar().subscribe({
      next: (options) => this.specialtyNames.set(new Map(options.map((o) => [o.conceptId, o.display]))),
      error: (error: unknown) => {
        this.specialties.olvidar();
        this.specialtiesError.set(
          describeApiFailure(error, 'No pudimos traer los nombres de las especialidades.'),
        );
      },
    });
  }

  protected decide(item: AccessRequestItem, { decision, specialtyIds }: AccessRequestDecision): void {
    this.run(
      item,
      this.actions.decide(this.role(), item, decision, specialtyIds),
      decision === 'ACCEPT' ? 'Aceptó la solicitud.' : 'Rechazó la solicitud.',
    );
  }

  protected async revoke(item: AccessRequestItem): Promise<void> {
    const confirmed = await this.dialogs.confirm({
      title: 'Revocar el acceso',
      message: `${item.counterpart.displayName || 'Este profesional'} deja de ver su historia clínica por esta solicitud.`,
      confirmLabel: 'Revocar',
      destructive: true,
    });
    if (confirmed) {
      this.run(item, this.actions.revoke(item), 'Revocó el acceso.');
    }
  }

  private reload(): void {
    const copy = this.copy();
    this.actions.list(this.role()).subscribe({
      next: (items) =>
        this.state.set(
          items.length === 0 ? empty(copy.emptyAction, copy.emptyMessage, copy.emptyTitle) : ready(items),
        ),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  private run(item: AccessRequestItem, request: Observable<unknown>, done: string): void {
    this.busyId.set(item.id);
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        this.toasts.success(done);
        this.reload();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.toasts.error(describeApiFailure(error, 'No se pudo guardar su decisión. Intente de nuevo.'));
      },
    });
  }
}
