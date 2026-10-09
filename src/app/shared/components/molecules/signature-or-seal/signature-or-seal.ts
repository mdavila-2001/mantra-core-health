import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

/** Qué imagen es: decide la proporción de la caja y el texto del marcador. */
export type TipoDeFirmaOSello = 'firma' | 'sello';

/**
 * La firma o el sello médico del profesional dentro de su caja de tamaño fijo.
 *
 * Lo comparten la ficha, el editor y el alta, para que lo que se ve al mirar y
 * lo que se ve al editar sea **exactamente lo mismo**. La firma va en una caja
 * apaisada (3:1, la forma de una firma de verdad) y el sello en una cuadrada.
 *
 * - Con imagen: se **contiene** (`object-fit: contain`), sin recortar ni
 *   estirar, sobre fondo blanco: son imágenes hechas para papel.
 * - Sin imagen, o si no carga: marcador «Sin firma» / «Sin sello» del **mismo
 *   tamaño**. La caja no cambia de alto entre estados.
 *
 * Son **imágenes**, no una firma electrónica.
 *
 * ```html
 * <app-signature-or-seal tipo="firma" [src]="firmaUrl()" />
 * <app-signature-or-seal tipo="sello" [src]="selloUrl()" />
 * ```
 */
@Component({
  selector: 'app-signature-or-seal',
  templateUrl: './signature-or-seal.html',
  styleUrl: './signature-or-seal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"firma-o-sello firma-o-sello--" + tipo()' },
})
export class FirmaOSello {
  readonly tipo = input.required<TipoDeFirmaOSello>();
  /** La imagen como `data:` URL (la CSP no admite otra), o `null` si no hay. */
  readonly src = input<string | null>(null);

  /** Una imagen rota no puede dejar un hueco: cae al marcador. */
  protected readonly fallo = linkedSignal({
    source: this.src,
    computation: () => false,
  });

  protected readonly rotulo = computed(() => (this.tipo() === 'firma' ? 'firma' : 'sello'));
  protected readonly alt = computed(() =>
    this.tipo() === 'firma' ? 'Firma del médico' : 'Sello del médico',
  );
  protected readonly vacio = computed(() =>
    this.tipo() === 'firma' ? 'Sin firma' : 'Sin sello',
  );

  protected alFallar(): void {
    this.fallo.set(true);
  }
}
