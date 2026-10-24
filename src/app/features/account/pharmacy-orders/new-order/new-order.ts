import { DatePipe, DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import {
  PharmacyCampaignsClient,
  etiquetaDeCampana,
  mecanicaDe,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import {
  aCentavos,
  aTexto,
  normalizado,
} from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.money';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import {
  type BorradorDePedido,
  type LineaDePedido,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { SAMPLE_DATA_ENABLED } from '../../../../core/mock/sample-data';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MI_HISTORIA_ROUTE } from '../../medical-record/medical-record.routes';
import {
  DATOS_DE_EJEMPLO_DE_LA_RECETA,
  NOTA_DE_DATOS_DE_EJEMPLO,
  type AlternativaDeEjemplo,
  type DatosDeEjemploDeLaReceta,
} from './new-order.fixtures';
import {
  CLAVE_DEL_TRASPASO,
  RUTA_DEL_CHECKOUT,
  type TraspasoDeLaReceta,
} from './new-order.handoff';
import { OrderAlternatives } from './order-alternatives/order-alternatives';
import { displayCurrency } from '../../../../core/money/display-currency';
import { describeNudge } from '../../../../core/promotions-engine/describe-mechanic';
import { hasUnitPrice } from '../../../../core/promotions-engine/mechanic-level';
import { nearestNudges } from '../../../../core/promotions-engine/nearest-nudges';
import type { LineResult, OrderLine } from '../../../../core/promotions-engine/promotion-mechanics.types';

/** Menos de una unidad no es un renglón: para no pedirlo está «Volver». */
const CANTIDAD_MINIMA = 1;

/** Lo que la persona decidió sobre un renglón. */
interface EleccionDeRenglon {
  readonly cantidad: number;
  readonly alternativaId: string | null;
}

/** Un renglón del borrador más lo que se eligió, sin campañas todavía. */
interface RenglonBase {
  readonly indice: number;
  /** La línea del borrador, intacta. */
  readonly linea: LineaDePedido;
  readonly medicamento: string;
  readonly presentacion: string | null;
  readonly cantidad: number;
  readonly cantidadRecetada: number;
  /** El precio unitario sin campaña: el de la alternativa o el de la sede. */
  readonly precioDeLista: string | null;
  readonly alternativa: AlternativaDeEjemplo | null;
  readonly alternativas: readonly AlternativaDeEjemplo[];
  readonly aprobadoPorSeguro: boolean;
  /** Variante con seguro y renglón aprobado: no suma ni ofrece alternativas. */
  readonly cubierto: boolean;
  readonly ofreceAlternativas: boolean;
}

/** Un renglón con lo que le tocó de las campañas. */
interface RenglonVisible extends RenglonBase {
  /** El precio de campaña por unidad (FAR-I7), sólo si la campaña es de precio. */
  readonly precioPromocional: string | null;
  /** Lo que una campaña de otra forma (2x1, combo…) descuenta en este renglón. */
  readonly descuento: string | null;
  /** «2x1», «20 % menos»…: la campaña que lo alcanzó. */
  readonly etiquetaDeCampana: string | null;
  readonly subtotal: string | null;
}

/**
 * La dirección de ejemplo con que la demo ejercita los envíos. El backend no
 * expone todavía las direcciones del paciente (mismo bloqueador que anotó
 * «dónde comprar mi receta»): sin el gate de demostración los envíos se
 * ofrecen deshabilitados y con el porqué escrito.
 */
/**
 * **Confirmá tu pedido** (carril FAR-I2), extendida como **la orden médica
 * como pedido** (T-E1): el paso entre «dónde comprar mi receta» y el checkout.
 *
 * ## De dónde salen los datos
 *
 * Del **borrador** que la pantalla anterior dejó en el cliente al tocar
 * «Enviar pedido»: renglones ya evaluados contra la sede, con lo que la
 * farmacia no tiene dicho claro. Nada viaja por la URL — ni ids de productos
 * ni datos de la persona— y no se repite ninguna consulta.
 *
 * El borrador se **copia al construir**. Quien recarga o entra por URL directa
 * no tiene borrador y ve la salida honesta hacia su historia.
 *
 * Sobre el borrador, T-E1 dibuja lo que todavía no tiene contrato —cabecera
 * de la receta, cantidad dentro de lo recetado, alternativas por renglón y la
 * variante con seguro— con los datos de ejemplo de `new-order.fixtures.ts`,
 * rotulados como tales. **Nada de eso toca el borrador**: vive en señales de
 * esta pantalla.
 *
 * ## Desde acá no se crea ningún pedido (D-FARMOCK-T-E1-01)
 *
 * El pedido real se crea en la confirmación final del checkout. «Continuar»
 * conserva el borrador y lleva las elecciones en el estado de la navegación
 * (`new-order.handoff.ts`); mientras el checkout no exista, se ofrece
 * deshabilitado. Ninguna acción de esta pantalla llama a
 * `PharmacyOrdersClient.enviar()`: esa capacidad real sigue intacta en el
 * cliente para la confirmación final.
 *
 * ## La entrega
 *
 * El pedido sólo se retira en la farmacia: no hay otra modalidad que ofrecer,
 * así que la pantalla lo informa y no pide elegir nada.
 */
@Component({
  selector: 'app-new-order',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    DatePipe,
    OrderAlternatives,
    PageHeader,
    RouterLink,
    Skeleton,
    Switch,
    ViewStateHost,
  ],
  templateUrl: './new-order.html',
  styleUrl: './new-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewOrder {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly router = inject(Router);
  private readonly navigation = inject(NavigationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documento = inject(DOCUMENT);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly fuenteDeEjemplo = inject(DATOS_DE_EJEMPLO_DE_LA_RECETA);

  /**
   * Maqueta (`true`) o API real (`false`). Contra la API real no se ofrece la
   * variante con seguro ni se rotula nada como ejemplo: la fuente de arriba
   * ya no inventa cabecera, alternativas ni aprobación. Ver
   * `core/mock/sample-data.ts`.
   */
  protected readonly sampleData = inject(SAMPLE_DATA_ENABLED);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;

  /** La copia del borrador (ver el JSDoc de la clase). */
  protected readonly borrador = this.ordersClient.borradorPreparado();

  /** Medications that block the complete order under the approved policy. */
  protected readonly unresolvedProductNames =
    this.borrador?.lineas
      .filter((line) => line.productId === null)
      .map((line) => line.medicamento) ?? [];

  protected readonly hasUnresolvedProducts = this.unresolvedProductNames.length > 0;

  /** Vuelve a la consulta de sedes de la misma receta. */
  protected readonly rutaDeVuelta =
    this.borrador === null
      ? MI_HISTORIA_ROUTE
      : `/my-account/medical-record/where-to-buy/${this.borrador.requestId}`;

  /* ---- los datos de ejemplo (T-E1) ----------------------------------------- */

  protected readonly datos = signal<DatosDeEjemploDeLaReceta | null>(null);
  private readonly falloDeLosDatos = signal<ViewState<BorradorDePedido> | null>(null);

  /**
   * Sin borrador, la salida honesta hacia la historia; con un borrador vacío,
   * la vuelta a las sucursales; y mientras los datos de ejemplo no llegan, el
   * esqueleto.
   */
  protected readonly estado = computed<ViewState<BorradorDePedido>>(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return notFound({ label: 'Ir a mi historia clínica', route: MI_HISTORIA_ROUTE });
    }
    if (borrador.lineas.length === 0) {
      return empty(
        { label: 'Volver a las sucursales', route: this.rutaDeVuelta },
        'Este pedido no tiene medicamentos para confirmar.',
      );
    }
    const fallo = this.falloDeLosDatos();
    if (fallo !== null) {
      return fallo;
    }
    return this.datos() === null ? loading() : ready(borrador);
  });

  /* ---- las promociones del pedido (FAR-I7) --------------------------------- */

  private readonly campaigns = inject(PharmacyCampaignsClient);

  /**
   * El precio de lista con el mismo formato que el promocional.
   *
   * `GET /pharmacy-inventory/availability` devuelve el `numeric` tal cual —
   * `"22.5"`—, y el promocional sale de la aritmética en centavos, siempre con
   * dos decimales. Sueltos no molesta; puestos uno al lado del otro, «antes
   * 22.5 · ahora 14.62» se lee como un descuido, y el descuido está sobre el
   * número que la paciente va a pagar.
   *
   * Lo que no es un importe vuelve **como vino**: mejor un formato raro que un
   * precio que desaparece de la pantalla.
   */
  protected precioNormalizado(importe: string | null): string | null {
    return importe === null ? null : (normalizado(importe) ?? importe);
  }

  /* ---- la receta como pedido (T-E1) ---------------------------------------- */

  protected readonly elecciones = signal<readonly EleccionDeRenglon[]>(
    this.borrador?.lineas.map((linea) => ({ cantidad: linea.cantidad, alternativaId: null })) ??
      [],
  );

  /** El conmutador de demostración de la variante con seguro. */
  protected readonly conSeguro = signal(false);

  /** El renglón cuyo panel de alternativas está abierto, o `null`. */
  protected readonly panelAbierto = signal<number | null>(null);

  /**
   * Cada renglón **sin campañas**: lo que se eligió y el precio de lista. Es la
   * entrada de la evaluación; las campañas se aplican después, sobre el pedido
   * entero, porque un 2x1 o una compra mínima no se pueden decidir renglón por
   * renglón.
   */
  private readonly renglonesBase = computed<readonly RenglonBase[]>(() => {
    const borrador = this.borrador;
    const datos = this.datos();
    if (borrador === null || datos === null) {
      return [];
    }
    const conSeguro = this.conSeguro();
    const elecciones = this.elecciones();
    return borrador.lineas.map((linea, indice): RenglonBase => {
      const deEjemplo = datos.renglones[indice];
      const eleccion = elecciones[indice] ?? { cantidad: linea.cantidad, alternativaId: null };
      const aprobadoPorSeguro = deEjemplo?.aprobadoPorSeguro ?? false;
      // Lo que la sede no tiene no se reparte con nadie: sigue diciendo que falta.
      const cubierto = conSeguro && aprobadoPorSeguro && linea.disponible;
      const alternativas = deEjemplo?.alternativas ?? [];
      // Con seguro, un aprobado muestra la recetada: la elección se conserva
      // y vuelve si se apaga el conmutador.
      const alternativa = cubierto
        ? null
        : (alternativas.find((opcion) => opcion.id === eleccion.alternativaId) ?? null);
      return {
        indice,
        linea,
        medicamento: alternativa?.nombre ?? linea.medicamento,
        presentacion: alternativa?.presentacion ?? linea.presentacion,
        cantidad: eleccion.cantidad,
        cantidadRecetada: deEjemplo?.cantidadRecetada ?? linea.cantidad,
        precioDeLista: alternativa?.precio ?? this.precioNormalizado(linea.precio),
        alternativa,
        alternativas,
        aprobadoPorSeguro,
        cubierto,
        ofreceAlternativas: linea.disponible && alternativas.length > 0 && !cubierto,
      };
    });
  });

  /**
   * El pedido evaluado contra **todas** las campañas vigentes de la farmacia:
   * precio por unidad, 2x1, escalonados, compra mínima, combos, regalos y puntos.
   *
   * Entran los renglones que la persona va a pagar: disponibles, con precio y
   * sin cubrir por el seguro. Una alternativa elegida entra con un identificador
   * propio, para que ninguna campaña de la recetada la alcance —el criterio de
   * siempre—, pero sí suma al total sobre el que se mide una compra mínima.
   *
   * El resultado es **una estimación**: el total autoritativo es del backend.
   */
  protected readonly evaluacion = computed(() => {
    const borrador = this.borrador;
    const lineas: OrderLine[] = [];
    for (const renglon of this.renglonesBase()) {
      if (!renglon.linea.disponible || renglon.cubierto || renglon.precioDeLista === null) {
        continue;
      }
      lineas.push({
        itemId: this.itemIdDelMotor(renglon),
        quantity: renglon.cantidad,
        unitPrice: renglon.precioDeLista,
      });
    }
    return this.campaigns.evaluarPedido(borrador?.pharmacyId ?? '', lineas);
  });

  /** La clave con que el motor reconoce un renglón: el producto, si una campaña lo puede alcanzar. */
  private itemIdDelMotor(renglon: RenglonBase): string {
    return renglon.alternativa === null && renglon.linea.productId !== null
      ? renglon.linea.productId
      : `renglon-${renglon.indice}`;
  }

  /** ¿Alguna campaña descuenta algo de este pedido? Gobierna el banner. */
  protected readonly hayPromocion = computed(
    () => (aCentavos(this.evaluacion().totalDiscount) ?? 0) > 0,
  );

  protected readonly renglones = computed<readonly RenglonVisible[]>(() => {
    const evaluacion = this.evaluacion();
    const yaVistos = new Set<string>();
    return this.renglonesBase().map((renglon): RenglonVisible => {
      const itemId = this.itemIdDelMotor(renglon);
      // Dos renglones del mismo producto el motor los suma en uno: el resultado
      // se muestra en el primero.
      const resultado =
        yaVistos.has(itemId) || !renglon.linea.disponible || renglon.cubierto
          ? undefined
          : evaluacion.lines.find((candidato) => candidato.itemId === itemId);
      yaVistos.add(itemId);
      return this.conPromocion(renglon, resultado);
    });
  });

  /** Un renglón con lo que le tocó de las campañas. */
  private conPromocion(renglon: RenglonBase, resultado: LineResult | undefined): RenglonVisible {
    const unitario = renglon.precioDeLista === null ? null : aCentavos(renglon.precioDeLista);
    const descuento = resultado === undefined ? 0 : (aCentavos(resultado.discount) ?? 0);
    const campana =
      resultado?.campaignId == null ? null : this.campaigns.campanaPorId(resultado.campaignId);
    // Un precio por unidad sólo existe si el descuento reparte exacto entre las
    // unidades: con un tope de por medio puede no hacerlo, y ahí se dice como
    // descuento del renglón y no como un precio inventado.
    const esPrecioPorUnidad =
      campana !== null &&
      unitario !== null &&
      descuento > 0 &&
      hasUnitPrice(mecanicaDe(campana)) &&
      descuento % renglon.cantidad === 0;
    return {
      ...renglon,
      precioPromocional:
        esPrecioPorUnidad && unitario !== null
          ? aTexto(unitario - descuento / renglon.cantidad)
          : null,
      descuento: !esPrecioPorUnidad && descuento > 0 ? aTexto(descuento) : null,
      etiquetaDeCampana: descuento > 0 && campana !== null ? etiquetaDeCampana(campana) : null,
      subtotal:
        renglon.linea.disponible && unitario !== null
          ? aTexto(unitario * renglon.cantidad - descuento)
          : null,
    };
  }

  /** Algo en pantalla ya no es el borrador tal como lo armó la sucursal. */
  protected readonly hayCambiosDeDemostracion = computed(() => {
    const borrador = this.borrador;
    if (borrador === null) {
      return false;
    }
    return (
      this.conSeguro() ||
      this.elecciones().some(
        (eleccion, indice) =>
          eleccion.alternativaId !== null || eleccion.cantidad !== borrador.lineas[indice]?.cantidad,
      )
    );
  });

  /**
   * El total recalculado con las elecciones: renglones disponibles y, con
   * seguro, sólo los no aprobados. `null` si falta algún precio.
   */
  protected readonly totalConCambios = computed(() => {
    const suman = this.renglones().filter((renglon) => renglon.linea.disponible && !renglon.cubierto);
    if (suman.some((renglon) => renglon.subtotal === null)) {
      return null;
    }
    // El del motor ya trae los descuentos de renglón **y** los del total.
    return this.evaluacion().total;
  });

  /**
   * El total con las promociones, o `null` si ninguna descuenta. El borrador
   * **no se reescribe**: el total que viaja es el del backend, y este se
   * muestra al lado.
   */
  protected readonly totalConPromocion = computed(() =>
    this.hayPromocion() ? this.totalConCambios() : null,
  );

  /** Lo que el pedido descuenta sobre el total (compra mínima, escalonados), con su etiqueta. */
  protected readonly descuentosDelTotal = computed(() =>
    this.evaluacion().orderDiscounts.map((descuento) => {
      const campana = this.campaigns.campanaPorId(descuento.campaignId);
      return {
        campaignId: descuento.campaignId,
        etiqueta: campana === null ? 'Promoción' : etiquetaDeCampana(campana),
        monto: descuento.amount,
      };
    }),
  );

  /** Lo que le falta al pedido para alcanzar una campaña: pocos, los más cercanos. */
  protected readonly avisosDePromocion = computed(() =>
    nearestNudges(this.evaluacion().nudges).map((aviso) =>
      describeNudge(aviso, { labelOf: () => null, currency: this.moneda(this.borrador?.moneda) }),
    ),
  );

  /** El multiplicador de puntos que alcanza este pedido, o `null`. */
  protected readonly multiplicadorDePuntos = computed(() => this.evaluacion().pointsMultiplier);

  protected readonly renglonesCubiertos = computed(
    () => this.renglones().filter((renglon) => renglon.cubierto).length,
  );

  /* ---- el paso siguiente (D-FARMOCK-T-E1-01) ------------------------------- */

  /** La ruta del checkout, o `null` mientras T-E3 no la publique. */
  protected readonly rutaDelCheckout = inject(RUTA_DEL_CHECKOUT);

  protected readonly puedeContinuar = computed(
    () => this.rutaDelCheckout !== null && !this.hasUnresolvedProducts && this.datos() !== null,
  );

  /** `true` desde que «Continuar» navega: el borrador ya no se descarta. */
  private continuando = false;

  constructor() {
    // Salir sin continuar descarta el borrador: quien vuelve atrás no deja un
    // pedido a medias esperando en la sesión. Tras continuar no se toca,
    // porque el checkout lo necesita.
    this.destroyRef.onDestroy(() => {
      if (!this.continuando) {
        this.ordersClient.descartarBorrador();
      }
    });
    this.cargarDatosDeEjemplo();
  }

  protected cargarDatosDeEjemplo(): void {
    const borrador = this.borrador;
    if (borrador === null || borrador.lineas.length === 0) {
      return;
    }
    this.falloDeLosDatos.set(null);
    this.datos.set(null);
    this.fuenteDeEjemplo(borrador)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (datos) => this.datos.set(datos),
        error: (error: unknown) =>
          this.falloDeLosDatos.set(errorToViewState<BorradorDePedido>(error)),
      });
  }

  protected cambiarCantidad(indice: number, paso: 1 | -1): void {
    const renglon = this.renglones()[indice];
    if (renglon === undefined) {
      return;
    }
    const siguiente = renglon.cantidad + paso;
    if (siguiente < CANTIDAD_MINIMA || siguiente > renglon.cantidadRecetada) {
      return;
    }
    this.actualizarEleccion(indice, { cantidad: siguiente });
  }

  protected alternarAlternativas(indice: number): void {
    this.panelAbierto.update((abierto) => (abierto === indice ? null : indice));
  }

  protected elegirAlternativa(indice: number, alternativa: AlternativaDeEjemplo): void {
    this.actualizarEleccion(indice, { alternativaId: alternativa.id });
    this.cerrarPanel(indice);
  }

  protected restaurarRecetada(indice: number): void {
    this.actualizarEleccion(indice, { alternativaId: null });
    this.cerrarPanel(indice);
  }

  protected alElegirSeguro(activo: boolean): void {
    this.conSeguro.set(activo);
    const abierto = this.panelAbierto();
    if (abierto !== null && !(this.renglones()[abierto]?.ofreceAlternativas ?? false)) {
      this.panelAbierto.set(null);
    }
  }

  /**
   * Lleva al checkout con el borrador intacto y las elecciones en el estado de
   * la navegación. No crea el pedido ni llama a la API.
   */
  protected continuar(): void {
    const ruta = this.rutaDelCheckout;
    if (ruta === null || !this.puedeContinuar()) {
      return;
    }
    const traspaso: TraspasoDeLaReceta = {
      conSeguro: this.conSeguro(),
      renglones: this.renglones().map((renglon) => ({
        indice: renglon.indice,
        cantidad: renglon.cantidad,
        alternativa: renglon.alternativa,
        aprobadoPorSeguro: renglon.aprobadoPorSeguro,
      })),
    };
    this.continuando = true;
    this.router.navigate([ruta], { state: { [CLAVE_DEL_TRASPASO]: traspaso } }).then(
      (navego) => {
        if (!navego) {
          this.continuando = false;
        }
      },
      () => {
        this.continuando = false;
      },
    );
  }

  private actualizarEleccion(indice: number, cambio: Partial<EleccionDeRenglon>): void {
    this.elecciones.update((actuales) =>
      actuales.map((eleccion, i) => (i === indice ? { ...eleccion, ...cambio } : eleccion)),
    );
  }

  /**
   * Elegir o restaurar desmonta el botón que tenía el foco: sin esto cae al
   * `body`. Vuelve al botón que abrió el panel, que sigue en el renglón.
   */
  private cerrarPanel(indice: number): void {
    this.panelAbierto.set(null);
    if (!this.esBrowser) {
      return;
    }
    queueMicrotask(() =>
      this.documento.getElementById(`pedido-ver-alternativas-${indice}`)?.focus(),
    );
  }
}
