import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

/**
 * El logo del consultorio dentro de su caja de tamaño fijo.
 *
 * Lo comparten la ficha (Facturación) y el editor, para que lo que se ve al
 * mirar y lo que se ve al editar sea **exactamente lo mismo**. Es una caja de
 * 2:1 —lo que después ocupa la ranura del membrete del PDF— y no un cuadrado
 * como el avatar: un logo es casi siempre apaisado y en un círculo se recorta.
 *
 * - Con imagen: se **contiene** (`object-fit: contain`), sin recortar ni
 *   estirar, sobre fondo blanco: los logos se diseñan para papel y sobre el
 *   oscuro perderían la tinta.
 * - Sin imagen, o si la imagen no carga: marcador neutro del **mismo tamaño**.
 *   La caja no cambia de alto entre estados, así que nada de lo que la rodea
 *   se mueve cuando llega o se quita un logo.
 *
 * ```html
 * <app-logo-consultorio [src]="logoUrl()" nombre="Consultorio Rojas" />
 * ```
 */
@Component({
  selector: 'app-logo-consultorio',
  templateUrl: './logo-consultorio.html',
  styleUrl: './logo-consultorio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogoConsultorio {
  /** La imagen como `data:` URL (la CSP no admite otra), o `null` si no hay. */
  readonly src = input<string | null>(null);
  /** Nombre del consultorio o de la organización, para el texto alternativo. Puede venir vacío. */
  readonly nombre = input<string>('');
  /**
   * Texto alternativo cuando no hay nombre. La caja es la misma para el consultorio
   * y para cualquier organización: cambia lo que se dice, no lo que se dibuja.
   */
  readonly etiqueta = input<string>('Logo del consultorio');

  /**
   * Una imagen rota no puede dejar un hueco: cae al marcador. `linkedSignal`
   * por el mismo motivo que en `Avatar`: un `src` nuevo merece su oportunidad.
   */
  protected readonly fallo = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  protected alt(): string {
    const nombre = this.nombre().trim();
    return nombre === '' ? this.etiqueta() : `Logo de ${nombre}`;
  }

  protected alFallar(): void {
    this.fallo.set(true);
  }
}
