import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { ClinicalClient } from '../../../../core/data-access/clinical/clinical.client';
import type { MedicationRequest } from '../../../../core/data-access/clinical/clinical.types';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import type {
  AvailabilityProduct,
  AvailabilityResult,
  AvailabilitySite,
  GeoPoint,
} from '../../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyCampaignsClient } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  aCentavos,
  aTexto,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import type { CampanaDeFarmacia } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { ProfilesClient } from '../../../../core/data-access/profiles/profiles.client';
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
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
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
import { MI_HISTORIA_ROUTE } from '../medical-record.routes';
import { aprobadosPorElSeguroDeEjemplo, NOTA_DE_DEMOSTRACION } from './where-to-buy.fixtures';

/** Los estudios que le pidieron a esta persona. Ya existe y ya se lee. */
const MIS_ESTUDIOS_ROUTE = '/my-account/diagnostic-orders';

/** La guía de laboratorios y centros de diagnóstico, sin cercanía. */
const LABORATORIOS_ROUTE = '/laboratory-directory';

/** La guía de clínicas y hospitales. */
const CLINICAS_ROUTE = '/clinics-directory';

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
const CIUDADES: readonly PuntoDeReferencia[] = [
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
@Component({
  selector: 'app-where-to-buy',
  imports: [
    AppButton,
    AppButtonLink,
    AppMap,
    Badge,
    Checkbox,
    Alert,
    EmptyState,
    Link,
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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly rutaDeHistoria = MI_HISTORIA_ROUTE;

  /**
   * Los destinos que ofrecen las dos pestañas que todavía no pueden ordenar por
   * cercanía. No son un consuelo: son lo que hoy sí resuelve parte de la
   * pregunta —qué me pidieron, y qué lugares hay— mientras el dato que falta
   * (la dirección de los centros) no exista.
   */
  protected readonly rutaDeEstudios = MIS_ESTUDIOS_ROUTE;
  protected readonly rutaDeLaboratorios = LABORATORIOS_ROUTE;
  protected readonly rutaDeClinicas = CLINICAS_ROUTE;
  protected readonly ciudades = CIUDADES;
  protected readonly opcionesDeOrden = OPCIONES_DE_ORDEN;
  protected readonly notaDeDemostracion = NOTA_DE_DEMOSTRACION;

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

  /** La lista en el orden elegido. Una copia: la respuesta no se toca. */
  protected readonly sedesOrdenadas = computed(() =>
    ordenarSedes(this.resultado()?.sedes ?? [], this.orden()),
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
        { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
        'Con el seguro, ninguno de los medicamentos que elegiste está aprobado. Apagá la variante con seguro para ver la receta completa.',
      );
    }
    return estado;
  });

  /** Las sedes que el mapa puede ubicar: las que tienen coordenadas. */
  protected readonly sedesEnElMapa = computed(() =>
    (this.resultado()?.sedes ?? []).filter(
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

  protected readonly etiquetaDelMapa = computed(() => {
    const cantidad = this.sedesEnElMapa().length;
    const marcadas = cantidad === 1 ? '1 sucursal marcada' : `${cantidad} sucursales marcadas`;
    return `${marcadas} en el mapa. La lista completa, con dirección y distancia en línea recta, está en las tarjetas debajo.`;
  });

  constructor() {
    if (this.perfil === null) {
      // No es un vacío de datos ni un error: la pantalla no le corresponde a
      // esta cuenta, y el aviso lo dice con su propia salida.
      this.lista.set(empty({ label: 'Ir a mi historia', route: MI_HISTORIA_ROUTE }));
      this.resultados.set(ready(SIN_SEDES));
      return;
    }
    this.cargar();
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
            this.lista.set(notFound({ label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE }));
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
          { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
          'Elegí al menos un medicamento para consultar dónde comprarlo.',
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
          { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
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
                { label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE },
                'Ninguna sucursal puede confirmar hoy los medicamentos de tu receta.',
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
      referencias.push({ etiqueta: 'tu casa', ...places.home });
    }
    if (places.work !== null) {
      referencias.push({ etiqueta: 'tu trabajo', ...places.work });
    }
    this.lugaresGuardados.set(referencias);
    if (places.home !== null) {
      this.origen.set({ etiqueta: 'tu casa', ...places.home });
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
          etiqueta: 'tu ubicación actual',
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
    this.consultar();
  }

  protected quitarOrigen(): void {
    this.origen.set(null);
    this.consultar();
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
        (productId) => nombrePorProducto.get(productId) ?? 'Un medicamento de tu receta',
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
      distancia:
        sede.distanceKm === null ? null : `${sede.distanceKm.toFixed(1).replace('.', ',')} km`,
      distanciaKm: sede.distanceKm,
      completa: faltantes.length === 0,
      faltantes,
      total:
        sede.totalAmount === null
          ? null
          : `${sede.totalAmount} ${sede.currency?.code ?? ''}`.trim(),
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
  return `${aTexto(centavos)} ${moneda ?? ''}`.trim();
}
