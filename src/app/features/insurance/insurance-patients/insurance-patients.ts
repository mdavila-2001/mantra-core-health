import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationSkipped, Router } from '@angular/router';
import { catchError, filter, forkJoin, map, of } from 'rxjs';

import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type {
  InsurerPatientInsuranceStatus,
  InsurerPatientListItem,
  InsurerPatientPage,
} from '../../../core/data-access/insurance/insurance.types';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { BoOccupationsCatalog } from '../../../core/data-access/terminology/bo-occupations.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { SearchMemoryService } from '../../../core/navigation/search-memory.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { historialDeCursor } from '../../../shared/components/organisms/data-table/cursor-history';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { DatePicker } from '../../../shared/components/organisms/date-picker/date-picker';
import {
  FilterBar,
  type FilterDef,
} from '../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';

/** Ruta de esta pantalla. La usa también «Ver todos los pacientes» del vacío. */
export const INSURER_PATIENTS_ROUTE = '/administration/insurance-patients';
/** Ruta del chat interno. Acepta `?escribirA=<slug>`. */
const MESSAGING_ROUTE = '/messaging';

/** Entrada de esta pantalla en {@link SearchMemoryService}. */
const SEARCH_MEMORY_SCREEN = 'insurer-patients';

/** Claves de filtro en la URL: las mismas que recibe `GET /insurance/patients`. */
const PARAM_GENDER = 'genderConceptId';
const PARAM_OCCUPATION = 'occupationConceptId';
const PARAM_INSURANCE = 'insuranceStatus';
const PARAM_BIRTH_FROM = 'birthDateFrom';
const PARAM_BIRTH_TO = 'birthDateTo';

const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

/** Estado de seguro, en palabras de quien opera. «Todos» es no filtrar. */
const INSURANCE_OPTIONS: readonly SelectOption<string>[] = [
  { value: 'WITH_INSURANCE', label: 'Con seguro' },
  { value: 'NO_INSURANCE', label: 'Sin seguro' },
];

/**
 * Las palabras de cada código de sexo administrativo. El catálogo rotula en
 * inglés técnico («Administrative gender female»): se mapea por **código**,
 * que sobrevive a un re-seed, igual que el alta de paciente.
 */
const GENDER_LABELS: Readonly<Record<string, string>> = {
  GENDER_MALE: 'Masculino',
  GENDER_FEMALE: 'Femenino',
  GENDER_OTHER: 'Otro',
  GENDER_UNKNOWN: 'Sin especificar',
};

/** Abreviatura que ocupa la columna Sexo. */
const GENDER_SHORT: Readonly<Record<string, string>> = {
  GENDER_MALE: 'M',
  GENDER_FEMALE: 'F',
  GENDER_OTHER: 'Otro',
  GENDER_UNKNOWN: '—',
};

/** `YYYY-MM-DD` en hora local: una fecha civil no pasa por UTC. */
function toDateOnly(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Lo contrario de {@link toDateOnly}; `null` si el texto no es una fecha. */
function fromDateOnly(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `DD/MM/AAAA` desde `YYYY-MM-DD`, sin construir un `Date`. */
function formatDateOnly(text: string): string {
  const [year, month, day] = text.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Directorio de pacientes de la aseguradora activa.
 *
 * ## Qué muestra
 *
 * Los pacientes que tienen relación con **esta** aseguradora —una cobertura en
 * uno de sus planes o un reclamo presentado a ella— con su filiación y contacto.
 * El alcance lo resuelve el servidor por el tenant activo: esta pantalla no
 * manda ningún id de aseguradora.
 *
 * ## Qué vive en la URL y qué no
 *
 * Los filtros de catálogo y el rango de nacimiento **sí**: no identifican a
 * nadie y permiten compartir la búsqueda. El texto buscado **no**: es el
 * nombre, el teléfono, el correo o el documento de un paciente, y en la URL
 * quedaría en el historial, en los logs y en el `Referer` (mismo criterio que
 * el listado de pacientes, 2026-09-26). Va a {@link SearchMemoryService}.
 *
 * ## «Ninguno»
 *
 * El servidor dice `hasActiveCoverage: false` tanto para quien no tiene
 * cobertura como para quien la tiene vencida o sólo llegó por un reclamo. La
 * fila no distingue: para quien opera la aseguradora, «Ninguno» es «hoy no lo
 * cubrimos».
 *
 * ## «Escribir»
 *
 * Abre el chat interno con `?escribirA=<slug>`, que `Messaging` ya atiende.
 * Sin `communityProfileSlug` el paciente todavía no activó la mensajería: el
 * botón se ve deshabilitado y dice por qué.
 */
@Component({
  selector: 'app-insurance-patients',
  imports: [Avatar, Badge, AppButton, Select, Tooltip, DataTable, DatePicker, FilterBar, PageHeader],
  templateUrl: './insurance-patients.html',
  styleUrl: './insurance-patients.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsurancePatients {
  private readonly insurance = inject(InsuranceClient);
  private readonly systemContext = inject(SystemContextClient);
  private readonly occupations = inject(BoOccupationsCatalog);
  private readonly navigation = inject(NavigationService);
  private readonly searchMemory = inject(SearchMemoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

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
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: InsurerPatientListItem }>>('actionsCell');

  protected readonly listing = signal<ViewState<readonly InsurerPatientListItem[]>>(loading());

  /** El texto buscado. Vacío es «sin filtro». Arranca con lo que había en memoria. */
  protected readonly search = signal(this.searchMemory.read(SEARCH_MEMORY_SCREEN)['q'] ?? '');

  private readonly genderParam = this.paramSignal(PARAM_GENDER);
  private readonly occupationParam = this.paramSignal(PARAM_OCCUPATION);
  private readonly insuranceParam = this.paramSignal(PARAM_INSURANCE);
  private readonly birthFromParam = this.paramSignal(PARAM_BIRTH_FROM);
  private readonly birthToParam = this.paramSignal(PARAM_BIRTH_TO);

  protected readonly birthFrom = computed(() => fromDateOnly(this.birthFromParam()));
  protected readonly birthTo = computed(() => fromDateOnly(this.birthToParam()));

  private readonly genderOptions = signal<readonly SelectOption<string>[]>([]);
  private readonly occupationOptions = signal<readonly SelectOption<string>[]>([]);

  protected readonly filters = computed<readonly FilterDef[]>(() => [
    { key: PARAM_GENDER, label: 'Sexo', options: this.genderOptions() },
    { key: PARAM_OCCUPATION, label: 'Profesión', options: this.occupationOptions() },
    {
      key: PARAM_INSURANCE,
      label: 'Seguro',
      placeholder: 'Todos',
      options: INSURANCE_OPTIONS,
    },
  ]);

  protected readonly pageSizeOptions: readonly SelectOption<string>[] = PAGE_SIZES.map((size) => ({
    value: String(size),
    label: `${size} por página`,
  }));
  protected readonly pageSize = signal(DEFAULT_PAGE_SIZE);

  private readonly paginado = historialDeCursor();
  protected readonly cursor = this.paginado.cursor;

  /** Un aviso corto, siempre en el DOM: una región viva dentro de un `@if` no se anuncia. */
  protected readonly notice = signal('');

  private readonly genderLabels = signal<ReadonlyMap<string, string>>(new Map());

  protected readonly columns = computed<readonly ColumnDef<InsurerPatientListItem>[]>(() => [
    { key: 'fullName', header: 'Nombre completo', priority: 1, cell: this.patientCell() },
    { key: 'phone', header: 'Teléfono', priority: 1, cell: this.phoneCell() },
    { key: 'email', header: 'Correo electrónico', priority: 2, cell: this.emailCell() },
    { key: 'birthDate', header: 'Fecha de nacimiento', priority: 2, cell: this.birthCell() },
    { key: 'genderCode', header: 'Sexo', priority: 2, cell: this.genderCell() },
    { key: 'occupationDisplay', header: 'Profesión', priority: 2, cell: this.occupationCell() },
    { key: 'coverage', header: 'Seguro', priority: 1, cell: this.insuranceCell() },
    { key: 'actions', header: 'Acciones', priority: 1, cell: this.actionsCell() },
  ]);

  protected readonly byProfile = (row: InsurerPatientListItem): string => row.patientProfileId;
  protected readonly rowName = (row: InsurerPatientListItem): string => row.fullName;
  protected readonly loadingNow = computed(() => this.listing().status === 'loading');

  /** Hay algún filtro puesto: decide qué dice el vacío y si «Limpiar» tiene algo que limpiar. */
  protected readonly hasFilters = computed(
    () =>
      this.search() !== '' ||
      this.genderParam() !== '' ||
      this.occupationParam() !== '' ||
      this.insuranceParam() !== '' ||
      this.birthFromParam() !== '' ||
      this.birthToParam() !== '',
  );

  constructor() {
    // Un cambio de filtro, de tamaño o de texto es una lista nueva: el cursor
    // que había era de la anterior.
    effect(() => {
      this.search();
      this.genderParam();
      this.occupationParam();
      this.insuranceParam();
      this.birthFromParam();
      this.birthToParam();
      this.pageSize();
      untracked(() => {
        this.paginado.reiniciar();
        this.load();
      });
    });

    this.loadCatalogs();

    // «Ver todos los pacientes» apunta a esta misma ruta: el router la descarta
    // y es la única señal de que la persona pidió empezar de nuevo.
    this.router.events
      .pipe(
        filter((event): event is NavigationSkipped => event instanceof NavigationSkipped),
        filter((event) => event.url.split('?')[0] === INSURER_PATIENTS_ROUTE),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.resetFilters());
  }

  /** Un parámetro de la URL como señal; vacío si no está. */
  private paramSignal(key: string) {
    return toSignal(this.route.queryParamMap.pipe(map((params) => params.get(key) ?? '')), {
      initialValue: '',
    });
  }

  /** Lo que publica `app-filter-bar` al buscar: se guarda, no se navega. */
  protected onSearch(text: string): void {
    this.searchMemory.write(SEARCH_MEMORY_SCREEN, { q: text });
    this.search.set(text);
  }

  protected onBirthFrom(date: Date | null): void {
    this.setParam(PARAM_BIRTH_FROM, date === null ? null : toDateOnly(date));
  }

  protected onBirthTo(date: Date | null): void {
    this.setParam(PARAM_BIRTH_TO, date === null ? null : toDateOnly(date));
  }

  protected onPageSize(value: string | null): void {
    const size = Number(value);
    this.pageSize.set(PAGE_SIZES.includes(size as (typeof PAGE_SIZES)[number]) ? size : DEFAULT_PAGE_SIZE);
  }

  private setParam(key: string, value: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: value },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** «Limpiar filtros»: saca de la URL todo lo que esta pantalla escribe y vacía la búsqueda. */
  protected resetFilters(): void {
    this.searchMemory.write(SEARCH_MEMORY_SCREEN, { q: '' });
    this.search.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        [PARAM_GENDER]: null,
        [PARAM_OCCUPATION]: null,
        [PARAM_INSURANCE]: null,
        [PARAM_BIRTH_FROM]: null,
        [PARAM_BIRTH_TO]: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected move(cursor: string): void {
    this.paginado.mover(cursor);
    this.load();
  }

  /** Reintento de S8/S9: repite la página en la que quedó, no la primera. */
  protected reload(): void {
    this.load();
  }

  protected genderShort(code: string | undefined): string {
    return code === undefined ? '—' : (GENDER_SHORT[code] ?? '—');
  }

  protected genderFull(code: string | undefined): string {
    if (code === undefined) return 'Sin sexo registrado';
    return this.genderLabels().get(code) ?? GENDER_LABELS[code] ?? 'Sin sexo registrado';
  }

  protected formatBirth(birthDate: string): string {
    return formatDateOnly(birthDate);
  }

  /** `tel:` sin espacios ni guiones: lo que el marcador del teléfono entiende. */
  protected telHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
  }

  protected async copyPhone(phone: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(phone);
      this.notice.set(`Teléfono ${phone} copiado.`);
    } catch {
      this.notice.set('No pudimos copiar el teléfono. Seleccionalo y copialo a mano.');
    }
  }

  /** Abre el chat interno con el paciente. Sin slug no hay a quién escribirle. */
  protected message(row: InsurerPatientListItem): void {
    if (row.communityProfileSlug === undefined) return;
    void this.router.navigate([MESSAGING_ROUTE], {
      queryParams: { escribirA: row.communityProfileSlug },
    });
  }

  /**
   * Sexo y profesión, una sola vez. Un catálogo que falla deja su filtro
   * deshabilitado en vez de tumbar la pantalla: el listado sigue viéndose.
   */
  private loadCatalogs(): void {
    forkJoin({
      gender: this.systemContext
        .dynamicEnum('profiles.persons.administrative_gender_concept_id')
        .pipe(catchError(() => of(null))),
      occupation: this.occupations.listar().pipe(catchError(() => of(null))),
    }).subscribe(({ gender, occupation }) => {
      const genderOptions = (gender?.options ?? []).map((option) => ({
        value: option.conceptId,
        label: GENDER_LABELS[option.code] ?? option.display,
      }));
      this.genderOptions.set(genderOptions);
      this.genderLabels.set(
        new Map((gender?.options ?? []).map((option) => [option.code, GENDER_LABELS[option.code] ?? option.display])),
      );
      this.occupationOptions.set(
        (occupation ?? []).map((option) => ({ value: option.conceptId, label: option.display })),
      );
    });
  }

  private load(): void {
    this.listing.set(loading());
    const text = this.search();
    const gender = this.genderParam();
    const occupation = this.occupationParam();
    const insurance = this.insuranceParam();
    const from = this.birthFromParam();
    const to = this.birthToParam();
    const cursor = this.paginado.actual();

    this.insurance
      .listInsurerPatients({
        limit: this.pageSize(),
        ...(text === '' ? {} : { search: text }),
        ...(gender === '' ? {} : { genderConceptId: gender }),
        ...(occupation === '' ? {} : { occupationConceptId: occupation }),
        ...(insurance === '' ? {} : { insuranceStatus: insurance as InsurerPatientInsuranceStatus }),
        ...(from === '' ? {} : { birthDateFrom: from }),
        ...(to === '' ? {} : { birthDateTo: to }),
        ...(cursor === undefined ? {} : { cursor }),
      })
      .subscribe({
        next: (page) => {
          this.paginado.llego(page.nextCursor);
          this.listing.set(this.stateOf(page));
        },
        error: (error: unknown) => {
          this.paginado.llego(null);
          this.listing.set(errorToViewState<readonly InsurerPatientListItem[]>(error));
        },
      });
  }

  /**
   * De la página al estado. El vacío distingue «no hay pacientes todavía» de
   * «hay, pero ninguno coincide»: ofrecer lo primero cuando pasó lo segundo
   * sería mandar a la persona a buscar donde no hay nada.
   */
  private stateOf(page: InsurerPatientPage): ViewState<readonly InsurerPatientListItem[]> {
    if (page.items.length > 0) return ready(page.items);
    return this.hasFilters()
      ? empty(
          { label: 'Ver todos los pacientes', route: INSURER_PATIENTS_ROUTE },
          'Ningún paciente coincide con los filtros elegidos.',
        )
      : empty(
          { label: 'Ver solicitudes recibidas', route: '/administration/received-claims' },
          'Todavía no hay pacientes con cobertura o solicitudes en esta aseguradora.',
        );
  }
}
