import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  PLATFORM_ID,
  signal,
  viewChild,
  type ElementRef,
} from '@angular/core';

import type { ComprobanteDeCanje } from '../../../../core/data-access/loyalty/loyalty.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { dibujarQr } from '../../../../shared/utils/qr/dibujar-qr';
import { puntosEnPalabras } from '../punto-motivo';

/** Lado del QR de canje: el mismo tamaño legible que el de pago y el de retiro. */
const LADO_DEL_QR = 176;

/**
 * **El comprobante de canje** (carril FAR-I6): lo que el paciente muestra en
 * el mostrador después de canjear.
 *
 * ## Lo único simulado del carril, y se dice
 *
 * Quien escanea este código —el lado comercio— **no existe todavía** y está
 * declarado fuera de alcance. Por eso el chip «DEMO» va **quemado en la
 * plantilla**, sin ningún input que lo apague, igual que en la pestaña QR del
 * pago. Lo que sí es real es el descuento: el saldo ya bajó cuando se pidió el
 * canje, que es lo que hace el endpoint del backend.
 *
 * El código en letras no es decoración: si la cámara falla, alguien lo dicta.
 * Por eso sale del alfabeto legible —sin `O/0` ni `I/1`— y se muestra siempre,
 * escanee o no.
 */
@Component({
  selector: 'app-redeem-code',
  imports: [AppButton, Badge, DatePipe],
  templateUrl: './redeem-code.html',
  styleUrl: './redeem-code.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedeemCode {
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly comprobante = input.required<ComprobanteDeCanje>();

  /** «Listo»: la billetera vuelve al saldo. */
  readonly cerrado = output<void>();

  protected readonly ladoDelQr = LADO_DEL_QR;

  /** `false` si la lib del QR no cargó: queda el código en letras, que alcanza. */
  protected readonly qrDisponible = signal(true);

  private readonly lienzoQr = viewChild<ElementRef<HTMLCanvasElement>>('lienzoQrCanje');

  /** «1 punto», no «1 puntos». */
  protected enPuntos(cifra: string): string {
    return puntosEnPalabras(cifra);
  }

  constructor() {
    effect(() => {
      const lienzo = this.lienzoQr();
      const comprobante = this.comprobante();
      if (!this.esBrowser || lienzo === undefined) {
        return;
      }
      dibujarQr(lienzo.nativeElement, contenidoDelQr(comprobante), LADO_DEL_QR).catch(() =>
        this.qrDisponible.set(false),
      );
    });
  }
}

/**
 * El payload del QR. Texto propio y legible a propósito: cuando exista el lado
 * comercio, el formato lo define él. Escanear esto hoy muestra una frase que
 * dice lo que es — no un enlace a ninguna parte.
 */
function contenidoDelQr(comprobante: ComprobanteDeCanje): string {
  return `ALOVIDA-CANJE-DEMO|${comprobante.codigo}|${comprobante.canje.puntos}`;
}
