import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';

import { CUERPO_VIEW_BOX, SILUETAS_DEL_CUERPO } from './body-zones.geometry';

/**
 * Una zona del cuerpo que se puede elegir, tal como la trae quien monta el
 * organismo: el `id` de la tabla de zonas y el nombre que se lee y se anuncia.
 * Acá no se inventa ninguno de los dos: sin `zonas`, no hay silueta que pulsar.
 */
export interface ZonaElegible {
  readonly id: string;
  readonly nombre: string;
}

/** Una zona ya lista para pintar: su dato y su contorno, juntos. */
interface ZonaDibujable extends ZonaElegible {
  readonly d: string;
}

/**
 * La silueta del cuerpo para señalar dónde duele (P-01, doctor 22/09/2026).
 *
 * ## Por qué una silueta y no sólo pastillas
 *
 * Porque señalar **dónde** es lo primero que hace cualquiera cuando le duele
 * algo, y lo hace sobre el cuerpo, no sobre una lista de rótulos. El doctor lo
 * pidió «como el mapa de Bolivia que se tiene»: este organismo es ese molde
 * (`organisms/department-map`) aplicado a una figura humana.
 *
 * ## El equivalente por teclado no es un añadido, es la mitad del control
 *
 * Cada zona es un `<path>` con `role="button"`, su `tabindex`, su `aria-label`
 * con el nombre completo y su `aria-pressed`. Se recorre con el tabulador de
 * arriba abajo —el orden de `SILUETAS_DEL_CUERPO`— y se activa con Enter o con
 * la barra. No hay una «versión accesible» aparte: es el mismo control, operado
 * de dos maneras.
 *
 * **La elección no se comunica sólo por color.** Quien no distingue el relleno
 * ve el trazo grueso de la zona elegida, y quien no ve nada de eso lee el
 * nombre en la línea de abajo y el `aria-pressed` del control. Tres señales
 * para el mismo dato.
 *
 * ## Qué NO hace
 *
 * No sabe de síntomas ni de especialidades: recibe las zonas ya resueltas y
 * devuelve un `id`. Qué síntomas ofrece cada zona y a qué especialidad llevan
 * es de `features/symptom-check`, que es quien lo monta. Y no dibuja una zona
 * que no le hayan pasado: una forma que no apunta a nada es un adorno.
 */
@Component({
  selector: 'app-body-map',
  templateUrl: './body-map.html',
  styleUrl: './body-map.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BodyMap {
  /** Las zonas que se pueden elegir. Vacío no dibuja nada: ver la plantilla. */
  readonly zonas = input.required<readonly ZonaElegible[]>();

  /** El `id` de la zona elegida, o `null`. */
  readonly value = model<string | null>(null);

  /** Nombre accesible de la silueta entera. */
  readonly etiqueta = input('Silueta del cuerpo: tocá dónde te pasa');

  /** Prefijo del `data-testid` de cada zona; el sufijo es su `id`. */
  readonly testId = input('body-map');

  protected readonly viewBox = CUERPO_VIEW_BOX;

  /**
   * Las zonas que se dibujan: las recibidas que además tienen silueta, en el
   * orden de las siluetas.
   *
   * El recorrido es sobre las **siluetas** y no sobre `zonas` para que el
   * orden del tabulador sea siempre el mismo —de arriba abajo— venga como
   * venga la lista. Una zona sin silueta («piel», «ánimo», «general») no se
   * dibuja: sigue ofreciéndola quien monta el organismo, como pastilla.
   */
  protected readonly dibujables = computed<readonly ZonaDibujable[]>(() => {
    const porId = new Map(this.zonas().map((zona) => [zona.id, zona]));
    return SILUETAS_DEL_CUERPO.flatMap((silueta) => {
      const zona = porId.get(silueta.id);
      if (zona === undefined) return [];
      return [{ ...zona, d: silueta.d }];
    });
  });

  /** El nombre de la elegida, para decirlo con palabras además de con el dibujo. */
  protected readonly nombreElegido = computed<string | null>(() => {
    const elegida = this.value();
    if (elegida === null) return null;
    return this.zonas().find((zona) => zona.id === elegida)?.nombre ?? null;
  });

  /**
   * Elige una zona, o la suelta si ya estaba elegida.
   *
   * Suelta a propósito, igual que las pastillas de `symptom-check`: es un
   * botón de dos estados, no un radio, y sin la vuelta atrás no habría forma
   * de decir «no era acá» sin elegir otra parte.
   */
  protected elegir(id: string): void {
    this.value.set(this.value() === id ? null : id);
  }

  /**
   * La barra espaciadora activa, y **no** desplaza la página.
   *
   * Un `<path>` con `role="button"` no hereda el comportamiento del botón
   * nativo: sin este `preventDefault`, la barra haría scroll y la figura se
   * iría de la vista en el momento exacto en que alguien la usa con el teclado.
   */
  protected elegirConBarra(evento: Event, id: string): void {
    evento.preventDefault();
    this.elegir(id);
  }
}
