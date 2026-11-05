import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  type OnDestroy,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Una explicación: por qué se pide lo que se está pidiendo en este paso. */
export interface TarjetaDeAyuda {
  readonly icono: NavIconName;
  readonly titulo: string;
  readonly texto: string;
}

/**
 * Un aviso ya en la pila: lo que la plantilla pinta.
 *
 * No es la `TarjetaDeAyuda` que entra por el `input`: a lo que escribe la
 * pantalla hay que sumarle la clave de seguimiento, cuánto se queda y si es el
 * sello —que no tiene párrafo sino lista—. Mezclar las dos formas obligaría a
 * cada alta a inventar una duración, que es justo lo que no tiene que decidir.
 */
interface AvisoDeAyuda {
  readonly clave: string;
  readonly icono: NavIconName;
  readonly titulo: string;
  readonly texto?: string;
  readonly puntos?: readonly string[];
  readonly sello: boolean;
  readonly duracionMs: number;
}

/** Lo que tarda un aviso en irse. Tiene que coincidir con `ayuda-toast-sale`. */
const SALIDA_MS = 220;

/**
 * Cuánto se queda un aviso, medido por lo que hay que leer.
 *
 * Un plazo fijo trata igual a «Tu nombre, como figura en tu documento» que a un
 * párrafo de tres renglones, y el segundo se va a la mitad. ~28 ms por carácter
 * son unas 170 palabras por minuto leyendo, con un suelo generoso para que
 * nadie pierda un aviso corto por mirar el teclado.
 */
const MS_POR_CARACTER = 28;
const DURACION_MINIMA_MS = 7_000;
const DURACION_MAXIMA_MS = 15_000;

/** El sello dura más: son cuatro promesas y se muestra una sola vez. */
const DURACION_SELLO_MS = 14_000;

/**
 * El sello de privacidad. No cambia con el paso —la promesa es la misma se esté
 * contestando lo que se esté contestando—, así que no sale de la pantalla: vive
 * acá y se emite una única vez por alta.
 */
const SELLO: AvisoDeAyuda = {
  clave: 'sello-privacidad',
  icono: 'shield',
  titulo: 'Tus datos están a salvo',
  puntos: [
    'Todo lo que escribís viaja cifrado hasta nuestros servidores.',
    'Tu información clínica la ve el profesional que te atiende, nadie más.',
    'No vendemos tus datos ni los usamos para publicidad.',
    'Podés corregirlos cuando quieras desde tu perfil.',
  ],
  sello: true,
  duracionMs: DURACION_SELLO_MS,
};

/** Reloj de un aviso: lo que falta para que se cierre solo. */
interface Reloj {
  id: ReturnType<typeof setTimeout> | null;
  expiraEn: number;
  restanteMs: number;
}

function duracionPara(texto: string): number {
  return Math.min(
    DURACION_MAXIMA_MS,
    Math.max(DURACION_MINIMA_MS, texto.length * MS_POR_CARACTER),
  );
}

/**
 * El «por qué te pedimos esto» del alta, dicho como avisos que bajan desde
 * arriba de la pantalla.
 *
 * ## Qué problema resuelve
 *
 * Un alta de salud pregunta cosas que ningún otro formulario pregunta —el
 * departamento que emitió tu cédula, dónde trabajás, qué seguro tenés—, y la
 * pregunta sin su motivo se lee como una intromisión. La respuesta no cabe en
 * la pista del campo: la pista dice qué escribir, no por qué se guarda ni quién
 * lo va a ver.
 *
 * ## Por qué toast y no una columna al costado
 *
 * Porque la explicación es **temporal**: hace falta en el momento en que
 * aparece la pregunta y estorba después. De columna fija empujaba el formulario
 * hacia abajo en el teléfono y era una card de apoyo a un costado en escritorio
 * —prohibidas en ALOVIDA—. De aviso llega cuando cambia el paso, se lee y se
 * va: el formulario se queda con toda la pantalla, que es a lo que vino quien
 * abrió el alta.
 *
 * El precio es que la explicación **no es permanente**: se cierra sola. Por eso
 * el plazo se calcula sobre el texto y no es fijo, el puntero o el foco encima
 * lo congelan, y el sello de privacidad —lo más largo— dura más que el resto.
 *
 * ## Por qué cambia con el paso
 *
 * Porque «por qué me piden ESTO» es una pregunta distinta en cada página. Una
 * lista fija con las ocho respuestas juntas es un texto legal: está todo y no
 * se lee nada. La pantalla le pasa las tarjetas del paso visible —ver
 * `pasoVisible` del motor— y al cambiar el paso los avisos viejos se van antes
 * de que entren los nuevos, para que se lea como un relevo y no como una
 * sustitución de golpe.
 *
 * ## Por qué el nodo se muda al `<body>`
 *
 * Porque la pila va fija contra el borde superior de la **ventana**, y dentro
 * del alta todo ancestro con `backdrop-filter` o con una animación de
 * `transform` —`.registro`, el panel de `app-auth-split`— es bloque contenedor
 * de lo que esté `fixed`: ahí el aviso quedaría pegado al borde de la tarjeta y
 * recortado por ella. Mudarlo al `<body>` saca el nodo de esos contextos sin
 * sacarlo de la vista de Angular: los `input` y la detección de cambios siguen
 * funcionando porque sólo se movió el DOM.
 */
@Component({
  selector: 'app-registro-ayuda',
  imports: [NavIcon],
  templateUrl: './registro-ayuda.html',
  styleUrl: './registro-ayuda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // El nodo se muda al `<body>` y en el servidor no se pinta nada: las dos
    // cosas son exactamente lo que la hidratación no sabe reconciliar.
    ngSkipHydration: 'true',
  },
})
export class RegistroAyuda implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  /** En el servidor no hay a quién avisarle, y un temporizador pendiente retrasa la respuesta. */
  protected readonly enNavegador = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Las explicaciones del paso que se está contestando.
   *
   * Vacío es un caso válido —hay pasos que no necesitan defenderse— y entonces
   * no baja nada: el sello ya se mostró al abrir el alta.
   */
  readonly tarjetas = input<readonly TarjetaDeAyuda[]>([]);

  private readonly avisos = signal<readonly AvisoDeAyuda[]>([]);
  private readonly saliendo = signal<ReadonlySet<string>>(new Set());

  /** La pila, del primero al último. El sello siempre al final. */
  protected readonly cola = this.avisos.asReadonly();

  private readonly relojes = new Map<string, Reloj>();
  private readonly pendientes = new Set<ReturnType<typeof setTimeout>>();
  private pausadoEn: number | null = null;
  private selloEmitido = false;

  constructor() {
    // `afterNextRender` sólo corre en el navegador y después de que el nodo
    // existe: antes de eso no hay nada que mudar.
    afterNextRender(() => {
      this.document.body.appendChild(this.host.nativeElement);
    });

    effect(() => {
      const tarjetas = this.tarjetas();
      // `untracked`: lo de adentro lee y escribe señales propias, y sin esto el
      // efecto se volvería a disparar por su propio resultado.
      untracked(() => this.sincronizar(tarjetas));
    });
  }

  protected estaSaliendo(clave: string): boolean {
    return this.saliendo().has(clave);
  }

  /** Cierra un aviso a mano. Es idempotente: cerrar dos veces no rompe. */
  protected cerrar(clave: string): void {
    if (this.saliendo().has(clave)) {
      return;
    }
    this.apagarReloj(clave);
    this.marcarSalida(clave);
    this.demorar(() => {
      this.avisos.update((cola) => cola.filter((aviso) => aviso.clave !== clave));
      this.desmarcarSalida(clave);
    }, SALIDA_MS);
  }

  /**
   * Congela los relojes mientras el puntero o el foco están encima: un aviso
   * que se cierra justo cuando lo estabas leyendo es un aviso que no se leyó.
   */
  protected pausar(): void {
    if (this.pausadoEn !== null) {
      return;
    }
    this.pausadoEn = Date.now();
    for (const reloj of this.relojes.values()) {
      if (reloj.id !== null) {
        clearTimeout(reloj.id);
        reloj.id = null;
      }
      reloj.restanteMs = Math.max(0, reloj.expiraEn - this.pausadoEn);
    }
  }

  protected reanudar(): void {
    // El puntero puede salir de un aviso con el foco todavía dentro de otro
    // —`mouseleave` y `focusout` son independientes—: mientras quede cualquiera
    // de los dos encima, la pila sigue congelada.
    if (this.pausadoEn === null || this.host.nativeElement.matches(':hover, :focus-within')) {
      return;
    }
    this.pausadoEn = null;
    for (const [clave, reloj] of this.relojes) {
      this.encender(clave, reloj.restanteMs);
    }
  }

  ngOnDestroy(): void {
    for (const clave of [...this.relojes.keys()]) {
      this.apagarReloj(clave);
    }
    for (const id of this.pendientes) {
      clearTimeout(id);
    }
    this.pendientes.clear();
  }

  // ---- la pila ------------------------------------------------------------

  private sincronizar(tarjetas: readonly TarjetaDeAyuda[]): void {
    if (!this.enNavegador) {
      return;
    }

    this.asegurarSello();

    const nuevos: readonly AvisoDeAyuda[] = tarjetas.map((tarjeta, indice) => ({
      // El título entra en la clave para que `@for … track` rehaga el nodo al
      // cambiar de paso: si la clave fuera sólo el índice, la primera tarjeta
      // del paso 2 reusaría el nodo de la del paso 1 y cambiaría el texto sin
      // que se viera entrar nada.
      clave: `paso:${indice}:${tarjeta.titulo}`,
      icono: tarjeta.icono,
      titulo: tarjeta.titulo,
      texto: tarjeta.texto,
      sello: false,
      duracionMs: duracionPara(`${tarjeta.titulo} ${tarjeta.texto}`),
    }));

    const anteriores = this.avisos().filter((aviso) => !aviso.sello);
    const sinCambios =
      anteriores.length === nuevos.length &&
      anteriores.every((aviso, indice) => aviso.clave === nuevos[indice]?.clave);
    if (sinCambios) {
      return;
    }

    if (anteriores.length === 0) {
      this.publicar(nuevos);
      return;
    }

    // Relevo: primero se van los del paso anterior, después entran los de éste.
    // Solapados se leerían como un salto de la pila, porque comparten columna.
    for (const aviso of anteriores) {
      this.apagarReloj(aviso.clave);
      this.marcarSalida(aviso.clave);
    }
    this.demorar(() => this.publicar(nuevos), SALIDA_MS);
  }

  private publicar(nuevos: readonly AvisoDeAyuda[]): void {
    const sello = this.avisos().filter(
      (aviso) => aviso.sello && !this.saliendo().has(aviso.clave),
    );
    this.saliendo.set(new Set());
    this.avisos.set([...nuevos, ...sello]);
    for (const aviso of nuevos) {
      this.encender(aviso.clave, aviso.duracionMs);
    }
  }

  private asegurarSello(): void {
    if (this.selloEmitido) {
      return;
    }
    this.selloEmitido = true;
    this.avisos.update((cola) => [...cola, SELLO]);
    this.encender(SELLO.clave, SELLO.duracionMs);
  }

  // ---- relojes ------------------------------------------------------------

  private encender(clave: string, duracionMs: number): void {
    const reloj: Reloj = { id: null, expiraEn: Date.now() + duracionMs, restanteMs: duracionMs };
    // Con el puntero encima el aviso queda fijo: se guarda lo que falta y el
    // temporizador se enciende recién al salir.
    if (this.pausadoEn === null) {
      reloj.id = setTimeout(() => {
        this.relojes.delete(clave);
        this.cerrar(clave);
      }, duracionMs);
    }
    this.relojes.set(clave, reloj);
  }

  private apagarReloj(clave: string): void {
    const reloj = this.relojes.get(clave);
    if (reloj === undefined) {
      return;
    }
    if (reloj.id !== null) {
      clearTimeout(reloj.id);
    }
    this.relojes.delete(clave);
  }

  private marcarSalida(clave: string): void {
    this.saliendo.update((actual) => new Set([...actual, clave]));
  }

  private desmarcarSalida(clave: string): void {
    this.saliendo.update((actual) => {
      const siguiente = new Set(actual);
      siguiente.delete(clave);
      return siguiente;
    });
  }

  /** `setTimeout` que se cancela solo si el componente se destruye antes. */
  private demorar(accion: () => void, ms: number): void {
    const id = setTimeout(() => {
      this.pendientes.delete(id);
      accion();
    }, ms);
    this.pendientes.add(id);
  }
}
