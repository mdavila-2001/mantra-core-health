import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';

import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';
import { VISTAS_DEL_CUERPO, type IdDeVista, type VistaDelCuerpo } from './body-zones.geometry';

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
  readonly centros: readonly (readonly [number, number])[];
  readonly acercaA?: IdDeVista;
}

/** Una vista con las zonas recibidas que tienen forma en ella. */
interface VistaDibujable {
  readonly vista: VistaDelCuerpo;
  readonly zonas: readonly ZonaDibujable[];
}

/** Para que cada silueta tenga su propio degradado aunque haya dos en la página. */
let siguienteSilueta = 0;

/** Los `id` de zona que tienen forma en alguna vista. El resto va como pastilla. */
export const ZONAS_CON_SILUETA: ReadonlySet<string> = new Set(
  VISTAS_DEL_CUERPO.flatMap((vista) => vista.zonas.map((zona) => zona.id)),
);

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
 * ## Tres vistas
 *
 * De frente, de espaldas y la cara de cerca (`body-zones.geometry.ts`). La
 * espalda existe porque la nuca, la cintura y los glúteos no se ven de frente,
 * y son justo las zonas que llevan a traumatología, urología o proctología. La
 * cara existe porque a escala de cuerpo entero los ojos, la nariz y la boca
 * miden menos que un dedo.
 *
 * **Tocar la cabeza de frente acerca la cara**, además de elegirla: es lo que
 * uno espera de un dibujo que se puede tocar, y deja a mano ojos, oídos, nariz
 * y boca sin buscar el selector. El selector sigue estando para volver.
 *
 * Si la zona elegida desde afuera (una pastilla, un síntoma) no está en la
 * vista puesta, la figura se da vuelta sola a la primera vista que la tenga:
 * lo elegido siempre está a la vista.
 *
 * ## El equivalente por teclado no es un añadido, es la mitad del control
 *
 * Cada zona es un `<path>` con `role="button"`, su `tabindex`, su `aria-label`
 * con el nombre completo y su `aria-pressed`. Se recorre con el tabulador de
 * arriba abajo y se activa con Enter o con la barra. El selector de vista es un
 * `radiogroup` (`app-segmented-control`). No hay una «versión accesible»
 * aparte: es el mismo control, operado de dos maneras.
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
  imports: [SegmentedControl],
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

  /**
   * Zonas que nombra lo que la persona escribió o dictó.
   *
   * Se iluminan **sin quedar elegidas**: elegir es tocar, y esto es la figura
   * devolviendo «te entendí esto» mientras se habla. Quien lo monta decide qué
   * zonas son (ver `symptom-check`); acá sólo se pintan y se nombran.
   */
  readonly marcadas = input<readonly string[]>([]);

  /**
   * Los `id` de los degradados de esta instancia: el volumen (costados más
   * oscuros), la luz (de arriba a la izquierda) y el relleno de la elegida.
   * Por instancia, para que dos siluetas en la misma página no se los pisen.
   */
  private readonly numero = siguienteSilueta++;
  protected readonly idDelVolumen = `body-map-volumen-${this.numero}`;
  protected readonly idDeLaLuz = `body-map-luz-${this.numero}`;
  protected readonly idDeLaElegida = `body-map-elegida-${this.numero}`;

  /** La zona bajo el puntero o con el foco, para nombrarla antes de tocarla. */
  private readonly apuntada = signal<string | null>(null);

  /** La vista que eligió la persona con el selector (o con el acercamiento). */
  private readonly vistaPedida = signal<IdDeVista>('frente');

  /**
   * La zona que estaba elegida cuando se pidió la vista.
   *
   * Mientras siga siendo la misma, **manda la vista pedida**: quien está en la
   * cara con los ojos elegidos y toca «Frente» quiere ver el frente, aunque los
   * ojos no estén ahí. Sin esto la figura volvía sola a la cara y el selector
   * parecía roto (reporte del cliente, 24/09/2026). Si la elegida cambia
   * después —una pastilla, un chip—, vuelve a regir «lo elegido a la vista».
   */
  private readonly elegidaAlPedirVista = signal<string | null | undefined>(undefined);

  /**
   * Las vistas que tienen algo que pulsar, cada una con sus zonas en el orden
   * de la geometría (el del tabulador, de arriba abajo). Una zona sin forma
   * («piel», «ánimo», «general») no se dibuja: la ofrece quien monta el
   * organismo, como pastilla.
   */
  protected readonly vistas = computed<readonly VistaDibujable[]>(() => {
    const porId = new Map(this.zonas().map((zona) => [zona.id, zona]));
    return VISTAS_DEL_CUERPO.flatMap((vista) => {
      const zonas = vista.zonas.flatMap((silueta) => {
        const zona = porId.get(silueta.id);
        if (zona === undefined) return [];
        return [{ ...zona, d: silueta.d, centros: silueta.centros, acercaA: silueta.acercaA }];
      });
      return zonas.length > 0 ? [{ vista, zonas }] : [];
    });
  });

  /**
   * La vista que se muestra: la pedida, salvo que lo elegido **cambie** y no
   * esté en ella; entonces, la primera que lo tenga.
   */
  protected readonly vista = computed<VistaDibujable | null>(() => {
    const vistas = this.vistas();
    const pedida = vistas.find((v) => v.vista.id === this.vistaPedida()) ?? vistas[0] ?? null;
    const elegida = this.value();
    if (pedida === null || elegida === null) return pedida;
    if (elegida === this.elegidaAlPedirVista()) return pedida;
    if (pedida.zonas.some((zona) => zona.id === elegida)) return pedida;
    return vistas.find((v) => v.zonas.some((zona) => zona.id === elegida)) ?? pedida;
  });

  /**
   * Dónde va el marcador de la elegida: un punto por cada parte de la zona en
   * la vista puesta (las dos manos llevan dos). Vacío si no hay elegida o si
   * no está en esta vista.
   */
  protected readonly centrosDeLaElegida = computed<readonly (readonly [number, number])[]>(() => {
    const elegida = this.value();
    if (elegida === null) return [];
    return this.vista()?.zonas.find((zona) => zona.id === elegida)?.centros ?? [];
  });

  protected readonly opcionesDeVista = computed<readonly SegmentedOption<IdDeVista>[]>(() =>
    this.vistas().map(({ vista }) => ({ value: vista.id, label: vista.nombre })),
  );

  private readonly marcadasPorId = computed(() => new Set(this.marcadas()));

  /** Las marcadas, en palabras y en el orden de la tabla: «Espalda y Piel y pelo». */
  protected readonly nombresMarcados = computed<string | null>(() => {
    const marcadas = this.marcadasPorId();
    const nombres = this.zonas()
      .filter((zona) => marcadas.has(zona.id))
      .map((zona) => zona.nombre);
    if (nombres.length === 0) return null;
    return nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  });

  /** El nombre de la zona apuntada, salvo que ya sea la elegida (eso ya se dice abajo). */
  protected readonly nombreApuntado = computed<string | null>(() => {
    const apuntada = this.apuntada();
    if (apuntada === null || apuntada === this.value()) return null;
    return this.zonas().find((zona) => zona.id === apuntada)?.nombre ?? null;
  });

  protected estaMarcada(id: string): boolean {
    return this.marcadasPorId().has(id);
  }

  /** El nombre que se anuncia: el de la zona y, si lo contado la nombra, eso también. */
  protected nombreAccesible(zona: ZonaDibujable): string {
    return this.estaMarcada(zona.id) ? `${zona.nombre} (por lo que contaste)` : zona.nombre;
  }

  protected apuntar(id: string | null): void {
    this.apuntada.set(id);
  }

  /** El nombre de la elegida, para decirlo con palabras además de con el dibujo. */
  protected readonly nombreElegido = computed<string | null>(() => {
    const elegida = this.value();
    if (elegida === null) return null;
    return this.zonas().find((zona) => zona.id === elegida)?.nombre ?? null;
  });

  protected cambiarVista(id: IdDeVista): void {
    // La zona apuntada desaparece con la vista y nunca avisa que el puntero se
    // fue: sin esto su nombre quedaba flotando sobre la vista nueva.
    this.apuntada.set(null);
    this.vistaPedida.set(id);
    this.elegidaAlPedirVista.set(this.value());
  }

  /**
   * Elige una zona, o la suelta si ya estaba elegida.
   *
   * Suelta a propósito, igual que las pastillas de `symptom-check`: es un
   * botón de dos estados, no un radio, y sin la vuelta atrás no habría forma
   * de decir «no era acá» sin elegir otra parte.
   *
   * La zona que acerca otra vista (la cabeza de frente) no suelta: acerca y
   * queda elegida, que es lo que se quiso al tocarla.
   */
  protected elegir(zona: ZonaDibujable): void {
    if (zona.acercaA !== undefined && this.vistas().some((v) => v.vista.id === zona.acercaA)) {
      this.apuntada.set(null);
      this.vistaPedida.set(zona.acercaA);
      this.value.set(zona.id);
      this.elegidaAlPedirVista.set(zona.id);
      return;
    }
    this.value.set(this.value() === zona.id ? null : zona.id);
  }

  /**
   * La barra espaciadora activa, y **no** desplaza la página.
   *
   * Un `<path>` con `role="button"` no hereda el comportamiento del botón
   * nativo: sin este `preventDefault`, la barra haría scroll y la figura se
   * iría de la vista en el momento exacto en que alguien la usa con el teclado.
   */
  protected elegirConBarra(evento: Event, zona: ZonaDibujable): void {
    evento.preventDefault();
    this.elegir(zona);
  }
}
