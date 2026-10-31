import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import { DiagnosticUnitsClient } from '../../../../core/data-access/diagnostic-units/diagnostic-units.client';
import { DiagnosticsClient } from '../../../../core/data-access/diagnostics/diagnostics.client';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type { MedicationAvailabilityResult } from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  PharmacyCampaignsClient,
  etiquetaDeCampana,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import type { CampanaDeFarmacia } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.types';
import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
import { SAMPLE_DATA_ENABLED } from '../../../../core/mock/sample-data';
import { NO_SAVED_PLACES, savedPlacesOf, type SavedPlaces } from '../../../../core/data-access/profiles/saved-places';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type { PinMap } from '../../../../shared/components/organisms/map/map-pin.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { PHARMACY_CART_ROUTE } from '../../pharmacy/pharmacy.routes';
import { MI_HISTORIA_ROUTE } from '../medical-record.routes';
import {
  imagingCenterOf,
  pendingImagingStudies,
  type ImagingResult,
  type PendingStudy,
} from './imaging-centers';
import { MedicalCentersTab } from './medical-centers-tab/medical-centers-tab';
import { orderablePrescriptionOf } from './orderable-prescription';
import {
  approvedCoverageLabel,
  cartLinesFromDraft,
  cartSiteOf,
  evaluateBranches,
  NO_BRANCHES,
  orderDraftOf,
  pinStatusOf,
  pinSubtitleOf,
  prescriptionItemOf,
  presentationOf,
  rowsOfPrescription,
  SORT_OPTIONS,
  sortBranches,
  splitByPublication,
  uniqueByMedication,
  type BranchResult,
  type BranchSortOrder,
  type PrescriptionItem,
  type ShoppingList,
  type VisibleBranch,
} from './pharmacy-branches';
import { sampleInsuranceApprovals, DEMO_NOTE } from './where-to-buy.fixtures';
import { coverageRoute, geoPointOf, type CoverageRoute, type ReferencePoint } from './where-to-buy.route';

/** Los estudios que le pidieron a esta persona. Ya existe y ya se lee. */
const MY_STUDIES_ROUTE = '/my-account/diagnostic-orders';

/** La guía de laboratorios y centros de diagnóstico, sin cercanía. */
const LABORATORY_DIRECTORY_ROUTE = '/laboratory-directory';

/**
 * Las pestañas, en el orden de la plantilla, por su valor en `?tab=`. La
 * pestaña viaja en la URL para que recargar o compartir el enlace vuelva a la
 * misma; un valor desconocido abre Farmacias.
 */
export const WHERE_TO_BUY_TABS = ['pharmacies', 'imaging', 'medical-centers'] as const;

/** Tope de centros de la búsqueda por cobertura: el mismo que el de sedes. */
const IMAGING_CENTER_LIMIT = 20;

/** Mismo tope que la historia: es la misma lectura del resumen clínico. */
const SUMMARY_LIMIT = 50;

/** Tope de sedes servidas por la consulta de disponibilidad. */
const BRANCH_LIMIT = 20;

/** Cuántas campañas se ven de entrada en la tarjeta de una sede; el resto, plegado. */
const VISIBLE_PROMOTIONS = 3;

/**
 * Puntos de referencia para medir distancias sin entregar la ubicación: las
 * plazas centrales de las ciudades donde la red opera. Son data públicos del
 * mapa, no data de la persona — el domicilio y el trabajo declarados por el
 * paciente son otro juego de puntos, `savedPlaces` más abajo, que se
 * ofrecen primero porque ya sabemos que le quedan cerca.
 */
const CITIES: readonly ReferencePoint[] = [
  { label: 'Santa Cruz de la Sierra', lat: -17.7833, lng: -63.1821 },
  { label: 'La Paz', lat: -16.4957, lng: -68.1335 },
  { label: 'Cochabamba', lat: -17.3895, lng: -66.1568 },
];

/**
 * **Dónde comprar mi receta** (carril E3, sobre las lecturas E2 del backend).
 *
 * ## Qué responde
 *
 * Qué sucursales pueden surtir los medicamentos recetados, cuáles los tienen
 * **todos** (completas, primero) y a cuáles les falta algo (parciales, con el
 * faltante dicho por su nombre), con dirección, distancia y total estimado.
 * El orden por defecto es el del backend: completas primero, después
 * distancia, total y nombre — «Receta completa primero» lo respeta tal cual.
 * «Más cerca» y «Más barato» (T-E2) reacomodan en la pantalla lo que ya llegó,
 * sin volver a consultar; ver {@link sortBranches}.
 *
 * ## La variante con seguro es una demostración
 *
 * El conmutador (T-E2 · F2.2.2) evalúa lista y mapa sólo sobre los renglones
 * que el seguro aprueba y parte el precio en «aprobado / a tu cargo». Qué se
 * aprueba sale de `where-to-buy.fixtures.ts`, no de un contrato; las sedes,
 * existencias y precios siguen siendo los de la disponibilidad. El borrador
 * del pedido no se entera: el CTA arma el mismo borrador con o sin seguro.
 *
 * ## La ubicación se pide, no se toma — salvo la que ya diste
 *
 * Mismo patrón que «Cerca mío» (P4): la API de geolocalización del navegador
 * no se toca hasta que alguien aprieta «Compartir mi ubicación». Domicilio y
 * trabajo (subtarea B.2) son la excepción, y no una contradicción: son data
 * que la persona **ya declaró** en su perfil, no algo que el navegador
 * entregue sin que se sepa. Por eso la casa se preselecciona sin pedir
 * permiso — la primera consulta de disponibilidad ya sale con ese origen —,
 * y las ciudades siguen ahí para quien no declaró ninguno de los dos.
 *
 * ## El puente receta → producto
 *
 * La receta trae el medicamento del vademécum (`medicationConceptId`); el
 * directorio publica **productos**, y cada uno es de una sola farmacia.
 * `GET /pharmacy-inventory/availability/medications` es el puente: una sola
 * consulta por receta, con los medicamentos, que mira todos los productos de
 * todas las farmacias de la red y devuelve cada sede con un producto suyo por
 * medicamento. Un medicamento que ninguna farmacia publica se dice
 * abiertamente y ninguna sede se declara «completa» mientras tanto.
 *
 * ## Cero identificadores visibles
 *
 * Todo lo que se pinta son nombres: medicamentos por su etiqueta de
 * terminología, faltantes por su nombre, sedes por el suyo. Los uuid viajan
 * en las consultas y no llegan nunca a la plantilla.
 */
@Component({
  selector: 'app-where-to-buy',
  imports: [
    AppButton,
    AppButtonLink,
    AppMap,
    Badge,
    Checkbox,
    Alert,
    Link,
    MedicalCentersTab,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Switch,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './where-to-buy.html',
  styleUrl: './where-to-buy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhereToBuy {
  private readonly auth = inject(AuthService);
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly profiles = inject(ProfilesClient);
  private readonly campaigns = inject(PharmacyCampaignsClient);
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly cart = inject(CartStore);
  private readonly dialogs = inject(DialogService);
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly diagnosticUnits = inject(DiagnosticUnitsClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  /**
   * El id con que viaja el pedido: la elegida si se puede pedir, si no otra
   * fila vigente de la misma receta (FAR-03). `null` hasta que la receta carga.
   */
  private orderRequestId: string | null = null;
  private readonly profileId = this.auth.patientProfileId();

  protected readonly noPatientProfile = this.profileId === null;
  protected readonly medicalRecordRoute = MI_HISTORIA_ROUTE;

  /**
   * Las salidas de las otras dos pestañas: qué me pidieron, y qué lugares hay
   * cuando la búsqueda por cobertura no tiene nada que mostrar.
   */
  protected readonly myStudiesRoute = MY_STUDIES_ROUTE;
  protected readonly laboratoryDirectoryRoute = LABORATORY_DIRECTORY_ROUTE;
  protected readonly cities = CITIES;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly demoNote = DEMO_NOTE;

  /* ---- la pestaña activa, en la URL ---------------------------------------- */

  protected readonly tabIndex = signal(
    tabIndexOf(this.route.snapshot.queryParamMap.get('tab')),
  );
  protected readonly medicalCentersActive = computed(
    () => WHERE_TO_BUY_TABS[this.tabIndex()] === 'medical-centers',
  );

  /**
   * Cambia de pestaña y la deja en la URL (`replaceUrl`: cambiar de pestaña no
   * apila pasos en el historial). Imagenología se consulta recién la primera
   * vez que se abre: quien vino por la receta no paga esa lectura.
   */
  protected selectTab(index: number): void {
    this.tabIndex.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: WHERE_TO_BUY_TABS[index] ?? null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (WHERE_TO_BUY_TABS[index] === 'imaging') {
      this.loadImagingOnce();
    }
  }

  /**
   * Maqueta (`true`) o API real (`false`). La variante con seguro es una
   * demostración sobre un dato que ningún contrato publica —qué renglón
   * aprueba el seguro antes de que exista el pedido—, así que contra la API
   * real no se ofrece: `withInsurance` queda apagado y la lista es la de la
   * consulta, sin más. Ver `core/mock/sample-data.ts`.
   */
  protected readonly sampleData = inject(SAMPLE_DATA_ENABLED);

  /**
   * El domicilio y el trabajo del paciente, como puntos de referencia
   * (subtarea B.2). Vacío hasta que el perfil responde; si no declaró
   * ninguno de los dos, se queda vacío y sólo quedan las ciudades.
   */
  protected readonly savedPlaces = signal<readonly ReferencePoint[]>([]);

  /** La última respuesta cruda: el borrador necesita los precios por línea. */
  private lastQuery: {
    readonly response: MedicationAvailabilityResult;
    readonly queryable: readonly PrescriptionItem[];
    readonly withoutProduct: readonly string[];
  } | null = null;

  protected readonly list = signal<ViewState<ShoppingList>>(loading());
  protected readonly results = signal<ViewState<BranchResult>>(loading());

  /** Qué medicamentos entran en la consulta, por concepto. */
  private readonly included = signal<ReadonlySet<string>>(new Set());

  /**
   * Lo que no entró al carrito, dicho por su nombre (carril 43 · H5).
   *
   * `null` es «no hay nada que avisar», no «no se intentó»: sólo se llena
   * después de volcar una receta que dejó medicamentos afuera.
   */
  protected readonly cartNotice = signal<string | null>(null);

  /** Desde dónde se miden las distancias; `null` = sin origen, sin permiso pedido. */
  protected readonly origin = signal<ReferencePoint | null>(null);
  protected readonly requestingLocation = signal(false);
  protected readonly locationDenied = signal(false);

  protected readonly items = computed(() => dataOf(this.list())?.items ?? []);
  protected readonly result = computed(() => dataOf(this.results()));

  /* ---- el orden y la variante con seguro (T-E2) --------------------------- */

  protected readonly sortOrder = signal<BranchSortOrder>('complete-first');

  /** El conmutador de demostración de la variante con seguro. */
  protected readonly withInsurance = signal(false);

  /** Qué renglones aprueba el seguro, de ejemplo, sobre la receta entera. */
  private readonly insuranceApprovals = computed(() =>
    sampleInsuranceApprovals(this.items().map((item) => item.conceptId)),
  );

  /**
   * Por defecto se muestran solo las sucursales que tienen todo (P-19-4). Las
   * que tienen una parte se ven a pedido: sirven cuando ninguna tiene todo, y
   * el recorrido sugerido las sigue considerando igual.
   */
  protected readonly showPartialPharmacies = signal(false);

  /** «Completa» es contra lo que se mira: la receta entera o, con seguro, lo aprobado. */
  private isComplete(branch: VisibleBranch): boolean {
    return this.withInsurance() ? branch.insured.complete : branch.complete;
  }

  /** Cuántas sucursales quedan fuera de la vista por defecto. */
  protected readonly partialPharmacyCount = computed(
    () => (this.result()?.branches ?? []).filter((branch) => !this.isComplete(branch)).length,
  );

  protected readonly partialPharmaciesLabel = computed(() =>
    this.showPartialPharmacies()
      ? 'Mostrar solo las que tienen todo'
      : partialCountLabel(this.partialPharmacyCount(), 'la', 'las'),
  );

  /** Las sucursales que se ven: la lista y el mapa hablan de las mismas. */
  private readonly visibleBranches = computed(() => {
    const branches = this.result()?.branches ?? [];
    return this.showPartialPharmacies() ? branches : branches.filter((branch) => this.isComplete(branch));
  });

  /** La lista en el orden elegido. Una copia: la respuesta no se toca. */
  protected readonly sortedBranches = computed(() =>
    sortBranches(this.visibleBranches(), this.sortOrder()),
  );

  /**
   * El estado de las sucursales tal como se pinta. Es el mismo de la consulta
   * —cargando, vacío y error pasan intactos—, salvo un caso propio de la
   * variante: con seguro y ningún renglón incluido aprobado no hay nada que
   * evaluar, y eso se dice con su salida en vez de mostrar «0 de 0».
   */
  protected readonly branchesState = computed<ViewState<BranchResult>>(() => {
    const state = this.results();
    const data = dataOf(state);
    if (
      this.withInsurance() &&
      data !== null &&
      data.branches.length > 0 &&
      data.includedApprovedCount === 0
    ) {
      return empty(
        { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
        'Con el seguro, ninguno de los medicamentos que eligió está aprobado. Apague la variante con seguro para ver la receta completa.',
      );
    }
    return state;
  });

  /** Las sedes que el mapa puede ubicar: las que tienen coordenadas. */
  protected readonly mappedBranches = computed(() =>
    this.visibleBranches().filter(
      (branch): branch is VisibleBranch & { lat: number; lng: number } =>
        branch.lat !== null && branch.lng !== null,
    ),
  );

  /** La sede resaltada, compartida en two-way entre el mapa y las tarjetas. */
  protected readonly selectedBranch = signal<string | null>(null);

  /** Las sedes ubicables, traducidas al contrato del organismo de mapa. */
  protected readonly branchPins = computed<readonly PinMap[]>(() =>
    this.mappedBranches().map((branch): PinMap => ({
      // La letra de la tarjeta es la referencia compartida: ningún uuid
      // llega al mapa, la misma regla de cero identificadores visibles.
      id: branch.code,
      codigo: branch.code,
      lat: branch.lat,
      lng: branch.lng,
      titulo: `${branch.pharmacy} · ${branch.site}`,
      subtitulo: pinSubtitleOf(branch, this.withInsurance()),
      estado: pinStatusOf(branch, this.withInsurance()),
      ctaEtiqueta: 'Ver en la lista',
    })),
  );

  /**
   * El recorrido que cubre los medicamentos consultables (ver
   * `where-to-buy.route.ts`). Con la variante con seguro no se ofrece: esa
   * vista evalúa otra receta, la aprobada, y mezclar los dos criterios en la
   * misma pantalla confundiría más de lo que ayuda.
   */
  protected readonly coverage = computed<CoverageRoute<VisibleBranch> | null>(() => {
    const branches = this.result()?.branches ?? [];
    if (this.withInsurance() || branches.length === 0) {
      return null;
    }
    const withoutProduct = new Set(this.result()?.withoutProductConceptIds ?? []);
    const needed = this.items()
      .filter((item) => !withoutProduct.has(item.conceptId) && this.included().has(item.conceptId))
      .map((item) => item.conceptId);
    if (needed.length === 0) {
      return null;
    }
    return coverageRoute(branches, needed);
  });

  /** Los medicamentos de la receta, por su nombre, a partir de sus conceptos. */
  protected namesOf(conceptIds: readonly string[]): string {
    return this.items()
      .filter((item) => conceptIds.includes(item.conceptId))
      .map((item) => item.medication)
      .join(', ');
  }

  protected readonly imagingData = computed(() => dataOf(this.imaging()));

  /** El mismo criterio que farmacias (P-19-4): por defecto, solo los que tienen todos. */
  protected readonly showPartialCenters = signal(false);

  protected readonly partialCenterCount = computed(
    () => this.imagingData()?.centers.filter((center) => !center.complete).length ?? 0,
  );

  protected readonly visibleCenters = computed(() => {
    const centers = this.imagingData()?.centers ?? [];
    return this.showPartialCenters() ? centers : centers.filter((center) => center.complete);
  });

  protected readonly partialCentersLabel = computed(() =>
    this.showPartialCenters()
      ? 'Mostrar solo los que tienen todos'
      : partialCountLabel(this.partialCenterCount(), 'el', 'los'),
  );

  protected studyNames(studies: readonly PendingStudy[]): string {
    return studies.map((study) => study.name).join(', ');
  }

  /** Los medicamentos que esta parada aporta al recorrido, por su nombre. */
  protected coveredBy(branch: VisibleBranch): string {
    return this.items()
      .filter((item) => branch.covers.has(item.conceptId) && this.included().has(item.conceptId))
      .map((item) => item.medication)
      .join(', ');
  }

  protected readonly mapLabel = computed(() => {
    const howMany = this.mappedBranches().length;
    const marked = howMany === 1 ? '1 sucursal marcada' : `${howMany} sucursales marcadas`;
    return `${marked} en el mapa. La lista completa, con dirección y distancia en línea recta, está en las tarjetas debajo.`;
  });

  constructor() {
    if (this.profileId === null) {
      // No es un vacío de data ni un error: la pantalla no le corresponde a
      // esta cuenta, y el aviso lo dice con su propia salida.
      this.list.set(empty({ label: 'Ir a mi historia', route: MI_HISTORIA_ROUTE }));
      this.results.set(ready(NO_BRANCHES));
      return;
    }
    this.load();
    if (WHERE_TO_BUY_TABS[this.tabIndex()] === 'imaging') {
      this.loadImagingOnce();
    }
  }

  /* ---- imagenología: los centros que tienen mis estudios ------------------ */

  protected readonly imaging = signal<ViewState<ImagingResult>>(loading());

  /** Los estudios pendientes, una vez leídos; `null` mientras no se pidieron. */
  private imagingStudies: readonly PendingStudy[] | null = null;
  private imagingRequested = false;

  private loadImagingOnce(): void {
    if (this.imagingRequested || this.profileId === null) {
      return;
    }
    this.imagingRequested = true;
    this.loadImaging();
  }

  /**
   * Lee las órdenes propias y se queda con las de imagenología sin resultado.
   * Sin etiquetas no hay código de estudio con qué buscar, así que un fallo
   * del catálogo es un error con reintento, no un «no tiene estudios».
   */
  protected loadImaging(): void {
    this.imaging.set(loading());
    this.imagingStudies = null;
    this.diagnostics
      .getOwnOrders()
      .pipe(
        switchMap((page) => {
          const pending = page.items.filter((order) => !order.hasReleasedResult);
          if (pending.length === 0) {
            return of<readonly PendingStudy[]>([]);
          }
          const ids = pending.flatMap((order) =>
            order.categoryConceptId === undefined
              ? [order.codeConceptId]
              : [order.codeConceptId, order.categoryConceptId],
          );
          return this.terminology
            .readConceptLabels([...new Set(ids)])
            .pipe(map((labels) => pendingImagingStudies(pending, labels)));
        }),
      )
      .subscribe({
        next: (studies) => {
          this.imagingStudies = studies;
          this.searchImaging();
        },
        error: (error: unknown) => this.imaging.set(errorToViewState<ImagingResult>(error)),
      });
  }

  /** Una sola búsqueda con todos los estudios, desde el mismo origen que farmacias. */
  protected searchImaging(): void {
    const studies = this.imagingStudies;
    if (studies === null) {
      return;
    }
    if (studies.length === 0) {
      this.imaging.set(
        empty(
          { label: 'Ver mis estudios pedidos', route: MY_STUDIES_ROUTE },
          'No tiene estudios de imagenología pendientes. Cuando su médico le pida uno, acá va a ver dónde hacérselo.',
        ),
      );
      return;
    }
    this.imaging.set(loading());
    const origin = this.origin();
    this.diagnosticUnits
      .searchCoverage({
        studyConceptIds: studies.map((study) => study.conceptId),
        kind: 'IMAGING',
        origin: origin === null ? undefined : geoPointOf(origin),
        limit: IMAGING_CENTER_LIMIT,
      })
      .subscribe({
        next: (page) => {
          if (page.items.length === 0) {
            this.imaging.set(
              empty(
                { label: 'Buscar un laboratorio', route: LABORATORY_DIRECTORY_ROUTE },
                'Ningún centro publicado ofrece hoy los estudios que le pidieron.',
              ),
            );
            return;
          }
          this.imaging.set(
            ready({ studies, centers: page.items.map((item) => imagingCenterOf(item, studies)) }),
          );
        },
        error: (error: unknown) => this.imaging.set(errorToViewState<ImagingResult>(error)),
      });
  }

  /* ---- la receta ---------------------------------------------------------- */

  protected load(): void {
    const profileId = this.profileId;
    if (profileId === null) {
      return;
    }

    this.list.set(loading());
    this.results.set(loading());
    this.orderRequestId = null;

    this.clinical
      .getSummary(profileId, SUMMARY_LIMIT)
      .pipe(
        switchMap((summary) => {
          const prescribed = summary.medicationRequests.find((row) => row.id === this.requestId);
          if (prescribed === undefined) {
            return of(null);
          }
          // Sólo la receta elegida (FAR-03 · D-3): el pedido lleva su id, y un
          // fármaco de otra consulta no viaja bajo él.
          const rows = rowsOfPrescription(summary.medicationRequests, this.requestId);
          const conceptIds = [...new Set(rows.map((row) => row.medicationConceptId))];
          return forkJoin({
            rows: of(rows),
            prescribed: of(prescribed),
            // Sin etiquetas la pantalla no puede nombrar nada: acá sí son
            // parte del dato, no un adorno — pero perderlas tampoco justifica
            // perder la consulta: el renglón sale como «Sin registrar». Van
            // también los estados: su código dice qué fila se puede pedir.
            labels: this.terminology
              .readConceptLabels([...conceptIds, ...rows.map((row) => row.statusConceptId)])
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
            // Domicilio y trabajo del paciente, para ofrecerlos como puntos
            // de referencia sin pedirle el GPS (subtarea B.2). Un fallo acá
            // no puede tumbar la consulta de disponibilidad: se degrada a
            // «sin lugares guardados», que es exactamente lo que había antes.
            places: this.profiles.getOwnPatientProfile().pipe(
              map(savedPlacesOf),
              catchError(() => of<SavedPlaces>(NO_SAVED_PLACES)),
            ),
          });
        }),
      )
      .subscribe({
        next: (loaded) => {
          if (loaded === null) {
            this.list.set(notFound({ label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE }));
            this.results.set(ready(NO_BRANCHES));
            return;
          }
          const orderable = orderablePrescriptionOf(
            loaded.rows,
            this.requestId,
            loaded.labels,
            new Date(),
          );
          if (orderable.requestId === null) {
            // Borrador, anulada, reemplazada, entregada o vencida: la API
            // rechazaría el pedido, así que no se ofrece armarlo.
            this.list.set(
              empty(
                { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
                'Esta receta no se puede usar para comprar: todavía no se emitió, fue anulada o reemplazada, ya se entregó o venció.',
              ),
            );
            this.results.set(ready(NO_BRANCHES));
            return;
          }
          this.orderRequestId = orderable.requestId;
          const items = uniqueByMedication(orderable.rows).map((row) =>
            prescriptionItemOf(row, loaded.labels),
          );
          // Entran a la consulta la receta que se tocó y las ya emitidas: son
          // las que la persona puede efectivamente ir a comprar.
          this.included.set(
            new Set(
              items
                .filter(
                  (item) => item.issued || item.conceptId === loaded.prescribed.medicationConceptId,
                )
                .map((item) => item.conceptId),
            ),
          );
          this.list.set(ready({ items }));
          this.seedSavedPlaces(loaded.places);
          this.queryAvailability();
        },
        error: (error: unknown) => {
          this.list.set(errorToViewState<ShoppingList>(error));
          this.results.set(ready(NO_BRANCHES));
        },
      });
  }

  /* ---- la selección ------------------------------------------------------- */

  protected isIncluded(item: PrescriptionItem): boolean {
    return this.included().has(item.conceptId);
  }

  /** Ninguna farmacia de la red publica un producto de este medicamento. */
  protected isUnpublished(item: PrescriptionItem): boolean {
    return this.result()?.withoutProductConceptIds.includes(item.conceptId) ?? false;
  }

  /** Si el seguro aprueba el renglón, de ejemplo (T-E2). */
  protected isApproved(item: PrescriptionItem): boolean {
    return this.insuranceApprovals().has(item.conceptId);
  }

  protected readonly approvedCoverageLabel = approvedCoverageLabel;

  /** El badge de la tarjeta: el mismo estado que el pin del mapa. */
  protected readonly branchStatusOf = pinStatusOf;

  protected toggle(item: PrescriptionItem, include: boolean): void {
    const nextIncluded = new Set(this.included());
    if (include) {
      nextIncluded.add(item.conceptId);
    } else {
      nextIncluded.delete(item.conceptId);
    }
    this.included.set(nextIncluded);
    this.queryAvailability();
  }

  /* ---- la consulta -------------------------------------------------------- */

  protected queryAvailability(): void {
    this.lastQuery = null;
    const included = this.items().filter((item) => this.included().has(item.conceptId));
    if (included.length === 0) {
      this.results.set(
        empty(
          { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
          'Elija al menos un medicamento para consultar dónde comprarlo.',
        ),
      );
      return;
    }

    // Con seguro se evalúa sobre lo aprobado: lo que no tiene producto también
    // cuenta, porque ninguna sede puede confirmarlo.
    const approved = this.insuranceApprovals();

    this.results.set(loading());
    const origin = this.origin();
    // Una sola consulta por receta, por medicamento: el backend mira todos los
    // productos de todas las farmacias de la red.
    this.pharmacy
      .availabilityByMedication({
        medicationConceptIds: included.map((item) => item.conceptId),
        origin: origin === null ? undefined : geoPointOf(origin),
        limit: BRANCH_LIMIT,
      })
      .subscribe({
        next: (response) => {
          const { queryable, withoutProductItems } = splitByPublication(response, included);
          const withoutProduct = withoutProductItems.map((item) => item.medication);
          if (queryable.length === 0) {
            this.results.set(
              empty(
                { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
                `No hay un producto publicado para: ${withoutProduct.join(', ')}. El pedido completo no se puede enviar.`,
              ),
            );
            return;
          }
          if (response.items.length === 0) {
            this.results.set(
              empty(
                { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
                'Ninguna sucursal puede confirmar hoy los medicamentos de su receta.',
              ),
            );
            return;
          }
          this.lastQuery = { response, queryable, withoutProduct };
          this.seedPromotions(response);
          this.results.set(
            ready(evaluateBranches(response, included, approved)),
          );
        },
        error: (error: unknown) => this.results.set(errorToViewState<BranchResult>(error)),
      });
  }

  /* ---- las promociones (FAR-I7) -------------------------------------------- */

  /**
   * Le pasa al carril de promociones el catálogo que esta consulta ya trajo.
   *
   * El cliente de campañas no tiene de dónde leer productos con precio: no hay
   * endpoint de campañas y `GET /pharmacy/products` publica el catálogo sin
   * precios. Acá sí están, reales, y sembrar con ellos es lo que evita que una
   * promoción de demostración anuncie un producto inventado. Es idempotente:
   * cada farmacia se siembra una sola vez por sesión.
   */
  private seedPromotions(response: MedicationAvailabilityResult): void {
    for (const branch of response.items) {
      // `flatMap` y no `filter` + `map`: el filtro no estrecha el tipo de
      // `price` y obligaría a una aserción por cada uso.
      const catalog = branch.products.flatMap((product) => {
        const price = product.price;
        if (price === null) {
          return [];
        }
        return [
          {
            productId: product.productId,
            nombre: product.brandName ?? product.genericName ?? product.productCode,
            presentacion: presentationOf(product),
            // Lo que paga el paciente cuando la lista lo distingue: es el
            // precio sobre el que la promoción tiene que descontar.
            precio: price.patientAmount ?? price.unitAmount,
            moneda: price.currency?.code ?? '',
          },
        ];
      });
      this.campaigns.sembrarPara(branch.pharmacyId, branch.pharmacyName, catalog);
    }
  }

  /** Cuántas promociones vigentes tiene la farmacia de esta sede. */
  protected promotionsOf(branch: VisibleBranch): readonly CampanaDeFarmacia[] {
    return this.campaigns.campanasVigentes(branch.pharmacyId);
  }

  /** La etiqueta que lee el paciente («2x1», «Combo»…): sale del motor. */
  protected promotionLabel(promo: CampanaDeFarmacia): string {
    return etiquetaDeCampana(promo);
  }

  /** Las primeras campañas, a la vista en la tarjeta de la sede. */
  protected firstPromotions(
    promotions: readonly CampanaDeFarmacia[],
  ): readonly CampanaDeFarmacia[] {
    return promotions.slice(0, VISIBLE_PROMOTIONS);
  }

  /** El resto, plegado: una farmacia con diez campañas no tapa su propia tarjeta. */
  protected remainingPromotions(
    promotions: readonly CampanaDeFarmacia[],
  ): readonly CampanaDeFarmacia[] {
    return promotions.slice(VISIBLE_PROMOTIONS);
  }

  /* ---- el pedido (FAR-I2) -------------------------------------------------- */

  /**
   * Arma el borrador con la sede elegida y navega a la confirmación.
   *
   * El borrador viaja por el cliente de pedidos y no por la URL: renglones,
   * precios y sede ya están acá, y repetir la consulta en la pantalla
   * siguiente sería pedirle dos veces lo mismo al backend.
   */
  protected sendOrder(branch: VisibleBranch): void {
    const lastQuery = this.lastQuery;
    const site = lastQuery?.response.items.find((item) => item.siteId === branch.siteId);
    const requestId = this.orderRequestId;
    if (lastQuery === null || site === undefined || requestId === null) {
      return;
    }
    this.ordersClient.prepararBorrador(
      orderDraftOf(requestId, site, lastQuery.queryable, lastQuery.withoutProduct),
    );
    void this.router.navigate(['/my-account/pharmacy-orders/new']);
  }

  /* ---- la receta al carrito (carril 43 · H5) ------------------------------ */

  /**
   * Vuelca la receta entera al carrito de esta sede y lleva al carrito.
   *
   * Un carrito es de una sola sede, así que esto **reemplaza** lo que hubiera:
   * si ya había uno de otra sede se pregunta primero, y cancelar no cambia
   * nada. Al carrito entra sólo lo que esta sede puede confirmar (ver
   * {@link cartLinesFromDraft}); lo demás se avisa por su nombre — mandar una
   * línea sin producto haría explotar `createOrderRequest` más adelante.
   *
   * No reemplaza a «Enviar pedido»: son dos salidas distintas de la misma
   * decisión. Ahí el pedido se arma de una; acá la receta queda en el carrito
   * y se puede seguir agregando antes de confirmar.
   */
  protected async addPrescriptionToCart(branch: VisibleBranch): Promise<void> {
    const lastQuery = this.lastQuery;
    const site = lastQuery?.response.items.find((item) => item.siteId === branch.siteId);
    const requestId = this.orderRequestId;
    if (lastQuery === null || site === undefined || requestId === null) {
      return;
    }

    const { lines, omitted } = cartLinesFromDraft(
      orderDraftOf(requestId, site, lastQuery.queryable, lastQuery.withoutProduct),
    );
    if (lines.length === 0) {
      this.cartNotice.set('Esta sede no puede confirmar ninguno de los medicamentos.');
      return;
    }

    const currentCart = this.cart.cart();
    if (currentCart !== null && currentCart.site.siteId !== site.siteId) {
      const confirmed = await this.dialogs.confirm({
        title: 'Vaciar y cambiar de farmacia',
        message: `Su carrito es de otra farmacia. Si sigue, se vacía y queda la receta de ${branch.pharmacy} · ${branch.site}.`,
        confirmLabel: 'Vaciar y cambiar',
        cancelLabel: 'Dejarlo como está',
        destructive: true,
      });
      if (!confirmed) {
        return;
      }
    }

    this.cart.replaceWith(cartSiteOf(site), lines, requestId);
    this.cartNotice.set(
      omitted.length === 0
        ? null
        : `${omitted.length} ${omitted.length === 1 ? 'medicamento' : 'medicamentos'} no se pudieron agregar: ${omitted.join(', ')}.`,
    );
    void this.router.navigateByUrl(PHARMACY_CART_ROUTE);
  }

  /* ---- la ubicación: se pide, no se toma ---------------------------------- */

  /**
   * Ofrece la casa y el trabajo del paciente como origen, y preselecciona la
   * casa si existe.
   *
   * A diferencia de `shareLocation`, esto **no pide nada al
   * navegador**: la casa es un dato que la persona ya declaró en su perfil,
   * así que usarla de entrada no es «tomar» su ubicación, es leer lo que ya
   * dio. Si no hay casa pero sí trabajo, el trabajo queda ofrecido como
   * botón — pero no se preselecciona: `casa` es la lectura por defecto más
   * útil, no cualquiera de las dos.
   */
  private seedSavedPlaces(places: SavedPlaces): void {
    const references: ReferencePoint[] = [];
    if (places.home !== null) {
      references.push({ label: 'su casa', ...places.home });
    }
    if (places.work !== null) {
      references.push({ label: 'su trabajo', ...places.work });
    }
    this.savedPlaces.set(references);
    if (places.home !== null) {
      this.origin.set({ label: 'su casa', ...places.home });
    }
  }

  /** Pide la ubicación al navegador. Sólo se llama desde el botón. */
  protected shareLocation(): void {
    const geo = this.document.defaultView?.navigator?.geolocation;
    if (!geo) {
      // Sin API de geolocalización —navegador viejo, o el render del
      // servidor— no hay nada que pedir: quedan las ciudades.
      this.locationDenied.set(true);
      return;
    }

    this.requestingLocation.set(true);
    geo.getCurrentPosition(
      (position) => {
        this.requestingLocation.set(false);
        this.locationDenied.set(false);
        this.measureFrom({
          label: 'su ubicación actual',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      // Denegado, no disponible o vencido llevan al mismo lugar: las
      // alternativas escritas. Distinguirlos no le cambia nada a quien mira.
      () => {
        this.requestingLocation.set(false);
        this.locationDenied.set(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  protected measureFrom(point: ReferencePoint): void {
    this.origin.set(point);
    this.remeasure();
  }

  protected clearOrigin(): void {
    this.origin.set(null);
    this.remeasure();
  }

  /** El origen es uno solo: farmacias e imagenología miden desde el mismo punto. */
  private remeasure(): void {
    this.queryAvailability();
    if (this.imagingStudies !== null) {
      this.searchImaging();
    }
  }

  /* ---- el mapa y las tarjetas hablan de la misma sede ---------------------- */

  /** Lleva la vista a la tarjeta de la sede cuyo CTA se tocó en el popup. */
  protected focusBranch(code: string): void {
    const card = this.document.getElementById(`where-to-buy-branch-${code}`);
    if (card === null) {
      return;
    }
    const reduceMotion =
      this.document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    card.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
}

/** «Ver la que tiene una parte» o «Ver las 3 que tienen una parte», según cuántas sean. */
export function partialCountLabel(howMany: number, singular: string, plural: string): string {
  return howMany === 1
    ? `Ver ${singular} que tiene una parte`
    : `Ver ${plural} ${howMany} que tienen una parte`;
}

/** El índice de la pestaña pedida en `?tab=`; desconocida o ausente, Farmacias. */
export function tabIndexOf(tab: string | null): number {
  const index = (WHERE_TO_BUY_TABS as readonly string[]).indexOf(tab ?? '');
  return index < 0 ? 0 : index;
}
