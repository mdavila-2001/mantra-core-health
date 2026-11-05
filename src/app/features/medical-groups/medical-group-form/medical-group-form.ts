import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { MedicalGroupsClient } from '../../../core/data-access/medical-groups/medical-groups.client';
import type {
  MedicalGroupConditionOption,
  NewMedicalGroup,
} from '../../../core/data-access/medical-groups/medical-groups.types';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { PatientListItem } from '../../../core/data-access/profiles/profiles.types';
import { ServicesCatalogClient } from '../../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ServiceCatalogItem,
} from '../../../core/data-access/services-catalog/services-catalog.types';
import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { medicalGroupRoute } from '../medical-groups.routes';

/** Tope de los buscadores de paciente y servicio, igual que en cotizaciones. */
const SEARCH_LIMIT = 25;
/** Lo que acepta la API en `agreedPaymentAmount`: positivo, hasta dos decimales. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/** Una fila del equipo, mientras se arma. */
interface TeamRow {
  readonly key: number;
  readonly practitionerProfileId: string | null;
  readonly roleTitle: string;
  readonly agreedPaymentAmount: string;
  readonly additionalTermsText: string;
}

/**
 * **Crear grupo médico** (FT-21, carril 21).
 *
 * El grupo apunta a un servicio del catálogo y opcionalmente a un paciente y a
 * uno de sus diagnósticos. El equipo es el conjunto de cargos: cada uno con el
 * profesional invitado, el pago acordado y, si hace falta, términos propios.
 *
 * ## Una tarjeta con pestañas
 *
 * El formulario es UNA `app-card` centrada con tres pestañas —Servicio y
 * paciente, Fecha y lugar, Equipo— y el botón de crear fuera de ellas
 * (`composition-rules.md` §5). Los valores viven en señales de este componente
 * y no en los controles, porque `app-tab` no dibuja el panel cerrado.
 *
 * ## Lo que reusa
 *
 * - Paciente y servicio: el mismo par buscador + tabla que el alta de
 *   cotización (`quotation-form.ts`), sobre los mismos clientes.
 * - Colegas: `GET /medical-groups/eligible-members`, la misma regla con que
 *   la API valida cada invitado (misma organización que el servicio, sin
 *   quien crea el grupo, que entra solo como miembro aceptado).
 * - Diagnósticos: `GET /medical-groups/patients/:id/conditions`. Se propone el
 *   último **sólo** si la API lo marca `isMostRecent` (es la que sabe si se
 *   puede determinar sin ambigüedad) y la persona lo puede cambiar.
 *
 * Toda regla de negocio la valida la API: que el servicio sea de una práctica
 * propia, que haya base clínica sobre el paciente, el formato del pago.
 */
@Component({
  selector: 'app-medical-group-form',
  imports: [
    Alert,
    AppButton,
    Card,
    DataTable,
    DatePicker,
    FormField,
    Input,
    PageHeader,
    SearchField,
    Select,
    Tab,
    Tabs,
    Textarea,
  ],
  templateUrl: './medical-group-form.html',
  styleUrl: './medical-group-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalGroupForm {
  private readonly groups = inject(MedicalGroupsClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly patientActionCell =
    viewChild.required<TemplateRef<{ $implicit: PatientListItem }>>('patientActionCell');
  private readonly serviceActionCell =
    viewChild.required<TemplateRef<{ $implicit: ServiceCatalogItem }>>('serviceActionCell');

  /* ---- práctica y servicio ------------------------------------------------- */

  private readonly practices = toSignal(
    this.catalog.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
  );
  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    (this.practices() ?? []).map((practice) => ({ value: practice.id, label: practice.name })),
  );
  protected readonly selectedPractice = linkedSignal<
    readonly Practice[] | undefined,
    string | null
  >({
    source: this.practices,
    computation: (practices) => practices?.[0]?.id ?? null,
  });
  protected readonly mustChoosePractice = computed(() => (this.practices() ?? []).length > 1);

  protected readonly serviceQuery = signal('');
  protected readonly serviceResults = signal<ViewState<readonly ServiceCatalogItem[]>>(
    empty({ label: 'Escriba para buscar' }, 'Busque el servicio de salud por código o nombre.'),
  );
  protected readonly selectedService = signal<ServiceCatalogItem | null>(null);

  protected readonly serviceColumns = computed<readonly ColumnDef<ServiceCatalogItem>[]>(() => [
    { key: 'code', header: 'Código', priority: 2 },
    { key: 'name', header: 'Servicio', priority: 1 },
    { key: 'accion', header: '', priority: 1, cell: this.serviceActionCell() },
  ]);
  protected readonly byServiceId = (row: ServiceCatalogItem): string => row.id;
  protected readonly serviceName = (row: ServiceCatalogItem): string => row.name;

  constructor() {
    // El catálogo se lista apenas se conoce la práctica, sin esperar a que la
    // persona escriba: con la lista vacía «Escriba para buscar» parecía que la
    // práctica no tenía servicios y no había nada que elegir. Al cambiar de
    // práctica se vuelve a leer, con lo que ya estaba escrito.
    effect(() => {
      if (this.selectedPractice() === null) return;
      untracked(() => this.searchService(this.serviceQuery()));
    });
  }

  protected changePractice(practiceId: string | null): void {
    this.selectedPractice.set(practiceId);
    this.selectedService.set(null);
  }

  protected searchService(text: string): void {
    this.serviceQuery.set(text);
    const practiceId = this.selectedPractice();
    if (practiceId === null) {
      this.serviceResults.set(
        empty({ label: 'Elegir una práctica' }, 'Elija una práctica para ver su catálogo.'),
      );
      return;
    }
    this.serviceResults.set(loading());
    this.catalog
      .search(practiceId, {
        limit: SEARCH_LIMIT,
        isActive: true,
        ...(text === '' ? {} : { query: text }),
      })
      .subscribe({
        next: (page) =>
          this.serviceResults.set(
            page.items.length > 0
              ? ready(page.items)
              : empty(
                  { label: 'Volver a buscar' },
                  text === ''
                    ? 'Esta práctica todavía no tiene servicios en su catálogo.'
                    : `Ningún servicio coincide con «${text}».`,
                ),
          ),
        error: (error: unknown) =>
          this.serviceResults.set(errorToViewState<readonly ServiceCatalogItem[]>(error)),
      });
  }

  protected chooseService(service: ServiceCatalogItem): void {
    this.selectedService.set(service);
    this.loadColleagues(service.id);
  }

  protected changeService(): void {
    this.selectedService.set(null);
    this.colleagues.set(null);
    // Los invitados elegidos valían para la organización del servicio anterior.
    this.team.update((rows) => rows.map((row) => ({ ...row, practitionerProfileId: null })));
  }

  private loadColleagues(serviceCatalogId: string): void {
    this.colleagues.set(loading());
    this.groups.listEligibleMembers(serviceCatalogId).subscribe({
      next: (members) =>
        this.colleagues.set(
          ready(
            members.map((member) => ({
              value: member.practitionerProfileId,
              label: member.name ?? 'Profesional sin nombre cargado',
            })),
          ),
        ),
      error: (error: unknown) =>
        this.colleagues.set(errorToViewState<readonly SelectOption<string>[]>(error)),
    });
  }

  /* ---- paciente y diagnóstico (opcionales) --------------------------------- */

  protected readonly patientQuery = signal('');
  protected readonly patientResults = signal<ViewState<readonly PatientListItem[]>>(
    empty({ label: 'Escriba para buscar' }, 'Opcional. Busque al paciente por nombre o código.'),
  );
  protected readonly selectedPatient = signal<PatientListItem | null>(null);
  protected readonly conditions = signal<ViewState<readonly MedicalGroupConditionOption[]> | null>(
    null,
  );
  protected readonly selectedCondition = signal<string | null>(null);

  protected readonly patientColumns = computed<readonly ColumnDef<PatientListItem>[]>(() => [
    { key: 'displayName', header: 'Paciente', priority: 1 },
    { key: 'patientCode', header: 'Código', priority: 2 },
    { key: 'accion', header: '', priority: 1, cell: this.patientActionCell() },
  ]);
  protected readonly byPatientId = (row: PatientListItem): string => row.profileId;
  protected readonly patientName = (row: PatientListItem): string => row.displayName ?? '';

  protected readonly conditionOptions = computed<readonly SelectOption<string>[]>(() => {
    const state = this.conditions();
    if (state?.status !== 'ready') return [];
    return state.data.map((condition) => ({
      value: condition.id,
      label: `${condition.display} (${condition.code})`,
    }));
  });
  protected readonly conditionsUnavailable = computed(() => {
    const state = this.conditions();
    return state !== null && state.status !== 'ready' && state.status !== 'loading';
  });

  protected searchPatient(text: string): void {
    this.patientQuery.set(text);
    if (text.trim() === '') {
      this.patientResults.set(
        empty(
          { label: 'Escriba para buscar' },
          'Opcional. Busque al paciente por nombre o código.',
        ),
      );
      return;
    }
    this.patientResults.set(loading());
    this.profiles.searchPatients({ query: text, limit: SEARCH_LIMIT }).subscribe({
      next: (page) =>
        this.patientResults.set(
          page.items.length > 0
            ? ready(page.items)
            : empty({ label: 'Volver a buscar' }, `Nadie coincide con «${text}».`),
        ),
      error: (error: unknown) =>
        this.patientResults.set(errorToViewState<readonly PatientListItem[]>(error)),
    });
  }

  /** Primero el paciente, después sus diagnósticos (AC-21-05). */
  protected choosePatient(patient: PatientListItem): void {
    this.selectedPatient.set(patient);
    this.selectedCondition.set(null);
    this.conditions.set(loading());
    this.groups.listPatientConditions(patient.profileId).subscribe({
      next: (items) => {
        this.conditions.set(ready(items));
        // Se propone el último sólo si la API lo pudo determinar sin ambigüedad.
        const mostRecent = items.filter((item) => item.isMostRecent);
        if (mostRecent.length === 1) this.selectedCondition.set(mostRecent[0]!.id);
      },
      error: (error: unknown) =>
        this.conditions.set(errorToViewState<readonly MedicalGroupConditionOption[]>(error)),
    });
  }

  protected removePatient(): void {
    this.selectedPatient.set(null);
    this.selectedCondition.set(null);
    this.conditions.set(null);
  }

  /* ---- fecha, lugar, notas y términos -------------------------------------- */

  protected readonly scheduledAt = signal<Date | null>(null);
  protected readonly minDate = new Date();
  protected readonly locationText = signal('');
  protected readonly notesText = signal('');
  protected readonly additionalTermsText = signal('');

  /* ---- equipo --------------------------------------------------------------- */

  private nextKey = 1;
  protected readonly team = signal<readonly TeamRow[]>([this.blankRow()]);

  /**
   * Los colegas que se pueden invitar dependen del servicio: la API acepta
   * sólo a los de la misma organización que su práctica. Sin servicio
   * elegido no hay a quién ofrecer.
   */
  protected readonly colleagues = signal<ViewState<readonly SelectOption<string>[]> | null>(null);
  protected readonly colleaguesFailed = computed(() => {
    const state = this.colleagues();
    return state !== null && state.status !== 'ready' && state.status !== 'loading';
  });
  protected readonly colleagueOptions = computed<readonly SelectOption<string>[]>(() => {
    const state = this.colleagues();
    return state?.status === 'ready' ? state.data : [];
  });

  protected readonly colleaguesPlaceholder = computed(() => {
    const state = this.colleagues();
    if (state === null) return 'Primero elija el servicio';
    if (state.status === 'loading') return 'Cargando colegas…';
    if (state.status === 'ready' && state.data.length === 0) return 'Nadie más en su organización';
    return 'Elija un colega';
  });

  protected addMember(): void {
    this.team.update((rows) => [...rows, this.blankRow()]);
  }

  protected removeMember(key: number): void {
    this.team.update((rows) => rows.filter((row) => row.key !== key));
  }

  protected updateMember(key: number, change: Partial<Omit<TeamRow, 'key'>>): void {
    this.team.update((rows) => rows.map((row) => (row.key === key ? { ...row, ...change } : row)));
  }

  /** Lo que emite `app-input` (texto, número o nada), como texto. */
  protected text(value: string | number | null): string {
    return value === null ? '' : String(value);
  }

  protected amountProblem(row: TeamRow): string {
    const amount = row.agreedPaymentAmount.trim();
    if (amount === '' || AMOUNT_PATTERN.test(amount)) return '';
    return 'Ingrese un monto positivo, con hasta dos decimales.';
  }

  /** Una fila vacía no se manda: el equipo puede ser sólo quien crea el grupo. */
  private readonly filledRows = computed(() =>
    this.team().filter(
      (row) =>
        row.practitionerProfileId !== null ||
        row.roleTitle.trim() !== '' ||
        row.agreedPaymentAmount.trim() !== '',
    ),
  );

  private readonly teamProblem = computed<string | null>(() => {
    for (const row of this.filledRows()) {
      if (row.practitionerProfileId === null) return 'Elija al profesional de cada cargo.';
      if (row.roleTitle.trim() === '') return 'Escriba el cargo o función de cada integrante.';
      if (!AMOUNT_PATTERN.test(row.agreedPaymentAmount.trim())) {
        return 'El pago acordado de cada cargo tiene que ser un monto positivo, con hasta dos decimales.';
      }
    }
    const ids = this.filledRows().map((row) => row.practitionerProfileId);
    if (new Set(ids).size !== ids.length) return 'Un mismo profesional no puede ocupar dos cargos.';
    return null;
  });

  /* ---- guardar -------------------------------------------------------------- */

  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  /** La pestaña a la vista. Como `app-tab` no dibuja el cerrado, el estado vive acá. */
  protected readonly tab = signal(0);

  /** La pestaña donde vive el primer pendiente: 0 servicio, 1 fecha y lugar, 2 equipo. */
  private readonly problemTab = computed(() => {
    if (this.selectedService() === null) return 0;
    if (this.scheduledAt() === null || this.locationText().trim() === '') return 1;
    return 2;
  });

  protected readonly missing = computed<string | null>(() => {
    if (this.selectedService() === null) return 'Elija el servicio de salud.';
    if (this.scheduledAt() === null) return 'Elija la fecha y la hora de realización.';
    if (this.locationText().trim() === '') return 'Escriba el lugar de realización.';
    return this.teamProblem();
  });

  protected save(): void {
    const problem = this.missing();
    if (problem !== null) {
      this.saveError.set(problem);
      // El pendiente puede estar en una pestaña cerrada: se lleva a la persona hasta ahí.
      this.tab.set(this.problemTab());
      return;
    }
    if (this.saving()) return;

    const service = this.selectedService()!;
    const patient = this.selectedPatient();
    const condition = this.selectedCondition();
    const notes = this.notesText().trim();
    const terms = this.additionalTermsText().trim();

    const group: NewMedicalGroup = {
      serviceCatalogId: service.id,
      ...(patient === null ? {} : { patientProfileId: patient.profileId }),
      ...(patient === null || condition === null ? {} : { conditionId: condition }),
      scheduledAt: this.scheduledAt()!.toISOString(),
      locationText: this.locationText().trim(),
      ...(notes === '' ? {} : { notesText: notes }),
      ...(terms === '' ? {} : { additionalTermsText: terms }),
      members: this.filledRows().map((row) => {
        const rowTerms = row.additionalTermsText.trim();
        return {
          practitionerProfileId: row.practitionerProfileId!,
          roleTitle: row.roleTitle.trim(),
          agreedPaymentAmount: row.agreedPaymentAmount.trim(),
          ...(rowTerms === '' ? {} : { additionalTermsText: rowTerms }),
        };
      }),
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.groups.create(group).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.toasts.success(
          created.members.some((member) => !member.isCreator)
            ? 'Las invitaciones quedaron enviadas al equipo.'
            : 'El grupo quedó programado.',
          'Grupo médico creado',
        );
        void this.router.navigateByUrl(medicalGroupRoute(created.id));
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(serverMessage(error));
      },
    });
  }

  private blankRow(): TeamRow {
    return {
      key: this.nextKey++,
      practitionerProfileId: null,
      roleTitle: '',
      agreedPaymentAmount: '',
      additionalTermsText: '',
    };
  }
}

function serverMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = readApiError(error);
    if (body !== null && body.message !== '') return body.message;
  }
  return 'No pudimos crear el grupo médico. Pruebe de nuevo.';
}
