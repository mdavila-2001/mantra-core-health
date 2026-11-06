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
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { conectadosA, describirIntervalo } from './recorrido-clinico.model';
import {
  agruparEnEpisodios,
  ASPECTO_DE_LA_CLASE,
  NOMBRE_DEL_MOTIVO,
  relacionesDe,
  type ClaseDeLaRed,
  type EpisodioClinico,
  type MotivoDelVinculo,
  type RegistroDeLaRed,
  type VinculoDeLaRed,
} from './red-clinica.model';
import {
  DISTANCIA_DEL_TRONCO,
  MEDIDAS_DE_LA_RED,
  ubicarRed,
  type ColumnaDeLaRed,
  type HiloDeLaRed,
  type NodoDeLaRed,
} from './red-clinica.geometria';

/**
 * El nodo elegido, para quien quiera mostrar su detalle (el panel lateral de
 * la Franja 3). El `id` es el del registro real.
 */
export interface NodoElegido {
  readonly id: string;
  readonly clase: ClaseDeLaRed;
  readonly episodio: string;
}

/** Los vínculos que tiene la leyenda, en el orden en que se explican. */
const ORDEN_DE_LA_LEYENDA: readonly MotivoDelVinculo[] = [
  'registrado-en',
  'derivado-desde',
  'indicado-para',
  'pedido-para',
  'resultado-de',
  'plan-para',
  'evidencia',
  'reemplazado-por',
  'receta-reemplazada',
  'reconsulta-de',
  'recibido-en',
  'durante-internacion',
  'inferido-misma-atencion',
  'inferido-mismo-dia',
];

/**
 * **Recorrido clínico** — la historia de una persona como una red de
 * episodios.
 *
 * ## Qué responde
 *
 * «¿Qué le pasó, problema por problema, y en qué orden?». Cada hilo es un
 * episodio clínico —un problema y todo lo que se hizo por él: atenciones,
 * estudios, recetas, derivaciones, reconsultas—, y el tiempo corre de
 * izquierda a derecha, alineado entre hilos. La regla de agrupación está en
 * `red-clinica.model.ts` y en `docs/adr/ADR-0021-red-clinica-por-episodios.md`.
 *
 * ## Divulgación progresiva
 *
 * 1. Plegado, cada episodio es una franja-resumen: nombre, estado, fechas,
 *    conteos y los hitos clave sobre el eje.
 * 2. Desplegado, sus registros en el tiempo, con los vínculos del contrato.
 * 3. El detalle (observaciones, notas, planes, documentos) agrupado tras un
 *    «+N» por momento; los diagnósticos descartados, plegados en un marcador.
 *
 * ## Puntos de extensión
 *
 * - `elegido` emite el nodo que se eligió, con el id del registro real.
 * - `resaltados`: ids de registros a resaltar (alertas). Vacío, sin efecto.
 * - `visibles`: ids de registros a dibujar (filtro). Vacío, sin efecto.
 *
 * ## Accesibilidad
 *
 * Cada episodio es un botón con `aria-expanded` cuyo nombre resume el
 * episodio, seguido de sus registros en orden cronológico. Las líneas son
 * decorativas: lo que dicen está en el nombre de cada nodo, y un vínculo
 * inferido lo dice con esa palabra.
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

  readonly registros = input.required<readonly RegistroDeLaRed[]>();
  readonly vinculos = input.required<readonly VinculoDeLaRed[]>();
  /** Ids de registros a resaltar. Vacío: ninguno. */
  readonly resaltados = input<readonly string[]>([]);
  /** Ids de registros a dibujar. Vacío: todos. */
  readonly visibles = input<readonly string[]>([]);
  /** El registro cuyo detalle está abierto (en el panel): se marca en la red. */
  readonly seleccionado = input<string | null>(null);

  /** Se pidió el detalle de un registro (el que ya abre el expediente). */
  readonly abrir = output<string>();
  /** Se eligió un nodo: para el panel de detalle. */
  readonly elegido = output<NodoElegido>();

  protected readonly medidas = MEDIDAS_DE_LA_RED;
  protected readonly aspecto = ASPECTO_DE_LA_CLASE;
  protected readonly distanciaDelTronco = DISTANCIA_DEL_TRONCO;

  /** Los episodios desplegados. Arranca todo plegado: nivel 1. */
  protected readonly desplegados = signal<ReadonlySet<string>>(new Set());
  /** Descartados abiertos (por id) y grupos de detalle abiertos (por clave). */
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

  /** Los motivos que hay en pantalla, para la leyenda. */
  protected readonly leyenda = computed(() => {
    const presentes = new Set(this.plano().aristas.map((a) => a.motivo));
    return ORDEN_DE_LA_LEYENDA.filter((m) => presentes.has(m)).map((motivo) => ({
      motivo,
      nombre: NOMBRE_DEL_MOTIVO[motivo],
      familia: motivo.startsWith('inferido-') ? 'inferido' : motivo === 'registrado-en' || motivo === 'derivado-desde' ? 'tronco' : 'enlace',
    }));
  });

  /*
   * El nodo bajo el puntero y el que tiene el foco, por separado: sacar el
   * puntero no apaga el camino del que sigue enfocado con el teclado.
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

  /** Pantalla angosta (`--bp-sm`, 650 px): la red se lee en vertical. */
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

    // Lo más reciente es lo que se viene a mirar: el lienzo abre por el final,
    // cada vez que se CREA un lienzo, y no cuando se despliega un episodio.
    effect(() => {
      const lienzo = this.lienzo()?.nativeElement;
      if (lienzo === undefined) {
        return;
      }
      untracked(() => afterNextRender(() => this.fijarAlFinal(lienzo), { injector: this.injector }));
    });
    this.destroyRef.onDestroy(() => this.soltarLienzo?.());
  }

  private soltarLienzo: (() => void) | null = null;

  /**
   * Si el lienzo sigue pegado al final. Lo suelta quien se desplaza, y
   * también desplegar un episodio: el lienzo va a sus registros.
   */
  private pegadoAlFinal = true;

  /**
   * Abre por el final y se queda ahí mientras quien mira no se mueva: después
   * del primer render el lienzo todavía cambia de ancho (barra de
   * desplazamiento, fuentes), y la última columna quedaba cortada.
   */
  private fijarAlFinal(lienzo: HTMLElement): void {
    this.soltarLienzo?.();
    this.soltarLienzo = null;
    if (typeof ResizeObserver !== 'function') {
      this.irA('final', false);
      return;
    }
    this.pegadoAlFinal = true;
    let propio = lienzo.scrollLeft;
    const pegar = (): void => {
      this.irA('final', false);
      propio = lienzo.scrollLeft;
    };
    const observador = new ResizeObserver(() => {
      if (this.pegadoAlFinal) {
        pegar();
      }
    });
    observador.observe(lienzo);
    if (lienzo.firstElementChild !== null) {
      observador.observe(lienzo.firstElementChild);
    }
    const alDesplazar = (): void => {
      if (Math.abs(lienzo.scrollLeft - propio) <= 1) {
        return;
      }
      if (lienzo.scrollLeft < lienzo.scrollWidth - lienzo.clientWidth - 2) {
        this.pegadoAlFinal = false;
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
      const reducir =
        typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      lienzo.scrollTo({ left: destino, behavior: suave && !reducir ? 'smooth' : 'auto' });
    } else {
      lienzo.scrollLeft = destino;
    }
  }

  /* -- Plegar y desplegar ------------------------------------------------- */

  protected alternarEpisodio(id: string): void {
    const desplegar = !this.desplegados().has(id);
    this.desplegados.update((actual) => {
      const siguiente = new Set(actual);
      if (desplegar) {
        siguiente.add(id);
      } else {
        siguiente.delete(id);
      }
      return siguiente;
    });
    if (desplegar) {
      // Desplegado, el episodio puede tener sus registros a la izquierda de lo
      // que se ve (empezó hace un año): el lienzo va a su primer momento, para
      // no mostrar un hilo abierto y vacío.
      this.pegadoAlFinal = false;
      afterNextRender(() => this.irAlEpisodio(id), { injector: this.injector });
    }
  }

  private irAlEpisodio(id: string): void {
    const lienzo = this.lienzo()?.nativeElement;
    const xs = this.plano()
      .nodos.filter((n) => n.episodio === id)
      .map((n) => n.x);
    if (lienzo === undefined || xs.length === 0 || typeof lienzo.scrollTo !== 'function') {
      return;
    }
    const primero = Math.min(...xs) - 2 * this.distanciaDelTronco;
    const ultimo = Math.max(...xs) + this.medidas.anchoAncha;
    // Si ya se ve entero, no se mueve: un salto sin motivo desorienta.
    if (primero >= lienzo.scrollLeft && ultimo <= lienzo.scrollLeft + lienzo.clientWidth) {
      return;
    }
    const reducir =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    lienzo.scrollTo({ left: Math.max(0, primero), behavior: reducir ? 'auto' : 'smooth' });
  }

  protected desplegarTodo(): void {
    this.desplegados.set(new Set(this.plano().hilos.map((h) => h.episodio.id)));
  }

  protected plegarTodo(): void {
    this.desplegados.set(new Set());
    this.bajoElPuntero.set(null);
  }

  private alternarAbierto(clave: string, abrir: boolean): void {
    this.abiertos.update((actual) => {
      const siguiente = new Set(actual);
      if (abrir) {
        siguiente.add(clave);
      } else {
        siguiente.delete(clave);
      }
      return siguiente;
    });
  }

  /** Un registro abre su detalle; los controles abren o cierran lo suyo. */
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

  /* -- Ir a un registro (desde el panel o una alerta) ---------------------- */

  /**
   * Lleva la red a un registro: despliega su episodio, abre el descartado o el
   * «+N» que lo esconde, lo trae a la vista y lo marca enfocado (`foco`: también
   * el del teclado, al cerrar el panel). `false` si no está o se filtró.
   */
  irANodo(id: string, opciones: { readonly foco?: boolean } = {}): boolean {
    const [registro, episodio, visibles] = [this.porId().get(id), this.red().episodioDe.get(id), this.conjuntoVisible()];
    if (registro === undefined || episodio === undefined || (visibles.size > 0 && !visibles.has(id))) return false;
    if (!this.desplegados().has(episodio)) this.desplegados.update((actual) => new Set([...actual, episodio]));
    if (registro.clase === 'diagnostico' && registro.certeza === 'descartado') this.alternarAbierto(id, true);
    const grupo = this.plano().nodos.find((n) => n.grupo?.accion === 'expandir' && n.grupo.ocultos.some((r) => r.id === id));
    if (grupo?.grupo !== undefined) this.alternarAbierto(grupo.grupo.clave, true);
    this.pegadoAlFinal = false;
    this.conElFoco.set(id);
    afterNextRender(
      () => {
        const nodos = this.anfitrion.nativeElement.querySelectorAll<HTMLElement>('[data-testid="recorrido-nodo"]');
        const boton = Array.from(nodos).find((b) => b.dataset['id'] === id);
        const reducir = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        boton?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: reducir ? 'auto' : 'smooth' });
        if (opciones.foco === true) boton?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
    return true;
  }

  /* -- Camino iluminado ---------------------------------------------------- */

  /** Sólo los registros iluminan camino: un control no es un registro. */
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

  /* -- Textos -------------------------------------------------------------- */

  /** Los conteos del resumen, en palabras cortas. */
  protected conteosDe(episodio: EpisodioClinico): readonly string[] {
    const orden: readonly [ClaseDeLaRed, string, string][] = [
      ['atencion', 'atención', 'atenciones'],
      ['cita', 'cita', 'citas'],
      ['estudio', 'estudio', 'estudios'],
      ['medicacion', 'receta', 'recetas'],
      ['derivacion', 'derivación', 'derivaciones'],
      ['internacion', 'internación', 'internaciones'],
      ['procedimiento', 'procedimiento', 'procedimientos'],
    ];
    return orden
      .filter(([clase]) => (episodio.conteos[clase] ?? 0) > 0)
      .map(([clase, uno, varios]) => {
        const n = episodio.conteos[clase] ?? 0;
        return `${n} ${n === 1 ? uno : varios}`;
      });
  }

  /** El nombre accesible del botón de un episodio: el resumen entero. */
  protected nombreDelEpisodio(hilo: HiloDeLaRed): string {
    const e = hilo.episodio;
    const fecha = (f: Date | null): string =>
      f === null ? '' : f.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    const rango = e.desde === null ? '' : e.hasta === null || e.hasta.getTime() === e.desde.getTime() ? `el ${fecha(e.desde)}` : `del ${fecha(e.desde)} al ${fecha(e.hasta)}`;
    const partes = [
      `Episodio: ${e.nombre}`,
      e.estado,
      rango,
      this.conteosDe(e).join(', '),
      e.descartados > 0 ? `${e.descartados} diagnóstico${e.descartados === 1 ? '' : 's'} descartado${e.descartados === 1 ? '' : 's'}` : '',
      e.compartidos.length > 0 ? `${e.compartidos.length} registro${e.compartidos.length === 1 ? '' : 's'} compartido${e.compartidos.length === 1 ? '' : 's'} con otro episodio` : '',
    ];
    return partes.filter((p) => p !== '').join('. ');
  }

  /** Los otros episodios a los que pertenece un registro dibujado acá. */
  protected compartidoCon(nodo: NodoDeLaRed): readonly string[] {
    if (nodo.registro === undefined) return [];
    const episodios = this.episodioPorId();
    return (this.red().pertenencias.get(nodo.registro.id) ?? [])
      .slice(1)
      .map((id) => episodios.get(id)?.nombre ?? '')
      .filter((n) => n !== '');
  }

  /** Las relaciones del nodo en palabras: lo que en vertical reemplaza a las líneas. */
  protected readonly relaciones = computed(() => {
    const porId = this.porId();
    const vinculos = this.vinculos();
    const mapa = new Map<string, readonly string[]>();
    for (const r of this.registros()) {
      mapa.set(r.id, relacionesDe(r.id, vinculos, porId));
    }
    return mapa;
  });

  /** El nombre accesible de cada nodo: clase, registro, estado, fecha y vínculos. */
  protected readonly nombres = computed(() => {
    const nombres = new Map<string, string>();
    const relaciones = this.relaciones();
    for (const nodo of this.plano().nodos) {
      if (nodo.forma === 'grupo' && nodo.grupo !== undefined) {
        nombres.set(
          nodo.id,
          nodo.grupo.accion === 'expandir'
            ? `Mostrar ${nodo.grupo.ocultos.length} registros de detalle: ${nodo.grupo.ocultos.map((r) => r.titulo).join(', ')}`
            : 'Agrupar el detalle',
        );
        continue;
      }
      const r = nodo.registro!;
      if (nodo.forma === 'descartado') {
        nombres.set(nodo.id, `Diagnóstico descartado: ${r.titulo}. Mostrar`);
        continue;
      }
      if (nodo.forma === 'plegar') {
        nombres.set(nodo.id, `Ocultar el diagnóstico descartado ${r.titulo}`);
        continue;
      }
      const otros = this.compartidoCon(nodo);
      const partes = [
        `${this.aspecto[r.clase].singular}: ${r.titulo}`,
        r.detalle,
        r.estado,
        r.cuando === null
          ? ''
          : `fecha ${r.cuando.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        ...(relaciones.get(r.id) ?? []),
        otros.length > 0 ? `también en el episodio ${otros.join(' y ')}` : '',
        this.resaltado(r.id) ? 'resaltado' : '',
      ];
      nombres.set(nodo.id, partes.filter((p) => p !== '').join('. '));
    }
    return nombres;
  });

  /** Qué es la columna, en palabras: cabecera visible. */
  protected contextoDe(columna: ColumnaDeLaRed): string {
    return columna.contexto === 'atencion' ? 'Atención' : columna.contexto === 'dia' ? 'Registros del día' : 'Sin atención';
  }

  /** La fecha propia del registro cuando no es la de su columna. */
  protected fechaPropia(
    nodo: NodoDeLaRed,
    columna: ColumnaDeLaRed | undefined,
  ): { readonly rotulo: string; readonly fecha: Date; readonly formato: string } | null {
    const r = nodo.registro;
    if (nodo.forma !== 'tarjeta' || r === undefined || r.cuando === null || columna === undefined || columna.fecha === null) {
      return null;
    }
    if (r.cuando.toDateString() === columna.fecha.toDateString()) {
      return null;
    }
    const rotulo = r.clase === 'diagnostico' ? 'Inicio' : r.clase === 'medicacion' ? 'Desde' : 'Del';
    const dias = Math.abs(r.cuando.getTime() - columna.fecha.getTime()) / 86_400_000;
    const formato = this.angosto()
      ? 'd MMM y'
      : r.cuando.getFullYear() === columna.fecha.getFullYear()
        ? 'd MMM'
        : dias < 90
          ? 'd MMM y'
          : 'MMM y';
    return { rotulo, fecha: r.cuando, formato };
  }

  protected iconoDe(clase: ClaseDeLaRed): NavIconName {
    return this.aspecto[clase].icono;
  }

  protected tonoDe(nodo: NodoDeLaRed): string {
    if (nodo.forma === 'grupo') {
      return 'neutral';
    }
    return this.aspecto[nodo.registro!.clase].tono;
  }

  /* -- La versión vertical ---------------------------------------------- */

  /**
   * Los momentos de un episodio desplegado, lo más reciente primero, con sus
   * nodos: el mismo plano que el lienzo, leído de otra manera.
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

  protected intervaloDelEpisodio(e: EpisodioClinico): string {
    return e.desde === null || e.hasta === null ? '' : describirIntervalo(e.desde, e.hasta);
  }

  protected nodosDelHilo(hilo: HiloDeLaRed): readonly NodoDeLaRed[] {
    return this.plano()
      .nodos.filter((n) => n.episodio === hilo.episodio.id)
      .sort((a, b) => a.columna - b.columna || a.y - b.y);
  }

  protected titulosDe(registros: readonly RegistroDeLaRed[]): string {
    return registros.map((r) => r.titulo).join(', ');
  }

  protected tituloDelHito(titulos: readonly string[]): string {
    return titulos.join(' · ');
  }
}
