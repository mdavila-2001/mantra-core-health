import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { isInsideSchedule, windowStatus } from '../../promotions-engine/campaign-window';
import { displayCurrency } from '../../money/display-currency';
import { describeMechanic } from '../../promotions-engine/describe-mechanic';
import type { MechanicDescription } from '../../promotions-engine/describe-mechanic';
import { evaluateOrder } from '../../promotions-engine/evaluate-order';
import { MECHANIC_CATALOG } from '../../promotions-engine/mechanic-catalog';
import { hasUnitPrice, isOrderLevel } from '../../promotions-engine/mechanic-level';
import { fromCents } from '../../promotions-engine/promotion-money';
import { NO_CONDITIONS } from '../../promotions-engine/promotion-mechanics.types';
import type {
  CampaignConditions,
  CampaignScope,
  DraftFailure,
  EvaluationResult,
  Mechanic,
  OrderLine,
  PromotionCampaign,
} from '../../promotions-engine/promotion-mechanics.types';
import { validateDraft } from '../../promotions-engine/validate-draft';
import { CAMPANAS_SEMBRADAS, UN_DIA, idSembrado } from './pharmacy-campaigns.fixtures';
import { aCentavos, conDescuento, normalizado, porcentajeDeAhorro } from './pharmacy-campaigns.money';
import {
  BorradorDeCampana,
  CampanaDeFarmacia,
  CampanaPublica,
  EstadoDeCampana,
  FalloDeBorrador,
  ProductoConPrecioPromocional,
  ProductoEnCampana,
} from './pharmacy-campaigns.types';

/**
 * El canal que sincroniza las campañas entre pestañas: la farmacia crea en una
 * ventana, el paciente la ve en la otra. Muere con el backend real.
 */
const CANAL_DE_DEMO = 'alovida.pharmacy-campaigns.demo';

/** Un producto del catálogo, como lo conoce quien tiene precios a mano. */
export interface ProductoDeCatalogo {
  readonly productId: string;
  readonly nombre: string;
  readonly presentacion: string | null;
  readonly precio: string;
  readonly moneda: string;
}

/**
 * Campañas de farmacia (carril FAR-I7), **sin backend y con gate de demo**.
 *
 * ## Por qué no habla HTTP
 *
 * Los módulos `promotions` y `marketing` existen en el modelo pero **no
 * publican una sola lectura**: seis y trece rutas respectivamente, todas
 * `POST` (`promotions.controller.ts:41-112`,
 * `marketing.controller.ts:62-236`). Además el modelo todavía no relaciona una
 * campaña con productos: `discount_rules.target_filter_json` se persiste
 * literal y nadie lo lee, y `applies_to_concept_id` es
 * `ORDER | ITEM | CATEGORY`, que es una clase de objetivo y no una lista. El
 * pedido a Marcelo está en `COORDINACION-AGENTES.md`.
 *
 * Mismo camino que la billetera de puntos (FAR-I6): las **reglas** se cumplen
 * de verdad —la vigencia se evalúa contra el reloj, una campaña vencida no
 * entrega precios ni por URL directa, el promocional siempre es menor que el
 * normal— y los **datos** son de demostración.
 *
 * TODO(FAR-E?): cuando existan las lecturas, cada método pasa a su endpoint.
 * Un solo commit: el ajuste vive acá y las pantallas no se enteran.
 *
 * ## Por qué el gate apaga las secciones enteras
 *
 * `environment.campaignsDemo` no decide si hay datos: decide si **hay
 * secciones**. Sin campañas no se pinta una sección vacía decorativa (regla
 * del carril), así que apagado el interruptor las promociones desaparecen de
 * la ficha, del pedido y del panel.
 *
 * ## Qué es real y qué está sembrado
 *
 * Los **productos** de una campaña sembrada salen del catálogo real que le
 * pasa quien la siembra, con sus precios reales; lo sembrado es el envoltorio
 * —título, texto, ventana y porcentaje—. Las campañas que crea la farmacia
 * viven lo que vive la sesión: no hay dónde persistirlas todavía, y decirlo es
 * más honesto que un `localStorage` que promete durabilidad.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyCampaignsClient {
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly campanas = signal<readonly CampanaDeFarmacia[]>([]);
  /** Farmacias ya sembradas, para que sembrar dos veces no duplique nada. */
  private readonly sembradas = new Set<string>();
  private readonly canal = this.abrirCanal();

  /** `true` si el carril de promociones está encendido en este despliegue. */
  readonly activo = environment.campaignsDemo;

  /** Todas las campañas conocidas, para el panel de la farmacia. */
  private readonly todas = computed(() => this.campanas());

  /* ─── El lado del paciente ────────────────────────────────────────────── */

  /**
   * Siembra el paquete de demostración para una farmacia, una sola vez.
   *
   * Lo llama quien tiene el catálogo a mano —hoy «dónde comprar», que ya
   * recibe productos y precios reales de `GET /pharmacy-inventory/availability`—
   * porque este cliente no tiene de dónde leerlos: no hay endpoint de campañas
   * y `GET /pharmacy/products` no publica precios.
   *
   * Es idempotente y silenciosa: con el gate apagado, o sin catálogo, no hace
   * nada.
   */
  sembrarPara(
    pharmacyId: string,
    farmacia: string,
    catalogo: readonly ProductoDeCatalogo[],
  ): void {
    if (!this.activo || this.sembradas.has(pharmacyId) || catalogo.length === 0) {
      return;
    }
    this.sembradas.add(pharmacyId);
    const ahora = Date.now();
    const nuevas: CampanaDeFarmacia[] = [];
    for (const plantilla of CAMPANAS_SEMBRADAS) {
      const { desde, cuantos } = plantilla.productos;
      const elegidos = catalogo.slice(desde, desde + cuantos);
      const mecanica = plantilla.mecanica(elegidos);
      if (mecanica === null) {
        // El catálogo no alcanza para armarla (un combo de dos con un solo
        // producto): mejor que no exista a que exista incompleta.
        continue;
      }
      const productos = isOrderLevel(mecanica)
        ? []
        : elegidos
            .map((producto) => resolverProducto(producto, mecanica))
            .filter((producto): producto is ProductoEnCampana => producto !== null);
      if (!isOrderLevel(mecanica) && productos.length === 0) {
        // Sin un solo producto con precio válido la campaña no diría nada:
        // mejor que no exista a que exista vacía.
        continue;
      }
      nuevas.push({
        id: idSembrado(plantilla.slug, pharmacyId),
        pharmacyId,
        farmacia,
        titulo: plantilla.titulo,
        descripcion: plantilla.descripcion,
        desde: new Date(ahora + plantilla.desdeEnDias * UN_DIA),
        hasta: new Date(ahora + plantilla.hastaEnDias * UN_DIA),
        productos,
        mecanica,
        condiciones: { ...NO_CONDITIONS, ...plantilla.condiciones },
        alcance: alcanceDeProductos(productos),
        sembrada: true,
      });
    }
    if (nuevas.length > 0) {
      this.campanas.set([...this.campanas(), ...nuevas]);
    }
  }

  /**
   * Las campañas **vigentes** de una farmacia, más recientes primero.
   *
   * Sólo vigentes: una programada todavía no promete nada y una vencida ya no
   * lo cumple. El paciente nunca ve ninguna de las dos.
   */
  campanasVigentes(pharmacyId: string, ahora: Date = new Date()): readonly CampanaDeFarmacia[] {
    if (!this.activo) {
      return [];
    }
    return this.campanas()
      .filter(
        (campana) =>
          campana.pharmacyId === pharmacyId && estadoDe(campana, ahora) === 'VIGENTE',
      )
      .sort((a, b) => b.desde.getTime() - a.desde.getTime());
  }

  /**
   * El precio promocional vigente de un producto en una farmacia, o `null`.
   *
   * Con dos campañas vigentes sobre el mismo producto gana **el precio más
   * bajo**: quien compra paga el mejor precio anunciado, que es la única
   * lectura que no deja a nadie sintiéndose engañado.
   */
  precioPromocional(
    pharmacyId: string,
    productId: string,
    ahora: Date = new Date(),
  ): ProductoConPrecioPromocional | null {
    let mejor: ProductoConPrecioPromocional | null = null;
    for (const campana of this.campanasVigentes(pharmacyId, ahora)) {
      // Un precio por unidad sólo existe donde la campaña lo da hoy: fuera de su
      // calendario, o detrás de un cupón que este camino no tiene, no hay precio.
      if (!aplicaAhora(campana, ahora)) {
        continue;
      }
      for (const producto of campana.productos) {
        if (producto.productId !== productId || producto.precioPromocional === null) {
          continue;
        }
        if (mejor === null || Number(producto.precioPromocional) < Number(mejor.precioPromocional)) {
          mejor = { ...producto, precioPromocional: producto.precioPromocional };
        }
      }
    }
    return mejor;
  }

  /**
   * Evalúa un pedido contra **todas** las mecánicas de la farmacia: precio por
   * unidad, 2x1, escalonados, compra mínima, combos, regalos y puntos.
   *
   * Es lo que el pedido tiene que usar en vez de `precioPromocional()`, que sólo
   * ve las campañas de precio por unidad. El total que devuelve es **una
   * estimación**: el autoritativo es del backend.
   */
  evaluarPedido(
    pharmacyId: string,
    renglones: readonly OrderLine[],
    ahora: Date = new Date(),
    cupones: readonly string[] = [],
  ): EvaluationResult {
    const campanas = this.activo
      ? this.campanas().filter((campana) => campana.pharmacyId === pharmacyId)
      : [];
    return evaluateOrder(campanas.map(aCampanaDelMotor), renglones, {
      now: ahora,
      couponCodes: cupones,
    });
  }

  /**
   * Una campaña por su id, resuelta para la pantalla pública.
   *
   * Devuelve una unión discriminada y no la campaña cruda: fuera de la rama
   * vigente los precios directamente no existen, así que una promoción vencida
   * no puede filtrarlos por un `@if` mal escrito en la plantilla.
   */
  campanaPublica(id: string, ahora: Date = new Date()): Observable<CampanaPublica | null> {
    if (!this.activo) {
      return of(null);
    }
    const campana = this.campanas().find((candidata) => candidata.id === id) ?? null;
    if (campana === null) {
      return of(null);
    }
    switch (estadoDe(campana, ahora)) {
      case 'VIGENTE':
        return of({ tipo: 'vigente', campana });
      case 'PROGRAMADA':
        return of({ tipo: 'programada', titulo: campana.titulo, desde: campana.desde });
      case 'TERMINADA':
        return of({ tipo: 'terminada', titulo: campana.titulo, hasta: campana.hasta });
    }
  }

  /* ─── El lado de la farmacia ──────────────────────────────────────────── */

  /** Una campaña por su id, sea cual sea su estado; `null` si no existe. */
  campanaPorId(id: string): CampanaDeFarmacia | null {
    return this.campanas().find((campana) => campana.id === id) ?? null;
  }

  /** Las campañas de una farmacia, en cualquier estado, para su panel. */
  campanasDeFarmacia(pharmacyId: string): Observable<readonly CampanaDeFarmacia[]> {
    if (!this.activo) {
      return of([]);
    }
    return of(
      this.todas()
        .filter((campana) => campana.pharmacyId === pharmacyId)
        .sort((a, b) => b.desde.getTime() - a.desde.getTime()),
    );
  }

  /**
   * Publica una campaña nueva, o devuelve todo lo que le falta al borrador.
   *
   * Los fallos vuelven **todos juntos** y no de a uno: corregir un formulario
   * a base de reintentos es la forma más rápida de que alguien lo abandone.
   */
  crear(
    borrador: BorradorDeCampana,
    pharmacyId: string,
    farmacia: string,
  ): Observable<CampanaDeFarmacia | readonly FalloDeBorrador[]> {
    const fallos = revisar(borrador);
    if (fallos.length > 0) {
      return of(fallos);
    }
    // `revisar` ya garantizó que las dos fechas están; el estrechamiento no
    // cruza la llamada, así que se vuelve a preguntar en vez de afirmarlo con
    // un `!`.
    if (borrador.desde === null || borrador.hasta === null) {
      return of<readonly FalloDeBorrador[]>(['FALTA_FECHA']);
    }
    const mecanica = mecanicaDelBorrador(borrador);
    const productos = isOrderLevel(mecanica)
      ? []
      : borrador.renglones
          .map((renglon) =>
            resolverProducto(
              {
                productId: renglon.productId,
                nombre: renglon.nombre,
                presentacion: renglon.presentacion,
                precio: renglon.precioNormal,
                moneda: renglon.moneda,
              },
              mecanica,
            ),
          )
          .filter((producto): producto is ProductoEnCampana => producto !== null);
    const campana: CampanaDeFarmacia = {
      id: nuevoId(),
      pharmacyId,
      farmacia,
      titulo: borrador.titulo.trim(),
      descripcion: borrador.descripcion.trim(),
      desde: borrador.desde,
      hasta: borrador.hasta,
      productos,
      mecanica,
      condiciones: borrador.condiciones ?? NO_CONDITIONS,
      alcance: alcanceDelBorrador(borrador, productos),
      sembrada: false,
    };
    this.campanas.set([campana, ...this.campanas()]);
    this.canal?.postMessage(aMensaje(campana));
    return of(campana);
  }

  /* ─── El puente de la demo de dos ventanas ────────────────────────────── */

  /**
   * Guardas dobles, como en el cliente de pedidos: bajo SSR no hay canal, y en
   * un navegador sin `BroadcastChannel` la demo sigue andando en una pestaña.
   */
  private abrirCanal(): BroadcastChannel | null {
    if (!this.esBrowser || typeof BroadcastChannel === 'undefined') {
      return null;
    }
    const canal = new BroadcastChannel(CANAL_DE_DEMO);
    canal.onmessage = (evento: MessageEvent<unknown>) => {
      // El canal es público dentro del origen: sólo entra lo que tiene la
      // forma del contrato. Una campaña rota en el store rompería cada filtro
      // de las pantallas para toda la sesión.
      const campana = desdeMensaje(evento.data);
      if (campana !== null) {
        this.recibir(campana);
      }
    };
    return canal;
  }

  /** Upsert de una campaña que llegó desde otra pestaña. */
  private recibir(campana: CampanaDeFarmacia): void {
    const actuales = this.campanas();
    const existe = actuales.some((candidata) => candidata.id === campana.id);
    this.campanas.set(
      existe
        ? actuales.map((candidata) => (candidata.id === campana.id ? campana : candidata))
        : [campana, ...actuales],
    );
  }
}

/* ─── Reglas puras, verificables sin instanciar el cliente ──────────────── */

const ESTADO_POR_VENTANA = {
  SCHEDULED: 'PROGRAMADA',
  LIVE: 'VIGENTE',
  ENDED: 'TERMINADA',
} as const satisfies Record<ReturnType<typeof windowStatus>, EstadoDeCampana>;

/**
 * Dónde está una campaña respecto de su ventana.
 *
 * La ventana se mide en **días completos** y los dos extremos son inclusivos
 * (una campaña que termina hoy vale todo hoy): la regla vive en el motor, en
 * `windowStatus()`, con su explicación.
 */
export function estadoDe(campana: CampanaDeFarmacia, ahora: Date = new Date()): EstadoDeCampana {
  return ESTADO_POR_VENTANA[windowStatus(campana.desde, campana.hasta, ahora)];
}

/**
 * ¿Vale **ahora**? Además de la ventana de fechas, el calendario semanal y la
 * franja horaria; y una campaña con cupón no vale sin que alguien lo escriba.
 */
function aplicaAhora(campana: CampanaDeFarmacia, ahora: Date): boolean {
  const condiciones = condicionesDe(campana);
  return (
    estadoDe(campana, ahora) === 'VIGENTE' &&
    isInsideSchedule(condiciones, ahora) &&
    condiciones.couponCode === null
  );
}

/** El ahorro de un producto en porcentaje entero, o `null` si no se deriva. */
export function ahorroDe(producto: ProductoEnCampana): number | null {
  return producto.precioPromocional === null
    ? null
    : porcentajeDeAhorro(producto.precioNormal, producto.precioPromocional);
}

/**
 * La mecánica de una campaña. Sin ella, la campaña es de **precio de campaña
 * por producto**: así se guardaban antes del motor, y los precios ya están en
 * `productos`.
 */
export function mecanicaDe(campana: CampanaDeFarmacia): Mechanic {
  if (campana.mecanica !== undefined) {
    return campana.mecanica;
  }
  const prices: Record<string, string> = {};
  for (const producto of campana.productos) {
    if (producto.precioPromocional !== null) {
      prices[producto.productId] = producto.precioPromocional;
    }
  }
  return { kind: 'CAMPAIGN_PRICE', prices };
}

export function condicionesDe(campana: CampanaDeFarmacia): CampaignConditions {
  return campana.condiciones ?? NO_CONDITIONS;
}

/** Sobre qué actúa la campaña; sin declararlo, sobre sus productos. */
export function alcanceDe(campana: CampanaDeFarmacia): CampaignScope {
  return campana.alcance ?? alcanceDeProductos(campana.productos);
}

function alcanceDeProductos(productos: readonly { readonly productId: string }[]): CampaignScope {
  return { itemIds: productos.map((producto) => producto.productId), categoryIds: [], allItems: false };
}

/**
 * Cómo se resume una campaña en una línea: la etiqueta que lee el paciente
 * («2x1», «20 % menos», «Combo»). Sale del motor, así que panel, ficha, «dónde
 * comprar» y pedido dicen lo mismo.
 */
export function etiquetaDeCampana(campana: CampanaDeFarmacia): string {
  return describirCampana(campana).badge;
}

/** La etiqueta y la oración completa de una campaña, con los nombres de sus productos. */
export function describirCampana(campana: CampanaDeFarmacia): MechanicDescription {
  return describeMechanic(mecanicaDe(campana), {
    labelOf: (itemId) =>
      campana.productos.find((producto) => producto.productId === itemId)?.nombre ?? null,
    currency: displayCurrency(campana.productos[0]?.moneda),
  });
}

/** La campaña tal como la lee el motor. */
export function aCampanaDelMotor(campana: CampanaDeFarmacia): PromotionCampaign {
  return {
    id: campana.id,
    from: campana.desde,
    to: campana.hasta,
    mechanic: mecanicaDe(campana),
    scope: alcanceDe(campana),
    conditions: condicionesDe(campana),
  };
}

/**
 * La mecánica de un borrador. Si el formulario no declaró una, el borrador usa
 * el camino heredado: `tipoDeDescuento` y `porcentaje`.
 */
function mecanicaDelBorrador(borrador: BorradorDeCampana): Mechanic {
  if (borrador.mecanica !== undefined) {
    return borrador.mecanica;
  }
  if (borrador.tipoDeDescuento === 'PRECIO') {
    const prices: Record<string, string> = {};
    for (const renglon of borrador.renglones) {
      if (renglon.precioPromocional !== null) {
        prices[renglon.productId] = renglon.precioPromocional;
      }
    }
    return { kind: 'CAMPAIGN_PRICE', prices };
  }
  return { kind: 'PERCENT_OFF', percent: borrador.porcentaje ?? 0 };
}

function alcanceDelBorrador(
  borrador: BorradorDeCampana,
  productos: readonly { readonly productId: string }[],
): CampaignScope {
  return borrador.alcance ?? alcanceDeProductos(productos);
}

/**
 * Los fallos del motor que ya tenían nombre en este carril conservan ese
 * nombre: lo leen la pantalla y sus pruebas. Los nuevos pasan tal cual.
 */
const FALLO_HEREDADO: Readonly<Partial<Record<DraftFailure, FalloDeBorrador>>> = {
  MISSING_TITLE: 'SIN_TITULO',
  NO_ITEMS: 'SIN_PRODUCTOS',
  MISSING_DATES: 'FALTA_FECHA',
  DATES_INVERTED: 'VIGENCIA_INVERTIDA',
  PERCENT_OUT_OF_RANGE: 'PORCENTAJE_FUERA_DE_RANGO',
  PRICE_NOT_A_DISCOUNT: 'PRECIO_NO_ES_DESCUENTO',
  MIXED_CURRENCIES: 'MONEDAS_MEZCLADAS',
};

/**
 * Los fallos de un borrador en el idioma del motor, para marcar cada campo del
 * editor: el camino inverso de `FALLO_HEREDADO`.
 */
export function fallosDelMotor(fallos: readonly FalloDeBorrador[]): readonly DraftFailure[] {
  const delMotor = new Map<FalloDeBorrador, DraftFailure>(
    Object.entries(FALLO_HEREDADO).map(([motor, heredado]) => [heredado, motor as DraftFailure]),
  );
  return fallos.map((fallo) => delMotor.get(fallo) ?? (fallo as DraftFailure));
}

/** Todo lo que le impide a un borrador convertirse en campaña. */
export function revisar(borrador: BorradorDeCampana): readonly FalloDeBorrador[] {
  const fallos = validateDraft({
    title: borrador.titulo,
    from: borrador.desde,
    to: borrador.hasta,
    mechanic: mecanicaDelBorrador(borrador),
    scope: alcanceDelBorrador(borrador, borrador.renglones),
    conditions: borrador.condiciones ?? NO_CONDITIONS,
    items: borrador.renglones.map((renglon) => ({
      itemId: renglon.productId,
      label: renglon.nombre,
      detail: renglon.presentacion,
      unitPrice: renglon.precioNormal,
      currency: renglon.moneda,
    })),
  });
  return [...new Set(fallos.map((fallo) => FALLO_HEREDADO[fallo] ?? fallo))];
}

/** Un producto a lo que se guarda en la campaña, o `null` si no se puede armar. */
function resolverProducto(
  origen: ProductoDeCatalogo,
  mecanica: Mechanic,
): ProductoEnCampana | null {
  const normal = normalizado(origen.precio);
  if (normal === null) {
    return null;
  }
  let promocional: string | null = null;
  if (hasUnitPrice(mecanica)) {
    promocional = precioPorUnidad(mecanica, origen.productId, normal);
    // La única definición de «promoción» que este carril acepta: más barato que
    // el precio de lista. Sin esto, un cero mal tipeado se publica como oferta.
    if (promocional === null || porcentajeDeAhorro(normal, promocional) === null) {
      return null;
    }
  }
  return {
    productId: origen.productId,
    nombre: origen.nombre,
    presentacion: origen.presentacion,
    precioNormal: normal,
    precioPromocional: promocional,
    moneda: origen.moneda,
  };
}

/** El precio por unidad que deja una mecánica de precio, o `null` si no cierra. */
function precioPorUnidad(mecanica: Mechanic, productId: string, normal: string): string | null {
  switch (mecanica.kind) {
    case 'PERCENT_OFF':
    case 'CLEARANCE':
      return conDescuento(normal, mecanica.percent);
    case 'AMOUNT_OFF_PER_UNIT': {
      const resta = aCentavos(mecanica.amount);
      const lista = aCentavos(normal);
      return resta === null || lista === null || resta >= lista ? null : fromCents(lista - resta);
    }
    case 'CAMPAIGN_PRICE':
      return normalizado(mecanica.prices[productId] ?? '');
    default:
      return null;
  }
}

/** El id de una campaña creada en la sesión. */
function nuevoId(): string {
  return `propia-${crypto.randomUUID()}`;
}

/* ─── Serialización del canal ───────────────────────────────────────────── */

/** Lo que viaja por el canal: las fechas van como texto ISO. */
interface MensajeDeCampana extends Omit<CampanaDeFarmacia, 'desde' | 'hasta'> {
  readonly desde: string;
  readonly hasta: string;
}

function aMensaje(campana: CampanaDeFarmacia): MensajeDeCampana {
  return {
    ...campana,
    desde: campana.desde.toISOString(),
    hasta: campana.hasta.toISOString(),
  };
}

/**
 * Un mensaje del canal a campaña, o `null` si no tiene la forma del contrato.
 *
 * `structuredClone` conserva los `Date`, pero el canal es público dentro del
 * origen: puede llegar cualquier cosa, incluida otra versión de la app durante
 * un despliegue.
 */
function desdeMensaje(dato: unknown): CampanaDeFarmacia | null {
  if (typeof dato !== 'object' || dato === null) {
    return null;
  }
  const posible = dato as Partial<MensajeDeCampana>;
  if (
    typeof posible.id !== 'string' ||
    typeof posible.pharmacyId !== 'string' ||
    typeof posible.farmacia !== 'string' ||
    typeof posible.titulo !== 'string' ||
    typeof posible.descripcion !== 'string' ||
    typeof posible.desde !== 'string' ||
    typeof posible.hasta !== 'string' ||
    typeof posible.sembrada !== 'boolean' ||
    !Array.isArray(posible.productos)
  ) {
    return null;
  }
  const desde = new Date(posible.desde);
  const hasta = new Date(posible.hasta);
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
    return null;
  }
  const productos = posible.productos.filter(esProducto);
  if (productos.length !== posible.productos.length) {
    return null;
  }
  // Lo nuevo es opcional, pero si viene tiene que tener la forma: una mecánica
  // rota rompería el cálculo de cada pedido de la sesión.
  if (
    (posible.mecanica !== undefined && !esMecanica(posible.mecanica)) ||
    (posible.condiciones !== undefined && !esCondiciones(posible.condiciones)) ||
    (posible.alcance !== undefined && !esAlcance(posible.alcance))
  ) {
    return null;
  }
  return {
    id: posible.id,
    pharmacyId: posible.pharmacyId,
    farmacia: posible.farmacia,
    titulo: posible.titulo,
    descripcion: posible.descripcion,
    desde,
    hasta,
    productos,
    ...(posible.mecanica === undefined ? {} : { mecanica: posible.mecanica }),
    ...(posible.condiciones === undefined ? {} : { condiciones: posible.condiciones }),
    ...(posible.alcance === undefined ? {} : { alcance: posible.alcance }),
    sembrada: posible.sembrada,
  };
}

const MECANICAS_CONOCIDAS: ReadonlySet<string> = new Set(MECHANIC_CATALOG.map((info) => info.kind));

/** La forma, no el contenido: el mensaje viene de otra pestaña de la misma app. */
function esMecanica(dato: unknown): dato is Mechanic {
  return (
    typeof dato === 'object' &&
    dato !== null &&
    typeof (dato as { kind?: unknown }).kind === 'string' &&
    MECANICAS_CONOCIDAS.has((dato as { kind: string }).kind)
  );
}

function esCondiciones(dato: unknown): dato is CampaignConditions {
  if (typeof dato !== 'object' || dato === null) {
    return false;
  }
  const posible = dato as Partial<CampaignConditions>;
  return typeof posible.stackable === 'boolean' && Array.isArray(posible.weekdays);
}

function esAlcance(dato: unknown): dato is CampaignScope {
  if (typeof dato !== 'object' || dato === null) {
    return false;
  }
  const posible = dato as Partial<CampaignScope>;
  return (
    typeof posible.allItems === 'boolean' &&
    Array.isArray(posible.itemIds) &&
    Array.isArray(posible.categoryIds)
  );
}

function esProducto(dato: unknown): dato is ProductoEnCampana {
  if (typeof dato !== 'object' || dato === null) {
    return false;
  }
  const posible = dato as Partial<ProductoEnCampana>;
  return (
    typeof posible.productId === 'string' &&
    typeof posible.nombre === 'string' &&
    (posible.presentacion === null || typeof posible.presentacion === 'string') &&
    typeof posible.precioNormal === 'string' &&
    (posible.precioPromocional === null || typeof posible.precioPromocional === 'string') &&
    typeof posible.moneda === 'string'
  );
}
