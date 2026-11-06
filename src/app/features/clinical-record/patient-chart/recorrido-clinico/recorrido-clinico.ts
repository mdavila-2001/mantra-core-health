import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
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
import { DatePipe, NgTemplateOutlet } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { conectadosA } from './recorrido-clinico.model';
import { ASPECTO_DE_LA_CLASE, type ClaseDeLaRed, type RegistroDeLaRed, type VinculoDeLaRed } from './red-clinica.model';
import { agruparEnEpisodios } from './red-clinica.episodios';
import { type EpisodioClinico } from './red-clinica.episodio';
import { relacionesDe } from './red-clinica.vinculos';
import { ubicarRed } from './red-clinica.geometria';
import {
  DISTANCIA_DEL_TRONCO,
  MEDIDAS_DE_LA_RED,
  type ColumnaDeLaRed,
  type HiloDeLaRed,
  type NodoDeLaRed,
} from './red-clinica.geometria.types';
import { contextoDe, fechaPropia, nombresDeLosNodos, type FechaPropia } from './recorrido-clinico.textos';
import { DesplazamientoDelLienzo, reducirMovimiento } from './desplazamiento-del-lienzo';
import { RedNodo } from './nodo/red-nodo';
import { RedCabecera } from './cabecera/red-cabecera';
import { RedLeyenda } from './leyenda/red-leyenda';

/**
 * The chosen node, for whoever wants to show its detail (the Strip 3 side
 * panel). The `id` is the real record's id.
 */
export interface NodoElegido {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly episodio: string;
}

/** What `plegado()` saves and `restaurarPlegado()` puts back. */
export interface PlegadoDeLaRed {
  readonly desplegados: ReadonlySet<string>;
  readonly abiertos: ReadonlySet<string>;
  readonly desplazamiento: number | null;
}

/**
 * **Clinical tour** — a person's history as a network of episodes.
 *
 * ## What it answers
 *
 * «What happened to them, problem by problem, and in what order?». Each
 * thread is a clinical episode —a problem and everything done for it:
 * encounters, studies, prescriptions, referrals, follow-ups—, and time runs
 * left to right, aligned across threads. The grouping rule is in
 * `red-clinica.model.ts` and `docs/adr/ADR-0021-red-clinica-por-episodios.md`.
 *
 * ## Progressive disclosure
 *
 * 1. Collapsed, each episode is a summary strip: name, status, dates, counts
 *    and the key milestones on the axis.
 * 2. Expanded, its records over time, with the contract's links.
 * 3. The detail (observations, notes, plans, documents) grouped behind a «+N»
 *    per moment; ruled-out diagnoses, folded into a marker.
 *
 * ## Extension points
 *
 * - `elegido` emits the chosen node, with the real record's id.
 * - `resaltados`: ids of records to highlight (alerts). Empty, no effect.
 * - `visibles`: ids of records to draw (filter). Empty, no effect.
 *
 * ## Accessibility
 *
 * Each episode is a button with `aria-expanded` whose name summarises the
 * episode, followed by its records in chronological order. The lines are
 * decorative: what they say is in each node's name, and an inferred link says
 * so with that word.
 */
@Component({
  selector: 'app-recorrido-clinico',
  imports: [AppButton, DatePipe, NavIcon, NgTemplateOutlet, RedCabecera, RedLeyenda, RedNodo],
  templateUrl: './recorrido-clinico.html',
  styleUrls: ['./red-clinica-tonos.css', './recorrido-clinico.css', './red-clinica-trazos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecorridoClinico {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  readonly registros = input.required<readonly RegistroDeLaRed[]>();
  readonly vinculos = input.required<readonly VinculoDeLaRed[]>();
  /** Ids of records to highlight. Empty: none. */
  readonly resaltados = input<readonly string[]>([]);
  /** Ids of records to draw. Empty: all. */
  readonly visibles = input<readonly string[]>([]);
  /** The record whose detail is open (in the panel): it is marked on the network. */
  readonly seleccionado = input<string | null>(null);

  /** A record's detail was requested (the one the chart already opens). */
  readonly abrir = output<string>();
  /** A node was chosen: for the detail panel. */
  readonly elegido = output<NodoElegido>();

  protected readonly medidas = MEDIDAS_DE_LA_RED;
  protected readonly distanciaDelTronco = DISTANCIA_DEL_TRONCO;
  protected readonly contextoDe = contextoDe;

  /** The expanded episodes. Everything starts collapsed: level 1. */
  protected readonly desplegados = signal<ReadonlySet<string>>(new Set());
  /** Open ruled-out diagnoses (by id) and open detail groups (by key). */
  protected readonly abiertos = signal<ReadonlySet<string>>(new Set());

  protected readonly red = computed(() => agruparEnEpisodios(this.registros(), this.vinculos()));

  private readonly conjuntoVisible = computed(() => new Set(this.visibles()));
  private readonly conjuntoResaltado = computed(() => new Set(this.resaltados()));

  protected readonly plano = computed(() =>
    ubicarRed(this.registros(), this.vinculos(), this.red(), {
      desplegados: this.desplegados(),
      abiertos: this.abiertos(),
      visibles: this.conjuntoVisible(),
    }),
  );

  private readonly porId = computed(() => new Map(this.registros().map((r) => [r.id, r])));
  private readonly episodioPorId = computed(() => new Map(this.red().episodios.map((e) => [e.id, e])));

  protected readonly todoDesplegado = computed(() =>
    this.plano().hilos.every((h) => h.desplegado),
  );
  protected readonly nadaDesplegado = computed(() => this.plano().hilos.every((h) => !h.desplegado));

  /*
   * The node under the pointer and the focused one, apart: moving the pointer
   * away does not switch off the path of the one still focused by keyboard.
   */
  private readonly bajoElPuntero = signal<string | null>(null);
  private readonly conElFoco = signal<string | null>(null);
  protected readonly enfocado = computed(() => this.bajoElPuntero() ?? this.conElFoco());

  protected readonly camino = computed(() => {
    const id = this.enfocado();
    return id === null ? null : conectadosA(id, this.plano().aristas);
  });

  private readonly lienzo = viewChild<ElementRef<HTMLElement>>('lienzo');
  private readonly anfitrion = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly desplazamiento = new DesplazamientoDelLienzo(() => this.lienzo()?.nativeElement);

  /** Narrow screen (`--bp-sm`, 650 px): the network reads vertically. */
  protected readonly angosto = signal(false);

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

    // The most recent is what people come to see: the canvas opens at the end
    // every time a canvas is CREATED, and not when an episode is expanded.
    effect(() => {
      const lienzo = this.lienzo()?.nativeElement;
      if (lienzo === undefined) {
        return;
      }
      untracked(() => afterNextRender(() => this.desplazamiento.fijarAlFinal(lienzo), { injector: this.injector }));
    });
    this.destroyRef.onDestroy(() => this.desplazamiento.soltar());
  }

  protected irA(extremo: 'inicio' | 'final'): void {
    this.desplazamiento.irA(extremo);
  }

  /* -- Fold and unfold ----------------------------------------------------- */

  protected alternarEpisodio(id: string): void {
    const desplegar = !this.desplegados().has(id);
    this.desplegados.update((actual) => (desplegar ? new Set([...actual, id]) : new Set([...actual].filter((e) => e !== id))));
    if (desplegar) {
      // Expanded, the episode may have its records left of what is in view (it
      // started a year ago): the canvas goes to its first moment, so as not to
      // show an open, empty thread.
      this.desplazamiento.pegadoAlFinal = false;
      afterNextRender(() => this.irAlEpisodio(id), { injector: this.injector });
    }
  }

  private irAlEpisodio(id: string): void {
    const xs = this.plano()
      .nodos.filter((n) => n.episodio === id)
      .map((n) => n.x);
    if (xs.length > 0) {
      this.desplazamiento.mostrarTramo(Math.min(...xs) - 2 * this.distanciaDelTronco, Math.max(...xs) + this.medidas.anchoAncha);
    }
  }

  protected desplegarTodo(): void {
    this.desplegados.set(new Set(this.plano().hilos.map((h) => h.episodio.id)));
  }

  protected plegarTodo(): void {
    this.desplegados.set(new Set());
    this.bajoElPuntero.set(null);
  }

  private alternarAbierto(clave: string, abrir: boolean): void {
    this.abiertos.update((actual) => (abrir ? new Set([...actual, clave]) : new Set([...actual].filter((c) => c !== clave))));
  }

  /** What is expanded and open, and where the canvas is: to come back there (on leaving the guided tour). */
  plegado(): PlegadoDeLaRed {
    return { desplegados: this.desplegados(), abiertos: this.abiertos(), desplazamiento: this.lienzo()?.nativeElement.scrollLeft ?? null };
  }

  restaurarPlegado(previo: PlegadoDeLaRed): void {
    this.desplegados.set(previo.desplegados);
    this.abiertos.set(previo.abiertos);
    this.bajoElPuntero.set(null);
    this.conElFoco.set(null);
    this.desplazamiento.pegadoAlFinal = false;
    const izquierda = previo.desplazamiento;
    if (izquierda !== null) afterNextRender(() => this.lienzo()?.nativeElement.scrollTo?.({ left: izquierda }), { injector: this.injector });
  }

  /** A record opens its detail; the controls open or close their own. */
  protected activar(nodo: NodoDeLaRed): void {
    if (nodo.forma === 'grupo' && nodo.grupo !== undefined) {
      this.alternarAbierto(nodo.grupo.clave, nodo.grupo.accion === 'expandir');
      this.bajoElPuntero.set(null);
      return;
    }
    if (nodo.forma === 'descartado' && nodo.registro !== undefined) {
      this.alternarAbierto(nodo.registro.id, true);
      return;
    }
    if (nodo.forma === 'plegar' && nodo.registro !== undefined) {
      this.alternarAbierto(nodo.registro.id, false);
      this.bajoElPuntero.set(null);
      return;
    }
    if (nodo.registro !== undefined) {
      this.abrir.emit(nodo.registro.id);
      this.elegido.emit({ id: nodo.registro.id, clase: nodo.registro.clase, episodio: nodo.episodio });
    }
  }

  /* -- Go to a record (from the panel or an alert) -------------------------- */

  /**
   * Takes the network to a record: expands its episode, opens the ruled-out
   * marker or the «+N» hiding it, brings it into view and marks it focused
   * (`foco`: also the keyboard focus, on closing the panel). `false` if it is
   * not there or was filtered out.
   */
  irANodo(id: string, opciones: { readonly foco?: boolean } = {}): boolean {
    const [registro, episodio, visibles] = [this.porId().get(id), this.red().episodioDe.get(id), this.conjuntoVisible()];
    if (registro === undefined || episodio === undefined || (visibles.size > 0 && !visibles.has(id))) return false;
    if (!this.desplegados().has(episodio)) this.desplegados.update((actual) => new Set([...actual, episodio]));
    if (registro.clase === 'diagnostico' && registro.certeza === 'descartado') this.alternarAbierto(id, true);
    const grupo = this.plano().nodos.find((n) => n.grupo?.accion === 'expandir' && n.grupo.ocultos.some((r) => r.id === id));
    if (grupo?.grupo !== undefined) this.alternarAbierto(grupo.grupo.clave, true);
    this.desplazamiento.pegadoAlFinal = false;
    this.conElFoco.set(id);
    afterNextRender(
      () => {
        const nodos = this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('[data-testid="recorrido-nodo"]');
        const boton = Array.from(nodos).find((b) => b.dataset['id'] === id);
        boton?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reducirMovimiento() ? 'auto' : 'smooth' });
        if (opciones.foco === true) boton?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
    return true;
  }

  /* -- Lit path ------------------------------------------------------------- */

  /** Only records light up a path: a control is not a record. */
  protected apuntar(nodo: NodoDeLaRed | null): void {
    this.bajoElPuntero.set(nodo === null || nodo.forma === 'grupo' || nodo.forma === 'plegar' ? null : nodo.id);
  }

  protected enfocar(nodo: NodoDeLaRed | null): void {
    this.conElFoco.set(nodo === null || nodo.forma === 'grupo' || nodo.forma === 'plegar' ? null : nodo.id);
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

  protected resaltado(id: string): boolean {
    return this.conjuntoResaltado().has(id);
  }

  protected hiloResaltado(episodio: EpisodioClinico): boolean {
    const resaltados = this.conjuntoResaltado();
    return resaltados.size > 0 && [...episodio.miembros, ...episodio.compartidos].some((id) => resaltados.has(id));
  }

  /* -- Texts ---------------------------------------------------------------- */

  /** The other episodes a record drawn here belongs to. */
  protected compartidoCon(nodo: NodoDeLaRed): readonly string[] {
    if (nodo.registro === undefined) return [];
    const episodios = this.episodioPorId();
    return (this.red().pertenencias.get(nodo.registro.id) ?? [])
      .slice(1)
      .map((id) => episodios.get(id)?.nombre ?? '')
      .filter((n) => n !== '');
  }

  /** The node's relations in words: what replaces the lines in the vertical layout. */
  protected readonly relaciones = computed(() => {
    const porId = this.porId();
    const vinculos = this.vinculos();
    const mapa = new Map<string, readonly string[]>();
    for (const r of this.registros()) {
      mapa.set(r.id, relacionesDe(r.id, vinculos, porId));
    }
    return mapa;
  });

  protected readonly nombres = computed(() =>
    nombresDeLosNodos(this.plano(), this.relaciones(), (nodo) => this.compartidoCon(nodo), (id) => this.resaltado(id)),
  );

  protected fechaPropia(nodo: NodoDeLaRed, columna: ColumnaDeLaRed | undefined): FechaPropia | null {
    return fechaPropia(nodo, columna, this.angosto());
  }

  protected tonoDe(nodo: NodoDeLaRed): string {
    return nodo.forma === 'grupo' ? 'neutral' : ASPECTO_DE_LA_CLASE[nodo.registro!.clase].tono;
  }

  /* -- The vertical layout -------------------------------------------------- */

  /**
   * The moments of an expanded episode, most recent first, with their nodes:
   * the same plane as the canvas, read another way.
   */
  protected momentosDe(hilo: HiloDeLaRed): readonly { readonly columna: ColumnaDeLaRed; readonly nodos: readonly NodoDeLaRed[] }[] {
    const plano = this.plano();
    const porColumna = new Map<number, NodoDeLaRed[]>();
    for (const n of plano.nodos) {
      if (n.episodio === hilo.episodio.id) {
        porColumna.set(n.columna, [...(porColumna.get(n.columna) ?? []), n]);
      }
    }
    return [...porColumna.entries()]
      .sort(([a], [b]) => b - a)
      .map(([c, nodos]) => ({ columna: plano.columnas[c], nodos: [...nodos].sort((a, b) => a.y - b.y) }));
  }

  protected nodosDelHilo(hilo: HiloDeLaRed): readonly NodoDeLaRed[] {
    return this.plano()
      .nodos.filter((n) => n.episodio === hilo.episodio.id)
      .sort((a, b) => a.columna - b.columna || a.y - b.y);
  }

  protected tituloDelHito(titulos: readonly string[]): string {
    return titulos.join(' · ');
  }
}
