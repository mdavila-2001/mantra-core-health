import { DatePipe } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import {
  LoyaltyClient,
  SaldoInsuficienteError,
} from '../../../core/data-access/loyalty/loyalty.client';
import {
  NOMBRE_PROGRAMA_PUNTOS,
  type ComprobanteDeCanje,
  type Membresia,
  type MovimientoDePuntos,
} from '../../../core/data-access/loyalty/loyalty.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { MIS_PEDIDOS_ROUTE } from '../pharmacy-orders/pharmacy-orders.routes';
import {
  etiquetaDeMotivo,
  movimientoEnPalabras,
  signoDe,
  tonoDeMovimiento,
  unidadDePuntos,
} from './punto-motivo';
import { RedeemCode } from './redeem-code/redeem-code';

/** En qué parte de la billetera está la persona. */
type PasoDeLaBilletera = 'saldo' | 'canjear' | 'comprobante';

/**
 * **Mis puntos** (carril FAR-I6): la billetera de fidelidad del paciente.
 *
 * El cliente pidió el módulo aunque el porcentaje por compra sea negociación
 * abierta («pero el módulo tiene que estar disponible»), así que esta pantalla
 * **existe siempre**. Lo que se ve depende de lo que el backend publique: hoy
 * no hay lecturas de saldo ni de movimientos para el paciente, así que la
 * billetera dice la verdad en vez de inventar un saldo.
 *
 * ## Qué es real acá
 *
 * Las reglas. El saldo nunca queda negativo, canjear no toca los puntos de por
 * vida ni el nivel, y el ledger sólo crece: son las del modelo
 * (`promotions.points_ledger_entries`) y el cliente las cumple de verdad. Lo
 * simulado es **el código de canje**, porque quien lo escanea —el lado
 * comercio— no existe todavía; por eso su comprobante lleva el chip DEMO.
 *
 * ## De dónde salen los datos (R-T-E6B2)
 *
 * Del backend, por HTTP: `GET /loyalty/me` y `GET /loyalty/me/points`, y el
 * canje por `POST /loyalty/me/points/redeem`. El titular no viaja desde acá:
 * lo resuelve el servidor con el paciente del token. Sin membresía la lectura
 * responde `enrolled: false` y la pantalla pinta su vacío, que es un estado
 * normal y no un error. No hay datos de ejemplo ni «Simular compra».
 *
 * Cero identificadores visibles: lo que se lee es el saldo, el nivel y qué pasó.
 *
 * ## Pantalla propia o pestaña de la ficha
 *
 * Es la misma billetera en dos lugares: en su ruta `/my-account/loyalty`,
 * con cabecera y migas, y como quinta pestaña de «Mi perfil» (N-03), donde
 * la tarjeta ya tiene cabecera y una segunda sería un título dentro de un
 * título. `embebido` apaga sólo eso; lo que se ve y lo que se puede hacer es
 * idéntico en los dos.
 */
@Component({
  selector: 'app-loyalty',
  imports: [
    Alert,
    AppButton,
    Badge,
    DatePipe,
    FormField,
    Input,
    PageHeader,
    RedeemCode,
    ViewStateHost,
  ],
  templateUrl: './loyalty.html',
  styleUrl: './loyalty.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Loyalty {
  private readonly loyalty = inject(LoyaltyClient);
  private readonly auth = inject(AuthService);
  private readonly navigation = inject(NavigationService);

  /** Montada dentro de otra pantalla: sin cabecera ni migas propias. */
  readonly embebido = input(false, { transform: booleanAttribute });

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly nombreDelPrograma = NOMBRE_PROGRAMA_PUNTOS;

  /** Sin perfil de paciente no hay membresía propia que mirar. */
  protected readonly sinPerfilDePaciente = this.auth.patientProfileId() === null;

  protected readonly membresia = signal<ViewState<Membresia>>(loading());
  protected readonly movimientos = signal<readonly MovimientoDePuntos[]>([]);
  protected readonly cursor = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);

  protected readonly paso = signal<PasoDeLaBilletera>('saldo');

  /**
   * Lo escrito en el campo.
   *
   * Es `string | number | null` y no `string` porque ése es el contrato del
   * átomo: con `type="number"` emite el número, o `null` con el campo vacío
   * —y `0` es un valor válido, así que no puede colapsarse con el vacío—.
   * Adaptarse al átomo es más barato que pedirle que mienta.
   */
  protected readonly puntosACanjear = signal<string | number | null>('');
  protected readonly errorDeCanje = signal<string | null>(null);
  protected readonly canjeando = signal(false);
  protected readonly comprobante = signal<ComprobanteDeCanje | null>(null);

  /** Los datos listos, para que la plantilla no destipe el estado. */
  protected readonly cuenta = computed(() => {
    const estado = this.membresia();
    return estado.status === 'ready' ? estado.data : null;
  });

  /** Hay más ledger del que se está mostrando. */
  protected readonly hayMas = computed(() => this.cursor() !== null);

  /** Canjear tiene sentido sólo con saldo: sin él, el botón no aparece. */
  protected readonly puedeCanjear = computed(() => {
    const cuenta = this.cuenta();
    return cuenta !== null && Number(cuenta.saldo) > 0;
  });

  constructor() {
    if (!this.sinPerfilDePaciente) {
      this.cargar();
    }
  }

  protected cargar(): void {
    this.membresia.set(loading());
    this.loyalty.miMembresia().subscribe({
      next: (cuenta) => {
        if (cuenta === null) {
          this.membresia.set(
            empty(
              // La salida es «Mis pedidos»: los puntos nacen de comprar, así
              // que la puerta correcta es donde vive la compra.
              { label: 'Ver mis pedidos', route: MIS_PEDIDOS_ROUTE },
              // Ahora sí lo sabemos: la lectura real responde `enrolled: false`
              // cuando la persona no tiene membresía en el programa del tenant.
              `Todavía no hay un programa de ${this.nombreDelPrograma} activo para tu cuenta. Cuando lo haya, vas a sumar puntos con cada compra en las farmacias de la red.`,
            ),
          );
          return;
        }
        this.membresia.set(ready(cuenta));
        this.cargarMovimientos();
      },
      error: (error: unknown) => this.membresia.set(errorToViewState<Membresia>(error)),
    });
  }

  /** La primera página del ledger; «Ver más» sigue desde el cursor. */
  protected cargarMovimientos(): void {
    this.loyalty.misMovimientos(null).subscribe((pagina) => {
      this.movimientos.set(pagina.movimientos);
      this.cursor.set(pagina.nextCursor);
    });
  }

  protected verMas(): void {
    const desde = this.cursor();
    if (desde === null || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.loyalty.misMovimientos(desde).subscribe({
      next: (pagina) => {
        this.movimientos.set([...this.movimientos(), ...pagina.movimientos]);
        this.cursor.set(pagina.nextCursor);
        this.cargandoMas.set(false);
      },
      error: () => this.cargandoMas.set(false),
    });
  }

  /** Abre el formulario de canje con el campo limpio. */
  protected abrirCanje(): void {
    this.puntosACanjear.set('');
    this.errorDeCanje.set(null);
    this.paso.set('canjear');
  }

  protected volverAlSaldo(): void {
    this.paso.set('saldo');
    this.comprobante.set(null);
  }

  /**
   * Pide el canje.
   *
   * La validación de acá es cortesía para no mandar un pedido imposible; el
   * candado real está en el cliente, que rechaza igual — el saldo nunca queda
   * negativo, y esa regla no puede vivir en una pantalla.
   */
  protected confirmarCanje(): void {
    const cuenta = this.cuenta();
    if (cuenta === null || this.canjeando()) {
      return;
    }
    const cifra = cifraDe(this.puntosACanjear());
    if (cifra === null || cifra <= 0) {
      this.errorDeCanje.set('Escribí cuántos puntos querés canjear.');
      return;
    }
    // Los puntos son unidades enteras: el ledger no guarda medios puntos.
    // Truncar en silencio canjearía una cantidad distinta de la pedida, así
    // que se rechaza y se dice por qué.
    if (!Number.isInteger(cifra)) {
      this.errorDeCanje.set('Los puntos son enteros: escribí una cantidad sin decimales.');
      return;
    }
    if (cifra > Number(cuenta.saldo)) {
      this.errorDeCanje.set(`Te alcanza para canjear hasta ${cuenta.saldo} puntos.`);
      return;
    }

    this.errorDeCanje.set(null);
    this.canjeando.set(true);
    this.loyalty
      .canjear({ puntos: String(cifra), idempotencyKey: crypto.randomUUID() })
      .subscribe({
        next: (canje) => {
          this.comprobante.set(this.loyalty.comprobanteDe(canje));
          this.membresia.set(ready({ ...cuenta, saldo: canje.saldoDespues }));
          this.canjeando.set(false);
          this.paso.set('comprobante');
          // El canje es una entrada más del ledger: se recarga desde el
          // principio para que aparezca arriba, que es donde corresponde.
          this.cargarMovimientos();
        },
        error: (error: unknown) => {
          this.canjeando.set(false);
          this.errorDeCanje.set(
            error instanceof SaldoInsuficienteError
              ? error.message
              : 'No pudimos registrar el canje. Probá de nuevo en un momento.',
          );
        },
      });
  }

  /** «1 punto», no «1 puntos», cuando la cifra va destacada aparte. */
  protected unidadDe(cifra: string): string {
    return unidadDePuntos(cifra);
  }

  protected etiquetaDe(movimiento: MovimientoDePuntos): string {
    return etiquetaDeMotivo(movimiento.motivo);
  }

  protected tonoDe(movimiento: MovimientoDePuntos): 'success' | 'secondary' {
    return tonoDeMovimiento(movimiento.direccion);
  }

  protected signoDe(movimiento: MovimientoDePuntos): string {
    return signoDe(movimiento.direccion);
  }

  protected enPalabras(movimiento: MovimientoDePuntos): string {
    return movimientoEnPalabras(movimiento.direccion, movimiento.puntos, movimiento.motivo);
  }
}

/**
 * Lo escrito en el campo, como cifra — o `null` si ahí no hay un número.
 *
 * El átomo entrega `number` cuando el campo es numérico y `null` cuando está
 * vacío, pero el valor inicial es la cadena vacía: los tres casos entran por
 * acá para que la validación no tenga que conocerlos.
 */
function cifraDe(valor: string | number | null): number | null {
  if (valor === null) {
    return null;
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? valor : null;
  }
  const limpio = valor.trim();
  if (limpio === '') {
    return null;
  }
  const cifra = Number(limpio);
  return Number.isFinite(cifra) ? cifra : null;
}
