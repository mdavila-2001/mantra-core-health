import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { SurveysServiceAssignmentsClient } from '../../../core/data-access/surveys/surveys-service-assignments.client';
import type {
  ServiceSurveyAssignments,
  ServiceSurveyRow as Row,
  StandardSurvey,
} from '../../../core/data-access/surveys/surveys-service-assignments.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { MY_SERVICES_ROUTE } from '../../billing-setup/consultation-price-block/consultation-price-block';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { EmptyState } from '../../../shared/components/molecules/empty-state/empty-state';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { ServiceSurveyRow } from './service-survey-row';
import { appointmentQuestions, importFailure, questionCount, removeFailure, serviceKindOf, serviceQuestions, withRow, type QuestionsView } from './service-surveys.logic';
import { SurveyCatalogPicker } from './survey-catalog-picker';
import { SurveyQuestionsDialog } from './survey-questions-dialog';

/**
 * «Encuestas por servicio» (06/11/2026). Fixed «Cita médica» row (system survey,
 * mandatory, view only), then one row per service of the practitioner. Import or
 * change opens the standard catalog → PUT; remove asks first → DELETE. After a
 * change the row is the one the server returned. Authorization stays in the API.
 */
@Component({
  selector: 'app-service-surveys',
  imports: [AppButton, Badge, EmptyState, NavIcon, RouterLink, ServiceSurveyRow, Skeleton, SurveyCatalogPicker, SurveyQuestionsDialog, ViewStateHost],
  templateUrl: './service-surveys.html',
  styleUrl: './service-surveys.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceSurveys {
  private readonly surveys = inject(SurveysServiceAssignmentsClient);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);

  protected readonly myServicesRoute = MY_SERVICES_ROUTE;
  protected readonly questionCount = questionCount;

  private readonly state = signal<ViewState<ServiceSurveyAssignments>>(loading());
  protected readonly view = this.state.asReadonly();
  private readonly catalogState = signal<ViewState<readonly StandardSurvey[]>>(loading());
  protected readonly catalogView = this.catalogState.asReadonly();
  protected readonly catalog = computed(() => dataOf(this.catalogView()) ?? []);
  /** Why nothing can be imported right now, if the catalog did not load or is empty. */
  protected readonly catalogProblem = computed(() => {
    const status = this.catalogView().status;
    return status === 'ready' || status === 'loading' ? null : status;
  });

  protected readonly pickingFor = signal<Row | null>(null);
  protected readonly pickedKind = computed(() => {
    const row = this.pickingFor();
    return row === null ? 'OTHER' : serviceKindOf(row.serviceName, row.serviceKind);
  });
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly removing = signal<string | null>(null);
  protected readonly viewing = signal<QuestionsView | null>(null);

  constructor() {
    this.load();
    this.loadCatalog();
  }

  protected load(): void {
    this.state.set(loading());
    this.surveys.list().subscribe({
      next: (assignments) => this.state.set(ready(assignments)),
      error: (error: unknown) => this.state.set(errorToViewState(error)),
    });
  }

  /** Loaded on its own: a catalog failure does not hide the list. An empty catalog is its own S3. */
  protected loadCatalog(): void {
    this.catalogState.set(loading());
    this.surveys.listStandardCatalog().subscribe({
      next: (entries) =>
        this.catalogState.set(
          entries.length === 0
            ? empty({ label: 'Mientras tanto, cada servicio usa la encuesta base de servicios' }, 'Todavía no hay encuestas estándar para importar.')
            : ready(entries),
        ),
      error: (error: unknown) => this.catalogState.set(errorToViewState(error)),
    });
  }

  protected entryFor(code: string | null | undefined): StandardSurvey | null {
    return this.catalog().find((entry) => entry.code === code) ?? null;
  }

  protected openPicker(row: Row): void {
    this.saveError.set(null);
    this.pickingFor.set(row);
  }

  /** Always clears the selection: a save still in flight reports through a toast. */
  protected closePicker(): void {
    this.pickingFor.set(null);
    this.saveError.set(null);
  }

  protected importSurvey(catalogCode: string): void {
    const row = this.pickingFor();
    if (row === null || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.surveys.assign(row.serviceId, catalogCode).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.replace(updated);
        if (this.pickingFor()?.serviceId === row.serviceId) this.pickingFor.set(null);
        this.toast.success(`«${updated.serviceName}» ya usa «${updated.assignment?.title ?? 'la encuesta elegida'}».`);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const failure = importFailure(error);
        const stillOpen = this.pickingFor()?.serviceId === row.serviceId;
        if (failure.followUp === 'reload-catalog') this.loadCatalog();
        if (failure.followUp === 'reload-list') {
          // The row changed elsewhere: the open picker would show stale data.
          this.closePicker();
          this.load();
        }
        if (stillOpen && failure.followUp !== 'reload-list') this.saveError.set(failure.message);
        else this.toast.error(failure.message);
      },
    });
  }

  protected async remove(row: Row): Promise<void> {
    if (row.assignment === null || this.removing() !== null) return;
    const confirmed = await this.dialogs.confirm({
      title: 'Quitar la encuesta del servicio',
      message: `«${row.serviceName}» deja de usar «${row.assignment.title}». Desde ahora sus pacientes recibirán la encuesta base de servicios. Las respuestas que ya recibió no se borran.`,
      confirmLabel: 'Quitar',
      destructive: true,
    });
    if (!confirmed) return;
    this.removing.set(row.serviceId);
    this.surveys.remove(row.serviceId).subscribe({
      next: () => {
        this.removing.set(null);
        this.replace({ ...row, assignment: null });
        this.toast.success(`«${row.serviceName}» vuelve a la encuesta base de servicios.`);
      },
      error: (error: unknown) => {
        this.removing.set(null);
        this.toast.error(removeFailure(error).message);
      },
    });
  }

  protected viewAppointment(data: ServiceSurveyAssignments): void {
    this.viewing.set(appointmentQuestions(data));
  }

  protected viewService(row: Row): void {
    const entry = this.entryFor(row.assignment?.catalogCode);
    if (entry !== null) this.viewing.set(serviceQuestions(row, entry));
  }

  private replace(next: Row): void {
    this.state.update((current) => (current.status === 'ready' ? ready(withRow(current.data, next)) : current));
  }
}
