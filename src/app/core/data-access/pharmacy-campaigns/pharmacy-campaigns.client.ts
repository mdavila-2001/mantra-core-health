import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import {
  CAMPANAS_SEMBRADAS,
  UN_DIA,
  idSembrado,
} from './pharmacy-campaigns.fixtures';
import { conDescuento, normalizado, porcentajeDeAhorro } from './pharmacy-campaigns.money';
import {
  BorradorDeCampana,
  CampanaDeFarmacia,
  CampanaPublica,
  EstadoDeCampana,
  FalloDeBorrador,
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
      const elegidos = catalogo.slice(0, plantilla.cuantosProductos);
      const productos = elegidos
        .map((producto) => aProductoEnCampana(producto, plantilla.porcentaje))
        .filter((producto): producto is ProductoEnCampana => producto !== null);
      if (productos.length === 0) {
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
  ): ProductoEnCampana | null {
    let mejor: ProductoEnCampana | null = null;
    for (const campana of this.campanasVigentes(pharmacyId, ahora)) {
      for (const producto of campana.productos) {
        if (producto.productId !== productId) {
          continue;
        }
        if (mejor === null || Number(producto.precioPromocional) < Number(mejor.precioPromocional)) {
          mejor = producto;
        }
      }
    }
    return mejor;
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
    const productos = borrador.renglones
      .map((renglon) => resolverRenglon(renglon, borrador))
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

/**
 * Dónde está una campaña respecto de su ventana.
 *
 * La ventana se mide en **días completos**, no en instantes, y los dos
 * extremos son inclusivos: una campaña «del 1 al 30» vale desde el primer
 * minuto del 1 hasta el último del 30.
 *
 * No es un adorno. La farmacia elige los dos días en un calendario, y el
 * calendario devuelve un `Date` con hora: el mediodía
 * (`date-picker.ts:38`, `SAFE_HOUR`). Comparando instantes, una campaña que
 * termina «el 30» moría a las 12:00:01 del 30 —la mitad de su último día—, y
 * una que empieza «el 10» todavía no valía a las nueve de la mañana del 10.
 * El formulario promete lo contrario con todas las letras: «el último día
 * cuenta: la campaña vale todo ese día».
 *
 * Los días son los de quien mira, no UTC: el paciente que lee «hasta el 30»
 * en su pantalla espera que valga todo su 30.
 */
export function estadoDe(campana: CampanaDeFarmacia, ahora: Date = new Date()): EstadoDeCampana {
  const instante = ahora.getTime();
  if (instante < inicioDelDia(campana.desde)) {
    return 'PROGRAMADA';
  }
  if (instante > finDelDia(campana.hasta)) {
    return 'TERMINADA';
  }
  return 'VIGENTE';
}

/** Las 00:00:00.000 del día de esa fecha, en la zona horaria local. */
function inicioDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/**
 * El último milisegundo del día de esa fecha, en la zona horaria local.
 *
 * Se calcula como «el arranque del día siguiente, menos uno» y no fijando
 * 23:59:59.999: en un día con cambio de horario de verano el día no dura 24
 * horas, y el arranque del siguiente sí es siempre el borde correcto.
 */
function finDelDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1).getTime() - 1;
}

/** El ahorro de un producto en porcentaje entero, o `null` si no se deriva. */
export function ahorroDe(producto: ProductoEnCampana): number | null {
  return porcentajeDeAhorro(producto.precioNormal, producto.precioPromocional);
}

/** Todo lo que le impide a un borrador convertirse en campaña. */
export function revisar(borrador: BorradorDeCampana): readonly FalloDeBorrador[] {
  const fallos: FalloDeBorrador[] = [];
  if (borrador.titulo.trim() === '') {
    fallos.push('SIN_TITULO');
  }
  if (borrador.renglones.length === 0) {
    fallos.push('SIN_PRODUCTOS');
  }
  if (borrador.desde === null || borrador.hasta === null) {
    // Falta una fecha, que no es lo mismo que tenerlas al revés. Decir
    // «la fecha de fin no puede ser anterior» cuando no hay fecha manda a
    // revisar un campo que está bien.
    fallos.push('FALTA_FECHA');
  } else if (borrador.hasta.getTime() < borrador.desde.getTime()) {
    fallos.push('VIGENCIA_INVERTIDA');
  }
  const monedas = new Set(borrador.renglones.map((renglon) => renglon.moneda));
  if (monedas.size > 1) {
    fallos.push('MONEDAS_MEZCLADAS');
  }
  if (borrador.tipoDeDescuento === 'PORCENTAJE') {
    const porcentaje = borrador.porcentaje;
    if (porcentaje === null || conDescuento('1.00', porcentaje) === null) {
      fallos.push('PORCENTAJE_FUERA_DE_RANGO');
    }
  } else {
    const alguno = borrador.renglones.some(
      (renglon) => resolverRenglon(renglon, borrador) === null,
    );
    if (borrador.renglones.length > 0 && alguno) {
      fallos.push('PRECIO_NO_ES_DESCUENTO');
    }
  }
  return fallos;
}

/** Un renglón del borrador a producto de campaña, o `null` si no cierra. */
function resolverRenglon(
  renglon: BorradorDeCampana['renglones'][number],
  borrador: BorradorDeCampana,
): ProductoEnCampana | null {
  const promocional =
    borrador.tipoDeDescuento === 'PORCENTAJE'
      ? conDescuento(renglon.precioNormal, borrador.porcentaje ?? 0)
      : renglon.precioPromocional;
  if (promocional === null) {
    return null;
  }
  // La única definición de «promoción» que este carril acepta: más barato que
  // el precio de lista. Sin esto, un cero mal tipeado se publica como oferta.
  if (porcentajeDeAhorro(renglon.precioNormal, promocional) === null) {
    return null;
  }
  const normal = normalizado(renglon.precioNormal);
  if (normal === null) {
    return null;
  }
  return {
    productId: renglon.productId,
    nombre: renglon.nombre,
    presentacion: renglon.presentacion,
    precioNormal: normal,
    precioPromocional: promocional,
    moneda: renglon.moneda,
  };
}

/** Un producto del catálogo a producto de campaña con el porcentaje dado. */
function aProductoEnCampana(
  producto: ProductoDeCatalogo,
  porcentaje: number,
): ProductoEnCampana | null {
  const promocional = conDescuento(producto.precio, porcentaje);
  if (promocional === null) {
    return null;
  }
  const normal = normalizado(producto.precio);
  if (normal === null) {
    return null;
  }
  return {
    productId: producto.productId,
    nombre: producto.nombre,
    presentacion: producto.presentacion,
    precioNormal: normal,
    precioPromocional: promocional,
    moneda: producto.moneda,
  };
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
  return {
    id: posible.id,
    pharmacyId: posible.pharmacyId,
    farmacia: posible.farmacia,
    titulo: posible.titulo,
    descripcion: posible.descripcion,
    desde,
    hasta,
    productos,
    sembrada: posible.sembrada,
  };
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
    typeof posible.precioPromocional === 'string' &&
    typeof posible.moneda === 'string'
  );
}
