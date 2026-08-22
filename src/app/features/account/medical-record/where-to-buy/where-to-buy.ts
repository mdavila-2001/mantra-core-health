import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { environment } from '../../../../../environments/environment';
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
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { dataOf, empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type { PinMapa } from '../../../../shared/components/organisms/map/pin-mapa.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../medical-record.routes';

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
 * mapa, no datos de la persona. Domicilio y trabajo van a sumarse acá cuando
 * el backend exponga las direcciones del paciente — hoy no hay contrato.
 */
const CIUDADES: readonly PuntoDeReferencia[] = [
  { etiqueta: 'Santa Cruz de la Sierra', lat: -17.7833, lng: -63.1821 },
  { etiqueta: 'La Paz', lat: -16.4957, lng: -68.1335 },
  { etiqueta: 'Cochabamba', lat: -17.3895, lng: -66.1568 },
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
  readonly codigo: string;
  readonly farmacia: string;
  readonly sede: string;
  readonly direccion: string | null;
  /** «1,2 km», o `null` sin origen o sin coordenadas de la sede. */
  readonly distancia: string | null;
  readonly completa: boolean;
  /** Los medicamentos de la receta que esta sede NO puede confirmar. */
  readonly faltantes: readonly string[];
  /** «96.50 BOB», o `null` si falta un precio o las listas mezclan monedas. */
  readonly total: string | null;
  readonly retiro: boolean | null;
  readonly delivery: boolean | null;
  /** Coordenadas reales de la sede; `null` si el directorio no las publica. */
  readonly lat: number | null;
  readonly lng: number | null;
}

/** El resultado de la consulta, listo para pintarse. */
interface ResultadoDeSedes {
  readonly sedes: readonly SedeVisible[];
  /** Medicamentos incluidos sin producto publicado: nadie puede confirmarlos. */
  readonly sinProducto: readonly string[];
}

/**
 * **Dónde comprar mi receta** (carril E3, sobre las lecturas E2 del backend).
 *
 * ## Qué responde
 *
 * Qué sucursales pueden surtir los medicamentos recetados, cuáles los tienen
 * **todos** (completas, primero) y a cuáles les falta algo (parciales, con el
 * faltante dicho por su nombre), con dirección, distancia y total estimado.
 * El orden lo decide el backend: completas primero, después distancia, total
 * y nombre — la pantalla no lo reordena.
 *
 * ## La ubicación se pide, no se toma
 *
 * Mismo patrón que «Cerca mío» (P4): la consulta sale **sin coordenadas** al
 * entrar —la disponibilidad no las necesita— y la API de geolocalización del
 * navegador no se toca hasta que alguien aprieta el botón. La alternativa sin
 * entregar la ubicación es medir desde una ciudad; domicilio y trabajo se
 * suman cuando exista el contrato de direcciones del paciente.
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
  imports: [AppButton, AppButtonLink, AppMap, Badge, Checkbox, Alert, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './where-to-buy.html',
  styleUrl: './where-to-buy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhereToBuy {
  private readonly auth = inject(AuthService);
  private readonly clinical = inject(ClinicalClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);

  private readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  private readonly perfil = this.auth.patientProfileId();

  protected readonly sinPerfilDePaciente = this.perfil === null;
  protected readonly rutaDeHistoria = MI_HISTORIA_ROUTE;
  protected readonly ciudades = CIUDADES;

  /**
   * El pedido (FAR-I2) corre hoy contra un mock del cliente de datos, así que
   * sólo se ofrece donde la demostración está pedida — con su aviso. Sin el
   * gate, el botón queda a la vista y cerrado, como estaba.
   * TODO(FAR-E1): al conectar el backend real, el botón queda siempre activo
   * y este gate desaparece.
   */
  protected readonly pedidoDisponible = environment.demoPresets;

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
      subtitulo: subtituloDePin(sede),
      estado: sede.completa
        ? { etiqueta: 'Tiene todo', tono: 'success' as const }
        : { etiqueta: 'Le falta algo', tono: 'warning' as const },
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
      this.resultados.set(ready({ sedes: [], sinProducto: [] }));
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
          });
        }),
      )
      .subscribe({
        next: (carga) => {
          if (carga === null) {
            this.lista.set(notFound({ label: 'Volver a mi historia', route: MI_HISTORIA_ROUTE }));
            this.resultados.set(ready({ sedes: [], sinProducto: [] }));
            return;
          }
          const items = carga.filas.map((fila) => itemDe(fila, carga.etiquetas, carga.productos));
          // Entran a la consulta la receta que se tocó y las ya emitidas: son
          // las que la persona puede efectivamente ir a comprar.
          this.incluidos.set(
            new Set(
              items
                .filter(
                  (item) =>
                    item.emitida ||
                    item.conceptId === carga.recetada.medicationConceptId,
                )
                .map((item) => item.conceptId),
            ),
          );
          this.lista.set(ready({ items }));
          this.consultar();
        },
        error: (error: unknown) => {
          this.lista.set(errorToViewState<ListaDeCompra>(error));
          this.resultados.set(ready({ sedes: [], sinProducto: [] }));
        },
      });
  }

  /** El producto representante de cada medicamento, en paralelo. */
  private productosDe(conceptIds: readonly string[]) {
    return forkJoin(
      conceptIds.map((conceptId) =>
        this.pharmacy.searchProducts({ conceptId, limit: 1 }).pipe(
          map((pagina) => [conceptId, pagina.items[0]?.id ?? null] as const),
          // Un medicamento cuya búsqueda falló queda como «sin producto»: la
          // pantalla lo dice, en vez de tirar la consulta entera.
          catchError(() => of([conceptId, null] as const)),
        ),
      ),
    ).pipe(map((pares) => new Map<string, string | null>(pares)));
  }

  /* ---- la selección ------------------------------------------------------- */

  protected estaIncluido(item: ItemDeReceta): boolean {
    return this.incluidos().has(item.conceptId);
  }

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
          'Ninguno de los medicamentos elegidos tiene todavía un producto publicado en el directorio de farmacias.',
        ),
      );
      return;
    }

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
          this.resultados.set(ready(evaluar(respuesta, consultables, sinProducto)));
        },
        error: (error: unknown) =>
          this.resultados.set(errorToViewState<ResultadoDeSedes>(error)),
      });
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
      this.documento.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ??
      false;
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

/** El renglón secundario del pin: distancia rotulada y dirección, lo que haya. */
function subtituloDePin(sede: SedeVisible): string | undefined {
  const partes = [
    sede.distancia === null ? null : `${sede.distancia} en línea recta`,
    sede.direccion,
  ].filter((parte): parte is string => parte !== null);
  return partes.length === 0 ? undefined : partes.join(' · ');
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
    ...sinProducto.map(
      (medicamento): LineaDePedido => ({
        productId: null,
        medicamento,
        presentacion: null,
        cantidad: CANTIDAD_POR_RENGLON,
        precio: null,
        moneda: null,
        disponible: false,
      }),
    ),
  ];
  return {
    requestId,
    siteId: sitio.siteId,
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
): ResultadoDeSedes {
  const nombrePorProducto = new Map(
    consultables.map((item) => [item.productId, item.medicamento]),
  );

  const sedes = respuesta.items.map((sede, indice): SedeVisible => {
    const faltantes = [
      ...sede.missingProductIds.map(
        (productId) => nombrePorProducto.get(productId) ?? 'Un medicamento de tu receta',
      ),
      ...sinProducto,
    ];
    return {
      siteId: sede.siteId,
      codigo: CODIGOS[indice] ?? String(indice + 1),
      farmacia: sede.pharmacyName,
      sede: sede.siteName,
      direccion: sede.addressText,
      distancia:
        sede.distanceKm === null ? null : `${sede.distanceKm.toFixed(1).replace('.', ',')} km`,
      completa: faltantes.length === 0,
      faltantes,
      total:
        sede.totalAmount === null
          ? null
          : `${sede.totalAmount} ${sede.currency?.code ?? ''}`.trim(),
      retiro: sede.pickupAvailable,
      delivery: sede.homeDeliveryAvailable,
      lat: sede.latitude,
      lng: sede.longitude,
    };
  });

  return { sedes, sinProducto };
}
