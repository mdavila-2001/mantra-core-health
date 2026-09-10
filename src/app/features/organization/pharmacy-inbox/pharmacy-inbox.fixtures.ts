import {
  ID_PEDIDO_CON_DELIVERY,
  ID_PEDIDO_CON_SEGURO,
} from '../../../core/mock/fixtures/pedidos-de-farmacia';
import type {
  LineaDePedido,
  ModalidadDeEntrega,
  PedidoFarmacia,
} from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';

/**
 * **Los datos de ejemplo de la bandeja** (carril FAR-I3).
 *
 * Dos de los tres incisos que este carril cubre describen algo que la API
 * todavía no publica: la respuesta del seguro renglón por renglón (F2.2.1) y
 * la factura que la farmacia emite y manda por la app (F2.1.12). El contrato
 * de `pharmacy-orders` no tiene ni cobertura ni factura, así que **no se
 * inventa un campo en `core/`**: se declara acá, junto a la pantalla que lo
 * dibuja, y la pantalla lo rotula como lo que es.
 *
 * El medio de entrega es un tercer caso, distinto: el campo `modalidad` SÍ
 * existe en el contrato y la pantalla lo lee de ahí siempre. Lo que falta es
 * un pedido a domicilio que mirar, porque el backend simulado responde
 * `RETIRO` para todos en una línea que se comparte con otra persona
 * (`core/mock/handlers/pharmacy.handlers.ts:195`). Así que un único pedido de
 * ejemplo trae su medio de acá, por identificador, y sale rotulado.
 *
 * Reglas que este archivo respeta y conviene no perder de vista:
 *
 * - **Nada se persiste.** Ni `localStorage` ni un servicio con estado: cada
 *   render vuelve a derivar lo mismo del pedido que la API devolvió.
 * - **Los importes son texto**, como en todo el contrato de farmacia: el
 *   `numeric` de la base no cabe sin pérdida en un `number`. Se convierte
 *   para sumar y se vuelve a texto con dos decimales, nada más.
 * - **Lo que se pinta se rotula.** `NOTA_DE_DATOS_DE_EJEMPLO` es el cartel
 *   que acompaña a todo lo que sale de acá.
 *
 * TODO(FAR-E2/FAR-E5): cuando el backend publique cobertura y facturación,
 * estos tipos se mudan al contrato y este archivo se queda sólo con los
 * pedidos de ejemplo de las pruebas.
 */

/** El cartel único: quien mira la pantalla sabe qué parte es maqueta. */
export const NOTA_DE_DATOS_DE_EJEMPLO = 'Datos de ejemplo';

/* ─── La respuesta del seguro (F2.2.1) ──────────────────────────────────── */

/** Un renglón visto por el seguro: si entró, y cómo se reparte la cuenta. */
export interface RenglonCubierto {
  readonly aprobado: boolean;
  /** Lo que pone el seguro por este renglón, texto exacto. */
  readonly cubierto: string;
  /** El coaseguro: lo que pone la persona por este renglón. */
  readonly coaseguro: string;
}

/** Lo que el seguro respondió sobre un pedido, renglón por renglón. */
export interface CoberturaDeSeguro {
  readonly aseguradora: string;
  readonly plan: string;
  /** Qué porcentaje del renglón aprobado paga el plan. */
  readonly porcentaje: number;
  /** Un renglón por línea del pedido, en el mismo orden. */
  readonly renglones: readonly RenglonCubierto[];
  readonly totalCubierto: string;
  readonly totalCoaseguro: string;
  readonly moneda: string;
}

/** Lo que la demo sabe de una persona con seguro. */
interface PolizaDeEjemplo {
  readonly aseguradora: string;
  readonly plan: string;
  readonly porcentaje: number;
  /**
   * Qué medicamentos rebotó el seguro, por nombre. La aprobación real la
   * decide la aseguradora contra su vademécum; acá se declara para que la
   * pantalla pueda mostrar **lo aprobado y lo no aprobado**, que es
   * exactamente lo que el registro del cliente pide ver.
   */
  readonly noAprobados: readonly string[];
}

/**
 * Qué pedido de ejemplo lleva seguro. Se indexa por **identificador del
 * pedido**, que es lo que identifica a un pedido: el nombre de la persona
 * existe para leerse, y dos pedidos suyos compartirían cobertura sin que
 * nadie lo haya pedido. El identificador vive en un solo lugar
 * (`core/mock/fixtures/pedidos-de-farmacia.ts`), que es de donde lo toma
 * también el backend simulado al sembrarlo.
 */
const POLIZAS_DE_EJEMPLO: ReadonlyMap<string, PolizaDeEjemplo> = new Map([
  [
    ID_PEDIDO_CON_SEGURO,
    {
      aseguradora: 'Seguro Universal',
      plan: 'Plan Salud Integral',
      porcentaje: 80,
      noAprobados: ['Sertralina'],
    },
  ],
]);

/**
 * La respuesta del seguro para este pedido, o `null` si no hay cobertura en
 * la demo — que es el caso de casi todos los pedidos.
 *
 * `enPie` son los renglones que el mostrador todavía va a despachar. Existe
 * porque el reparto y el total en vivo **se miran juntos en la pantalla**:
 * si el total baja al marcar un renglón «No disponible» y el reparto del
 * seguro no se mueve, las dos cifras se contradicen delante de quien atiende.
 * Un renglón caído no lo paga nadie —ni el seguro ni la persona—, aunque el
 * seguro lo hubiera aprobado: la aprobación es del seguro, el despacho es del
 * mostrador, y sólo lo despachado se cobra.
 */
export function coberturaDeEjemplo(
  pedido: PedidoFarmacia,
  enPie: ReadonlySet<number> | null = null,
): CoberturaDeSeguro | null {
  const poliza = POLIZAS_DE_EJEMPLO.get(pedido.id);
  if (poliza === undefined) {
    return null;
  }
  const renglones = pedido.lineas.map((linea, indice) =>
    enPie !== null && !enPie.has(indice)
      ? { aprobado: apruebaEl(linea, poliza), cubierto: '0.00', coaseguro: '0.00' }
      : repartir(linea, poliza),
  );
  return {
    aseguradora: poliza.aseguradora,
    plan: poliza.plan,
    porcentaje: poliza.porcentaje,
    renglones,
    totalCubierto: sumar(renglones.map((renglon) => renglon.cubierto)),
    totalCoaseguro: sumar(renglones.map((renglon) => renglon.coaseguro)),
    moneda: pedido.moneda ?? '',
  };
}

/** Si el seguro aceptó ese medicamento. No depende de lo que haya en stock. */
function apruebaEl(linea: LineaDePedido, poliza: PolizaDeEjemplo): boolean {
  return !poliza.noAprobados.some((nombre) => linea.medicamento.includes(nombre));
}

function repartir(linea: LineaDePedido, poliza: PolizaDeEjemplo): RenglonCubierto {
  const aprobado = apruebaEl(linea, poliza);
  // Un renglón sin precio publicado no se reparte: no hay cifra que repartir.
  const precio = Number(linea.precio ?? Number.NaN);
  const subtotal = Number.isFinite(precio) ? precio * linea.cantidad : 0;
  const cubierto = aprobado ? (subtotal * poliza.porcentaje) / 100 : 0;
  return {
    aprobado,
    cubierto: cubierto.toFixed(2),
    coaseguro: (subtotal - cubierto).toFixed(2),
  };
}

function sumar(importes: readonly string[]): string {
  return importes.reduce((total, importe) => total + Number(importe), 0).toFixed(2);
}

/* ─── El medio de entrega del pedido de ejemplo ──────────────────────────── */

/** El medio de entrega que la maqueta le pone a un pedido concreto. */
export interface EntregaDeEjemplo {
  readonly modalidad: ModalidadDeEntrega;
  readonly direccion: string;
}

/**
 * Qué pedido de ejemplo sale a domicilio, por identificador. Es un mapa de un
 * solo par a propósito: el resto de la bandeja usa la `modalidad` que devuelve
 * la API, sin pasar por acá.
 */
const ENTREGAS_DE_EJEMPLO: ReadonlyMap<string, EntregaDeEjemplo> = new Map([
  [
    ID_PEDIDO_CON_DELIVERY,
    {
      modalidad: 'DOMICILIO',
      direccion: 'Av. Cristo Redentor km 4 · Edificio Aurora, dpto. 3B',
    },
  ],
]);

/**
 * El medio de entrega que la maqueta aporta para este pedido, o `null` —lo
 * normal— para que la pantalla se quede con el del contrato.
 */
export function entregaDeEjemplo(pedido: PedidoFarmacia): EntregaDeEjemplo | null {
  return ENTREGAS_DE_EJEMPLO.get(pedido.id) ?? null;
}

/* ─── La factura que emite la farmacia (F2.1.12) ─────────────────────────── */

/** La factura del pedido, tal como el mostrador la ve al pie del detalle. */
export interface FacturaDeEjemplo {
  /** El número visible del comprobante. Jamás un identificador técnico. */
  readonly numero: string;
  readonly emitidaEl: Date;
  readonly total: string;
  readonly moneda: string;
  /** Cómo salió. Hoy sólo hay un camino: la app del paciente. */
  readonly estado: string;
}

/**
 * La factura de un pedido **ya entregado**, o `null` si todavía no hay nada
 * que facturar o si el pedido se cerró sin un total publicado.
 *
 * ## Por qué la fecha entra por parámetro y no sale del pedido
 *
 * Una factura se emite al entregar, y **el contrato no trae esa fecha**:
 * `pharmacy-orders.adapter.ts:94-96` descarta `entregas` y `pago` sin
 * condición, así que ninguna pantalla puede saber cuándo salió el pedido.
 * La versión anterior encadenaba `pago?.pagadoEl ?? última entrega ??
 * creadoEl`, y como las dos primeras ramas están muertas **siempre caía en la
 * de creación**: el comprobante de un pedido entregado se fechaba el día en
 * que se hizo el pedido, veinte días antes en el pedido sembrado. Una factura
 * anterior a la entrega no existe.
 *
 * Así que la emite la maqueta, en el momento en que se la pide, y la fecha se
 * inyecta para que sea comprobable. La real la fija el módulo de facturación,
 * que esta pantalla no consulta.
 */
export function facturaDeEjemplo(
  pedido: PedidoFarmacia,
  emitidaEl: Date = new Date(),
): FacturaDeEjemplo | null {
  if (pedido.estado !== 'RETIRADO' || pedido.totalEstimado === null) {
    return null;
  }
  return {
    numero: numeroDeFactura(pedido.id),
    emitidaEl,
    total: pedido.totalEstimado,
    moneda: pedido.moneda ?? '',
    estado: 'Enviada al paciente',
  };
}

/**
 * Un número de comprobante estable para el mismo pedido: la demo no puede
 * sortear uno distinto en cada render, porque entonces dos capturas de la
 * misma pantalla dirían cosas distintas. Es un resumen del identificador, no
 * el identificador: ocho cifras, sin nada que se lea como técnico.
 */
function numeroDeFactura(id: string): string {
  let hash = 5381;
  for (const caracter of id) {
    hash = (hash * 33 + caracter.charCodeAt(0)) % 100_000_000;
  }
  return String(hash).padStart(8, '0');
}

/* ─── Los cuatro casos, para las pruebas ─────────────────────────────────── */

/**
 * Los dos pedidos que la maqueta reconoce llevan **el identificador de
 * verdad**, el que el backend simulado siembra: si alguno se moviera, estas
 * constantes dejarían de encontrar su cobertura o su medio de entrega, y las
 * pruebas de acá abajo lo dicen antes que la pantalla.
 */
const IDS = {
  nuevo: 'c1a7f0e2-0000-4000-8000-000000000101',
  delivery: ID_PEDIDO_CON_DELIVERY,
  seguro: ID_PEDIDO_CON_SEGURO,
  entregado: 'c1a7f0e2-0000-4000-8000-000000000104',
  sede: 'c1a7f0e2-0000-4000-8000-000000000201',
  farmacia: 'c1a7f0e2-0000-4000-8000-000000000202',
  producto: 'c1a7f0e2-0000-4000-8000-000000000203',
} as const;

function lineaDeEjemplo(extra: Partial<LineaDePedido> = {}): LineaDePedido {
  return {
    productId: IDS.producto,
    conceptId: null,
    medicamento: 'Amoxicilina 500 mg',
    presentacion: '500 mg · Caja x 21 cápsulas',
    cantidad: 1,
    precio: '68.00',
    moneda: 'BOB',
    disponible: true,
    ...extra,
  };
}

function pedidoDeEjemplo(extra: Partial<PedidoFarmacia> = {}): PedidoFarmacia {
  return {
    id: IDS.nuevo,
    estado: 'ENVIADO',
    creadoEl: new Date('2026-09-03T14:00:00.000Z'),
    venceEl: null,
    farmacia: 'Farmacia Andina',
    sede: 'Sucursal Centro',
    direccion: null,
    modalidad: 'RETIRO',
    direccionDeEntrega: null,
    paciente: 'Ana Paciente',
    prescriptor: null,
    lineas: [lineaDeEjemplo()],
    totalEstimado: '68.00',
    moneda: 'BOB',
    codigoDeRetiro: null,
    motivoDeRechazo: null,
    sustituciones: [],
    envio: null,
    entregas: [],
    pago: null,
    requestId: null,
    siteId: IDS.sede,
    pharmacyId: IDS.farmacia,
    ...extra,
  };
}

/** Recién llegado: la cola «Nuevos» y la alarma. */
export const PEDIDO_NUEVO: PedidoFarmacia = pedidoDeEjemplo();

/**
 * Sale de la farmacia. Se declara **como lo devuelve la API** —`RETIRO`, sin
 * dirección—: el chip cambia porque `entregaDeEjemplo` lo reconoce por su
 * identificador, que es exactamente lo que pasa en la pantalla corriendo.
 */
export const PEDIDO_CON_DELIVERY: PedidoFarmacia = pedidoDeEjemplo({
  id: IDS.delivery,
  estado: 'EN_REVISION',
  paciente: 'Vania Gutiérrez Peña',
});

/** Con cobertura: un renglón aprobado y uno rechazado por el seguro. */
export const PEDIDO_CON_SEGURO: PedidoFarmacia = pedidoDeEjemplo({
  id: IDS.seguro,
  estado: 'EN_REVISION',
  paciente: 'Rosa Elena Quispe Vargas',
  lineas: [
    lineaDeEjemplo({ medicamento: 'Levotiroxina 50 mcg', precio: '40.00', cantidad: 2 }),
    lineaDeEjemplo({ medicamento: 'Sertralina 50 mg', precio: '95.50' }),
  ],
  totalEstimado: '175.50',
});

/**
 * Entregado y facturado: el resumen de factura al pie del detalle.
 *
 * `entregas` va vacío **a propósito**: es lo que el adaptador produce siempre
 * (`pharmacy-orders.adapter.ts:95`). Un ejemplo con entregas cargadas sería
 * un objeto que ninguna pantalla puede recibir, y las pruebas que corrieran
 * sobre él no probarían nada de lo que pasa de verdad.
 */
export const PEDIDO_ENTREGADO_CON_FACTURA: PedidoFarmacia = pedidoDeEjemplo({
  id: IDS.entregado,
  estado: 'RETIRADO',
});
