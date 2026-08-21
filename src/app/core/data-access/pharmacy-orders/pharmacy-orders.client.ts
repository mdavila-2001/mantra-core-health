import { Injectable, signal } from '@angular/core';
import { of, type Observable } from 'rxjs';

import type {
  BorradorDePedido,
  EnvioDePedido,
  EstadoDePedido,
  PedidoFarmacia,
  PropuestaDeSustitucion,
  SimulacionDeFarmacia,
} from './pharmacy-orders.types';

/** Cuántas horas vive la reserva desde que el pedido queda listo (contrato). */
const HORAS_DE_RESERVA = 48;

/**
 * Alfabeto del código de retiro: sin `O/0`, `I/1` ni `B/8` — se lee en voz
 * alta en un mostrador y no puede prestarse a confusión.
 */
const ALFABETO_DE_RETIRO = 'ACDEFHJKLMNPRTUVWXY34679';

const LARGO_DEL_CODIGO = 6;

/** El motivo con que la simulación rechaza: honesto y accionable. */
const MOTIVO_DE_RECHAZO_SIMULADO =
  'La sucursal no tiene stock suficiente para preparar tu pedido.';

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
 * Cliente de pedidos de farmacia (carril FAR-I2), **contract-first y todavía
 * sin backend**.
 *
 * ## Por qué un mock y no HTTP
 *
 * El contrato de la tanda existe (`POST /pharmacy/orders`,
 * `GET /pharmacy/orders/me`, `POST /pharmacy/orders/:id/confirm|reject|
 * accept-substitutions|ready|dispense|cancel`) pero FAR-E1 no lo implementó
 * aún. La regla de la casa es no esperar: este cliente guarda los pedidos en
 * memoria con las **firmas definitivas**, y las pantallas consumen
 * Observables como si el backend existiera.
 *
 * TODO(FAR-E1): conectar cada método a su endpoint real (un solo commit: el
 * ajuste vive acá, las pantallas no se enteran). Mientras tanto los pedidos
 * viven lo que vive la sesión de la pestaña — y eso también es honesto: no
 * hay dónde persistirlos todavía.
 *
 * ## La simulación es demo, no producto
 *
 * `simular()` ejecuta los pasos de la contraparte (revisar, confirmar,
 * proponer una sustitución…). Su único consumidor legítimo es la barra de
 * demostración del detalle, que sólo se pinta con `environment.demoPresets`.
 */
@Injectable({ providedIn: 'root' })
export class PharmacyOrdersClient {
  private readonly pedidos = signal<readonly PedidoFarmacia[]>([]);
  private readonly borrador = signal<BorradorDePedido | null>(null);

  /** El borrador que dejó «dónde comprar mi receta», si hay uno. */
  readonly borradorPreparado = this.borrador.asReadonly();

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
      farmacia: envio.borrador.farmacia,
      sede: envio.borrador.sede,
      direccion: envio.borrador.direccion,
      modalidad: envio.modalidad,
      direccionDeEntrega: envio.direccionDeEntrega,
      lineas: envio.borrador.lineas,
      totalEstimado: envio.borrador.totalEstimado,
      moneda: envio.borrador.moneda,
      codigoDeRetiro: null,
      motivoDeRechazo: null,
      sustituciones: [],
      requestId: envio.borrador.requestId,
      siteId: envio.borrador.siteId,
    };
    this.pedidos.set([pedido, ...this.pedidos()]);
    this.borrador.set(null);
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

  /** TODO(FAR-E1): `POST /pharmacy/orders/:id/accept-substitutions`. */
  aceptarSustituciones(id: string): Observable<PedidoFarmacia | null> {
    return of(this.transicionar(id, 'ACEPTACION_PENDIENTE', { estado: 'ACEPTADO' }));
  }

  /**
   * Rechazar la propuesta manteniendo la receta original. El pedido vuelve a
   * `CONFIRMADO`: la farmacia ya lo había revisado, y la propuesta queda en
   * el registro como historia. TODO(FAR-E1): el endpoint que E1 defina.
   */
  preferirOriginal(id: string): Observable<PedidoFarmacia | null> {
    return of(this.transicionar(id, 'ACEPTACION_PENDIENTE', { estado: 'CONFIRMADO' }));
  }

  /** TODO(FAR-E1): `POST /pharmacy/orders/:id/cancel`. */
  cancelar(id: string): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !puedeCancelarse(actual.estado)) {
      return of(actual ?? null);
    }
    return of(this.actualizar(id, { estado: 'CANCELADO' }));
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

  /** Qué pasos de farmacia puede simular la barra de demo desde este estado. */
  simulacionesPara(estado: EstadoDePedido): readonly SimulacionDeFarmacia[] {
    return SIMULACIONES_POR_ESTADO[estado] ?? [];
  }

  /**
   * Ejecuta un paso de la contraparte. Un paso que el estado no permite no
   * hace nada: la barra de demo no ofrece esos botones, y el mock no inventa
   * un error de un backend que todavía no existe.
   */
  simular(id: string, paso: SimulacionDeFarmacia): Observable<PedidoFarmacia | null> {
    const actual = this.pedidos().find((pedido) => pedido.id === id);
    if (actual === undefined || !this.simulacionesPara(actual.estado).includes(paso)) {
      return of(actual ?? null);
    }

    const cambios: Partial<PedidoFarmacia> = {
      estado: ESTADO_POR_SIMULACION[paso],
      ...(paso === 'MARCAR_LISTO'
        ? {
            codigoDeRetiro: codigoDeRetiro(),
            venceEl: new Date(Date.now() + HORAS_DE_RESERVA * 60 * 60 * 1000),
          }
        : {}),
      ...(paso === 'RECHAZAR' ? { motivoDeRechazo: MOTIVO_DE_RECHAZO_SIMULADO } : {}),
      ...(paso === 'PROPONER_SUSTITUCION'
        ? { sustituciones: [...actual.sustituciones, propuestaDesde(actual)] }
        : {}),
    };
    return of(this.actualizar(id, cambios));
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

/** Seis caracteres legibles en voz alta; la unicidad la dará el backend. */
function codigoDeRetiro(): string {
  let codigo = '';
  for (let i = 0; i < LARGO_DEL_CODIGO; i += 1) {
    codigo += ALFABETO_DE_RETIRO[Math.floor(Math.random() * ALFABETO_DE_RETIRO.length)];
  }
  return codigo;
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
