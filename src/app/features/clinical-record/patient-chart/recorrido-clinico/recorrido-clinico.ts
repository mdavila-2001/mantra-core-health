import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import {
  ASPECTO_DEL_TIPO,
  conectadosA,
  MEDIDAS,
  ubicarRecorrido,
  type AristaDelRecorrido,
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
  imports: [AppButton, DatePipe, NavIcon],
  templateUrl: './recorrido-clinico.html',
  styleUrl: './recorrido-clinico.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecorridoClinico {
  private readonly injector = inject(Injector);

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

  constructor() {
    // Lo más reciente es lo que se viene a mirar: el recorrido abre por el
    // final. Sólo la primera vez que hay plano, para no arrancarle el
    // desplazamiento a quien ya se movió.
    let ubicado = false;
    effect(() => {
      const columnas = this.plano().columnas.length;
      if (ubicado || columnas === 0) {
        return;
      }
      ubicado = true;
      untracked(() =>
        afterNextRender(() => this.irA('final'), { injector: this.injector }),
      );
    });
  }

  protected irA(extremo: 'inicio' | 'final'): void {
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
      lienzo.scrollTo({ left: destino, behavior: reducir ? 'auto' : 'smooth' });
    } else {
      lienzo.scrollLeft = destino;
    }
  }

  protected apuntar(id: string | null): void {
    this.bajoElPuntero.set(id);
  }

  protected enfocar(id: string | null): void {
    this.conElFoco.set(id);
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

  protected tonoDe(tipo: TipoDelRecorrido): string {
    return this.aspecto[tipo].tono;
  }
}
