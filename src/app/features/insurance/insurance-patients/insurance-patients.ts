import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, map, of, Subject, switchMap } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  InsurerPatientListItem,
  InsurerPatientPage,
  InsurerPatientQuery,
} from '../../../core/data-access/insurance/insurance.types';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { readApiError } from '../../../core/http/api-error';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { SearchMemoryService } from '../../../core/navigation/search-memory.service';
import {
  empty,
  loading,
  ready,
  routeAuthPending,
  validation,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Chip } from '../../../shared/components/atoms/chip/chip';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Skeleton } from '../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { historialDeCursor } from '../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

export const INSURER_PATIENTS_ROUTE = '/administration/insurance-patients';
const GENDER_LABELS: Readonly<Record<string, string>> = {
  GENDER_MALE: 'Masculino',
  GENDER_FEMALE: 'Femenino',
  GENDER_OTHER: 'Otro',
  GENDER_UNKNOWN: 'No especificado',
};
const PAGE_SIZES = [10, 25, 50];
const EMPTY_FILTERS = {
  search: '',
  genderConceptId: '',
  insurance: '',
  occupation: '',
  birthDateFrom: '',
  birthDateTo: '',
};
type DirectoryFilters = typeof EMPTY_FILTERS;
type FilterKey = keyof DirectoryFilters;

/** Una fecha civil nunca se convierte a UTC. */
function dateOnly(date: Date | null): string {
  return date === null
    ? ''
    : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function asDate(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Directorio administrativo y de aseguradora: la API determina el alcance. */
@Component({
  selector: 'app-insurance-patients',
  imports: [
    NgTemplateOutlet,
    Badge,
    AppButton,
    Chip,
    Select,
    Skeleton,
    Alert,
    SearchField,
    FormField,
    DataTable,
    DatePicker,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './insurance-patients.html',
  styleUrl: './insurance-patients.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurancePatients {
  private readonly insurance = inject(InsuranceClient);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly systemContext = inject(SystemContextClient);
  private readonly navigation = inject(NavigationService);
  private readonly memory = inject(SearchMemoryService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  private readonly memoryKey = computed(
    () => `insurer-patients:${this.session.userId() ?? ''}:${this.session.activeTenantId() ?? ''}`,
  );
  protected readonly criteria = signal<DirectoryFilters>({
    ...EMPTY_FILTERS,
    ...this.memory.read(this.memoryKey()),
  });
  protected readonly pageSize = signal(25);
  protected readonly pageSizeOptions = PAGE_SIZES.map((value) => ({
    value: String(value),
    label: `${value} por página`,
  }));
  protected readonly listing =
    signal<ViewState<readonly InsurerPatientListItem[]>>(routeAuthPending());
  protected readonly total = signal<number | null>(null);
  protected readonly rows = computed(() => {
    const state = this.listing();
    return state.status === 'ready' || state.status === 'stale' ? state.data : [];
  });
  protected readonly loadingNow = computed(() => this.listing().status === 'loading');
  protected readonly hasFilters = computed(() => Object.values(this.criteria()).some(Boolean));
  protected readonly birthFrom = computed(() => asDate(this.criteria().birthDateFrom));
  protected readonly birthTo = computed(() => asDate(this.criteria().birthDateTo));
  protected readonly genderOptions = signal<readonly SelectOption<string>[]>([
    { value: '', label: 'Todos' },
  ]);
  protected readonly insuranceOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly catalogError = signal(false);
  protected readonly genderError = signal(false);
  protected readonly authorized = signal(false);
  protected readonly notice = signal('');
  protected readonly chatError = signal('');
  protected readonly opening = signal<string | null>(null);
  private readonly paging = historialDeCursor();
  protected readonly cursor = this.paging.cursor;
  private readonly requests = new Subject<InsurerPatientQuery | null>();
  private readonly optionRequests = new Subject<void>();
  private readonly genderRequests = new Subject<void>();
  private readonly conversations = new Subject<InsurerPatientListItem | null>();
  protected readonly byProfile = (row: InsurerPatientListItem) => row.patientProfileId;
  protected readonly rowName = (row: InsurerPatientListItem) => row.fullName;

  private readonly patientCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('patientCell');
  private readonly phoneCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('phoneCell');
  private readonly emailCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('emailCell');
  private readonly birthCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('birthCell');
  private readonly genderCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('genderCell');
  private readonly occupationCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('occupationCell');
  private readonly insuranceCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('insuranceCell');
  protected readonly columns = computed<readonly ColumnDef<InsurerPatientListItem>[]>(() => [
    { key: 'fullName', header: 'Nombre completo', priority: 1, cell: this.patientCell() },
    { key: 'birthDate', header: 'Fecha de nacimiento', priority: 1, cell: this.birthCell() },
    { key: 'phone', header: 'Teléfono', priority: 1, cell: this.phoneCell() },
    { key: 'email', header: 'Correo electrónico', priority: 1, cell: this.emailCell() },
    { key: 'genderCode', header: 'Sexo', priority: 1, cell: this.genderCell() },
    { key: 'occupationDisplay', header: 'Profesión', priority: 1, cell: this.occupationCell() },
    { key: 'insurers', header: 'Seguro', priority: 1, cell: this.insuranceCell() },
  ]);
  protected readonly activeFilters = computed(() => {
    const labels: Record<FilterKey, string> = {
      search: 'Búsqueda',
      genderConceptId: 'Sexo',
      insurance: 'Seguro',
      occupation: 'Profesión',
      birthDateFrom: 'Desde',
      birthDateTo: 'Hasta',
    };
    return (Object.keys(EMPTY_FILTERS) as FilterKey[])
      .filter((key) => this.criteria()[key] !== '')
      .map((key) => {
        const value = this.criteria()[key];
        const options = key === 'genderConceptId' ? this.genderOptions() : this.insuranceOptions();
        const display =
          key === 'genderConceptId' || key === 'insurance'
            ? (options.find((option) => option.value === value)?.label ?? 'Seleccionado')
            : key === 'birthDateFrom' || key === 'birthDateTo'
              ? this.formatBirth(value)
              : value;
        return { key, label: `${labels[key]}: ${display}` };
      });
  });

  constructor() {
    this.requests
      .pipe(
        switchMap((query) => {
          if (query === null) return of(null);
          return this.insurance.listInsurerPatients(query).pipe(
            map((page) => ({ page, state: this.stateOf(page) })),
            catchError((error: unknown) =>
              of({ page: null, state: errorToViewState<readonly InsurerPatientListItem[]>(error) }),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        if (result === null) return;
        this.total.set(result.page?.total ?? null);
        this.paging.llego(result.page?.nextCursor ?? null);
        this.listing.set(result.state);
      });
    this.optionRequests
      .pipe(
        switchMap(() =>
          this.insurance.patientDirectoryOptions().pipe(
            map((options) => ({ options, failure: null })),
            catchError((error: unknown) =>
              of({
                options: null,
                failure: errorToViewState<readonly InsurerPatientListItem[]>(error),
              }),
            ),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.catalogError.set(result.options === null);
        if (result.options === null) {
          this.authorized.set(false);
          if (result.failure) this.listing.set(result.failure);
          return;
        }
        this.insuranceOptions.set([
          { value: '', label: 'Todos' },
          { value: 'NO_INSURANCE', label: 'Sin seguro / Ninguno' },
          ...result.options.insurers.map((carrier) => ({ value: carrier.id, label: carrier.name })),
        ]);
        this.authorized.set(true);
      });
    this.genderRequests
      .pipe(
        switchMap(() =>
          this.systemContext
            .dynamicEnum('profiles.persons.administrative_gender_concept_id')
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((gender) => {
        this.genderError.set(gender === null);
        this.genderOptions.set([
          { value: '', label: 'Todos' },
          ...(gender?.options ?? [])
            .filter((option) =>
              ['GENDER_MALE', 'GENDER_FEMALE', 'GENDER_OTHER'].includes(option.code),
            )
            .map((option) => ({ value: option.conceptId, label: GENDER_LABELS[option.code] })),
        ]);
      });
    this.conversations
      .pipe(
        switchMap((row) =>
          row === null
            ? of(null)
            : this.insurance
                .openPatientConversation(row.patientProfileId, row.messaging.channel)
                .pipe(
                  map((result) => ({ result, message: '' })),
                  catchError((error: unknown) =>
                    of({
                      result: null,
                      message:
                      error instanceof HttpErrorResponse && readApiError(error)?.code === 'PRECONDITION_FAILED'
                          ? 'Para conversar, ambos deben tener la mensajería activa y permitir el contacto. Revise su perfil de mensajería.'
                          : 'No pudimos abrir la conversación. Verifique que el paciente siga disponible e intente nuevamente.',
                    }),
                  ),
                ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((response) => {
        if (response === null) return;
        this.opening.set(null);
        if (response.result)
          void this.router.navigate(['/messaging', response.result.conversationId]);
        else this.chatError.set(response.message);
      });
    // Un cambio de actor/organización descarta respuestas en vuelo antes de autorizar otra lectura.
    effect(() => {
      const key = this.memoryKey();
      if (!this.isBrowser) return;
      untracked(() => {
        this.requests.next(null);
        this.conversations.next(null);
        this.opening.set(null);
        this.chatError.set('');
        this.insuranceOptions.set([]);
        this.authorized.set(false);
        this.listing.set(routeAuthPending());
        this.total.set(null);
        this.criteria.set({ ...EMPTY_FILTERS, ...this.memory.read(key) });
        this.optionRequests.next();
        this.genderRequests.next();
      });
    });
    effect(() => {
      const authorized = this.authorized();
      const criteria = this.criteria();
      this.pageSize();
      untracked(() => {
        this.memory.write(this.memoryKey(), criteria);
        this.paging.reiniciar();
        if (authorized) this.load();
      });
    });
  }

  protected setFilter(key: FilterKey, value: string | null): void {
    this.criteria.update((current) => ({ ...current, [key]: value ?? '' }));
  }
  protected onSearch(value: string): void {
    this.setFilter('search', value.trim());
  }
  protected onBirthFrom(value: Date | null): void {
    this.setFilter('birthDateFrom', dateOnly(value));
  }
  protected onBirthTo(value: Date | null): void {
    this.setFilter('birthDateTo', dateOnly(value));
  }
  protected onPageSize(value: string | null): void {
    this.pageSize.set(PAGE_SIZES.includes(Number(value)) ? Number(value) : 25);
  }
  protected resetFilters(): void {
    this.criteria.set({ ...EMPTY_FILTERS });
  }
  protected move(cursor: string): void {
    this.paging.mover(cursor);
    this.load();
  }
  protected reload(): void {
    if (this.authorized()) this.load();
    else {
      this.listing.set(routeAuthPending());
      this.optionRequests.next();
    }
  }
  protected reloadGender(): void {
    this.genderRequests.next();
  }
  protected genderFull(code?: string): string {
    return GENDER_LABELS[code ?? ''] ?? 'No especificado';
  }
  protected formatBirth(value: string): string {
    return value.split('-').reverse().join('/');
  }
  protected formatPhone(value: string): string {
    const digits = value.replace(/[^\d+]/g, '');
    return /^\+591\d{8}$/.test(digits)
      ? `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`
      : value;
  }
  protected telHref(value: string): string {
    return `tel:${value.replace(/[^\d+]/g, '')}`;
  }
  protected async copyContact(value: string, kind: 'Teléfono' | 'Correo'): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      this.notice.set(`${kind} copiado.`);
    } catch {
      this.notice.set('No pudimos copiar. Seleccione el dato y cópielo a mano.');
    }
  }
  protected message(row: InsurerPatientListItem): void {
    if (!row.messaging.available || this.opening() !== null) return;
    this.chatError.set('');
    this.opening.set(row.patientProfileId);
    this.conversations.next(row);
  }

  private load(): void {
    this.requests.next(null);
    this.total.set(null);
    const criteria = this.criteria();
    if (
      criteria.birthDateFrom &&
      criteria.birthDateTo &&
      criteria.birthDateFrom > criteria.birthDateTo
    ) {
      this.listing.set(
        validation([
          { field: 'Fecha de nacimiento', message: 'Desde debe ser anterior o igual a Hasta.' },
        ]),
      );
      return;
    }
    this.listing.set(loading());
    this.requests.next({
      limit: this.pageSize(),
      search: criteria.search,
      genderConceptId: criteria.genderConceptId,
      occupation: criteria.occupation,
      birthDateFrom: criteria.birthDateFrom,
      birthDateTo: criteria.birthDateTo,
      ...(criteria.insurance === 'NO_INSURANCE'
        ? { insuranceStatus: 'NO_INSURANCE' as const }
        : { insuranceCarrierId: criteria.insurance }),
      cursor: this.paging.actual(),
    });
  }
  private stateOf(page: InsurerPatientPage): ViewState<readonly InsurerPatientListItem[]> {
    if (page.items.length) return ready(page.items);
    return this.hasFilters()
      ? empty(
          { label: 'Restablecer filtros' },
          'No se encontraron pacientes con los filtros seleccionados',
        )
      : empty(
          { label: 'Actualizar directorio' },
          'Todavía no hay pacientes disponibles en su directorio autorizado.',
        );
  }
}
