import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { of, type Observable } from 'rxjs';

import { SessionStore } from '../../auth/session.store';
import { generarCodigoLegible } from '../../codigo-legible/codigo-legible';
import {
  ESTADOS_DE_PAGO,
  ESTADOS_DE_PEDIDO,
  ORIGENES_DE_PAGO,
  type AjusteDeLinea,
  type BorradorDePedido,
  type EnvioDePedido,
  type EstadoDePedido,
  type HitoDeEnvio,
  type LineaDePedido,
  type PagoDelPedido,
  type PedidoFarmacia,
  type PropuestaDeSustitucion,
  type RegistroDeRetiro,
  type ResultadoDeDispensa,
  type SimulacionDeFarmacia,
} from './pharmacy-orders.types';

/** Cuántas horas vive la reserva desde que el pedido queda listo (contrato). */
const HORAS_DE_RESERVA = 48;

const LARGO_DEL_CODIGO = 6;

/** El motivo con que la simulación rechaza: honesto y accionable. */
const MOTIVO_DE_RECHAZO_SIMULADO =
  'La sucursal no tiene stock suficiente para preparar tu pedido.';

/**
 * El canal que sincroniza el mock entre pestañas: la demo de dos ventanas
 * (paciente en una, mostrador en la otra). Muere con el backend real.
 */
const CANAL_DE_DEMO = 'alovida.pharmacy-orders.demo';

/** Qué simulación de farmacia es coherente desde cada estado. */
const SIMULACIONES_POR_ESTADO: Readonly<
  Partial<Record<EstadoDePedido, readonly SimulacionDeFarmacia[]>>
> = {
  ENVIADO: ['REVISAR', 'CONFIRMAR', 'RECHAZAR'],
  EN_REVISION: ['CONFIRMAR', 'PROPONER_SUSTITUCION', 'RECHAZAR'],
  CONFIRMADO: ['PROPONER_SUSTITUCION', 'MARCAR_LISTO'],
  ACEPTADO: ['MARCAR_LISTO'],
  LISTO_PARA_RETIRO: ['DISPENSAR', 'VENCER'],
};

/** A qué estado lleva cada simulación. */
const ESTADO_POR_SIMULACION: Readonly<Record<SimulacionDeFarmacia, EstadoDePedido>> = {
  REVISAR: 'EN_REVISION',
  CONFIRMAR: 'CONFIRMADO',
  PROPONER_SUSTITUCION: 'ACEPTACION_PENDIENTE',
  MARCAR_LISTO: 'LISTO_PARA_RETIRO',
  DISPENSAR: 'RETIRADO',
  RECHAZAR: 'RECHAZADO',
  VENCER: 'VENCIDO',
};

/**
 * Cliente de pedidos de farmacia (carriles FAR-I2/FAR-I3), **contract-first
 * y todavía sin backend**.
 *
 * ## Por qué un mock y no HTTP
 *
 * El contrato de la tanda existe (`POST /pharmacy/orders`,
 * `GET /pharmacy/orders/me`, `GET /pharmacy/orders`,
 * `POST /pharmacy/orders/:id/confirm|reject|accept-substitutions|ready|
 * dispense|cancel`) pero FAR-E1/E2 no lo implementaron aún. La regla de la
 * casa es no esperar: este cliente guarda los pedidos en memoria con las
 * **firmas definitivas**, y las pantallas consumen Observables como si el
 * backend existiera.
 *
 * TODO(FAR-E1): conectar cada método del lado paciente a su endpoint real.
 * TODO(FAR-E2/E3): ídem el lado del mostrador. Un solo commit por lado: el
 * ajuste vive acá, las pantallas no se enteran. Mientras tanto los pedidos
 * viven lo que vive la sesión de la pestaña — y eso también es honesto: no
 * hay dónde persistirlos todavía.
 *
 * ## La demo de dos ventanas
 *
 * Cada mutación viaja por `BroadcastChannel` para que la bandeja del
 * mostrador (FAR-I3) vea en su pestaña el pedido que el paciente envía en
 * otra. Sin `localStorage` a propósito: nada promete una durabilidad que el
 * backend todavía no da. El canal desaparece entero con FAR-E1/E2.
 *
 * ## La simulación es demo, no producto
 *
 * `simular()` ejecuta los pasos de la contraparte (revisar, confirmar,
 * proponer una sustitución…). Su único consumidor legítimo es la barra de
 * demostración del detalle, que sólo se pinta con `environment.demoPresets`.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyOrdersClient {
  private readonly session = inject(SessionStore);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pedidos = signal<readonly PedidoFarmacia[]>([]);
  private readonly borrador = signal<BorradorDePedido | null>(null);
  private readonly canal = this.abrirCanal();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.canal?.close());
  }

  /** El borrador que dejó «dónde comprar mi receta», si hay uno. */
  readonly borradorPreparado = this.borrador.asReadonly();

  /**
   * El mostrador de la demo, en vivo: la bandeja (FAR-I3) reacciona al
   * instante a lo que llega por el canal de pestañas. Con FAR-E2 este
   * signal se va y la bandeja queda sólo con su polling.
   */
  readonly pedidosEnVivo = this.pedidos.asReadonly();

  /** Deja el borrador listo para que la confirmación lo lea. */
  prepararBorrador(borrador: BorradorDePedido): void {
    this.borrador.set(borrador);
  }

  /** Descarta el borrador: quien vuelve atrás no deja un pedido a medias. */
  descartarBorrador(): void {
    this.borrador.set(null);
  }

  /** TODO(FAR-E1): `POST /pharmacy/orders`. */
  enviar(envio: EnvioDePedido): Observable<PedidoFarmacia> {
    const pedido: PedidoFarmacia = {
      id: crypto.randomUUID(),
      estado: 'ENVIADO',
      creadoEl: new Date(),
      venceEl: null,
      pharmacyId: envio.borrador.pharmacyId,
      farmacia: envio.borrador.farmacia,
      sede: envio.borrador.sede,
      direccion: envio.borrador.direccion,
      modalidad: envio.modalidad,
      direccionDeEntrega: envio.direccionDeEntrega,
      // En el backend real el nombre sale del token de quien envía; el mock
      // hace lo mismo con la sesión. El prescriptor llega con el DTO de
      // FAR-E2: acá sólo hay un uuid de perfil, y un uuid no se pinta.
      paciente: this.session.displayName(),
      prescriptor: null,
      lineas: envio.borrador.lineas,
      totalEstimado: envio.borrador.totalEstimado,
      moneda: envio.borrador.moneda,
      codigoDeRetiro: null,
      motivoDeRechazo: null,
      sustituciones: [],
      envio: null,
      entregas: [],
      pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
      requestId: envio.borrador.requestId,
      siteId: envio.borrador.siteId,
    };
    this.pedidos.set([pedido, ...this.pedidos()]);
    this.borrador.set(null);
    this.publicar(pedido);
    return of(pedido);
  }

  /** TODO(FAR-E1): `GET /pharmacy/orders/me`. Más nuevos primero. */
  misPedidos(): Observable<readonly PedidoFarmacia[]> {
    return of(this.pedidos());
  }

  /**
   * TODO(FAR-E1): `GET /pharmacy/orders/:id`. `null` = no existe — con el
   * backend real será su 404, y `errorToViewState` ya lo traduce.
   */
  pedido(id: string): Observable<PedidoFarmacia | null> {
    return of(this.pedidos().find((pedido) => pedido.id === id) ?? null);
  }

  /**
   * TODO(FAR-E1): `POST /pharmacy/orders/:id/accept-substitutions`.
   *
   * Aceptar aplica lo acordado a las líneas: el mostrador prepara y registra
   * el genérico, no la marca que ya no va. La propuesta queda en
   * `sustituciones` como historia.
   */
  aceptarSustituciones(id: string): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || actual.estado !== 'ACEPTACION_PENDIENTE') {
      return of(actual ?? null);
    }
    const lineas = conSustitucionesAplicadas(actual);
    return of(
      this.actualizar(id, { estado: 'ACEPTADO', lineas, totalEstimado: totalDe(lineas) }),
    );
  }

  /**
   * Rechazar la propuesta manteniendo la receta original. El pedido vuelve a
   * `CONFIRMADO`: la farmacia ya lo había revisado, y la propuesta queda en
   * el registro como historia. TODO(FAR-E1): el endpoint que E1 defina.
   */
  preferirOriginal(id: string): Observable<PedidoFarmacia | null> {
    return of(this.transicionar(id, 'ACEPTACION_PENDIENTE', { estado: 'CONFIRMADO' }));
  }

  /**
   * TODO(FAR-E1): `POST /pharmacy/orders/:id/cancel`.
   *
   * Un pedido YA PAGADO no se cancela: la gestión de devolución no existe
   * (es de la pasarela real, FAR-E4), y cancelarlo dejaría plata cobrada por
   * mercadería que nadie entrega. El final sin cobro suelta el pago a `null`:
   * no queda nada pendiente que mostrar.
   */
  cancelar(id: string): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !puedeCancelarse(actual.estado) || estaPagado(actual)) {
      return of(actual ?? null);
    }
    return of(this.actualizar(id, { estado: 'CANCELADO', pago: null }));
  }

  /**
   * Re-crea un pedido `VENCIDO` con un toque: mismas líneas, misma sede,
   * misma modalidad — un pedido nuevo desde cero, no una reapertura.
   * TODO(FAR-E1): `POST /pharmacy/orders` con el mismo cuerpo.
   */
  reintentar(id: string): Observable<PedidoFarmacia | null> {
    const vencido = this.pedidos().find((pedido) => pedido.id === id);
    if (vencido === undefined || vencido.estado !== 'VENCIDO') {
      return of(null);
    }
    return this.enviar({
      borrador: {
        requestId: vencido.requestId,
        siteId: vencido.siteId,
        pharmacyId: vencido.pharmacyId,
        farmacia: vencido.farmacia,
        sede: vencido.sede,
        direccion: vencido.direccion,
        lineas: vencido.lineas,
        totalEstimado: vencido.totalEstimado,
        moneda: vencido.moneda,
      },
      modalidad: vencido.modalidad,
      direccionDeEntrega: vencido.direccionDeEntrega,
    });
  }

  /* ─── El lado del mostrador (FAR-I3) ─────────────────────────────────── */

  /**
   * TODO(FAR-E2): `GET /pharmacy/orders` — el recorte por organización lo
   * hace el backend con `X-Tenant-Id`; el mock no tiene tenants y devuelve
   * el mostrador completo de la demo.
   */
  pedidosDeFarmacia(): Observable<readonly PedidoFarmacia[]> {
    return of(this.pedidos());
  }

  /**
   * Abrir un pedido nuevo ES recepcionarlo: pasa a `EN_REVISION` y el
   * paciente ve que la farmacia lo está mirando — el «visto» del mostrador.
   * TODO(FAR-E2): el endpoint que E2 defina.
   */
  abrirRevision(id: string): Observable<PedidoFarmacia | null> {
    return of(this.transicionar(id, 'ENVIADO', { estado: 'EN_REVISION' }));
  }

  /**
   * TODO(FAR-E2): `POST /pharmacy/orders/:id/confirm`.
   *
   * Con al menos un genérico propuesto, el pedido queda esperando la
   * decisión del paciente (`ACEPTACION_PENDIENTE`); sin propuestas queda
   * `CONFIRMADO`. El total se recalcula con los renglones que siguen en pie
   * y su precio original: la propuesta no toca el precio hasta que la
   * persona la acepte.
   */
  confirmarPedido(
    id: string,
    ajustes: readonly AjusteDeLinea[],
  ): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !puedeConfirmarse(actual.estado)) {
      return of(actual ?? null);
    }
    const lineas = actual.lineas.map((linea, indice) => {
      const ajuste = ajustes.find((candidato) => candidato.indice === indice);
      return ajuste?.decision === 'NO_DISPONIBLE' ? { ...linea, disponible: false } : linea;
    });
    const propuestas = ajustes
      .filter(
        (ajuste) => ajuste.decision === 'PROPONER_GENERICO' && ajuste.propuesta !== undefined,
      )
      .map((ajuste) => propuestaParaLinea(actual, ajuste));
    return of(
      this.actualizar(id, {
        estado: propuestas.length > 0 ? 'ACEPTACION_PENDIENTE' : 'CONFIRMADO',
        lineas,
        totalEstimado: totalDe(lineas),
        sustituciones: [...actual.sustituciones, ...propuestas],
      }),
    );
  }

  /**
   * TODO(FAR-E2): `POST /pharmacy/orders/:id/reject` — motivo obligatorio.
   * Un pedido pagado tampoco se rechaza (misma razón que cancelar: la
   * devolución es de FAR-E4). El rechazo sin cobro suelta el pago a `null`.
   */
  rechazarPedido(id: string, motivo: string): Observable<PedidoFarmacia | null> {
    const texto = motivo.trim();
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (
      actual === undefined ||
      texto === '' ||
      !puedeRechazarsePorFarmacia(actual.estado) ||
      estaPagado(actual)
    ) {
      return of(actual ?? null);
    }
    return of(this.actualizar(id, { estado: 'RECHAZADO', motivoDeRechazo: texto, pago: null }));
  }

  /**
   * TODO(FAR-E2): `POST /pharmacy/orders/:id/ready`. Sólo para retiros: con
   * envío no hay mostrador ni código — el cierre es `marcarEnvio`.
   */
  marcarListo(id: string): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !puedePrepararse(actual.estado) || actual.modalidad !== 'RETIRO') {
      return of(actual ?? null);
    }
    return of(this.actualizar(id, cambiosDeListo()));
  }

  /**
   * TODO(FAR-E3): `POST /pharmacy/orders/:id/dispense`.
   *
   * El código se compara sin distinguir mayúsculas. La entrega puede ser
   * parcial: el pedido sigue `LISTO_PARA_RETIRO` con la entrega en su
   * historia, y pasa a `RETIRADO` cuando las entregas cubren todos los
   * renglones que la farmacia tenía en pie.
   */
  dispensar(id: string, registro: RegistroDeRetiro): Observable<ResultadoDeDispensa> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || actual.estado !== 'LISTO_PARA_RETIRO') {
      return of({ codigoValido: true, pedido: actual ?? null });
    }
    if (registro.codigo.trim().toUpperCase() !== actual.codigoDeRetiro) {
      return of({ codigoValido: false, pedido: actual });
    }
    const previos = new Set(actual.entregas.flatMap((entrega) => entrega.indices));
    const indices = registro.indices.filter(
      (indice) => actual.lineas[indice]?.disponible === true && !previos.has(indice),
    );
    if (indices.length === 0) {
      return of({ codigoValido: true, pedido: actual });
    }
    const entregas = [...actual.entregas, { momento: new Date(), indices }];
    const entregados = new Set(entregas.flatMap((entrega) => entrega.indices));
    const completo = actual.lineas.every(
      (linea, indice) => !linea.disponible || entregados.has(indice),
    );
    // La PRIMERA entrega cobra el pedido en pie completo: la persona está en
    // el mostrador y «pagás al retirar» sucede ahí, aunque vuelva por el
    // resto otro día. TODO(FAR-E3): la dispensación real define pagos
    // parciales; el mock no los inventa.
    return of({
      codigoValido: true,
      pedido: this.actualizar(
        id,
        completo
          ? { entregas, estado: 'RETIRADO', pago: pagoAlCerrar(actual) }
          : { entregas, pago: pagoAlCerrar(actual) },
      ),
    });
  }

  /**
   * El delivery artesanal (la costura de FAR-E4): la farmacia marca los
   * hitos a mano y el texto es honesto — no hay courier real detrás.
   * «Entregado» cierra el pedido: con envío no hay mostrador ni código.
   * TODO(FAR-E4): el endpoint del puerto de delivery.
   */
  marcarEnvio(id: string, hito: HitoDeEnvio): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || actual.modalidad === 'RETIRO') {
      return of(actual ?? null);
    }
    if (hito === 'EN_CAMINO') {
      const permitido = puedePrepararse(actual.estado) && actual.envio === null;
      return of(permitido ? this.actualizar(id, { envio: 'EN_CAMINO' }) : actual);
    }
    // Un pedido que terminó (cancelado en el camino, por ejemplo) no se
    // resucita: la entrega sólo cierra lo que sigue en preparación.
    if (actual.envio !== 'EN_CAMINO' || !puedePrepararse(actual.estado)) {
      return of(actual);
    }
    return of(
      this.actualizar(id, {
        envio: 'ENTREGADO',
        estado: 'RETIRADO',
        entregas: [...actual.entregas, { momento: new Date(), indices: enPie(actual) }],
        pago: pagoAlCerrar(actual),
      }),
    );
  }

  /**
   * El «pago aprobado» del QR simulado (carril FAR-I5). Sólo lo dispara el
   * botón de la pestaña QR, que sólo existe con `environment.paymentDemo`:
   * la pasarela real no está, y este camino lo dice con el chip DEMO.
   * TODO(FAR-E4): el puerto real de pago reemplaza esto detrás de la misma
   * firma; las pantallas no se enteran.
   */
  confirmarPagoDemo(id: string): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !puedePagarse(actual.estado) || estaPagado(actual)) {
      return of(actual ?? null);
    }
    return of(
      this.actualizar(id, {
        pago: {
          estado: 'PAGADO',
          origen: 'QR_DEMO',
          pagadoEl: new Date(),
          // Se congela lo que el QR mostró: si el pedido cambiara después,
          // el comprobante sigue diciendo lo que de verdad se pagó.
          total: actual.totalEstimado,
          moneda: actual.moneda,
        },
      }),
    );
  }

  /**
   * Qué pasos de farmacia puede simular la barra de demo para este pedido.
   * Por pedido y no por estado: sobre un pedido YA PAGADO el precio está
   * cerrado — no se propone un genérico (cambiaría el total pagado), no se
   * rechaza ni se vence (la devolución es de FAR-E4). Queda lo que entrega.
   */
  simulacionesPara(pedido: PedidoFarmacia): readonly SimulacionDeFarmacia[] {
    const posibles = SIMULACIONES_POR_ESTADO[pedido.estado] ?? [];
    if (!estaPagado(pedido)) {
      return posibles;
    }
    return posibles.filter(
      (paso) => paso !== 'PROPONER_SUSTITUCION' && paso !== 'RECHAZAR' && paso !== 'VENCER',
    );
  }

  /**
   * Ejecuta un paso de la contraparte. Un paso que el pedido no permite no
   * hace nada: la barra de demo no ofrece esos botones, y el mock no inventa
   * un error de un backend que todavía no existe.
   */
  simular(id: string, paso: SimulacionDeFarmacia): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !this.simulacionesPara(actual).includes(paso)) {
      return of(actual ?? null);
    }

    const cambios: Partial<PedidoFarmacia> = {
      estado: ESTADO_POR_SIMULACION[paso],
      ...(paso === 'MARCAR_LISTO' ? cambiosDeListo() : {}),
      ...(paso === 'RECHAZAR' ? { motivoDeRechazo: MOTIVO_DE_RECHAZO_SIMULADO, pago: null } : {}),
      ...(paso === 'VENCER' ? { pago: null } : {}),
      ...(paso === 'PROPONER_SUSTITUCION'
        ? { sustituciones: [...actual.sustituciones, propuestaDesde(actual)] }
        : {}),
      // Entregar en mostrador también cobra (FAR-I5): sin esto, el ciclo de
      // la barra de demo cerraría pedidos sin pago y sin comprobante.
      ...(paso === 'DISPENSAR' ? { pago: pagoAlCerrar(actual) } : {}),
    };
    return of(this.actualizar(id, cambios));
  }

  /**
   * El puente de la demo de dos ventanas. Guardas dobles: bajo SSR no hay
   * canal, y en un navegador sin `BroadcastChannel` la demo sigue andando
   * en una sola pestaña.
   */
  private abrirCanal(): BroadcastChannel | null {
    if (!this.esBrowser || typeof BroadcastChannel === 'undefined') {
      return null;
    }
    const canal = new BroadcastChannel(CANAL_DE_DEMO);
    canal.onmessage = (evento: MessageEvent<unknown>) => {
      // El canal es público dentro del origen (otra versión de la app en
      // otra pestaña durante un deploy, la consola): sólo entra lo que tiene
      // la forma del contrato — un solo `null` en el store rompería cada
      // `filter` de la bandeja para toda la sesión.
      if (esPedidoDelCanal(evento.data)) {
        this.recibir(evento.data);
      }
    };
    return canal;
  }

  /** Upsert de un pedido que llegó desde otra pestaña. */
  private recibir(pedido: PedidoFarmacia): void {
    const actuales = this.pedidos();
    const existe = actuales.some((candidato) => candidato.id === pedido.id);
    this.pedidos.set(
      existe
        ? actuales.map((candidato) => (candidato.id === pedido.id ? pedido : candidato))
        : [pedido, ...actuales],
    );
  }

  private publicar(pedido: PedidoFarmacia): void {
    this.canal?.postMessage(pedido);
  }

  /** Aplica cambios si el pedido existe y está en el estado esperado. */
  private transicionar(
    id: string,
    desde: EstadoDePedido,
    cambios: Partial<PedidoFarmacia>,
  ): PedidoFarmacia | null {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined) {
      return null;
    }
    if (actual.estado !== desde) {
      return actual;
    }
    return this.actualizar(id, cambios);
  }

  private actualizar(id: string, cambios: Partial<PedidoFarmacia>): PedidoFarmacia {
    let actualizado!: PedidoFarmacia;
    this.pedidos.set(
      this.pedidos().map((pedido) => {
        if (pedido.id !== id) {
          return pedido;
        }
        actualizado = { ...pedido, ...cambios };
        return actualizado;
      }),
    );
    this.publicar(actualizado);
    return actualizado;
  }
}

/** Un pedido se puede cancelar mientras nadie lo entregó ni lo cerró. */
export function puedeCancelarse(estado: EstadoDePedido): boolean {
  return !esEstadoTerminal(estado);
}

/** Los estados de los que un pedido ya no se mueve. */
export function esEstadoTerminal(estado: EstadoDePedido): boolean {
  return (
    estado === 'RETIRADO' ||
    estado === 'RECHAZADO' ||
    estado === 'VENCIDO' ||
    estado === 'CANCELADO'
  );
}

/** El mostrador puede confirmar lo que todavía no revisó o está revisando. */
export function puedeConfirmarse(estado: EstadoDePedido): boolean {
  return estado === 'ENVIADO' || estado === 'EN_REVISION';
}

/**
 * El mostrador puede rechazar mientras el pedido no cerró ni quedó listo:
 * un pedido en el mostrador esperando a la persona ya no se rechaza — se
 * dispensa o vence.
 */
export function puedeRechazarsePorFarmacia(estado: EstadoDePedido): boolean {
  return !esEstadoTerminal(estado) && estado !== 'LISTO_PARA_RETIRO';
}

/** Confirmado o con la propuesta aceptada: en preparación. */
export function puedePrepararse(estado: EstadoDePedido): boolean {
  return estado === 'CONFIRMADO' || estado === 'ACEPTADO';
}

/**
 * Un pedido se puede pagar cuando la farmacia ya fijó qué se lleva y por
 * cuánto: en preparación o listo en el mostrador. Antes de confirmar (o con
 * una propuesta en el aire) el total puede cambiar, y nadie paga un total
 * que se está moviendo.
 */
export function puedePagarse(estado: EstadoDePedido): boolean {
  return puedePrepararse(estado) || estado === 'LISTO_PARA_RETIRO';
}

/** `true` sólo con el pago registrado (mostrador o demo). */
export function estaPagado(pedido: PedidoFarmacia): boolean {
  return pedido.pago?.estado === 'PAGADO';
}

/**
 * Un mensaje del canal de la demo es de fiar sólo con la forma del contrato:
 * id, estado del value set y las tres colecciones. Alcanza para que ninguna
 * pantalla lea propiedades de basura.
 */
export function esPedidoDelCanal(dato: unknown): dato is PedidoFarmacia {
  if (typeof dato !== 'object' || dato === null) {
    return false;
  }
  const pedido = dato as Partial<PedidoFarmacia>;
  return (
    typeof pedido.id === 'string' &&
    typeof pedido.estado === 'string' &&
    ESTADOS_DE_PEDIDO.includes(pedido.estado) &&
    pedido.creadoEl instanceof Date &&
    Array.isArray(pedido.lineas) &&
    Array.isArray(pedido.sustituciones) &&
    Array.isArray(pedido.entregas) &&
    esPagoDelContrato(pedido.pago)
  );
}

/**
 * `pago` viene del contrato de FAR-I5: `null` o un pago bien formado.
 * `undefined` es una versión vieja de la app en otra pestaña — contrato
 * distinto, afuera. Un `PAGADO` exige fecha `Date` de verdad y origen del
 * value set: el comprobante formatea esa fecha y arma el PDF con ella — una
 * fecha-string colada por el canal reventaría la descarga.
 */
function esPagoDelContrato(pago: PedidoFarmacia['pago'] | undefined): boolean {
  if (pago === null) {
    return true;
  }
  if (typeof pago !== 'object' || typeof pago.estado !== 'string') {
    return false;
  }
  if (!ESTADOS_DE_PAGO.includes(pago.estado)) {
    return false;
  }
  if (pago.estado === 'PENDIENTE') {
    return pago.origen === null && pago.pagadoEl === null;
  }
  return (
    pago.pagadoEl instanceof Date &&
    typeof pago.origen === 'string' &&
    ORIGENES_DE_PAGO.includes(pago.origen) &&
    (pago.total === null || typeof pago.total === 'string')
  );
}

/**
 * El pago con que un pedido cierra por el mostrador o la entrega: si ya
 * estaba pagado (el QR de la demo), se conserva tal cual; si no, el cierre
 * ES el cobro — «pagás al retirar» hecho dato, con el monto CONGELADO en el
 * momento de cobrar (el comprobante imprime esto, no el total vivo).
 */
function pagoAlCerrar(pedido: PedidoFarmacia): PagoDelPedido {
  if (pedido.pago?.estado === 'PAGADO') {
    return pedido.pago;
  }
  return {
    estado: 'PAGADO',
    origen: 'MOSTRADOR',
    pagadoEl: new Date(),
    total: pedido.totalEstimado,
    moneda: pedido.moneda,
  };
}

/** Los cambios de «quedó listo»: estado, código y las 48 h de reserva. */
function cambiosDeListo(): Partial<PedidoFarmacia> {
  return {
    estado: 'LISTO_PARA_RETIRO',
    codigoDeRetiro: codigoDeRetiro(),
    venceEl: new Date(Date.now() + HORAS_DE_RESERVA * 60 * 60 * 1000),
  };
}

/** Seis caracteres legibles en voz alta; la unicidad la dará el backend. */
function codigoDeRetiro(): string {
  return generarCodigoLegible(LARGO_DEL_CODIGO);
}

/** Índices de las líneas que la farmacia mantiene en pie. */
function enPie(pedido: PedidoFarmacia): readonly number[] {
  return pedido.lineas.flatMap((linea, indice) => (linea.disponible ? [indice] : []));
}

/**
 * Total de los renglones en pie con su precio original, como texto exacto.
 * `null` si no queda ninguno o si a alguno le falta el precio: un total a
 * medias es peor que decir que no se puede calcular.
 */
function totalDe(lineas: readonly LineaDePedido[]): string | null {
  const disponibles = lineas.filter((linea) => linea.disponible);
  if (disponibles.length === 0) {
    return null;
  }
  let total = 0;
  for (const linea of disponibles) {
    const precio = Number(linea.precio ?? Number.NaN);
    if (!Number.isFinite(precio)) {
      return null;
    }
    total += precio * linea.cantidad;
  }
  return total.toFixed(2);
}

/**
 * Las líneas con las propuestas aceptadas aplicadas: el renglón pasa a ser
 * el genérico acordado (nombre y precio); la presentación de la marca ya no
 * describe lo que se entrega, así que se suelta. La propuesta más nueva por
 * renglón manda. TODO(FAR-E2): el DTO real vincula propuesta↔renglón por
 * índice; el mock sólo puede matchear por el nombre del original.
 */
function conSustitucionesAplicadas(pedido: PedidoFarmacia): readonly LineaDePedido[] {
  const porOriginal = new Map<string, PropuestaDeSustitucion>();
  for (const propuesta of pedido.sustituciones) {
    porOriginal.set(propuesta.original.nombre, propuesta);
  }
  return pedido.lineas.map((linea) => {
    const aplicada = porOriginal.get(linea.medicamento);
    if (aplicada === undefined || !linea.disponible) {
      return linea;
    }
    // Una propuesta ajusta un solo renglón, aunque dos se llamen igual.
    porOriginal.delete(linea.medicamento);
    return {
      ...linea,
      medicamento: aplicada.propuesta.nombre,
      precio: aplicada.propuesta.precio,
      presentacion: null,
    };
  });
}

/** La propuesta que la confirmación del mostrador arma para un renglón. */
function propuestaParaLinea(
  pedido: PedidoFarmacia,
  ajuste: AjusteDeLinea,
): PropuestaDeSustitucion {
  const linea = pedido.lineas[ajuste.indice];
  return {
    id: crypto.randomUUID(),
    original: { nombre: linea?.medicamento ?? 'Tu medicamento', precio: linea?.precio ?? null },
    propuesta: {
      nombre: ajuste.propuesta?.nombre ?? '',
      precio: ajuste.propuesta?.precio ?? null,
    },
    moneda: linea?.moneda ?? pedido.moneda,
  };
}

/**
 * La propuesta que la simulación arma: el primer renglón disponible, con un
 * genérico más barato. Si el renglón no tiene precio publicado, la propuesta
 * tampoco inventa uno — la pantalla muestra la comparación sin el ahorro.
 */
function propuestaDesde(pedido: PedidoFarmacia): PropuestaDeSustitucion {
  const linea =
    pedido.lineas.find((candidata) => candidata.disponible && candidata.precio !== null) ??
    pedido.lineas[0];
  // `Number(null)` es 0 — finito— y terminaría inventando un precio «0.00».
  const original = Number(linea?.precio ?? Number.NaN);
  return {
    id: crypto.randomUUID(),
    original: { nombre: linea?.medicamento ?? 'Tu medicamento', precio: linea?.precio ?? null },
    propuesta: {
      nombre: `Genérico equivalente de ${linea?.medicamento ?? 'tu medicamento'}`,
      precio: Number.isFinite(original) ? (original * 0.4).toFixed(2) : null,
    },
    moneda: linea?.moneda ?? pedido.moneda,
  };
}
