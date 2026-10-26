import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import { DiagnosticUnitsClient } from '../../../../core/data-access/diagnostic-units/diagnostic-units.client';
import type { DiagnosticUnitCoverageItem } from '../../../../core/data-access/diagnostic-units/diagnostic-units.types';
import { modalidadDeEstudio } from '../../../../core/data-access/diagnostic-units/modalidades';
import { DiagnosticsClient } from '../../../../core/data-access/diagnostics/diagnostics.client';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilityProduct,
  AvailabilityResult,
  AvailabilitySite,
  GeoPoint,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import {
  PharmacyCampaignsClient,
  etiquetaDeCampana,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  aCentavos,
  aTexto,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { CampanaDeFarmacia } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.types';
import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import type {
  CartLine,
  CartSite,
} from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
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
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type {
  EstadoDePin,
  PinMapa,
} from '../../../../shared/components/organisms/map/pin-mapa.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { categoriaDeAnalisis } from '../../diagnostic-orders/diagnostic-orders.types';
import { PHARMACY_CART_ROUTE } from '../../pharmacy/pharmacy.routes';
import { MY_MEDICAL_RECORD_ROUTE } from '../medical-record.routes';
import { aprobadosPorElSeguroDeEjemplo, NOTA_DE_DEMOSTRACION } from './where-to-buy.fixtures';
import { MedicalCentersTab } from './medical-centers-tab/medical-centers-tab';
import { coverageRoute, directionsUrl, type CoverageRoute } from './where-to-buy.route';
import { withDisplayCurrency } from '../../../../core/money/display-currency';

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
const TOPE = 50;

/** Tope de sedes servidas por la consulta de disponibilidad. */
const LIMITE_DE_SEDES = 20;

/** Las letras con las que el mapa y las tarjetas se refieren a la misma sede. */
const CODIGOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/**
 * Un envase por renglón recetado: la receta no declara cantidades, y la
 * confirmación del pedido las muestra tal cual — inventar más sería decidir
 * por la persona.
 */
const CANTIDAD_POR_RENGLON = 1;

/**
 * Puntos de referencia para medir distancias sin entregar la ubicación: las
 * plazas centrales de las ciudades donde la red opera. Son datos públicos del
 * mapa, no datos de la persona — el domicilio y el trabajo declarados por el
 * paciente son otro juego de puntos, `lugaresGuardados` más abajo, que se
 * ofrecen primero porque ya sabemos que le quedan cerca.
 */
const CITIES: readonly PuntoDeReferencia[] = [
  { etiqueta: 'Santa Cruz de la Sierra', lat: -17.7833, lng: -63.1821 },
  { etiqueta: 'La Paz', lat: -16.4957, lng: -68.1335 },
  { etiqueta: 'Cochabamba', lat: -17.3895, lng: -66.1568 },
];

/** Cómo se ordenan las sucursales en la lista (T-E2 · F2.1.4). */
export type OrdenDeSedes = 'receta-completa' | 'mas-cerca' | 'mas-barato';

/**
 * Las tres maneras de mirar la misma lista. La primera es la del backend y es
 * la que se abre: ordenar no vuelve a consultar, sólo reacomoda lo que llegó.
 */
export const OPCIONES_DE_ORDEN: readonly SegmentedOption<OrdenDeSedes>[] = [
  { value: 'receta-completa', label: 'Receta completa primero' },
  { value: 'mas-cerca', label: 'Más cerca' },
  { value: 'mas-barato', label: 'Más barato' },
];

/** Un lugar con nombre desde donde medir distancias. */
export interface PuntoDeReferencia {
  readonly etiqueta: string;
  readonly lat: number;
  readonly lng: number;
}

/** Un renglón de la receta, listo para incluirse en la consulta. */
export interface ItemDeReceta {
  readonly conceptId: string;
  readonly medicamento: string;
  readonly indicacion: string;
  readonly emitida: boolean;
  /**
   * El producto publicado que responde a ese medicamento, o `null` si el
   * directorio no publica ninguno. Hoy es **un representante por
   * medicamento** (el primero publicado): si una sede tiene otra marca del
   * mismo genérico, esta consulta no la ve. TODO(E3): cubrir multimarca
   * cuando el carril E2 decida cómo agrupar productos por concepto.
   */
  readonly productId: string | null;
}

/** La receta ya traducida, con sus renglones consultables. */
interface ListaDeCompra {
  readonly items: readonly ItemDeReceta[];
}

/** Una sede candidata, ya evaluada contra los renglones incluidos. */
interface SedeVisible {
  /** Identifica la sede al armar el borrador del pedido. Jamás se pinta. */
  readonly siteId: string;
  /** La farmacia dueña de la sede: la llave para cruzar sus promociones. */
  readonly pharmacyId: string;
  readonly codigo: string;
  readonly farmacia: string;
  readonly sede: string;
  readonly direccion: string | null;
  /** «1,2 km», o `null` sin origen o sin coordenadas de la sede. */
  readonly distancia: string | null;
  /** La distancia del backend sin formatear: la clave de «Más cerca». */
  readonly distanciaKm: number | null;
  readonly completa: boolean;
  /** Los medicamentos de la receta que esta sede NO puede confirmar. */
  readonly faltantes: readonly string[];
  /** Los medicamentos que sí confirma, por concepto: lo que pesa el recorrido. */
  readonly covers: ReadonlySet<string>;
  /** «Cómo llegar»: el punto en el mapa, o `null` sin coordenadas. */
  readonly directions: string | null;
  /** «96.50 BOB», o `null` si falta un precio o las listas mezclan monedas. */
  readonly total: string | null;
  /** El total en centavos, o `null` si no es un importe: la clave de «Más barato». */
  readonly totalCentavos: number | null;
  readonly retiro: boolean | null;
  readonly delivery: boolean | null;
  /** Coordenadas reales de la sede; `null` si el directorio no las publica. */
  readonly lat: number | null;
  readonly lng: number | null;
  /** La misma sede evaluada sólo sobre lo aprobado por el seguro (demostración). */
  readonly conSeguro: CoberturaConSeguro;
}

/**
 * Una sede mirada con seguro (T-E2 · F2.2.2): la cobertura cuenta sólo los
 * renglones aprobados, y el precio se parte en lo aprobado y lo que paga la
 * persona. Se calcula junto con la vista normal para que el conmutador no
 * vuelva a consultar nada.
 */
export interface CoberturaConSeguro {
  /** Cuántos renglones incluidos aprueba el seguro: el «M» de «N de M». */
  readonly aprobados: number;
  /** Cuántos de esos puede confirmar esta sede: el «N». */
  readonly cubiertos: number;
  readonly completa: boolean;
  /** Los aprobados que esta sede NO puede confirmar. */
  readonly faltantes: readonly string[];
  /** «68.00 BOB» por lo aprobado disponible, o `null` si falta un precio. */
  readonly aprobado: string | null;
  /** «28.50 BOB» por lo no aprobado disponible, o `null` si falta un precio. */
  readonly aCargo: string | null;
}

/** El resultado de la consulta, listo para pintarse. */
interface ResultadoDeSedes {
  readonly sedes: readonly SedeVisible[];
  /** Medicamentos incluidos sin producto publicado: nadie puede confirmarlos. */
  readonly sinProducto: readonly string[];
  /** Renglones incluidos que aprueba el seguro; `0` vacía la variante con seguro. */
  readonly aprobadosIncluidos: number;
}

/** Sin sucursales que mostrar: la pantalla no llegó a consultar. */
const SIN_SEDES: ResultadoDeSedes = { sedes: [], sinProducto: [], aprobadosIncluidos: 0 };

/** Una sede como parada del recorrido: la misma, con la distancia que pesa el criterio. */
type RouteStop = SedeVisible & { readonly distanceKm: number | null };

/** Un estudio pedido que todavía no tiene resultado, listo para la búsqueda. */
interface PendingStudy {
  /** El concepto del estudio: el `codeConceptId` de la orden, que es el `study_concept_id` de la oferta. */
  readonly conceptId: string;
  readonly name: string;
}

/** Un centro de imagenología, evaluado contra los estudios pendientes. */
interface ImagingCenter {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  /** «1,2 km», o `null` sin origen o sin coordenadas del centro. */
  readonly distance: string | null;
  readonly complete: boolean;
  /** Los estudios que este centro no ofrece, por su nombre. */
  readonly missing: readonly string[];
  readonly directions: string | null;
}

/** Lo que pinta la pestaña de imagenología. */
interface ImagingResult {
  readonly studies: readonly PendingStudy[];
  readonly centers: readonly ImagingCenter[];
}

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
 * sin volver a consultar; ver {@link ordenarSedes}.
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
 * trabajo (subtarea B.2) son la excepción, y no una contradicción: son datos
 * que la persona **ya declaró** en su perfil, no algo que el navegador
 * entregue sin que se sepa. Por eso la casa se preselecciona sin pedir
 * permiso — la primera consulta de disponibilidad ya sale con ese origen —,
 * y las ciudades siguen ahí para quien no declaró ninguno de los dos.
 *
 * ## El puente receta → producto
 *
 * La receta trae el medicamento del vademécum (`medicationConceptId`); el
 * directorio publica **productos**. `GET /pharmacy/products?conceptId=` es el
 * puente, con un representante por medicamento (ver {@link ItemDeReceta}).
 * Un medicamento sin producto publicado no puede consultarse: se dice
 * abiertamente y ninguna sede se declara «completa» mientras tanto.
 *
 * ## Cero identificadores visibles
 *
 * Todo lo que se pinta son nombres: medicamentos por su etiqueta de
 * terminología, faltantes por su nombre, sedes por el suyo. Los uuid viajan
 * en las consultas y no llegan nunca a la plantilla.
 */
/** Cuántas campañas se ven de entrada en la tarjeta de una sede; el resto, plegado. */
const PROMOCIONES_VISIBLES = 3;

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
  private readonly documento = inject(DOCUMENT);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly rutaDeHistoria = MY_MEDICAL_RECORD_ROUTE;

  /**
   * Las salidas de las otras dos pestañas: qué me pidieron, y qué lugares hay
   * cuando la búsqueda por cobertura no tiene nada que mostrar.
   */
  protected readonly myStudiesRoute = MY_STUDIES_ROUTE;
  protected readonly laboratoryDirectoryRoute = LABORATORY_DIRECTORY_ROUTE;
  protected readonly ciudades = CITIES;
  protected readonly opcionesDeOrden = OPCIONES_DE_ORDEN;
  protected readonly notaDeDemostracion = NOTA_DE_DEMOSTRACION;

  /* ---- la pestaña activa, en la URL ---------------------------------------- */

  protected readonly tabIndex = signal(
    tabIndexOf(this.route.snapshot.queryParamMap.get('tab')),
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
   * real no se ofrece: `conSeguro` queda apagado y la lista es la de la
   * consulta, sin más. Ver `core/mock/sample-data.ts`.
   */
  protected readonly sampleData = inject(SAMPLE_DATA_ENABLED);

  /**
   * El domicilio y el trabajo del paciente, como puntos de referencia
   * (subtarea B.2). Vacío hasta que el perfil responde; si no declaró
   * ninguno de los dos, se queda vacío y sólo quedan las ciudades.
   */
  protected readonly lugaresGuardados = signal<readonly PuntoDeReferencia[]>([]);

  /** La última respuesta cruda: el borrador necesita los precios por línea. */
  private ultimaConsulta: {
    readonly respuesta: AvailabilityResult;
    readonly consultables: readonly (ItemDeReceta & { productId: string })[];
    readonly sinProducto: readonly string[];
  } | null = null;

  protected readonly lista = signal<ViewState<ListaDeCompra>>(loading());
  protected readonly resultados = signal<ViewState<ResultadoDeSedes>>(loading());

  /** Qué medicamentos entran en la consulta, por concepto. */
  private readonly incluidos = signal<ReadonlySet<string>>(new Set());

  /**
   * Lo que no entró al carrito, dicho por su nombre (carril 43 · H5).
   *
   * `null` es «no hay nada que avisar», no «no se intentó»: sólo se llena
   * después de volcar una receta que dejó medicamentos afuera.
   */
  protected readonly avisoDelCarrito = signal<string | null>(null);

  /** Desde dónde se miden las distancias; `null` = sin origen, sin permiso pedido. */
  protected readonly origen = signal<PuntoDeReferencia | null>(null);
  protected readonly pidiendoUbicacion = signal(false);
  protected readonly ubicacionDenegada = signal(false);

  protected readonly items = computed(() => dataOf(this.lista())?.items ?? []);
  protected readonly resultado = computed(() => dataOf(this.resultados()));

  /* ---- el orden y la variante con seguro (T-E2) --------------------------- */

  protected readonly orden = signal<OrdenDeSedes>('receta-completa');

  /** El conmutador de demostración de la variante con seguro. */
  protected readonly conSeguro = signal(false);

  /** Qué renglones aprueba el seguro, de ejemplo, sobre la receta entera. */
  private readonly aprobadosPorElSeguro = computed(() =>
    aprobadosPorElSeguroDeEjemplo(this.items().map((item) => item.conceptId)),
  );

  /**
   * Por defecto se muestran solo las sucursales que tienen todo (P-19-4). Las
   * que tienen una parte se ven a pedido: sirven cuando ninguna tiene todo, y
   * el recorrido sugerido las sigue considerando igual.
   */
  protected readonly showPartialPharmacies = signal(false);

  /** «Completa» es contra lo que se mira: la receta entera o, con seguro, lo aprobado. */
  private isComplete(sede: SedeVisible): boolean {
    return this.conSeguro() ? sede.conSeguro.completa : sede.completa;
  }

  /** Cuántas sucursales quedan fuera de la vista por defecto. */
  protected readonly partialPharmacyCount = computed(
    () => (this.resultado()?.sedes ?? []).filter((sede) => !this.isComplete(sede)).length,
  );

  protected readonly partialPharmaciesLabel = computed(() =>
    this.showPartialPharmacies()
      ? 'Mostrar solo las que tienen todo'
      : partialCountLabel(this.partialPharmacyCount(), 'la', 'las'),
  );

  /** Las sucursales que se ven: la lista y el mapa hablan de las mismas. */
  private readonly visibleBranches = computed(() => {
    const sedes = this.resultado()?.sedes ?? [];
    return this.showPartialPharmacies() ? sedes : sedes.filter((sede) => this.isComplete(sede));
  });

  /** La lista en el orden elegido. Una copia: la respuesta no se toca. */
  protected readonly sedesOrdenadas = computed(() =>
    ordenarSedes(this.visibleBranches(), this.orden()),
  );

  /**
   * El estado de las sucursales tal como se pinta. Es el mismo de la consulta
   * —cargando, vacío y error pasan intactos—, salvo un caso propio de la
   * variante: con seguro y ningún renglón incluido aprobado no hay nada que
   * evaluar, y eso se dice con su salida en vez de mostrar «0 de 0».
   */
  protected readonly estadoDeSedes = computed<ViewState<ResultadoDeSedes>>(() => {
    const estado = this.resultados();
    const datos = dataOf(estado);
    if (
      this.conSeguro() &&
      datos !== null &&
      datos.sedes.length > 0 &&
      datos.aprobadosIncluidos === 0
    ) {
      return empty(
        { label: 'Volver a mi historia', route: MY_MEDICAL_RECORD_ROUTE },
        'Con el seguro, ninguno de los medicamentos que eligió está aprobado. Apague la variante con seguro para ver la receta completa.',
      );
    }
    return estado;
  });

  /** Las sedes que el mapa puede ubicar: las que tienen coordenadas. */
  protected readonly sedesEnElMapa = computed(() =>
    this.visibleBranches().filter(
      (sede): sede is SedeVisible & { lat: number; lng: number } =>
        sede.lat !== null && sede.lng !== null,
    ),
  );

  /** La sede resaltada, compartida en two-way entre el mapa y las tarjetas. */
  protected readonly sedeElegida = signal<string | null>(null);

  /** Las sedes ubicables, traducidas al contrato del organismo de mapa. */
  protected readonly pinesDeSedes = computed<readonly PinMapa[]>(() =>
    this.sedesEnElMapa().map((sede) => ({
      // La letra de la tarjeta es la referencia compartida: ningún uuid
      // llega al mapa, la misma regla de cero identificadores visibles.
      id: sede.codigo,
      codigo: sede.codigo,
      lat: sede.lat,
      lng: sede.lng,
      titulo: `${sede.farmacia} · ${sede.sede}`,
      subtitulo: subtituloDePin(sede, this.conSeguro()),
      estado: estadoDePin(sede, this.conSeguro()),
      ctaEtiqueta: 'Ver en la lista',
    })),
  );

  /**
   * El recorrido que cubre los medicamentos consultables (ver
   * `where-to-buy.route.ts`). Con la variante con seguro no se ofrece: esa
   * vista evalúa otra receta, la aprobada, y mezclar los dos criterios en la
   * misma pantalla confundiría más de lo que ayuda.
   */
  protected readonly coverage = computed<CoverageRoute<RouteStop> | null>(() => {
    const sedes = this.resultado()?.sedes ?? [];
    if (this.conSeguro() || sedes.length === 0) {
      return null;
    }
    const needed = this.items()
      .filter((item) => item.productId !== null && this.incluidos().has(item.conceptId))
      .map((item) => item.conceptId);
    if (needed.length === 0) {
      return null;
    }
    return coverageRoute(
      sedes.map((sede) => ({ ...sede, distanceKm: sede.distanciaKm })),
      needed,
    );
  });

  /** Los medicamentos de la receta, por su nombre, a partir de sus conceptos. */
  protected namesOf(conceptIds: readonly string[]): string {
    return this.items()
      .filter((item) => conceptIds.includes(item.conceptId))
      .map((item) => item.medicamento)
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
  protected coveredBy(sede: SedeVisible): string {
    return this.items()
      .filter((item) => sede.covers.has(item.conceptId) && this.incluidos().has(item.conceptId))
      .map((item) => item.medicamento)
      .join(', ');
  }

  protected readonly etiquetaDelMapa = computed(() => {
    const cantidad = this.sedesEnElMapa().length;
    const marcadas = cantidad === 1 ? '1 sucursal marcada' : `${cantidad} sucursales marcadas`;
    return `${marcadas} en el mapa. La lista completa, con dirección y distancia en línea recta, está en las tarjetas debajo.`;
  });

  constructor() {
    if (this.perfil === null) {
      // No es un vacío de datos ni un error: la pantalla no le corresponde a
      // esta cuenta, y el aviso lo dice con su propia salida.
      this.lista.set(empty({ label: 'Ir a mi historia', route: MY_MEDICAL_RECORD_ROUTE }));
      this.resultados.set(ready(SIN_SEDES));
      return;
    }
    this.cargar();
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
    if (this.imagingRequested || this.perfil === null) {
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
    const origen = this.origen();
    this.diagnosticUnits
      .searchCoverage({
        studyConceptIds: studies.map((study) => study.conceptId),
        kind: 'IMAGING',
        origin: origen === null ? undefined : geoPuntoDe(origen),
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

  protected cargar(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.lista.set(loading());
    this.resultados.set(loading());

    this.clinical
      .getSummary(perfil, TOPE)
      .pipe(
        switchMap((resumen) => {
          const recetada = resumen.medicationRequests.find((fila) => fila.id === this.requestId);
          if (recetada === undefined) {
            return of(null);
          }
          const filas = renglonesDe(resumen.medicationRequests);
          return forkJoin({
            filas: of(filas),
            recetada: of(recetada),
            // Sin etiquetas la pantalla no puede nombrar nada: acá sí son
            // parte del dato, no un adorno — pero perderlas tampoco justifica
            // perder la consulta: el renglón sale como «Sin registrar».
            etiquetas: this.terminology
              .readConceptLabels(filas.map((fila) => fila.medicationConceptId))
              .pipe(catchError(() => of<ConceptLabels>(new Map()))),
            productos: this.productosDe(filas.map((fila) => fila.medicationConceptId)),
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
        next: (carga) => {
          if (carga === null) {
            this.lista.set(notFound({ label: 'Volver a mi historia', route: MY_MEDICAL_RECORD_ROUTE }));
            this.resultados.set(ready(SIN_SEDES));
            return;
          }
          const items = carga.filas.map((fila) => itemDe(fila, carga.etiquetas, carga.productos));
          // Entran a la consulta la receta que se tocó y las ya emitidas: son
          // las que la persona puede efectivamente ir a comprar.
          this.incluidos.set(
            new Set(
              items
                .filter(
                  (item) => item.emitida || item.conceptId === carga.recetada.medicationConceptId,
                )
                .map((item) => item.conceptId),
            ),
          );
          this.lista.set(ready({ items }));
          this.sembrarLugaresGuardados(carga.places);
          this.consultar();
        },
        error: (error: unknown) => {
          this.lista.set(errorToViewState<ListaDeCompra>(error));
          this.resultados.set(ready(SIN_SEDES));
        },
      });
  }

  /** El producto representante de cada medicamento, en paralelo. */
  private productosDe(conceptIds: readonly string[]) {
    return forkJoin(
      conceptIds.map((conceptId) =>
        this.pharmacy
          .searchProducts({ conceptId, limit: 1 })
          .pipe(map((pagina) => [conceptId, pagina.items[0]?.id ?? null] as const)),
      ),
    ).pipe(map((pares) => new Map<string, string | null>(pares)));
  }

  /* ---- la selección ------------------------------------------------------- */

  protected estaIncluido(item: ItemDeReceta): boolean {
    return this.incluidos().has(item.conceptId);
  }

  /** Si el seguro aprueba el renglón, de ejemplo (T-E2). */
  protected estaAprobado(item: ItemDeReceta): boolean {
    return this.aprobadosPorElSeguro().has(item.conceptId);
  }

  protected readonly coberturaDeLoAprobado = coberturaDeLoAprobado;

  protected alternar(item: ItemDeReceta, incluir: boolean): void {
    const proximos = new Set(this.incluidos());
    if (incluir) {
      proximos.add(item.conceptId);
    } else {
      proximos.delete(item.conceptId);
    }
    this.incluidos.set(proximos);
    this.consultar();
  }

  /* ---- la consulta -------------------------------------------------------- */

  protected consultar(): void {
    this.ultimaConsulta = null;
    const incluidos = this.items().filter((item) => this.incluidos().has(item.conceptId));
    if (incluidos.length === 0) {
      this.resultados.set(
        empty(
          { label: 'Volver a mi historia', route: MY_MEDICAL_RECORD_ROUTE },
          'Elija al menos un medicamento para consultar dónde comprarlo.',
        ),
      );
      return;
    }

    const sinProducto = incluidos
      .filter((item) => item.productId === null)
      .map((item) => item.medicamento);
    const consultables = incluidos.filter(
      (item): item is ItemDeReceta & { productId: string } => item.productId !== null,
    );

    if (consultables.length === 0) {
      this.resultados.set(
        empty(
          { label: 'Volver a mi historia', route: MY_MEDICAL_RECORD_ROUTE },
          `No hay un producto publicado para: ${sinProducto.join(', ')}. El pedido completo no se puede enviar.`,
        ),
      );
      return;
    }

    // Con seguro se evalúa sobre lo aprobado: lo que no tiene producto también
    // cuenta, porque ninguna sede puede confirmarlo.
    const aprobados = this.aprobadosPorElSeguro();
    const sinProductoPorConcepto = incluidos.filter((item) => item.productId === null);

    this.resultados.set(loading());
    const origen = this.origen();
    this.pharmacy
      .availability({
        productIds: consultables.map((item) => item.productId),
        origin: origen === null ? undefined : geoPuntoDe(origen),
        limit: LIMITE_DE_SEDES,
      })
      .subscribe({
        next: (respuesta) => {
          if (respuesta.items.length === 0) {
            this.resultados.set(
              empty(
                { label: 'Volver a mi historia', route: MY_MEDICAL_RECORD_ROUTE },
                'Ninguna sucursal puede confirmar hoy los medicamentos de su receta.',
              ),
            );
            return;
          }
          this.ultimaConsulta = { respuesta, consultables, sinProducto };
          this.sembrarPromociones(respuesta);
          this.resultados.set(
            ready(evaluar(respuesta, consultables, sinProducto, sinProductoPorConcepto, aprobados)),
          );
        },
        error: (error: unknown) => this.resultados.set(errorToViewState<ResultadoDeSedes>(error)),
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
  private sembrarPromociones(respuesta: AvailabilityResult): void {
    for (const sede of respuesta.items) {
      // `flatMap` y no `filter` + `map`: el filtro no estrecha el tipo de
      // `price` y obligaría a una aserción por cada uso.
      const catalogo = sede.products.flatMap((producto) => {
        const precio = producto.price;
        if (precio === null) {
          return [];
        }
        return [
          {
            productId: producto.productId,
            nombre: producto.brandName ?? producto.genericName ?? producto.productCode,
            presentacion: presentacionDe(producto),
            // Lo que paga el paciente cuando la lista lo distingue: es el
            // precio sobre el que la promoción tiene que descontar.
            precio: precio.patientAmount ?? precio.unitAmount,
            moneda: precio.currency?.code ?? '',
          },
        ];
      });
      this.campaigns.sembrarPara(sede.pharmacyId, sede.pharmacyName, catalogo);
    }
  }

  /** Cuántas promociones vigentes tiene la farmacia de esta sede. */
  protected promocionesDe(sede: SedeVisible): readonly CampanaDeFarmacia[] {
    return this.campaigns.campanasVigentes(sede.pharmacyId);
  }

  /** La etiqueta que lee el paciente («2x1», «Combo»…): sale del motor. */
  protected etiquetaDe(promo: CampanaDeFarmacia): string {
    return etiquetaDeCampana(promo);
  }

  /** Las primeras campañas, a la vista en la tarjeta de la sede. */
  protected primerasPromociones(
    promociones: readonly CampanaDeFarmacia[],
  ): readonly CampanaDeFarmacia[] {
    return promociones.slice(0, PROMOCIONES_VISIBLES);
  }

  /** El resto, plegado: una farmacia con diez campañas no tapa su propia tarjeta. */
  protected restoDePromociones(
    promociones: readonly CampanaDeFarmacia[],
  ): readonly CampanaDeFarmacia[] {
    return promociones.slice(PROMOCIONES_VISIBLES);
  }

  /* ---- el pedido (FAR-I2) -------------------------------------------------- */

  /**
   * Arma el borrador con la sede elegida y navega a la confirmación.
   *
   * El borrador viaja por el cliente de pedidos y no por la URL: renglones,
   * precios y sede ya están acá, y repetir la consulta en la pantalla
   * siguiente sería pedirle dos veces lo mismo al backend.
   */
  protected enviarPedido(sede: SedeVisible): void {
    const consulta = this.ultimaConsulta;
    const sitio = consulta?.respuesta.items.find((item) => item.siteId === sede.siteId);
    if (consulta === null || sitio === undefined) {
      return;
    }
    this.ordersClient.prepararBorrador(
      borradorDePedido(this.requestId, sitio, consulta.consultables, consulta.sinProducto),
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
  protected async agregarRecetaAlCarrito(sede: SedeVisible): Promise<void> {
    const consulta = this.ultimaConsulta;
    const sitio = consulta?.respuesta.items.find((item) => item.siteId === sede.siteId);
    if (consulta === null || sitio === undefined) {
      return;
    }

    const { lines, omitted } = cartLinesFromDraft(
      borradorDePedido(this.requestId, sitio, consulta.consultables, consulta.sinProducto),
    );
    if (lines.length === 0) {
      this.avisoDelCarrito.set('Esta sede no puede confirmar ninguno de los medicamentos.');
      return;
    }

    const carrito = this.cart.cart();
    if (carrito !== null && carrito.site.siteId !== sitio.siteId) {
      const confirmado = await this.dialogs.confirm({
        title: 'Vaciar y cambiar de farmacia',
        message: `Su carrito es de otra farmacia. Si sigue, se vacía y queda la receta de ${sede.farmacia} · ${sede.sede}.`,
        confirmLabel: 'Vaciar y cambiar',
        cancelLabel: 'Dejarlo como está',
        destructive: true,
      });
      if (!confirmado) {
        return;
      }
    }

    this.cart.replaceWith(sedeDelCarrito(sitio), lines, this.requestId);
    this.avisoDelCarrito.set(
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
   * A diferencia de `compartirUbicacion`, esto **no pide nada al
   * navegador**: la casa es un dato que la persona ya declaró en su perfil,
   * así que usarla de entrada no es «tomar» su ubicación, es leer lo que ya
   * dio. Si no hay casa pero sí trabajo, el trabajo queda ofrecido como
   * botón — pero no se preselecciona: `casa` es la lectura por defecto más
   * útil, no cualquiera de las dos.
   */
  private sembrarLugaresGuardados(places: SavedPlaces): void {
    const referencias: PuntoDeReferencia[] = [];
    if (places.home !== null) {
      referencias.push({ etiqueta: 'su casa', ...places.home });
    }
    if (places.work !== null) {
      referencias.push({ etiqueta: 'su trabajo', ...places.work });
    }
    this.lugaresGuardados.set(referencias);
    if (places.home !== null) {
      this.origen.set({ etiqueta: 'su casa', ...places.home });
    }
  }

  /** Pide la ubicación al navegador. Sólo se llama desde el botón. */
  protected compartirUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      // Sin API de geolocalización —navegador viejo, o el render del
      // servidor— no hay nada que pedir: quedan las ciudades.
      this.ubicacionDenegada.set(true);
      return;
    }

    this.pidiendoUbicacion.set(true);
    geo.getCurrentPosition(
      (posicion) => {
        this.pidiendoUbicacion.set(false);
        this.ubicacionDenegada.set(false);
        this.medirDesde({
          etiqueta: 'su ubicación actual',
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
      },
      // Denegado, no disponible o vencido llevan al mismo lugar: las
      // alternativas escritas. Distinguirlos no le cambia nada a quien mira.
      () => {
        this.pidiendoUbicacion.set(false);
        this.ubicacionDenegada.set(true);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  protected medirDesde(punto: PuntoDeReferencia): void {
    this.origen.set(punto);
    this.remeasure();
  }

  protected quitarOrigen(): void {
    this.origen.set(null);
    this.remeasure();
  }

  /** El origen es uno solo: farmacias e imagenología miden desde el mismo punto. */
  private remeasure(): void {
    this.consultar();
    if (this.imagingStudies !== null) {
      this.searchImaging();
    }
  }

  /* ---- el mapa y las tarjetas hablan de la misma sede ---------------------- */

  /** Lleva la vista a la tarjeta de la sede cuyo CTA se tocó en el popup. */
  protected enfocarSede(codigo: string): void {
    const tarjeta = this.documento.getElementById(`compra-sede-${codigo}`);
    if (tarjeta === null) {
      return;
    }
    const reducirMovimiento =
      this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    tarjeta.scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'center' });
  }
}

/** Un renglón por medicamento: dos recetas del mismo remedio son una compra. */
function renglonesDe(recetas: readonly MedicationRequest[]): readonly MedicationRequest[] {
  const porConcepto = new Map<string, MedicationRequest>();
  for (const receta of recetas) {
    const previa = porConcepto.get(receta.medicationConceptId);
    // La emitida le gana a la que no lo está: es la que se puede comprar.
    if (previa === undefined || (previa.issuedAt === undefined && receta.issuedAt !== undefined)) {
      porConcepto.set(receta.medicationConceptId, receta);
    }
  }
  return [...porConcepto.values()];
}

/** El renglón ya traducido y con su producto representante. */
function itemDe(
  fila: MedicationRequest,
  etiquetas: ConceptLabels,
  productos: ReadonlyMap<string, string | null>,
): ItemDeReceta {
  return {
    conceptId: fila.medicationConceptId,
    medicamento: etiquetas.get(fila.medicationConceptId)?.display ?? SIN_DATO,
    indicacion: [fila.doseText, fila.frequencyText].filter(Boolean).join(' · '),
    emitida: fila.issuedAt !== undefined,
    productId: productos.get(fila.medicationConceptId) ?? null,
  };
}

function geoPuntoDe(punto: PuntoDeReferencia): GeoPoint {
  return { lat: punto.lat, lng: punto.lng };
}

/** «1,2 km»: un decimal y coma, como el resto de la pantalla. */
function formatKm(km: number): string {
  return `${km.toFixed(1).replace('.', ',')} km`;
}

/** «Ver la que tiene una parte» o «Ver las 3 que tienen una parte», según cuántas sean. */
export function partialCountLabel(cantidad: number, singular: string, plural: string): string {
  return cantidad === 1
    ? `Ver ${singular} que tiene una parte`
    : `Ver ${plural} ${cantidad} que tienen una parte`;
}

/** El índice de la pestaña pedida en `?tab=`; desconocida o ausente, Farmacias. */
export function tabIndexOf(tab: string | null): number {
  const index = (WHERE_TO_BUY_TABS as readonly string[]).indexOf(tab ?? '');
  return index < 0 ? 0 : index;
}

/**
 * Los estudios de imagenología sin resultado, uno por concepto. Cuenta como
 * imagenología la orden cuya categoría lo dice, o la que no trae categoría y
 * cuyo estudio tiene una modalidad de imagen; una orden de laboratorio nunca.
 *
 * La búsqueda va por concepto y no por el `studyCode` de la oferta: ese es el
 * código propio de cada centro; el concepto es lo que la orden y la oferta
 * comparten. El `code` del concepto sólo sirve para reconocer la modalidad.
 */
export function pendingImagingStudies(
  orders: readonly PatientOrder[],
  labels: ConceptLabels,
): readonly PendingStudy[] {
  const byConcept = new Map<string, PendingStudy>();
  for (const order of orders) {
    const study = labels.get(order.codeConceptId);
    if (study === undefined || order.hasReleasedResult) {
      continue;
    }
    const category = categoriaDeAnalisis(
      order.categoryConceptId === undefined ? undefined : labels.get(order.categoryConceptId)?.code,
    );
    // `LAB` también es una modalidad (la toma de muestras): sin categoría, un
    // análisis no es imagen.
    const modality = modalidadDeEstudio(study.code);
    const imaging =
      category === 'IMAGING' || (category === 'OTHER' && modality !== null && modality !== 'LAB');
    if (imaging) {
      byConcept.set(order.codeConceptId, { conceptId: order.codeConceptId, name: study.display });
    }
  }
  return [...byConcept.values()];
}

/** Un centro de la búsqueda, con sus faltantes dichos por su nombre. */
function imagingCenterOf(
  item: DiagnosticUnitCoverageItem,
  studies: readonly PendingStudy[],
): ImagingCenter {
  const nameOf = new Map(studies.map((study) => [study.conceptId, study.name]));
  return {
    id: item.id,
    name: item.name,
    address: item.addressText,
    distance: item.distanceKm === null ? null : formatKm(item.distanceKm),
    complete: item.complete,
    missing: item.missingStudyConceptIds.map((id) => nameOf.get(id) ?? 'Un estudio pedido'),
    directions: directionsUrl(item.latitude, item.longitude),
  };
}

/**
 * El renglón secundario del pin: distancia rotulada y dirección, lo que haya;
 * con seguro, primero la cobertura de lo aprobado — lo mismo que dice la tarjeta.
 */
function subtituloDePin(sede: SedeVisible, conSeguro: boolean): string | undefined {
  const partes = [
    conSeguro ? coberturaDeLoAprobado(sede.conSeguro) : null,
    sede.distancia === null ? null : `${sede.distancia} en línea recta`,
    sede.direccion,
  ].filter((parte): parte is string => parte !== null);
  return partes.length === 0 ? undefined : partes.join(' · ');
}

/** El estado del pin: el mismo criterio que el badge de la tarjeta. */
function estadoDePin(sede: SedeVisible, conSeguro: boolean): EstadoDePin {
  if (conSeguro) {
    return sede.conSeguro.completa
      ? { etiqueta: 'Tiene todo lo aprobado', tono: 'success' }
      : { etiqueta: 'Le falta algo aprobado', tono: 'warning' };
  }
  return sede.completa
    ? { etiqueta: 'Tiene todo', tono: 'success' }
    : { etiqueta: 'Le falta algo', tono: 'warning' };
}

/** «Cobertura de lo aprobado: 3 de 3». */
export function coberturaDeLoAprobado(cobertura: CoberturaConSeguro): string {
  return `Cobertura de lo aprobado: ${cobertura.cubiertos} de ${cobertura.aprobados}`;
}

/**
 * Las sedes en el orden elegido (T-E2 · F2.1.4). **Pura y sin mutar**: devuelve
 * la misma lista con «Receta completa primero» —el orden del backend, sin
 * recalcular nada— y una copia reacomodada con las otras dos.
 *
 * - «Más cerca»: distancia ascendente.
 * - «Más barato»: total ascendente, en centavos.
 * - Un valor ausente o que no es un número finito no negativo va al final;
 *   el `0` es un valor válido (una sede a 0 km, un total 0.00).
 * - Los empates, entre sí y entre ausentes, conservan el orden del backend:
 *   el índice original desempata, sin depender de la estabilidad del `sort`.
 */
export function ordenarSedes<
  T extends { readonly distanciaKm: number | null; readonly totalCentavos: number | null },
>(sedes: readonly T[], orden: OrdenDeSedes): readonly T[] {
  if (orden === 'receta-completa') {
    return sedes;
  }
  const claveDe = (sede: T) => (orden === 'mas-cerca' ? sede.distanciaKm : sede.totalCentavos);
  return sedes
    .map((sede, indice) => ({ sede, indice, clave: claveValida(claveDe(sede)) }))
    .sort((a, b) => {
      if (a.clave === null || b.clave === null) {
        if (a.clave === b.clave) {
          return a.indice - b.indice;
        }
        return a.clave === null ? 1 : -1;
      }
      return a.clave - b.clave || a.indice - b.indice;
    })
    .map(({ sede }) => sede);
}

/** Un número utilizable para ordenar, o `null`. `0` vale; `NaN` e infinitos no. */
function claveValida(valor: number | null | undefined): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;
}

/**
 * El borrador del pedido (FAR-I2): los renglones incluidos, evaluados contra
 * la sede elegida, con el precio que la sede publica.
 *
 * Exportada a propósito: es pura y el spec la ejercita directo — el clic que
 * la dispara sólo existe con la demostración encendida.
 */
export function borradorDePedido(
  requestId: string,
  sitio: AvailabilitySite,
  consultables: readonly (ItemDeReceta & { productId: string })[],
  sinProducto: readonly string[],
): BorradorDePedido {
  const porProducto = new Map(sitio.products.map((producto) => [producto.productId, producto]));
  const lineas: readonly LineaDePedido[] = [
    ...consultables.map((item): LineaDePedido => {
      const producto = porProducto.get(item.productId);
      const disponible =
        producto !== undefined && !sitio.missingProductIds.includes(item.productId);
      const precio = producto?.price?.patientAmount ?? producto?.price?.unitAmount ?? null;
      return {
        productId: item.productId,
        medicamento: item.medicamento,
        presentacion: presentacionDe(producto),
        cantidad: CANTIDAD_POR_RENGLON,
        precio: disponible ? precio : null,
        moneda:
          disponible && precio !== null
            ? (producto?.price?.currency?.code ?? sitio.currency?.code ?? null)
            : null,
        disponible,
      };
    }),
    // Sin producto publicado nadie puede confirmarlo: viaja igual en el
    // pedido, dicho claro, para que la farmacia sepa qué más pide la receta.
    ...sinProducto.map((medicamento): LineaDePedido => ({
      productId: null,
      medicamento,
      presentacion: null,
      cantidad: CANTIDAD_POR_RENGLON,
      precio: null,
      moneda: null,
      disponible: false,
    })),
  ];
  return {
    requestId,
    siteId: sitio.siteId,
    pharmacyId: sitio.pharmacyId,
    farmacia: sitio.pharmacyName,
    sede: sitio.siteName,
    direccion: sitio.addressText,
    lineas,
    totalEstimado: sitio.totalAmount,
    moneda: sitio.currency?.code ?? null,
  };
}

/**
 * El borrador, convertido en las líneas que el carrito acepta (carril 43 · H5).
 *
 * ## Qué entra y qué no
 *
 * Sólo las líneas con `productId` **y** `disponible`. Las otras dos clases se
 * quedan afuera a propósito y vuelven en `omitted` con su nombre:
 *
 * - **sin producto publicado** (`productId === null`): no existe nada que
 *   agregar, y `createOrderRequest` rechaza esa línea con
 *   `UnsupportedPharmacyOrderLineError`;
 * - **sin stock en esta sede** (`disponible === false`): existe el producto,
 *   pero esta sede no lo puede confirmar hoy.
 *
 * Es la decisión Q-J3 del plan: al carrito va sólo lo disponible, lo faltante
 * se avisa. Meterlo igual sería armar un pedido que la farmacia no puede
 * cumplir y que el backend rechaza.
 *
 * ## Toda línea de una receta exige receta
 *
 * `requiresPrescription: true` sin excepción: el borrador nace de una
 * `medicationRequest`, no del catálogo libre. El carrito lo acepta porque
 * `replaceWith` lo arma **con** `requestId` — que es justamente lo que
 * distingue este camino del «Agregar» suelto de la tienda.
 *
 * Exportada porque es pura y el spec la ejercita directo.
 */
export function cartLinesFromDraft(borrador: BorradorDePedido): {
  lines: CartLine[];
  omitted: string[];
} {
  const lines: CartLine[] = [];
  const omitted: string[] = [];
  for (const linea of borrador.lineas) {
    if (linea.productId === null || !linea.disponible) {
      omitted.push(linea.medicamento);
      continue;
    }
    lines.push({
      productId: linea.productId,
      name: linea.medicamento,
      presentation: linea.presentacion,
      quantity: linea.cantidad,
      unitAmount: linea.precio,
      currency: linea.moneda,
      requiresPrescription: true,
      medicationConceptId: linea.conceptId ?? null,
    });
  }
  return { lines, omitted };
}

/** La sede del carrito, tal como la publica la disponibilidad. */
function sedeDelCarrito(sitio: AvailabilitySite): CartSite {
  return {
    pharmacyId: sitio.pharmacyId,
    pharmacyName: sitio.pharmacyName,
    siteId: sitio.siteId,
    siteName: sitio.siteName,
    addressText: sitio.addressText,
  };
}

/** «500 mg · caja x 20», con lo que el directorio publique. */
function presentacionDe(producto: AvailabilityProduct | undefined): string | null {
  const partes = [producto?.strengthText, producto?.packageSizeText].filter(
    (parte): parte is string => typeof parte === 'string' && parte !== '',
  );
  return partes.length === 0 ? null : partes.join(' · ');
}

/**
 * Las sedes del backend, evaluadas contra la receta.
 *
 * La «completa» del backend habla de los productos consultados; acá se exige
 * además que ningún medicamento incluido haya quedado afuera por no tener
 * producto publicado — una sede no puede declararse completa sobre una
 * consulta que no pudo incluirlo todo. El orden del backend se conserva.
 *
 * Las coordenadas viajan crudas: la cartografía es del organismo de mapa
 * (FAR-I1), no de esta pantalla.
 */
function evaluar(
  respuesta: AvailabilityResult,
  consultables: readonly (ItemDeReceta & { productId: string })[],
  sinProducto: readonly string[],
  sinProductoPorConcepto: readonly ItemDeReceta[],
  aprobados: ReadonlySet<string>,
): ResultadoDeSedes {
  const nombrePorProducto = new Map(consultables.map((item) => [item.productId, item.medicamento]));

  const sedes = respuesta.items.map((sede, indice): SedeVisible => {
    const faltantes = [
      ...sede.missingProductIds.map(
        (productId) => nombrePorProducto.get(productId) ?? 'Un medicamento de su receta',
      ),
      ...sinProducto,
    ];
    return {
      siteId: sede.siteId,
      pharmacyId: sede.pharmacyId,
      codigo: CODIGOS[indice] ?? String(indice + 1),
      farmacia: sede.pharmacyName,
      sede: sede.siteName,
      direccion: sede.addressText,
      distancia: sede.distanceKm === null ? null : formatKm(sede.distanceKm),
      distanciaKm: sede.distanceKm,
      completa: faltantes.length === 0,
      faltantes,
      covers: new Set(
        consultables
          .filter((item) => !sede.missingProductIds.includes(item.productId))
          .map((item) => item.conceptId),
      ),
      directions: directionsUrl(sede.latitude, sede.longitude),
      total:
        sede.totalAmount === null
          ? null
          : withDisplayCurrency(sede.totalAmount, sede.currency?.code),
      totalCentavos: sede.totalAmount === null ? null : aCentavos(sede.totalAmount),
      retiro: sede.pickupAvailable,
      delivery: sede.homeDeliveryAvailable,
      lat: sede.latitude,
      lng: sede.longitude,
      conSeguro: coberturaConSeguro(sede, consultables, sinProductoPorConcepto, aprobados),
    };
  });

  const aprobadosIncluidos =
    consultables.filter((item) => aprobados.has(item.conceptId)).length +
    sinProductoPorConcepto.filter((item) => aprobados.has(item.conceptId)).length;

  return { sedes, sinProducto, aprobadosIncluidos };
}

/**
 * Una sede evaluada sólo sobre los renglones aprobados (T-E2 · F2.2.2).
 *
 * - **Cobertura:** de los aprobados incluidos, cuántos confirma la sede. Un
 *   aprobado sin producto publicado cuenta y falta, como en la vista normal.
 * - **Aprobado / a tu cargo:** lo que la sede cobra por lo disponible, partido
 *   por la aprobación. Lo que la sede no tiene no suma en ninguno de los dos.
 * - **Aritmética en centavos** (`pharmacy-campaigns.money`): un precio que
 *   falta, que no es un importe o que viene en otra moneda deja esa parte en
 *   `null` — se dice, no se estima.
 *
 * Exportada a propósito: es pura y el spec la ejercita directo.
 */
export function coberturaConSeguro(
  sede: AvailabilitySite,
  consultables: readonly (ItemDeReceta & { productId: string })[],
  sinProductoPorConcepto: readonly ItemDeReceta[],
  aprobados: ReadonlySet<string>,
): CoberturaConSeguro {
  const porProducto = new Map(sede.products.map((producto) => [producto.productId, producto]));
  const disponible = (item: ItemDeReceta & { productId: string }) =>
    porProducto.has(item.productId) && !sede.missingProductIds.includes(item.productId);

  const aprobadosConProducto = consultables.filter((item) => aprobados.has(item.conceptId));
  const aprobadosSinProducto = sinProductoPorConcepto.filter((item) =>
    aprobados.has(item.conceptId),
  );
  const faltantes = [
    ...aprobadosConProducto.filter((item) => !disponible(item)).map((item) => item.medicamento),
    ...aprobadosSinProducto.map((item) => item.medicamento),
  ];
  const cantidadAprobada = aprobadosConProducto.length + aprobadosSinProducto.length;

  const importeDe = (items: readonly (ItemDeReceta & { productId: string })[]) =>
    importeDeProductos(
      items.filter(disponible).map((item) => porProducto.get(item.productId)),
      sede.currency?.code ?? null,
    );

  return {
    aprobados: cantidadAprobada,
    cubiertos: cantidadAprobada - faltantes.length,
    completa: cantidadAprobada > 0 && faltantes.length === 0,
    faltantes,
    aprobado: importeDe(aprobadosConProducto),
    aCargo: importeDe(consultables.filter((item) => !aprobados.has(item.conceptId))),
  };
}

/**
 * Lo que paga el paciente por esos productos, un envase por renglón, sumado en
 * centavos: «96.50 BOB». `null` si alguno no tiene precio, no es un importe o
 * viene en otra moneda que el resto. Sin productos, «0.00»: no pagar nada es
 * un dato, no una ausencia.
 */
function importeDeProductos(
  productos: readonly (AvailabilityProduct | undefined)[],
  monedaDeLaSede: string | null,
): string | null {
  let centavos = 0;
  let moneda = monedaDeLaSede;
  for (const producto of productos) {
    const precio = producto?.price ?? null;
    const importe = precio?.patientAmount ?? precio?.unitAmount ?? null;
    const enCentavos = importe === null ? null : aCentavos(importe);
    if (precio === null || enCentavos === null) {
      return null;
    }
    const suMoneda = precio.currency?.code ?? moneda;
    if (moneda !== null && suMoneda !== null && suMoneda !== moneda) {
      return null;
    }
    moneda = suMoneda;
    centavos += enCentavos * CANTIDAD_POR_RENGLON;
  }
  // Sin moneda en el dato no se agrega ninguna: el contrato E2 deja esa parte
  // en el número pelado y su prueba lo fija.
  return moneda === null ? aTexto(centavos) : withDisplayCurrency(aTexto(centavos), moneda);
}
