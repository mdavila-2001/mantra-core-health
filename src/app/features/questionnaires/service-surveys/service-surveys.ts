import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { SurveysServiceAssignmentsClient } from '../../../core/data-access/surveys/surveys-service-assignments.client';
import type { ServiceSurveyAssignments, ServiceSurveyRow as Row, StandardSurvey } from '../../../core/data-access/surveys/surveys-service-assignments.types';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { MY_SERVICES_ROUTE } from '../../my-services/my-services.routes';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { SupportCode } from '../../../shared/components/molecules/support-code/support-code';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ServiceSurveyRow } from './service-survey-row';
import * as logic from './service-surveys.logic';
import { SurveyCatalogPicker } from './survey-catalog-picker';
import { SurveyQuestionsDialog } from './survey-questions-dialog';

/**
 * «Encuestas por servicio» (06/11/2026). Fixed «Cita médica» row (system survey,
 * view only), then one row per service. Import or change opens the standard
 * catalog → PUT; remove asks first → DELETE. Every failure uses the S9 anatomy
 * (support code, «Copiar código», «Reintentar»; a refusal is S5, without retry)
 * and never the server's text.
 * Authorization stays in the API.
 */
@Component({
  selector: 'app-service-surveys',
  imports: [Alert, AppButton, AppButtonLink, Badge, EmptyState, NavIcon, RouterLink, ServiceSurveyRow, Skeleton, SupportCode, SurveyCatalogPicker, SurveyQuestionsDialog, ViewStateHost],
  templateUrl: './service-surveys.html',
  styleUrl: './service-surveys.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceSurveys {
  private readonly surveys = inject(SurveysServiceAssignmentsClient);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly myServicesRoute = MY_SERVICES_ROUTE;
  protected readonly questionCount = logic.questionCount;

  private readonly state = signal<ViewState<ServiceSurveyAssignments>>(loading());
  protected readonly view = this.state.asReadonly();
  private readonly catalogState = signal<ViewState<readonly StandardSurvey[]>>(loading());
  protected readonly catalogView = this.catalogState.asReadonly();
  protected readonly catalog = computed(() => dataOf(this.catalogView()) ?? []);

  protected readonly pickingFor = signal<Row | null>(null);
  protected readonly pickedKind = computed(() => {
    const row = this.pickingFor();
    return row === null ? 'OTHER' : logic.serviceKindOf(row.serviceName, row.serviceKind);
  });
  protected readonly saving = signal(false);
  /** The import failure shown inside the open picker. */
  protected readonly saveError = signal<logic.ShownFailure | null>(null);
  /** A write failure shown above the list (late import, removal), with what «Reintentar» redoes. */
  protected readonly writeError = signal<logic.ShownFailure | null>(null);
  private retryWrite: () => void = () => undefined;
  protected readonly removing = signal<string | null>(null);
  protected readonly viewing = signal<logic.QuestionsView | null>(null);

  /** In-flight reads: a new load cancels the previous one (no stale overwrite). */
  private listRead?: Subscription;
  private catalogRead?: Subscription;

  constructor() {
    inject(DestroyRef).onDestroy(() => (this.listRead?.unsubscribe(), this.catalogRead?.unsubscribe()));
    this.load();
    this.loadCatalog();
  }

  protected load(): void {
    this.listRead?.unsubscribe();
    this.state.set(loading());
    this.listRead = this.surveys.list().subscribe({
      next: (assignments) => this.state.set(ready(assignments)),
      error: (error: unknown) =>
        this.state.set(logic.readFailureState(error, 'No pudimos cargar sus servicios', 'El servidor tuvo un problema al leer la lista de sus servicios y sus encuestas.')),
    });
  }

  /** Loaded on its own: a catalog failure does not hide the list. An empty catalog is its own S3. */
  protected loadCatalog(): void {
    this.catalogRead?.unsubscribe();
    this.catalogState.set(loading());
    this.catalogRead = this.surveys.listStandardCatalog().subscribe({
      next: (entries) =>
        this.catalogState.set(entries.length === 0 ? empty({ label: 'Mientras tanto, cada servicio usa la encuesta base de servicios' }) : ready(entries)),
      error: (error: unknown) =>
        this.catalogState.set(
          logic.failureState(error, 'No se pudo cargar el catálogo de encuestas', 'La lista de sus servicios se ve, pero por ahora no puede importar ni cambiar.').state,
        ),
    });
  }

  protected entryFor(code: string | null | undefined): StandardSurvey | null {
    return this.catalog().find((entry) => entry.code === code) ?? null;
  }

  protected openPicker(row: Row): void {
    this.saveError.set(null);
    this.pickingFor.set(row);
  }

  /** Always clears the selection: a save still in flight reports above the list. */
  protected closePicker(): void {
    this.pickingFor.set(null);
    this.saveError.set(null);
  }

  protected importSurvey(catalogCode: string): void {
    const row = this.pickingFor();
    if (row === null || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.writeError.set(null);
    this.surveys.assign(row.serviceId, catalogCode).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.replace(updated);
        if (this.pickingFor()?.serviceId === row.serviceId) this.pickingFor.set(null);
        this.toast.success(`«${updated.serviceName}» ya usa «${updated.assignment?.title ?? 'la encuesta elegida'}».`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = logic.importFailure(error, row.serviceName);
        if (failure.followUp === 'reload-list') {
          // The row changed elsewhere: nothing to retry; say so and show the fresh list.
          this.closePicker();
          this.toast.warning(failure.message, failure.title);
          this.load();
          return;
        }
        if (failure.followUp === 'reload-catalog') this.loadCatalog();
        const shown = logic.failureState(error, failure.title, failure.message);
        if (this.pickingFor()?.serviceId === row.serviceId) this.saveError.set(shown);
        else this.showWriteError(shown, () => this.openPicker(row));
      },
    });
  }

  /** Always asks first, also when retrying: a DELETE is never repeated without confirmation. */
  protected async remove(row: Row): Promise<void> {
    if (row.assignment === null || this.removing() !== null) return;
    if (!(await this.dialogs.confirm(logic.removeConfirmation(row)))) return;
    this.removing.set(row.serviceId);
    this.writeError.set(null);
    this.surveys.remove(row.serviceId).subscribe({
      next: () => {
        this.removing.set(null);
        this.replace({ ...row, assignment: null });
        this.toast.success(`«${row.serviceName}» vuelve a la encuesta base de servicios.`);
      },
      error: (error: unknown) => {
        this.removing.set(null);
        const failure = logic.removeFailure(error, row.serviceName);
        this.showWriteError(logic.failureState(error, failure.title, failure.message), () => void this.remove(row));
      },
    });
  }

  protected retryLastWrite(): void {
    this.writeError.set(null);
    this.retryWrite();
  }

  protected viewAppointment(data: ServiceSurveyAssignments): void {
    this.viewing.set(logic.appointmentQuestions(data));
  }

  protected viewService(row: Row): void {
    const entry = this.entryFor(row.assignment?.catalogCode);
    if (entry !== null) this.viewing.set(logic.serviceQuestions(row, entry));
  }

  /** The refusal's text and its door, if any (S5 drawn with our own title). */
  protected refusalMessage(state: ViewState<never>): string {
    return state.status === 'forbidden' ? (state.message ?? '') : '';
  }

  protected refusalCode(state: ViewState<never>): string | null {
    return state.status === 'forbidden' ? (state.requestId ?? null) : null;
  }

  protected refusalAction(state: ViewState<never>): { label: string; route: string } | null {
    return state.status === 'forbidden' && state.nextAction?.route ? { label: state.nextAction.label, route: state.nextAction.route } : null;
  }

  private showWriteError(failure: logic.ShownFailure, retry: () => void): void {
    this.retryWrite = retry;
    this.writeError.set(failure);
  }

  private replace(next: Row): void {
    this.state.update((current) => (current.status === 'ready' ? ready(logic.withRow(current.data, next)) : current));
  }
}
