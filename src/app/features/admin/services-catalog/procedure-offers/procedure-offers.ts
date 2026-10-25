import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, of, switchMap, throwError } from 'rxjs';

import { HealthcareServicesClient } from '../../../../core/data-access/healthcare-services/healthcare-services.client';
import type {
  HealthcareServiceOffer,
  PracticeSiteOption,
} from '../../../../core/data-access/healthcare-services/healthcare-services.types';
import { ServicesCatalogClient } from '../../../../core/data-access/services-catalog/services-catalog.client';
import type {
  Practice,
  ProcedureNomenclatureItem,
} from '../../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  overMarginNotice,
  ownPriceText,
  referenceText,
  visibilityLabel,
} from './procedure-offer-rules';

/** La pestaña «Publicados» es la primera; «Publicar un procedimiento» es la segunda. */
const TAB_PUBLISHED = 0;

/** Resultados del nomenclador por búsqueda: alcanza para elegir, sin traer las 4408. */
const SEARCH_LIMIT = 20;

/** Largo máximo del código de un ítem de catálogo (`CreateServiceCatalogItemDto`). */
const MAX_CATALOG_CODE = 60;

/** Importe con hasta dos decimales; la coma también vale, como se escribe en Bolivia. */
const PRICE_PATTERN = /^\d+([.,]\d{1,2})?$/;

/**
 * Procedimientos por sede (CM-06) — `administration/services-catalog/procedure-offers`.
 *
 * ## Qué hace
 *
 * El centro médico elige su organización y una sede, y publica ahí los
 * procedimientos del nomenclador que realiza, cada uno con su **precio propio**.
 * Sin precio el procedimiento queda publicado pero **no aparece en las
 * búsquedas del paciente**: la pantalla lo dice en la fila.
 *
 * ## Una tarjeta, dos pestañas
 *
 * «Publicados» y «Publicar un procedimiento» comparten la misma tarjeta y la
 * misma elección de sede (`composition-rules.md` §5). Como `app-tab` no dibuja
 * el panel cerrado, lo elegido vive en señales y en un `FormControl` del
 * componente, no en los controles.
 *
 * ## Qué no hace
 *
 * - No acepta texto libre como procedimiento: sólo conceptos del nomenclador.
 * - No calcula el sobreprecio ni convierte UMA/USD: muestra lo que la API trae
 *   (`overMargin` es `null` hoy, A-1/A-2).
 * - No decide quién puede administrar: la autoridad es la API y un 403 se
 *   muestra como S5 (A-6).
 */
@Component({
  selector: 'app-procedure-offers',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    ContentDialog,
    FormField,
    Input,
    PageHeader,
    ReactiveFormsModule,
    ReferenceCombobox,
    Select,
    Switch,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './procedure-offers.html',
  styleUrl: './procedure-offers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcedureOffers {
  private readonly services = inject(HealthcareServicesClient);
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly navigation = inject(NavigationService);
  private readonly toast = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly visibilityLabel = visibilityLabel;
  protected readonly referenceText = referenceText;
  protected readonly ownPriceText = ownPriceText;
  protected readonly overMarginNotice = overMarginNotice;
  protected readonly byId = (offer: HealthcareServiceOffer): string => offer.id;

  /* ---- organización ------------------------------------------------------- */

  private readonly practices = toSignal(
    this.catalog.listPractices().pipe(catchError(() => of<readonly Practice[]>([]))),
    { initialValue: undefined },
  );

  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    (this.practices() ?? []).map((p) => ({ value: p.id, label: p.name })),
  );

  /** Preselecciona la primera sin pisar la elección de quien ya tocó el selector. */
  protected readonly practiceId = linkedSignal<readonly Practice[] | undefined, string | null>({
    source: this.practices,
    computation: (list, previous) => previous?.value ?? list?.[0]?.id ?? null,
  });

  /* ---- sede --------------------------------------------------------------- */

  protected readonly sitesState = signal<ViewState<readonly PracticeSiteOption[]>>(loading());

  protected readonly siteOptions = computed<readonly SelectOption<string>[]>(() =>
    (dataOf(this.sitesState()) ?? []).map((s) => ({ value: s.id, label: s.name })),
  );

  /** Conserva la sede elegida mientras siga en la lista; si no, toma la primera. */
  protected readonly siteId = linkedSignal<ViewState<readonly PracticeSiteOption[]>, string | null>({
    source: this.sitesState,
    computation: (state, previous) => {
      const sites = dataOf(state) ?? [];
      const kept = previous?.value;
      return kept !== undefined && kept !== null && sites.some((s) => s.id === kept)
        ? kept
        : (sites[0]?.id ?? null);
    },
  });

  /* ---- lo publicado ------------------------------------------------------- */

  protected readonly offersState = signal<ViewState<readonly HealthcareServiceOffer[]>>(loading());
  protected readonly offerItems = computed(() => dataOf(this.offersState()) ?? []);

  /** Sólo el interruptor de la fila que está esperando respuesta se apaga. */
  protected readonly togglingId = signal<string | null>(null);

  protected readonly selectedTab = signal(TAB_PUBLISHED);

  /* ---- publicar ----------------------------------------------------------- */

  protected readonly procedureOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly searchingProcedures = signal(false);
  private readonly nomenclature = new Map<string, ProcedureNomenclatureItem>();

  /** El procedimiento elegido del nomenclador; nunca un texto escrito a mano. */
  protected readonly chosenProcedure = signal<ProcedureNomenclatureItem | null>(null);
  protected readonly chosenOption = computed<ReferenceOption | null>(() => {
    const item = this.chosenProcedure();
    return item === null ? null : { value: item.conceptId, label: item.display };
  });

  protected readonly publishPrice = new FormControl('', {
    nonNullable: true,
    validators: [Validators.pattern(PRICE_PATTERN)],
  });
  protected readonly publishState = signal<ViewState<null>>(ready(null));
  protected readonly publishing = computed(() => this.publishState().status === 'loading');
  protected readonly procedureMissing = signal(false);

  /* ---- cambiar el precio (modal) ------------------------------------------ */

  protected readonly priceEditing = signal<HealthcareServiceOffer | null>(null);
  protected readonly priceEditControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(PRICE_PATTERN)],
  });
  protected readonly priceEditState = signal<ViewState<null>>(ready(null));
  protected readonly savingPrice = computed(() => this.priceEditState().status === 'loading');

  /** El mensaje de un S4/S5/S9 de formulario, o `null` si no hay error que mostrar. */
  protected messageOf(state: ViewState<null>): string | null {
    switch (state.status) {
      case 'validation':
        return state.issues.map((issue) => issue.message).join(' ') || 'Revise lo ingresado.';
      case 'forbidden':
        return state.message ?? 'Su cuenta no administra esta organización.';
      case 'offline':
        return 'No pudimos conectarnos. Revise su conexión y reintente.';
      case 'error':
        return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
      default:
        return null;
    }
  }

  protected readonly publishError = computed(() => this.messageOf(this.publishState()));
  protected readonly priceEditError = computed(() => this.messageOf(this.priceEditState()));

  /** Contador de pedidos: una respuesta tardía de otra sede no pisa la actual. */
  private offersRequest = 0;
  private sitesRequest = 0;

  constructor() {
    // Otra organización es otra lista de sedes.
    effect(() => {
      const practiceId = this.practiceId();
      const loaded = this.practices() !== undefined;
      untracked(() => {
        if (loaded) this.loadSites(practiceId);
      });
    });

    // Otra sede es otra lista de procedimientos.
    effect(() => {
      this.siteId();
      untracked(() => this.loadOffers());
    });
  }

  protected changePractice(practiceId: string | null): void {
    this.practiceId.set(practiceId);
  }

  protected changeSite(siteId: string | null): void {
    this.siteId.set(siteId);
  }

  protected reloadSites(): void {
    this.loadSites(this.practiceId());
  }

  protected reloadOffers(): void {
    this.loadOffers();
  }

  private loadSites(practiceId: string | null): void {
    const request = ++this.sitesRequest;
    if (practiceId === null) {
      this.sitesState.set(
        empty({ label: 'Elegir una organización' }, 'Todavía no hay una organización para administrar.'),
      );
      return;
    }
    this.sitesState.set(loading());
    this.services.listSites(practiceId).subscribe({
      next: (sites) => {
        if (request !== this.sitesRequest) return;
        this.sitesState.set(
          sites.length === 0
            ? empty(
                { label: 'Dar de alta una sede' },
                'Esta organización todavía no tiene sedes donde publicar procedimientos.',
              )
            : ready(sites),
        );
      },
      error: (error: unknown) => {
        if (request !== this.sitesRequest) return;
        this.sitesState.set(errorToViewState<readonly PracticeSiteOption[]>(error));
      },
    });
  }

  private loadOffers(): void {
    const request = ++this.offersRequest;
    const practiceId = this.practiceId();
    const siteId = this.siteId();
    if (practiceId === null || siteId === null) {
      this.offersState.set(empty({ label: 'Elegir una sede' }, 'Elija una sede para ver lo que publica.'));
      return;
    }
    this.offersState.set(loading());
    this.services.listOffers(practiceId, siteId).subscribe({
      next: (items) => {
        if (request !== this.offersRequest) return;
        this.offersState.set(this.offersStateOf(items));
      },
      error: (error: unknown) => {
        if (request !== this.offersRequest) return;
        this.offersState.set(errorToViewState<readonly HealthcareServiceOffer[]>(error));
      },
    });
  }

  private offersStateOf(
    items: readonly HealthcareServiceOffer[],
  ): ViewState<readonly HealthcareServiceOffer[]> {
    return items.length === 0
      ? empty(
          { label: 'Use la pestaña «Publicar un procedimiento»' },
          'Esta sede todavía no publica procedimientos.',
        )
      : ready(items);
  }

  /** Reemplaza una fila por la que devolvió la API, sin recargar la lista. */
  private replaceOffer(updated: HealthcareServiceOffer): void {
    const items = dataOf(this.offersState());
    if (items === null) return;
    this.offersState.set(ready(items.map((o) => (o.id === updated.id ? updated : o))));
  }

  /* ---- activar y desactivar ------------------------------------------------ */

  protected toggleActive(offer: HealthcareServiceOffer, active: boolean): void {
    const practiceId = this.practiceId();
    if (practiceId === null || this.togglingId() !== null || active === offer.active) return;
    this.togglingId.set(offer.id);
    this.services.updateOffer(practiceId, offer.id, { active }).subscribe({
      next: (updated) => {
        this.togglingId.set(null);
        this.replaceOffer(updated);
      },
      error: (error: unknown) => {
        this.togglingId.set(null);
        this.toast.show({
          type: 'error',
          title: 'No pudimos cambiar el estado',
          message: this.messageOf(errorToViewState<null>(error)) ?? 'Intente de nuevo.',
        });
        // La fila vuelve a lo que dice la API: el interruptor no se queda adelantado.
        this.loadOffers();
      },
    });
  }

  /* ---- publicar ------------------------------------------------------------ */

  protected searchProcedures(query: string): void {
    this.searchingProcedures.set(true);
    this.catalog.searchProcedures({ query, limit: SEARCH_LIMIT }).subscribe({
      next: (page) => {
        for (const item of page.items) this.nomenclature.set(item.conceptId, item);
        this.procedureOptions.set(
          page.items.map((item) => ({
            value: item.conceptId,
            label: item.display,
            ...(item.specialty === null ? {} : { hint: item.specialty }),
          })),
        );
        this.searchingProcedures.set(false);
      },
      error: () => {
        this.procedureOptions.set([]);
        this.searchingProcedures.set(false);
      },
    });
  }

  protected chooseProcedure(option: ReferenceOption | null): void {
    this.chosenProcedure.set(option === null ? null : (this.nomenclature.get(option.value) ?? null));
    if (option !== null) this.procedureMissing.set(false);
  }

  protected publish(): void {
    if (this.publishing()) return;
    const practiceId = this.practiceId();
    const siteId = this.siteId();
    const procedure = this.chosenProcedure();
    if (procedure === null) {
      this.procedureMissing.set(true);
      return;
    }
    if (practiceId === null || siteId === null || this.publishPrice.invalid) {
      this.publishPrice.markAsTouched();
      return;
    }

    this.publishState.set(loading());
    const price = normalizedPrice(this.publishPrice.value);

    const created$ =
      price === null
        ? this.services.createOffer(practiceId, { practiceSiteId: siteId, serviceConceptId: procedure.conceptId })
        : this.catalog.create(this.catalogItemOf(practiceId, siteId, procedure, price)).pipe(
            switchMap((item) =>
              this.services
                .createOffer(practiceId, {
                  practiceSiteId: siteId,
                  serviceConceptId: procedure.conceptId,
                  serviceCatalogId: item.id,
                })
                .pipe(
                  // El precio ya quedó creado: si la publicación falla (ya estaba en la
                  // sede, por ejemplo), se desactiva para no dejar un ítem huérfano.
                  catchError((error: unknown) =>
                    this.catalog.update(item.id, { isActive: false }).pipe(
                      catchError(() => of(null)),
                      switchMap(() => throwError(() => error)),
                    ),
                  ),
                ),
            ),
          );

    created$.subscribe({
      next: (offer) => {
        this.publishState.set(ready(null));
        const items = dataOf(this.offersState()) ?? [];
        this.offersState.set(ready([...items, offer]));
        this.publishPrice.reset('');
        this.chosenProcedure.set(null);
        this.procedureOptions.set([]);
        this.selectedTab.set(TAB_PUBLISHED);
        this.toast.success(
          offer.visibleInSearch
            ? 'Ya aparece en las búsquedas de los pacientes.'
            : 'Quedó publicado, pero no aparecerá en búsquedas hasta que fije su precio.',
          offer.serviceDisplay,
        );
      },
      error: (error: unknown) => {
        // El formulario conserva lo escrito: sólo se muestra qué dijo la API.
        this.publishState.set(errorToViewState<null>(error));
      },
    });
  }

  /* ---- precio ------------------------------------------------------------- */

  protected openPriceEditor(offer: HealthcareServiceOffer): void {
    this.priceEditControl.setValue(offer.price === null ? '' : String(offer.price));
    this.priceEditControl.markAsUntouched();
    this.priceEditState.set(ready(null));
    this.priceEditing.set(offer);
  }

  protected closePriceEditor(): void {
    this.priceEditing.set(null);
    this.priceEditState.set(ready(null));
  }

  protected savePrice(): void {
    const offer = this.priceEditing();
    const practiceId = this.practiceId();
    const siteId = this.siteId();
    if (offer === null || practiceId === null || siteId === null || this.savingPrice()) return;
    const price = normalizedPrice(this.priceEditControl.value);
    if (price === null || this.priceEditControl.invalid) {
      this.priceEditControl.markAsTouched();
      return;
    }

    this.priceEditState.set(loading());
    const saved$ =
      offer.serviceCatalogId === null
        ? this.catalog
            .create(
              this.catalogItemOf(practiceId, siteId, {
                conceptId: offer.serviceConceptId,
                code: offer.serviceConceptId.slice(0, 8),
                display: offer.serviceDisplay,
              }, price),
            )
            .pipe(
              switchMap((item) =>
                this.services.updateOffer(practiceId, offer.id, { serviceCatalogId: item.id }),
              ),
            )
        : this.catalog
            .update(offer.serviceCatalogId, { defaultPrice: price })
            .pipe(switchMap(() => this.services.listOffers(practiceId, siteId)))
            .pipe(switchMap((items) => of(items.find((o) => o.id === offer.id) ?? offer)));

    saved$.subscribe({
      next: (updated) => {
        this.priceEditState.set(ready(null));
        this.priceEditing.set(null);
        this.replaceOffer(updated);
        this.toast.success('El precio quedó guardado.', updated.serviceDisplay);
      },
      error: (error: unknown) => this.priceEditState.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Un ítem de catálogo **por sede** (A-13): `billing.service_catalog` es por
   * práctica, así que el código del ítem lleva la sede y no choca con el de otra.
   */
  private catalogItemOf(
    practiceId: string,
    siteId: string,
    procedure: Pick<ProcedureNomenclatureItem, 'conceptId' | 'code' | 'display'>,
    price: string,
  ) {
    const site = dataOf(this.sitesState())?.find((s) => s.id === siteId);
    const suffix = site?.code ?? siteId.slice(0, 8);
    return {
      practiceId,
      code: `${procedure.code}@${suffix}`.slice(0, MAX_CATALOG_CODE),
      name: procedure.display,
      serviceConceptId: procedure.conceptId,
      defaultPrice: price,
      isActive: true,
    };
  }
}

/** `''` es «sin precio»; `350,5` es `350.50`. */
function normalizedPrice(raw: string): string | null {
  const text = raw.trim();
  if (text === '') return null;
  return Number(text.replace(',', '.')).toFixed(2);
}
