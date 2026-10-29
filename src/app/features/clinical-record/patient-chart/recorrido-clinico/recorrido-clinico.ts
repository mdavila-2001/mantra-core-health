import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import {
  ASPECTO_DEL_TIPO,
  conectadosA,
  MEDIDAS,
  ubicarRecorrido,
  type AristaDelRecorrido,
  type ColumnaUbicada,
  type NodoDelRecorrido,
  type NodoUbicado,
  type TipoDelRecorrido,
} from './recorrido-clinico.model';

/**
 * **Recorrido clínico** — la historia de una persona como un mapa de decisiones.
 *
 * ## Qué responde que las pestañas no
 *
 * Las pestañas contestan «¿qué diagnósticos tiene?». El recorrido contesta
 * «¿qué pasó, en qué orden y qué se decidió a partir de qué?»: de esta consulta
 * salió este diagnóstico, y para ese diagnóstico se indicó esta receta, que se
 * renovó tres meses después en otra consulta.
 *
 * ## Cómo se lee
 *
 * - De izquierda a derecha, el tiempo: una columna por atención o por día con
 *   actividad, con el intervalo escrito sobre el eje.
 * - De arriba abajo, el razonamiento: un carril por tipo de registro, en el
 *   orden atender → observar → diagnosticar → tratar → dejar constancia.
 * - Las líneas son los vínculos que el contrato guarda, y ninguno más.
 *
 * Al pasar o enfocar un nodo se ilumina su camino —de dónde viene y qué derivó—
 * y el resto se atenúa. El clic abre el mismo detalle que la tabla.
 *
 * ## Accesibilidad
 *
 * Cada columna es una sección con su fecha y cada nodo un botón con nombre
 * completo, conexiones incluidas, en orden cronológico. Las líneas son
 * decorativas (`aria-hidden`): lo que dicen ya está en el nombre del botón.
 */
@Component({
  selector: 'app-recorrido-clinico',
  imports: [AppButton, DatePipe, NavIcon, NgTemplateOutlet],
  templateUrl: './recorrido-clinico.html',
  styleUrl: './recorrido-clinico.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecorridoClinico {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly nodos = input.required<readonly NodoDelRecorrido[]>();
  readonly aristas = input.required<readonly AristaDelRecorrido[]>();

  /** Se pidió el detalle de un registro. */
  readonly abrir = output<string>();

  protected readonly medidas = MEDIDAS;
  protected readonly aspecto = ASPECTO_DEL_TIPO;

  /** Las celdas agrupadas que se abrieron. */
  protected readonly celdasAbiertas = signal<ReadonlySet<string>>(new Set());

  protected readonly plano = computed(() =>
    ubicarRecorrido(this.nodos(), this.aristas(), this.celdasAbiertas()),
  );

  /**
   * El nodo bajo el puntero y el que tiene el foco, por separado: si fueran una
   * sola señal, sacar el puntero de un nodo apagaría el camino del que sigue
   * enfocado con el teclado. El puntero manda mientras está sobre un nodo.
   */
  private readonly bajoElPuntero = signal<string | null>(null);
  private readonly conElFoco = signal<string | null>(null);

  protected readonly enfocado = computed(() => this.bajoElPuntero() ?? this.conElFoco());

  protected readonly camino = computed(() => {
    const id = this.enfocado();
    // Sobre las conexiones ya dibujadas, que apuntan a los grupos y no a los
    // registros ocultos en ellos.
    return id === null ? null : conectadosA(id, this.plano().aristas);
  });

  protected readonly hayIndicaciones = computed(() =>
    this.plano().aristas.some((a) => a.motivo === 'indicacion'),
  );

  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');

  /**
   * Pantalla angosta: el recorrido se dibuja en vertical. El corte es
   * `--bp-sm` (650 px), el de la escala del sistema. Arranca en `false` —en el
   * servidor no hay pantalla— y se ajusta al montar en el navegador.
   */
  protected readonly angosto = signal(false);

  /** Para el teléfono: lo más reciente arriba. */
  protected readonly columnasRecientesPrimero = computed(() => [...this.plano().columnas].reverse());

  /**
   * Para qué diagnóstico se indicó cada receta, por id de receta, con el
   * nombre real aunque el diagnóstico esté agrupado. En vertical no hay
   * flecha: lo dice el texto.
   */
  protected readonly indicaciones = computed(() => {
    const porId = new Map(this.nodos().map((n) => [n.id, n]));
    const mapa = new Map<string, string>();
    for (const arista of this.aristas()) {
      const diagnostico = porId.get(arista.desde);
      if (arista.motivo === 'indicacion' && diagnostico !== undefined) {
        mapa.set(arista.hasta, diagnostico.principal);
      }
    }
    return mapa;
  });

  constructor() {
    afterNextRender(() => {
      if (typeof matchMedia !== 'function') {
        return;
      }
      const consulta = matchMedia('(max-width: 649px)');
      this.angosto.set(consulta.matches);
      const alCambiar = (evento: MediaQueryListEvent): void => this.angosto.set(evento.matches);
      consulta.addEventListener('change', alCambiar);
      this.destroyRef.onDestroy(() => consulta.removeEventListener('change', alCambiar));
    });

    // Lo más reciente es lo que se viene a mirar: el lienzo abre por el final.
    // Cada vez que se CREA un lienzo —al entrar a la vista, o al volver de
    // angosto a ancho, que arma uno nuevo con el desplazamiento en cero—, y
    // no cuando cambia el filtro: a quien ya se movió no se le arranca la
    // posición.
    effect(() => {
      const lienzo = this.lienzo()?.nativeElement;
      if (lienzo === undefined) {
        return;
      }
      untracked(() =>
        afterNextRender(() => this.fijarAlFinal(lienzo), { injector: this.injector }),
      );
    });
    this.destroyRef.onDestroy(() => this.soltarLienzo?.());
  }

  /** Desconecta el observador del lienzo anterior. */
  private soltarLienzo: (() => void) | null = null;

  /**
   * Abre por el final y se queda ahí mientras quien mira no se mueva.
   *
   * Una sola pasada no alcanza: después del primer render el lienzo todavía
   * cambia de ancho —la página gana su barra de desplazamiento vertical, la
   * fuente termina de cargar— y la última columna quedaba asomando cortada.
   * Así que, hasta el primer desplazamiento de la persona, cada cambio de
   * tamaño vuelve a pegar el lienzo al final.
   */
  private fijarAlFinal(lienzo: HTMLElement): void {
    this.soltarLienzo?.();
    this.soltarLienzo = null;
    if (typeof ResizeObserver !== 'function') {
      this.irA('final', false);
      return;
    }
    let pegado = true;
    // Dónde lo dejó el propio componente. El evento `scroll` de ese ajuste
    // llega después, cuando el lienzo ya pudo crecer: sin esto se leía como un
    // desplazamiento de la persona y el lienzo se soltaba antes de tiempo.
    let propio = lienzo.scrollLeft;
    const pegar = (): void => {
      this.irA('final', false);
      propio = lienzo.scrollLeft;
    };
    const observador = new ResizeObserver(() => {
      if (pegado) {
        pegar();
      }
    });
    observador.observe(lienzo);
    if (lienzo.firstElementChild !== null) {
      observador.observe(lienzo.firstElementChild);
    }
    // Un desplazamiento que no es el propio y no deja el lienzo al final es
    // de la persona: desde ahí, el lienzo es suyo.
    const alDesplazar = (): void => {
      if (Math.abs(lienzo.scrollLeft - propio) <= 1) {
        return;
      }
      if (lienzo.scrollLeft < lienzo.scrollWidth - lienzo.clientWidth - 2) {
        pegado = false;
      }
    };
    lienzo.addEventListener('scroll', alDesplazar, { passive: true });
    pegar();
    this.soltarLienzo = () => {
      observador.disconnect();
      lienzo.removeEventListener('scroll', alDesplazar);
    };
  }

  protected irA(extremo: 'inicio' | 'final', suave = true): void {
    const lienzo = this.lienzo()?.nativeElement;
    if (lienzo === undefined) {
      return;
    }
    const destino = extremo === 'inicio' ? 0 : lienzo.scrollWidth;
    if (typeof lienzo.scrollTo === 'function') {
      // El desplazamiento suave también es movimiento: con «reducir
      // movimiento» se salta, igual que las transiciones del CSS.
      const reducir =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      lienzo.scrollTo({ left: destino, behavior: suave && !reducir ? 'smooth' : 'auto' });
    } else {
      lienzo.scrollLeft = destino;
    }
  }

  /*
   * Un control de grupo no ilumina camino: no es un registro, y al abrirse
   * («Mostrar menos») atenuaba justo lo que se acababa de mostrar.
   */
  protected apuntar(nodo: NodoUbicado | null): void {
    this.bajoElPuntero.set(nodo === null || nodo.grupo !== undefined ? null : nodo.id);
  }

  protected enfocar(nodo: NodoUbicado | null): void {
    this.conElFoco.set(nodo === null || nodo.grupo !== undefined ? null : nodo.id);
  }

  /** Qué es la columna, en palabras: cabecera visible. */
  protected contextoDe(columna: ColumnaUbicada): string {
    return columna.contexto === 'atencion'
      ? 'Atención'
      : columna.contexto === 'dia'
        ? 'Registros del día'
        : 'Sin atención';
  }

  /** El nombre accesible de una columna: su fecha y qué es. */
  protected rotuloDeColumna(columna: ColumnaUbicada): string {
    const fecha =
      columna.fecha === null
        ? 'Sin fecha'
        : columna.fecha.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    const que =
      columna.contexto === 'atencion'
        ? 'atención'
        : columna.contexto === 'dia'
          ? 'registros de atenciones que no están a la vista'
          : 'registros sin atención';
    return `${fecha}, ${que}`;
  }

  /**
   * La fecha propia del registro cuando no es la de su columna, con un rótulo
   * que dice qué fecha es. `null` cuando coinciden: repetirla sería ruido.
   */
  protected fechaPropia(
    nodo: NodoUbicado,
    columna: ColumnaUbicada,
  ): { readonly rotulo: string; readonly fecha: Date; readonly formato: string } | null {
    if (nodo.grupo !== undefined || nodo.cuando === null || columna.fecha === null) {
      return null;
    }
    if (nodo.cuando.toDateString() === columna.fecha.toDateString()) {
      return null;
    }
    const rotulo = nodo.tipo === 'diagnosticos' ? 'Inicio' : nodo.tipo === 'medicacion' ? 'Desde' : 'Del';
    // Corta, porque la tarjeta es angosta y con el estado al lado la fecha
    // completa se cortaba («8 Oct 20…»): sin el año si es el de la columna, y
    // mes y año si es otro —para el comienzo de una enfermedad alcanza—. La
    // fecha entera va en el título y en el nombre accesible.
    // En vertical hay lugar para la fecha entera; y cuando la diferencia es de
    // días (un 28 de diciembre en una columna del 5 de enero) el día importa
    // aunque el año cambie.
    const dias = Math.abs(nodo.cuando.getTime() - columna.fecha.getTime()) / 86_400_000;
    const formato = this.angosto()
      ? 'd MMM y'
      : nodo.cuando.getFullYear() === columna.fecha.getFullYear()
        ? 'd MMM'
        : dias < 90
          ? 'd MMM y'
          : 'MMM y';
    return { rotulo, fecha: nodo.cuando, formato };
  }

  /** Un registro abre su detalle; un nodo de grupo abre o cierra su celda. */
  protected activar(nodo: NodoUbicado): void {
    if (nodo.grupo === undefined) {
      this.abrir.emit(nodo.id);
      return;
    }
    const { celda, accion } = nodo.grupo;
    this.celdasAbiertas.update((actual) => {
      const siguiente = new Set(actual);
      if (accion === 'expandir') {
        siguiente.add(celda);
      } else {
        siguiente.delete(celda);
      }
      return siguiente;
    });
    this.bajoElPuntero.set(null);
  }

  protected atenuado(id: string): boolean {
    const camino = this.camino();
    return camino !== null && !camino.nodos.has(id);
  }

  protected iluminada(clave: string): boolean {
    return this.camino()?.aristas.has(clave) ?? false;
  }

  protected aristaAtenuada(clave: string): boolean {
    const camino = this.camino();
    return camino !== null && !camino.aristas.has(clave);
  }

  /**
   * El nombre accesible de cada nodo: tipo, registro, estado y sus vínculos. Es
   * lo que reemplaza a las líneas para quien no las ve.
   */
  protected readonly nombres = computed(() => {
    // Los vínculos se nombran con las aristas ORIGINALES, no con las del plano:
    // ahí un diagnóstico agrupado figura como «+2 diagnósticos», y «indicado
    // para +2 diagnósticos» no le dice nada a quien escucha.
    const aristas = this.aristas();
    const porId = new Map(this.nodos().map((n) => [n.id, n]));
    const nombres = new Map<string, string>();
    for (const nodo of this.plano().nodos) {
      if (nodo.grupo !== undefined) {
        nombres.set(
          nodo.id,
          nodo.grupo.accion === 'expandir'
            ? `Mostrar ${nodo.grupo.ocultos} ${this.aspecto[nodo.tipo].plural.toLowerCase()} más: ${nodo.secundario}`
            : `Mostrar menos ${this.aspecto[nodo.tipo].plural.toLowerCase()}`,
        );
        continue;
      }
      const partes = [
        `${this.aspecto[nodo.tipo].singular}: ${nodo.principal}`,
        nodo.secundario,
        nodo.estado,
        // La fecha propia del registro: la columna puede ser la de la atención
        // y no la suya, y quien escucha no ve la tarjeta.
        nodo.cuando === null
          ? ''
          : `fecha ${nodo.cuando.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      ];
      for (const arista of aristas) {
        if (arista.hasta === nodo.id) {
          const origen = porId.get(arista.desde);
          if (origen !== undefined) {
            partes.push(
              arista.motivo === 'atencion'
                ? `registrado en la atención ${origen.principal}`
                : `indicado para ${origen.principal}`,
            );
          }
        }
        if (arista.desde === nodo.id && arista.motivo === 'indicacion') {
          const destino = porId.get(arista.hasta);
          if (destino !== undefined) {
            partes.push(`tratado con ${destino.principal}`);
          }
        }
      }
      nombres.set(nodo.id, partes.filter((parte) => parte !== '').join('. '));
    }
    return nombres;
  });

  /** El ícono del tipo. Método y no índice: en la plantilla del nodo el contexto llega sin tipo. */
  protected iconoDe(tipo: TipoDelRecorrido): NavIconName {
    return this.aspecto[tipo].icono;
  }

  protected tonoDe(tipo: TipoDelRecorrido): string {
    return this.aspecto[tipo].tono;
  }
}
