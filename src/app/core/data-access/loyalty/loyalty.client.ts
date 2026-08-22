import { Injectable, signal } from '@angular/core';
import { of, throwError, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { generarCodigoLegible } from '../../codigo-legible/codigo-legible';
import {
  NOMBRE_PROGRAMA_PUNTOS,
  type Canje,
  type ComprobanteDeCanje,
  type Membresia,
  type MotivoDePuntos,
  type MovimientoDePuntos,
  type NivelDeMembresia,
  type PaginaDeMovimientos,
  type PedidoDeCanje,
} from './loyalty.types';

/** Cuántos movimientos devuelve una página del ledger. */
const MOVIMIENTOS_POR_PAGINA = 6;

/** Cuántos caracteres tiene el código que se dicta en el comercio. */
const LARGO_DEL_CODIGO_DE_CANJE = 8;

/**
 * Cuánto vive el comprobante de canje.
 *
 * Corto a propósito: es un código que se muestra en el mostrador, ahí mismo. Un
 * comprobante que vive horas invita a generarlo «por las dudas» y a que el
 * saldo quede descontado sin que nadie lo use.
 */
const MINUTOS_DE_VIGENCIA_DEL_CANJE = 15;

/** Un día en milisegundos, para sembrar fechas relativas legibles. */
const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Los dos niveles del programa sembrado.
 *
 * Son datos de **demostración**, no el programa real: los tramos y el
 * multiplicador salen de la negociación que el cliente todavía no cerró. Por
 * eso los nombres son descriptivos y no una marca inventada.
 */
const NIVELES_SEMBRADOS: readonly NivelDeMembresia[] = [
  { codigo: 'INICIAL', nombre: 'Inicial', multiplicador: '1', puntosMinimos: '0' },
  { codigo: 'FRECUENTE', nombre: 'Frecuente', multiplicador: '1.25', puntosMinimos: '500' },
];

/** Un movimiento del paquete de demostración, antes de volverse fechas y saldos. */
interface MovimientoSembrado {
  readonly diasAtras: number;
  readonly motivo: MotivoDePuntos;
  /** Positivo acredita, negativo debita. */
  readonly puntos: number;
  readonly detalle: string | null;
}

/**
 * El paquete de demostración, del más viejo al más nuevo.
 *
 * Cuenta una historia creíble: alguien que se inscribió, compró varias veces,
 * canjeó dos, perdió puntos por vencimiento y recibió una compensación. Con eso
 * la pantalla muestra los cinco motivos y el cursor pagina de verdad (14
 * movimientos, 6 por página).
 */
const MOVIMIENTOS_SEMBRADOS: readonly MovimientoSembrado[] = [
  { diasAtras: 120, motivo: 'BIENVENIDA', puntos: 100, detalle: 'Te sumaste al programa' },
  { diasAtras: 96, motivo: 'COMPRA', puntos: 45, detalle: 'Compra en Farmacia Central' },
  { diasAtras: 74, motivo: 'COMPRA', puntos: 80, detalle: 'Compra en Farmacia Central' },
  { diasAtras: 60, motivo: 'CANJE', puntos: -150, detalle: 'Canje en Farmacia Central' },
  { diasAtras: 48, motivo: 'COMPRA', puntos: 60, detalle: 'Compra en Farmacia del Sur' },
  { diasAtras: 40, motivo: 'COMPRA', puntos: 25, detalle: 'Compra en Farmacia Central' },
  { diasAtras: 32, motivo: 'VENCIMIENTO', puntos: -30, detalle: 'Puntos vencidos' },
  { diasAtras: 25, motivo: 'COMPRA', puntos: 120, detalle: 'Compra en Farmacia del Sur' },
  { diasAtras: 20, motivo: 'AJUSTE', puntos: 40, detalle: 'Devolución de un canje anulado' },
  { diasAtras: 14, motivo: 'COMPRA', puntos: 55, detalle: 'Compra en Farmacia Central' },
  { diasAtras: 9, motivo: 'COMPRA', puntos: 35, detalle: 'Compra en Farmacia Norte' },
  { diasAtras: 6, motivo: 'CANJE', puntos: -100, detalle: 'Canje en Farmacia Norte' },
  { diasAtras: 3, motivo: 'COMPRA', puntos: 90, detalle: 'Compra en Farmacia Central' },
  { diasAtras: 1, motivo: 'COMPRA', puntos: 70, detalle: 'Compra en Farmacia Central' },
];

/**
 * Lo que devuelve el cliente cuando alguien pide canjear más de lo que tiene.
 *
 * El backend real rechaza ese canje —el saldo nunca queda negativo, es regla
 * del modelo— así que el mock rechaza igual. Que la pantalla además deshabilite
 * el botón es cortesía; esto es el candado.
 */
export class SaldoInsuficienteError extends Error {
  constructor(
    readonly saldo: string,
    readonly pedidos: string,
  ) {
    super(`El saldo disponible (${saldo}) no alcanza para canjear ${pedidos} puntos.`);
    this.name = 'SaldoInsuficienteError';
  }
}

/**
 * La billetera de puntos del paciente (carril FAR-I6).
 *
 * ## Por qué es un mock
 *
 * El backend tiene las tablas y las escrituras de fidelidad, pero **ninguna
 * lectura para el paciente**: `GET /loyalty/programs` está cerrado a roles de
 * administración y los saldos sólo vuelven como efecto colateral de un `POST`.
 * Las dos lecturas que faltan están pedidas, con su contrato exacto, en
 * `COORDINACION-AGENTES.md`.
 *
 * TODO(FAR-E?): conectar `miMembresia` y `misMovimientos` a esos dos `GET`.
 * Un solo commit: el ajuste vive acá, las pantallas no se enteran. `canjear`
 * ya espeja el endpoint real, que autoriza a `MEMBER`.
 *
 * ## Qué es real y qué está sembrado
 *
 * Las **reglas** son las del modelo y se cumplen de verdad: el saldo nunca
 * queda negativo, canjear no toca los puntos de por vida ni el nivel, el ledger
 * es append-only y la clave de idempotencia devuelve la entrada anterior en vez
 * de descontar dos veces. Los **datos** son de demostración y sólo existen con
 * `environment.loyaltyDemo`: apagado, no hay membresía y la pantalla lo dice.
 *
 * El **código de canje** es lo único simulado del carril: quien lo escanea —el
 * lado comercio— no existe y está declarado fuera de alcance.
 */
@Injectable({ providedIn: 'root' })
export class LoyaltyClient {
  private readonly membresia = signal<Membresia | null>(this.sembrarMembresia());
  private readonly ledger = signal<readonly MovimientoDePuntos[]>(this.sembrarLedger());

  /**
   * Los canjes ya emitidos, por clave de idempotencia.
   *
   * Reintentar con la misma clave devuelve el mismo canje. Con el backend real
   * esto lo resuelve la base; acá lo resuelve el mapa, y por el mismo motivo:
   * un reintento no puede descontar dos veces.
   */
  private readonly canjesEmitidos = new Map<string, Canje>();

  /** La billetera en vivo, para quien quiera reaccionar sin volver a pedirla. */
  readonly saldoEnVivo = this.membresia.asReadonly();

  /**
   * TODO(FAR-E?): `GET /loyalty/memberships/me`.
   *
   * `null` = esta persona no tiene membresía en ningún programa activo. Es un
   * estado legítimo, no un error: la pantalla lo pinta como el vacío honesto.
   */
  miMembresia(): Observable<Membresia | null> {
    return of(this.membresia());
  }

  /**
   * TODO(FAR-E?): `GET /loyalty/memberships/me/points?cursor=&limit=`.
   *
   * Paginado **por cursor**, nunca por número de página: es la regla del M34 y
   * es la forma en que el backend va a devolverlo. Más nuevos primero.
   *
   * @param cursor El `nextCursor` de la página anterior, o `null` para la primera.
   */
  misMovimientos(cursor: string | null = null): Observable<PaginaDeMovimientos> {
    const todos = this.ledger();
    const desde = posicionDelCursor(cursor, todos);
    const movimientos = todos.slice(desde, desde + MOVIMIENTOS_POR_PAGINA);
    const siguiente = desde + movimientos.length;
    return of({
      movimientos,
      nextCursor: siguiente < todos.length ? todos[siguiente].id : null,
    });
  }

  /**
   * TODO(FAR-E?): `POST /loyalty/memberships/:id/points/redeem`.
   *
   * Espeja el contrato real, que ya autoriza a `MEMBER`. Que el saldo baje acá
   * y no cuando el comercio escanee no es una decisión de diseño nuestra: es lo
   * que hace ese endpoint.
   *
   * Rechaza con `SaldoInsuficienteError` si no alcanza — el saldo nunca queda
   * negativo. Reintentar con la misma clave devuelve el canje anterior.
   */
  canjear(pedido: PedidoDeCanje): Observable<Canje> {
    const yaEmitido = this.canjesEmitidos.get(pedido.idempotencyKey);
    if (yaEmitido !== undefined) {
      return of({ ...yaEmitido, duplicado: true });
    }

    const actual = this.membresia();
    if (actual === null) {
      return throwError(() => new SaldoInsuficienteError('0', pedido.puntos));
    }

    const saldo = comoEntero(actual.saldo);
    const puntos = comoEntero(pedido.puntos);
    if (!Number.isFinite(puntos) || puntos <= 0 || !Number.isFinite(saldo) || puntos > saldo) {
      return throwError(() => new SaldoInsuficienteError(actual.saldo, pedido.puntos));
    }

    const saldoDespues = saldo - puntos;
    const movimiento: MovimientoDePuntos = {
      id: crypto.randomUUID(),
      direccion: 'DEBITO',
      puntos: String(puntos),
      motivo: 'CANJE',
      saldoDespues: String(saldoDespues),
      detalle: 'Canje que generaste desde la app',
      ocurrioEl: new Date(),
      venceEl: null,
    };
    // Append-only: la entrada nueva va al frente de la lectura (más nuevos
    // primero) y ninguna de las anteriores se toca.
    this.ledger.set([movimiento, ...this.ledger()]);
    // Los puntos de por vida y el nivel NO se mueven: el nivel mide lealtad
    // acumulada, no saldo disponible.
    this.membresia.set({ ...actual, saldo: String(saldoDespues) });

    const canje: Canje = {
      id: movimiento.id,
      puntos: String(puntos),
      saldoDespues: String(saldoDespues),
      puntosDePorVida: actual.puntosDePorVida,
      duplicado: false,
    };
    this.canjesEmitidos.set(pedido.idempotencyKey, canje);
    return of(canje);
  }

  /**
   * El comprobante que se muestra en el comercio.
   *
   * **Esto es lo simulado.** El código lo produce el front porque el lado que
   * lo consume no existe todavía; por eso la pantalla lo acompaña con el chip
   * DEMO y por eso vive separado del canje, que sí es contrato real.
   *
   * TODO(lado comercio): cuando exista, el código llega con la respuesta del
   * canje y esta función desaparece.
   */
  comprobanteDe(canje: Canje): ComprobanteDeCanje {
    const generadoEl = new Date();
    return {
      canje,
      codigo: generarCodigoLegible(LARGO_DEL_CODIGO_DE_CANJE),
      generadoEl,
      venceEl: new Date(generadoEl.getTime() + MINUTOS_DE_VIGENCIA_DEL_CANJE * 60 * 1000),
    };
  }

  /**
   * El puerto por el que entrará la acumulación cuando exista el porcentaje.
   *
   * Hoy no se llama desde ninguna parte, **a propósito**: cuántos puntos da una
   * compra es la negociación que el cliente todavía no cerró, y el equipo lo
   * declaró fuera de alcance. Inventar un porcentaje sería exactamente lo que
   * la regla del carril prohíbe.
   *
   * TODO(FAR-E?): lo dispara el backend al dispensar
   * (`POST /loyalty/memberships/:id/points/earn`, rol `SYSTEM`), y el aviso al
   * paciente viaja por la campana. Acá queda la forma, no la política.
   */
  acreditarPorCompra(puntos: string, detalle: string): Observable<Membresia | null> {
    const actual = this.membresia();
    const ganados = comoEntero(puntos);
    if (actual === null || !Number.isFinite(ganados) || ganados <= 0) {
      return of(actual);
    }
    const saldo = comoEntero(actual.saldo) + ganados;
    const deporVida = comoEntero(actual.puntosDePorVida) + ganados;
    this.ledger.set([
      {
        id: crypto.randomUUID(),
        direccion: 'CREDITO',
        puntos: String(ganados),
        motivo: 'COMPRA',
        saldoDespues: String(saldo),
        detalle,
        ocurrioEl: new Date(),
        venceEl: null,
      },
      ...this.ledger(),
    ]);
    const actualizada: Membresia = {
      ...actual,
      saldo: String(saldo),
      puntosDePorVida: String(deporVida),
      nivel: nivelPara(deporVida),
    };
    this.membresia.set(actualizada);
    return of(actualizada);
  }

  /** La membresía sembrada, o `null` cuando la demo está apagada. */
  private sembrarMembresia(): Membresia | null {
    if (!environment.loyaltyDemo) {
      return null;
    }
    const deporVida = MOVIMIENTOS_SEMBRADOS.filter((m) => m.puntos > 0).reduce(
      (total, m) => total + m.puntos,
      0,
    );
    const saldo = MOVIMIENTOS_SEMBRADOS.reduce((total, m) => total + m.puntos, 0);
    return {
      id: crypto.randomUUID(),
      programa: NOMBRE_PROGRAMA_PUNTOS,
      unidad: 'puntos',
      saldo: String(saldo),
      puntosDePorVida: String(deporVida),
      nivel: nivelPara(deporVida),
      inscritaEl: new Date(Date.now() - 120 * UN_DIA),
      estado: 'ACTIVA',
    };
  }

  /** El ledger sembrado, más nuevos primero, con los saldos ya encadenados. */
  private sembrarLedger(): readonly MovimientoDePuntos[] {
    if (!environment.loyaltyDemo) {
      return [];
    }
    let saldo = 0;
    const enOrden = MOVIMIENTOS_SEMBRADOS.map((sembrado) => {
      saldo += sembrado.puntos;
      const movimiento: MovimientoDePuntos = {
        id: crypto.randomUUID(),
        direccion: sembrado.puntos >= 0 ? 'CREDITO' : 'DEBITO',
        puntos: String(Math.abs(sembrado.puntos)),
        motivo: sembrado.motivo,
        saldoDespues: String(saldo),
        detalle: sembrado.detalle,
        ocurrioEl: new Date(Date.now() - sembrado.diasAtras * UN_DIA),
        venceEl: null,
      };
      return movimiento;
    });
    return enOrden.reverse();
  }
}

/**
 * Dónde arranca la página que pide este cursor.
 *
 * El cursor es el id del primer movimiento de la página siguiente. Si no se
 * reconoce —el ledger cambió debajo— se vuelve al principio: mejor repetir la
 * primera página que devolver una ventana arbitraria.
 */
function posicionDelCursor(
  cursor: string | null,
  movimientos: readonly MovimientoDePuntos[],
): number {
  if (cursor === null) {
    return 0;
  }
  const posicion = movimientos.findIndex((movimiento) => movimiento.id === cursor);
  return posicion < 0 ? 0 : posicion;
}

/**
 * El nivel que corresponde a estos puntos de por vida: el más alto cuyo mínimo
 * ya se alcanzó.
 */
function nivelPara(puntosDePorVida: number): NivelDeMembresia | null {
  const alcanzados = NIVELES_SEMBRADOS.filter(
    (nivel) => puntosDePorVida >= comoEntero(nivel.puntosMinimos),
  );
  return alcanzados.length === 0 ? null : alcanzados[alcanzados.length - 1];
}

/**
 * El texto de una cifra de puntos como número.
 *
 * Los puntos viajan como texto porque en la base son `numeric`; para compararlos
 * y restarlos hace falta un número, igual que hace el pedido de farmacia con los
 * importes. `NaN` cuando el texto no es una cifra, y quien llama lo comprueba:
 * `Number('')` es `0`, y un cero inventado acá sería un saldo inventado.
 */
function comoEntero(texto: string): number {
  const limpio = texto.trim();
  return limpio === '' ? Number.NaN : Number(limpio);
}
