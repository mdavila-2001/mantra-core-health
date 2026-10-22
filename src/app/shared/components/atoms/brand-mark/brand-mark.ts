import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/** `sm` para cabeceras y píldoras; `lg` para la columna de marca de una pantalla de acceso. */
export type BrandMarkSize = 'sm' | 'lg';

/**
 * La marca de AloVida: el glifo del latido y el rótulo «AloVida» con sus dos
 * tonos.
 *
 * ## Los dos tonos
 *
 * «Alo» va en el color de marca (`--brand-primary`: petróleo en claro, aqua en
 * oscuro) y «Vida» en una mezcla de los dos tonos de marca (60 % de
 * `--brand-secondary` y 40 % de `--brand-primary`). Todo sale de tokens que ya
 * se invierten con el tema, así que no hay un valor nuevo que revisar en
 * oscuro. Medido sobre la superficie de cada tema: «Alo» 8,03:1 en claro y
 * 7,03:1 en oscuro; «Vida» 3,88:1 en claro y ~9,3:1 en oscuro.
 *
 * Por eso el rótulo se dibuja siempre como **texto grande** (≥ 1,2 rem en
 * negrita): 3,88:1 pasa el umbral de 3:1 de AA para texto grande, no el de
 * 4,5:1 del texto corriente. No lo achique de ahí sin cambiar la mezcla.
 *
 * El celeste `#00A3FF` del arte original del splash móvil **no se usa**: no
 * pertenece a la paleta ALOVIDA y mide 2,73:1 sobre blanco (deuda de diseño
 * anotada en `identidad-visual.md`).
 *
 * ## Accesibilidad
 *
 * «Alo» y «Vida» son dos `<span>` contiguos sin espacio, así que el lector de
 * pantalla anuncia «AloVida» de corrido. El glifo es decorativo
 * (`aria-hidden`): se pinta con `mask` sobre `currentColor` y por eso sirve en
 * los dos temas con un solo archivo.
 */
@Component({
  selector: 'app-brand-mark',
  templateUrl: './brand-mark.html',
  styleUrl: './brand-mark.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMark {
  readonly size = input<BrandMarkSize>('sm');

  /**
   * El glifo late una vez al aparecer (lub-dub). Es la firma de la pantalla de
   * acceso; en una cabecera que está siempre a la vista sería ruido.
   */
  readonly beat = input(false, { transform: booleanAttribute });
}
